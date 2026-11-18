import "server-only";
import { unstable_cache } from "next/cache";
import {
  CACHE_TAG,
  REVALIDATE_SECONDS,
  getConfig,
  type StatbotConfig,
} from "./config";
import { ENDPOINTS, type EndpointId } from "./endpoints";

export type RateLimit = {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
};

type Common = {
  url: string | null;
  rateLimit: RateLimit | null;
  /** Optional parameters this endpoint rejected, which were left out to get an answer. */
  dropped: string[];
  /**
   * True for failures that should clear up by themselves: rate limit, timeout,
   * Statbot down. Pages use it to keep serving the last good version (see result.ts).
   */
  transient: boolean;
};

export type StatbotResult<T = unknown> =
  | ({ ok: true; data: T; status: number } & Common)
  | ({ ok: false; error: string; status: number | null } & Common);

export type QueryValue = string | number | boolean | string[] | undefined;

export type FetchOptions = {
  query?: Record<string, QueryValue>;
  /** Skip the cache and call Statbot now (used by /explorer). */
  fresh?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Parameter fallback                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Statbot rejects any query parameter an endpoint doesn't support ("querystring must
 * NOT have additional properties"), and endpoints differ in what they support. So we
 * try the full set first and drop the optional ones step by step until Statbot
 * accepts the request. The step that worked is remembered per endpoint for the rest
 * of the process, and /explorer shows which parameters were dropped.
 */
const PARAM_STEPS: string[][] = [
  ["start", "end", "interval", "timezone_offset", "bot", "blacklist_channels"],
  ["start", "end", "interval", "timezone_offset", "bot"],
  ["start", "end", "interval", "timezone_offset"],
  ["start", "end", "interval"],
  ["start", "end"],
  [],
];
const STEPPED_KEYS = new Set(PARAM_STEPS[0]);
const workingStep = new Map<EndpointId, number>();

const isUnsupportedParams = (r: StatbotResult) =>
  !r.ok && r.status === 400 && /additional properties/i.test(r.error);

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Statbot doesn't publish its limit; it reports it on every response in
 * x-ratelimit-limit / x-ratelimit-remaining / x-ratelimit-reset (seconds), plus
 * retry-after (seconds) once the limit is hit. /explorer shows the live values.
 *
 * So instead of assuming a number, we read those headers:
 * - at most 2 requests in flight per server instance;
 * - when only RESERVE requests are left in the window, everything waits for the reset
 *   (the reserve leaves room for other Vercel instances sharing the same key);
 * - a 429 makes every request wait for retry-after, then try again;
 * - retries stop at a time budget, not a fixed count, so a long retry-after is
 *   honoured when there's time and fails quickly when there isn't.
 */
const MAX_CONCURRENT = 2;
const RESERVE = 1;
const REQUEST_TIMEOUT_MS = 15_000;

/** Builds have minutes to spare; a page being refreshed for a visitor doesn't. */
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
const BUDGET_MS = IS_BUILD ? 120_000 : 40_000;

let active = 0;
const waiting: Array<() => void> = [];
let blockedUntil = 0;

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    // The request that finishes hands its slot straight to us, so `active` stays put.
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    active++;
  }
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function blockFor(seconds: number) {
  const ms = Math.max(seconds, 1) * 1000 + 250;
  blockedUntil = Math.max(blockedUntil, Date.now() + ms);
}

function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readRateLimit(headers: Headers): RateLimit {
  return {
    limit: toNumber(headers.get("x-ratelimit-limit")),
    remaining: toNumber(headers.get("x-ratelimit-remaining")),
    reset: toNumber(headers.get("x-ratelimit-reset")),
  };
}

/** The most recent rate-limit headers this instance saw (shown in /explorer). */
let lastSeen: (RateLimit & { at: number }) | null = null;
export function lastRateLimit() {
  return lastSeen;
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

export function buildUrl(
  cfg: StatbotConfig,
  path: string,
  query?: Record<string, QueryValue>,
  scope: "guild" | "global" = "guild",
): string {
  const root =
    scope === "global"
      ? `${cfg.base}/v1`
      : `${cfg.base}/v1/guilds/${encodeURIComponent(cfg.guildId)}`;
  const url = new URL(`${root}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      // Statbot documents array parameters as `name[]`, e.g. stats[]=text&stats[]=voice
      for (const item of value) url.searchParams.append(`${key}[]`, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function failure<T>(
  url: string,
  error: string,
  status: number | null,
  rateLimit: RateLimit | null,
  transient: boolean,
): StatbotResult<T> {
  return { ok: false, error, status, url, rateLimit, dropped: [], transient };
}

/** One call to Statbot, waiting out the rate limit and retrying until the budget runs out. */
async function request<T>(
  url: string,
  key: string,
  deadline: number,
): Promise<StatbotResult<T>> {
  for (let attempt = 0; ; attempt++) {
    const wait = blockedUntil - Date.now();
    if (wait > 0) {
      if (Date.now() + wait > deadline) {
        return failure(
          url,
          `Statbot's rate limit is used up for the next ${Math.ceil(wait / 1000)}s. The last good data will be shown until it resets.`,
          429,
          lastSeen,
          true,
        );
      }
      await sleep(wait);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        // Caching happens one level up, in cachedCall(), so it can keep the last good copy.
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = (err as Error).name === "TimeoutError";
      if (attempt === 0 && Date.now() + 2000 < deadline) {
        await sleep(2000);
        continue;
      }
      return failure(
        url,
        timedOut
          ? "Statbot took too long to answer."
          : `Couldn't reach Statbot: ${(err as Error).message}`,
        null,
        null,
        true,
      );
    }

    const rateLimit = readRateLimit(res.headers);
    if (rateLimit.limit !== null || rateLimit.remaining !== null) {
      lastSeen = { ...rateLimit, at: Date.now() };
    }

    if (res.status === 429) {
      const retryAfter =
        toNumber(res.headers.get("retry-after")) ?? rateLimit.reset ?? 5;
      blockFor(retryAfter);
      if (Date.now() + retryAfter * 1000 < deadline) continue;
      return failure(
        url,
        `Statbot's rate limit was hit and it asked to wait ${retryAfter}s. The last good data will be shown until then.`,
        429,
        rateLimit,
        true,
      );
    }

    // Slow down before we hit the limit, not after.
    if (
      rateLimit.remaining !== null &&
      rateLimit.remaining <= RESERVE &&
      rateLimit.reset !== null
    ) {
      blockFor(rateLimit.reset);
    }

    if (res.status >= 500 && attempt === 0 && Date.now() + 2000 < deadline) {
      await sleep(2000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint =
        res.status === 401
          ? " Check STATBOT_API_KEY, and that every Statbot Premium upgrade is still active."
          : res.status === 404
            ? " The path may be wrong; check it in lib/statbot/endpoints.ts."
            : "";
      return failure(
        url,
        `Statbot returned ${res.status}.${hint}${body ? ` Response: ${body.slice(0, 200)}` : ""}`,
        res.status,
        rateLimit,
        res.status >= 500,
      );
    }

    try {
      const data = (await res.json()) as T;
      return {
        ok: true,
        data,
        status: res.status,
        url,
        rateLimit,
        dropped: [],
        transient: false,
      };
    } catch {
      return failure(
        url,
        "Statbot returned a response that isn't JSON.",
        res.status,
        rateLimit,
        false,
      );
    }
  }
}

/** Call Statbot directly, stepping down through PARAM_STEPS if parameters are rejected. */
async function live<T>(
  id: EndpointId,
  query: Record<string, QueryValue>,
): Promise<StatbotResult<T>> {
  const cfg = getConfig();
  const def = ENDPOINTS[id];
  const required: Record<string, QueryValue> =
    "required" in def ? def.required : {};
  const scope = "scope" in def ? def.scope : "guild";
  const deadline = Date.now() + BUDGET_MS;

  const fixed: Record<string, QueryValue> = { ...required };
  const stepped: Record<string, QueryValue> = {};
  for (const [k, v] of Object.entries(query)) {
    if (STEPPED_KEYS.has(k)) stepped[k] = v;
    else fixed[k] = v;
  }
  const offered = Object.keys(stepped).filter((k) => stepped[k] !== undefined);

  let lastUrl = "";
  let result: StatbotResult<T> | null = null;

  for (let step = workingStep.get(id) ?? 0; step < PARAM_STEPS.length; step++) {
    const allowed = new Set(PARAM_STEPS[step]);
    const sent: Record<string, QueryValue> = { ...fixed };
    for (const k of offered) if (allowed.has(k)) sent[k] = stepped[k];

    const url = buildUrl(cfg, def.path, sent, scope);
    if (url === lastUrl) continue; // this step drops nothing we were sending
    lastUrl = url;

    result = await withSlot(() => request<T>(url, cfg.key, deadline));
    result.dropped = offered.filter((k) => !allowed.has(k));

    if (!isUnsupportedParams(result)) {
      workingStep.set(id, step);
      return result;
    }
  }

  return result!;
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

/** Thrown inside the cache so a failed call is never stored over good data. */
class StatbotFailure extends Error {
  constructor(readonly result: StatbotResult<unknown>) {
    super(result.ok ? "ok" : result.error);
  }
}

/**
 * The cache key leaves out `start` and `end`, which move every hour, and keeps the
 * length of the window instead. That way:
 * - every page asking for the same data shares one entry (the overview and the
 *   Messages page both use the message series, so Statbot is asked once);
 * - when an entry goes stale, visitors get the stale copy at once while a fresh one
 *   is fetched in the background;
 * - if that background fetch fails (rate limit, Statbot down), it throws, nothing is
 *   stored, and the stale copy keeps being served until a later fetch succeeds.
 */
function cacheKey(id: EndpointId, query: Record<string, QueryValue>): string[] {
  const { start, end, ...rest } = query;
  const span =
    start !== undefined && end !== undefined
      ? String(Number(end) - Number(start))
      : "";
  const params = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${JSON.stringify(rest[k])}`)
    .join("&");
  return ["statbot", "v2", id, span, params];
}

async function cachedCall<T>(
  id: EndpointId,
  query: Record<string, QueryValue>,
): Promise<StatbotResult<T>> {
  const load = unstable_cache(
    async () => {
      const result = await live<T>(id, query);
      if (!result.ok) throw new StatbotFailure(result);
      return result;
    },
    cacheKey(id, query),
    { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] },
  );
  try {
    return await load();
  } catch (err) {
    if (err instanceof StatbotFailure) return err.result as StatbotResult<T>;
    return {
      ok: false,
      error: `Couldn't load Statbot data: ${(err as Error).message}`,
      status: null,
      url: null,
      rateLimit: null,
      dropped: [],
      transient: true,
    };
  }
}

/** Fetch one Statbot endpoint for the configured guild. Never throws. */
export async function statbot<T = unknown>(
  id: EndpointId,
  options: FetchOptions = {},
): Promise<StatbotResult<T>> {
  const cfg = getConfig();
  if (cfg.missing.length > 0) {
    return {
      ok: false,
      error: `Add ${cfg.missing.join(", ")} to the environment variables in Vercel (or .env.local).`,
      status: null,
      url: null,
      rateLimit: null,
      dropped: [],
      transient: false,
    };
  }
  const query = options.query ?? {};
  return options.fresh ? live<T>(id, query) : cachedCall<T>(id, query);
}

import "server-only";
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
};

export type StatbotResult<T = unknown> =
  | ({ ok: true; data: T; status: number } & Common)
  | ({ ok: false; error: string; status: number | null } & Common);

export type QueryValue = string | number | boolean | string[] | undefined;

export type FetchOptions = {
  query?: Record<string, QueryValue>;
  /** Skip the cache (used by /explorer). */
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

// Statbot allows about 10 requests per 10 seconds. We keep at most 2 in flight, and
// when Statbot says the window is used up we pause every request until it resets.
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 3;
const MAX_WAIT_SECONDS = 15;

let active = 0;
const waiting: Array<() => void> = [];
let blockedUntil = 0;

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForWindow() {
  const wait = blockedUntil - Date.now();
  if (wait > 0) await sleep(wait);
}

function blockFor(seconds: number) {
  const ms = Math.min(Math.max(seconds, 1), MAX_WAIT_SECONDS) * 1000 + 250;
  blockedUntil = Math.max(blockedUntil, Date.now() + ms);
}

function toNumber(value: string | null): number | null {
  if (value === null) return null;
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

/** Cached responses carry old rate-limit headers; only act on ones from a live request. */
function isLiveResponse(headers: Headers): boolean {
  const date = Date.parse(headers.get("date") ?? "");
  return Number.isNaN(date) || Date.now() - date < 15_000;
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

export function buildUrl(
  cfg: StatbotConfig,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const url = new URL(
    `${cfg.base}/v1/guilds/${encodeURIComponent(cfg.guildId)}${path}`,
  );
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

async function request<T>(
  url: string,
  key: string,
  fresh: boolean,
  attempt = 0,
): Promise<StatbotResult<T>> {
  await waitForWindow();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      ...(fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] } }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `Couldn't reach Statbot: ${(err as Error).message}`,
      status: null,
      url,
      rateLimit: null,
      dropped: [],
    };
  }

  const rateLimit = readRateLimit(res.headers);
  const live = isLiveResponse(res.headers);

  if (res.status === 429 && attempt < MAX_RETRIES) {
    blockFor(toNumber(res.headers.get("retry-after")) ?? rateLimit.reset ?? 2);
    return request<T>(url, key, fresh, attempt + 1);
  }

  if (live && rateLimit.remaining === 0 && rateLimit.reset !== null) {
    blockFor(rateLimit.reset);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401
        ? " Check STATBOT_API_KEY, and that every Statbot Premium upgrade is still active."
        : res.status === 404
          ? " The path may be wrong; check it in lib/statbot/endpoints.ts."
          : res.status === 429
            ? " Statbot's rate limit was still hit after retrying."
            : "";
    return {
      ok: false,
      error: `Statbot returned ${res.status}.${hint}${body ? ` Response: ${body.slice(0, 200)}` : ""}`,
      status: res.status,
      url,
      rateLimit,
      dropped: [],
    };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: true, data, status: res.status, url, rateLimit, dropped: [] };
  } catch {
    return {
      ok: false,
      error: "Statbot returned a response that isn't JSON.",
      status: res.status,
      url,
      rateLimit,
      dropped: [],
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
    };
  }

  const def = ENDPOINTS[id];
  const required: Record<string, QueryValue> =
    "required" in def ? def.required : {};
  const query = options.query ?? {};

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

    const url = buildUrl(cfg, def.path, sent);
    if (url === lastUrl) continue; // this step drops nothing we were sending
    lastUrl = url;

    result = await withSlot(() =>
      request<T>(url, cfg.key, options.fresh ?? false),
    );
    result.dropped = offered.filter((k) => !allowed.has(k));

    if (!isUnsupportedParams(result)) {
      workingStep.set(id, step);
      return result;
    }
  }

  return result!;
}

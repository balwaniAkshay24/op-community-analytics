import type { StatbotResult } from "./statbot/client";

/** Apply `fn` to a successful result; otherwise return the error message. */
export function read<T, R>(
  result: StatbotResult<T>,
  fn: (data: T) => R,
): { value: R | null; error: string | null } {
  if (!result.ok) return { value: null, error: result.error };
  try {
    return { value: fn(result.data), error: null };
  } catch (err) {
    return {
      value: null,
      error: `Couldn't read this response: ${(err as Error).message}`,
    };
  }
}

/**
 * Call after a page's Statbot fetches. If any failed for a reason that clears up by
 * itself (rate limit, timeout, Statbot down), throw: when Vercel is refreshing the page
 * in the background, a thrown error makes it keep serving the previous good version
 * and try again on a later visit, instead of caching a page full of error notices.
 *
 * During `next build` there is no previous version, so the page renders with notices
 * for the affected panels and refreshes on the next cycle.
 */
export function keepLastGoodPage(results: StatbotResult<unknown>[]): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // In `next dev` there's no previous version to keep; show the notices instead.
  if (process.env.NODE_ENV === "development") return;
  const failed = results.filter((r) => !r.ok && r.transient);
  if (failed.length === 0) return;
  throw new Error(
    `Statbot is unavailable for ${failed.length} request(s); keeping the previous version of this page. ${
      failed[0].ok ? "" : failed[0].error
    }`,
  );
}

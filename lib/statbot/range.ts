import { getFilterParams } from "./filters";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Default window for every page. */
export const DEFAULT_DAYS = 30;

/** IST is UTC+5:30, so daily buckets line up with Indian days. */
export const TIMEZONE_OFFSET_HOURS = 5.5;

/**
 * Query parameters for a time window ending now, plus the site-wide filters.
 * Confirmed against the Statbot docs: start/end are milliseconds since epoch,
 * interval is hour | day | week | month, timezone_offset is hours from UTC.
 *
 * `end` is rounded down to the hour so repeated builds produce the same URL and
 * reuse the cache.
 */
export function rangeParams(
  days: number = DEFAULT_DAYS,
): Record<string, string | string[]> {
  const end = Math.floor(Date.now() / HOUR) * HOUR;
  const start = end - days * DAY;
  return {
    start: String(start),
    end: String(end),
    interval: "day",
    timezone_offset: String(TIMEZONE_OFFSET_HOURS),
    ...getFilterParams(),
  };
}

/**
 * Filters applied to every stats request, so the public numbers describe the
 * community rather than bots and staff channels. Both are set with environment
 * variables, so they can be changed in Vercel without touching code.
 *
 * STATBOT_INCLUDE_BOTS=true      include bot accounts (default: humans only)
 * STATBOT_EXCLUDE_CHANNELS=id,id comma-separated channel IDs to leave out,
 *                                e.g. #logs and #mod-logs
 */
export function getFilterParams(): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};

  if (process.env.STATBOT_INCLUDE_BOTS !== "true") {
    params.bot = "false";
  }

  const excluded = (process.env.STATBOT_EXCLUDE_CHANNELS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[0-9]+$/.test(id));

  if (excluded.length > 0) {
    params.blacklist_channels = excluded;
  }

  return params;
}

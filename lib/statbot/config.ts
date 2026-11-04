import "server-only";

/** How long fetched Statbot data is cached before Vercel refreshes it (3 hours). */
export const REVALIDATE_SECONDS = 60 * 60 * 3;

/** Every Statbot fetch is tagged with this, so /api/revalidate can refresh everything at once. */
export const CACHE_TAG = "statbot";

export function getConfig() {
  const base = (process.env.STATBOT_API_BASE ?? "").trim().replace(/\/+$/, "");
  const key = (process.env.STATBOT_API_KEY ?? "").trim();
  const guildId = (process.env.STATBOT_GUILD_ID ?? "").trim();

  const missing = [
    !base && "STATBOT_API_BASE",
    !key && "STATBOT_API_KEY",
    !guildId && "STATBOT_GUILD_ID",
  ].filter(Boolean) as string[];

  return {
    base,
    key,
    guildId,
    missing,
    showMemberNames: process.env.SHOW_MEMBER_NAMES === "true",
  };
}

export type StatbotConfig = ReturnType<typeof getConfig>;

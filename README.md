# OnePlus Community analytics

A public analytics site for the OnePlus Discord server, built on the Statbot API.
Next.js (App Router) on Vercel. No database and no login: pages fetch Statbot on the
server and Vercel caches them for 3 hours.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000, then http://localhost:3000/explorer?token=YOUR_EXPLORER_TOKEN.

## Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. In Vercel, choose **Add New > Project** and import the repo. The framework is detected as Next.js.
3. Under **Settings > Environment Variables**, add everything from `.env.example`.
4. Deploy. Changing an environment variable later needs a redeploy to take effect.

## Environment variables

| Variable                   | What it's for                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `STATBOT_API_BASE`         | Statbot API host. Set to `https://api.statbot.net`; confirm in Statbot's #api-support if requests fail.      |
| `STATBOT_API_KEY`          | From the Statbot dashboard: Server Settings > Developers > API Key. Server-side only.                        |
| `STATBOT_GUILD_ID`         | The Discord server ID. The key only works for this server.                                                   |
| `NEXT_PUBLIC_SITE_NAME`    | Name shown in the header and page titles.                                                                    |
| `SHOW_MEMBER_NAMES`        | `true` shows usernames in leaderboards. Defaults to off because the site is public.                          |
| `EXPLORER_TOKEN`           | Unlocks `/explorer`. Leave empty to disable it in production.                                                |
| `STATBOT_INCLUDE_BOTS`     | `true` counts bot accounts too. Default: real members only.                                                  |
| `STATBOT_EXCLUDE_CHANNELS` | Comma-separated channel IDs to leave out of public stats, such as log channels.                              |
| `REVALIDATE_SECRET`        | Lets you force a refresh: `curl -X POST -H "Authorization: Bearer <value>" "https://<site>/api/revalidate"`. |

## Checking the API in /explorer

Confirmed from the Statbot docs and live responses:

- Base URL `https://api.statbot.net`; `start`/`end` in milliseconds; `interval` is hour, day, week or month.
- Series items look like `{ "count": 110, "unixTimestamp": 1792972800000 }`; member counts add `joins` and `leaves`.
- The counts endpoints require `stats[]` (`text`, `voice`), set per endpoint in `lib/statbot/endpoints.ts`.
- Every request sends `timezone_offset=5.5`, so days follow IST.

- Voice time is in minutes.
- Endpoints reject query parameters they don't support. `client.ts` tries the full set, then drops
  optional ones (channel filter, bot filter, timezone, interval) until Statbot accepts, and
  remembers what worked. `/explorer` lists anything that was dropped.
- Rate limit is about 10 requests per 10 seconds; `client.ts` pauses when the window is used up.

## API coverage

Checked against docs.statbot.net in November 2026. The API has 23 endpoints; the site
calls 21 of them, and every path in `lib/statbot/endpoints.ts` is now taken from the docs.

| Docs group | Endpoints                                                                                     | Used on                              |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------ |
| Series     | messages, voice, activities, membercounts, statuses, invites, unique members, unique channels | Overview and every section page      |
| Tops       | activities, message members/channels, voice members/channels, invites, invite members         | Messages, Voice, Invites, Activities |
| Sums       | messages, voice                                                                               | Overview, Messages, Voice            |
| Counts     | members with counts                                                                           | `/explorer` only (see below)         |
| Resources  | channels, invites, activities                                                                 | Naming channels, invite links, games |

Not used:

- `GET /channels/:channel_id` and `GET /invites/:invite_id`: single-item lookups; the lists cover them.
- `GET /counts/members` returns per-member rows, so it stays off the public pages for now.
- The `by_*` grouping parameters on the series endpoints (for example messages `by_channel`,
  voice `by_state`, invites `by_invite`). The docs don't show the value format or the response
  shape, so try one in `/explorer` before building a chart on it.

Documented but not live: `GET /invites/series` returns 404 "Route ... not found" from
Statbot's server, so the Invites page has no per-day chart. It stays in `/explorer`, so a 200
there means Statbot has switched it on.

Hidden sections: Activities is built but switched off in `lib/features.ts` (no nav link, the
page returns 404 and makes no Statbot calls). Set `activities: true` to show it.

Still to confirm in `/explorer` with the live key:

- The unit of the activity counts (the Activities page shows plain numbers until then).
- The field names in the status series (the Members page maps online, idle, dnd, offline).
- That the guild key is accepted by `GET /v1/activities`, which is the only path outside the guild.

## How it fits together

```
app/
  page.tsx            Overview: 30-day message total, member growth, top channels
  messages/           Messages per day, top channels, top members, active channels
  voice/              Voice time per day, top voice channels, top members in voice
  members/            Member count, joins and leaves, active members, status
  invites/            Top invite links, top inviters
  activities/         Games and apps (hidden for now: turn on in lib/features.ts)
  error.tsx           Shown if a page fails to render
  explorer/           Raw API responses (token protected, never cached)
  api/revalidate/     Force-refresh all cached data
components/           Charts (Recharts), ranked lists, stat rows, panels
lib/statbot/
  client.ts           The only place that calls Statbot: auth, caching, rate limits, retries
  endpoints.ts        Every endpoint path in one list
  range.ts            The time-window query parameters
  normalize.ts        Response → chart rows, totals and ranked lists
  config.ts           Environment variables and cache time
lib/format.ts         Number, date (IST) and voice-time formatting
```

### Caching and rate limits

- Each page sets `revalidate = 10800` and each fetch uses the same 3-hour window, tagged `statbot`.
- Visitors always get a cached page; Vercel refreshes it in the background when it's older than 3 hours.
- **Rate limits and caching** (all in `lib/statbot/client.ts`):
  - Statbot doesn't publish its limit. It reports it on every response in
    `x-ratelimit-limit`, `x-ratelimit-remaining` and `x-ratelimit-reset` (seconds), and sends
    `retry-after` (seconds) once it's hit. To see the current cap, open
    `/explorer?token=<EXPLORER_TOKEN>&only=channels&range=off` and read the "Rate limit" line.
  - Every response is cached for 3 hours in Vercel's data cache, one entry per endpoint and
    parameters, shared by all pages. A full refresh is about 21 Statbot calls every 3 hours.
  - When an entry goes stale, visitors get the stale copy at once and a fresh one is
    fetched in the background. If that fetch fails, nothing is stored and the old copy stays.
  - Pages rebuild hourly from that cache (no Statbot calls). If a rebuild still meets a rate
    limit or outage, the page throws and Vercel keeps serving the previous good version.
  - Requests slow down before the limit (when 1 is left in the window they wait for the
    reset), wait out `retry-after` on a 429, and give up after 40 seconds (2 minutes during
    `next build`). At most 2 run at once per server instance.
  - `/api/revalidate` drops the whole cache, so the next visits call Statbot fresh with no
    stale copy to fall back on. Use it sparingly.

### Errors

`statbot()` never throws. A failed endpoint shows a message in its own panel and the rest of
the page still renders. A failed refresh replaces the cached page with the error until the next
refresh, so check `/explorer` if a panel goes red.

### Page-change loader

`components/LinkPending.tsx` sits inside each internal `<Link>` and draws a 2px line at the top
of the window while that link's page loads. It uses Next's `useLinkStatus`, adds no library,
and shows nothing when a page is already prefetched. Add `<LinkPending />` inside any new
internal link to give it the same behaviour.

### Privacy

Everything on this site is public. With `SHOW_MEMBER_NAMES=false`, member leaderboards are
replaced by a single figure: the share of activity from the top 10 members. Turn names on
only once the client and server mods have agreed. Use of the API is also subject to
Statbot's Developer Terms of Service.

## Keeping it secure

Before deploying, run `npm install` and `npm audit`. Keep `next`, `react` and `react-dom` on
current patch releases; Vercel blocks deploys of Next.js versions with known critical issues.

## When to add a database

Not needed now. Add Supabase (or Vercel Postgres) if you need history beyond what your Statbot
plan keeps, metrics built from your own saved snapshots, or if rate limits become a problem
as pages grow. Only `lib/statbot/client.ts` would change; the pages read through it.

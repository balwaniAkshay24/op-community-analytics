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

| Variable                   | What it's for                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `STATBOT_API_BASE`         | Statbot API host. Set to `https://api.statbot.net`; confirm in Statbot's #api-support if requests fail. |
| `STATBOT_API_KEY`          | From the Statbot dashboard: Server Settings > Developers > API Key. Server-side only.                   |
| `STATBOT_GUILD_ID`         | The Discord server ID. The key only works for this server.                                              |
| `NEXT_PUBLIC_SITE_NAME`    | Name shown in the header and page titles.                                                               |
| `SHOW_MEMBER_NAMES`        | `true` shows usernames in leaderboards. Defaults to off because the site is public.                     |
| `EXPLORER_TOKEN`           | Unlocks `/explorer`. Leave empty to disable it in production.                                           |
| `STATBOT_INCLUDE_BOTS`     | `true` counts bot accounts too. Default: real members only.                                             |
| `STATBOT_EXCLUDE_CHANNELS` | Comma-separated channel IDs to leave out of public stats, such as log channels.                         |
| `REVALIDATE_SECRET`        | Lets you force a refresh: `curl -X POST "https://<site>/api/revalidate?secret=<value>"`.                |

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

## How it fits together

```
app/
  page.tsx            Overview: 30-day message total, member growth, top channels
  messages/           Messages per day, top channels, top members, active channels
  voice/              Voice time per day, top voice channels, top members in voice
  members/            Member count, joins and leaves, active members, status
  invites/            Invite joins per day, top invite links, top inviters
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
- `client.ts` runs at most 2 Statbot requests at a time and retries a 429 after `retry-after`
  (up to 10 seconds, twice), so building every page at once doesn't trip the limit.
- To change the refresh time, update `REVALIDATE_SECONDS` in `lib/statbot/config.ts` and the
  `revalidate` export in each page (Next.js needs that one as a literal number).

### Errors

`statbot()` never throws. A failed endpoint shows a message in its own panel and the rest of
the page still renders. A failed refresh replaces the cached page with the error until the next
refresh, so check `/explorer` if a panel goes red.

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

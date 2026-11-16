/**
 * Every Statbot endpoint the site uses.
 *
 * All paths below were checked against docs.statbot.net (November 2026). The docs
 * list 23 endpoints; the two not used here are the single-item lookups
 * /channels/:channel_id and /invites/:invite_id, which the list endpoints cover.
 *
 * `verified: true`  = path copied from docs.statbot.net.
 * `verified: false` = path inferred. Open /explorer to check; fix here if it 404s.
 * `range: true`     = endpoint takes the time-range query from range.ts.
 * `scope: "global"` = path sits under /v1 instead of /v1/guilds/:guild_id.
 *
 * Not used yet: the `by_*` grouping parameters on the series endpoints
 * (messages: by_member, by_channel, by_flag; voice: by_member, by_channel, by_state,
 * by_flag; activities: by_member, by_activity; invites: by_invite, by_inviter,
 * by_invitee, by_flag). Try them in /explorer before building on them.
 */
export type EndpointDef = {
  path: string;
  label: string;
  group: "Series" | "Tops" | "Sums" | "Counts" | "Resources";
  verified: boolean;
  range: boolean;
  scope?: "guild" | "global";
  /** Query parameters the endpoint always needs, sent on every call. */
  required?: Record<string, string | string[]>;
};

// Statbot's stat types for the "counts" endpoints. Required there.
const ALL_STATS = { stats: ["text", "voice"] };

export const ENDPOINTS = {
  // Series
  messageSeries: {
    path: "/messages/series",
    label: "Message series",
    group: "Series",
    verified: true,
    range: true,
  },
  voiceSeries: {
    path: "/voice/series",
    label: "Voice series",
    group: "Series",
    verified: true,
    range: true,
  },
  activitySeries: {
    path: "/activities/series",
    label: "Activity series",
    group: "Series",
    verified: true,
    range: true,
  },
  memberCountSeries: {
    path: "/membercounts/series",
    label: "Member count, joins and leaves",
    group: "Series",
    verified: true,
    range: true,
  },
  statusSeries: {
    path: "/statuses/series",
    label: "Status series",
    group: "Series",
    verified: true,
    range: true,
  },
  inviteSeries: {
    path: "/invites/series",
    label: "Invite series",
    group: "Series",
    verified: true,
    range: true,
  },
  uniqueMemberSeries: {
    path: "/counts/members/series",
    label: "Unique active members",
    group: "Series",
    verified: true,
    range: true,
    required: ALL_STATS,
  },
  uniqueChannelSeries: {
    path: "/counts/channels/series",
    label: "Unique active channels",
    group: "Series",
    verified: true,
    range: true,
    required: ALL_STATS,
  },

  // Tops
  topActivities: {
    path: "/activities/tops/activities",
    label: "Top activities",
    group: "Tops",
    verified: true,
    range: true,
  },
  topMessageMembers: {
    path: "/messages/tops/members",
    label: "Top message members",
    group: "Tops",
    verified: true,
    range: true,
  },
  topMessageChannels: {
    path: "/messages/tops/channels",
    label: "Top message channels",
    group: "Tops",
    verified: true,
    range: true,
  },
  topVoiceMembers: {
    path: "/voice/tops/members",
    label: "Top voice members",
    group: "Tops",
    verified: true,
    range: true,
  },
  topVoiceChannels: {
    path: "/voice/tops/channels",
    label: "Top voice channels",
    group: "Tops",
    verified: true,
    range: true,
  },
  topInvites: {
    path: "/invites/tops/invites",
    label: "Top invites",
    group: "Tops",
    verified: true,
    range: true,
  },
  topInviteMembers: {
    path: "/invites/tops/members",
    label: "Top inviters",
    group: "Tops",
    verified: true,
    range: true,
  },

  // Sums
  messageSums: {
    path: "/messages/sums",
    label: "Message total",
    group: "Sums",
    verified: true,
    range: true,
  },
  voiceSums: {
    path: "/voice/sums",
    label: "Voice total",
    group: "Sums",
    verified: true,
    range: true,
  },

  // Counts
  memberStats: {
    path: "/counts/members",
    label: "Members with counts",
    group: "Counts",
    verified: true,
    range: true,
    required: ALL_STATS,
  },

  // Resources
  channels: {
    path: "/channels",
    label: "Channels",
    group: "Resources",
    verified: true,
    range: false,
  },
  invites: {
    path: "/invites",
    label: "Invites",
    group: "Resources",
    verified: true,
    range: false,
  },
  activities: {
    path: "/activities",
    label: "Activities (all of Statbot)",
    group: "Resources",
    verified: true,
    range: false,
    scope: "global",
  },
} satisfies Record<string, EndpointDef>;

export type EndpointId = keyof typeof ENDPOINTS;

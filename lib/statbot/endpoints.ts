/**
 * Every Statbot endpoint the site uses, relative to /v1/guilds/:guild_id.
 *
 * `verified: true`  = path copied from docs.statbot.net.
 * `verified: false` = path inferred from the docs' naming pattern. Open /explorer to
 *                     check these; fix the path here if one returns 404.
 * `range: true`     = endpoint takes the time-range query from range.ts.
 */
export type EndpointDef = {
  path: string;
  label: string;
  group: "Series" | "Tops" | "Sums" | "Counts" | "Resources";
  verified: boolean;
  range: boolean;
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
    verified: false,
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
    verified: false,
    range: true,
  },
  inviteSeries: {
    path: "/invites/series",
    label: "Invite series",
    group: "Series",
    verified: false,
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
    verified: false,
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
    verified: false,
    range: true,
  },
  topVoiceMembers: {
    path: "/voice/tops/members",
    label: "Top voice members",
    group: "Tops",
    verified: false,
    range: true,
  },
  topVoiceChannels: {
    path: "/voice/tops/channels",
    label: "Top voice channels",
    group: "Tops",
    verified: false,
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
    verified: false,
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
    verified: false,
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
    verified: false,
    range: false,
  },
  invites: {
    path: "/invites",
    label: "Invites",
    group: "Resources",
    verified: false,
    range: false,
  },
} satisfies Record<string, EndpointDef>;

export type EndpointId = keyof typeof ENDPOINTS;

import type { Metadata } from "next";
import { MemberLeaderboard } from "@/components/MemberLeaderboard";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { RankedList } from "@/components/RankedList";
import { keepLastGoodPage, read } from "@/lib/result";
import { statbot } from "@/lib/statbot/client";
import { getConfig } from "@/lib/statbot/config";
import { toInviteNameMap, toRanked, withNames } from "@/lib/statbot/normalize";
import { DEFAULT_DAYS, rangeParams } from "@/lib/statbot/range";

// Rebuilt hourly from the shared data cache, which only calls Statbot every 3 hours
// (see cachedCall in lib/statbot/client.ts). So this costs no extra Statbot requests.
export const revalidate = 3600;
export const maxDuration = 60;
export const metadata: Metadata = { title: "Invites" };

export default async function InvitesPage() {
  const { showMemberNames } = getConfig();
  const query = rangeParams(DEFAULT_DAYS);

  // No per-day chart: Statbot documents GET /invites/series, but its server answers
  // "Route ... not found" (checked November 2026). Add it back if that changes;
  // /explorer still calls it, so a 200 there means it's live.
  const [topInvites, topInviters, inviteList] = await Promise.all([
    statbot("topInvites", { query }),
    statbot("topInviteMembers", {
      query: { ...query, full: showMemberNames ? "true" : undefined },
    }),
    statbot("invites"),
  ]);
  keepLastGoodPage([topInvites, topInviters, inviteList]);

  // Label each link with its Statbot label (e.g. a campaign name) or its invite code.
  const inviteNames =
    read(inviteList, toInviteNameMap).value ?? new Map<string, string>();
  const linksTop = read(topInvites, (d) =>
    withNames(toRanked(d, 10), inviteNames, ""),
  );
  const invitersTop = read(topInviters, (d) => toRanked(d, 10));

  return (
    <>
      <PageHeader
        title="Invites"
        description={`Which invite links bring people in, over the last ${DEFAULT_DAYS} days.`}
      />
      <div className="grid">
        <Panel
          title="Top invite links"
          description="Shown by the label set in Statbot, or the invite code if there is none."
          error={linksTop.error}
          empty={!linksTop.value?.length}
        >
          {linksTop.value ? <RankedList items={linksTop.value} /> : null}
        </Panel>

        <MemberLeaderboard
          title="Top inviters"
          items={invitersTop.value}
          error={invitersTop.error}
          total={null}
          showNames={showMemberNames}
          unit="invite joins"
        />
      </div>
    </>
  );
}

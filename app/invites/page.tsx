import type { Metadata } from "next";
import { MemberLeaderboard } from "@/components/MemberLeaderboard";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { RankedList } from "@/components/RankedList";
import { TrendChart } from "@/components/TrendChart";
import { read } from "@/lib/result";
import { statbot } from "@/lib/statbot/client";
import { getConfig } from "@/lib/statbot/config";
import { pickKey, sumKey, toRanked, toRows } from "@/lib/statbot/normalize";
import { DEFAULT_DAYS, rangeParams } from "@/lib/statbot/range";

export const revalidate = 10800;
export const metadata: Metadata = { title: "Invites" };

export default async function InvitesPage() {
  const { showMemberNames } = getConfig();
  const query = rangeParams(DEFAULT_DAYS);

  const [series, topInvites, topInviters] = await Promise.all([
    statbot("inviteSeries", { query }),
    statbot("topInvites", { query }),
    statbot("topInviteMembers", {
      query: { ...query, full: showMemberNames ? "true" : undefined },
    }),
  ]);

  const invites = read(series, toRows);
  const key = invites.value
    ? pickKey(invites.value, ["count", "uses", "joins", "value"])
    : null;
  const total = invites.value ? sumKey(invites.value, key) : null;

  const linksTop = read(topInvites, (d) => toRanked(d, 10));
  const invitersTop = read(topInviters, (d) => toRanked(d, 10));

  return (
    <>
      <PageHeader
        title="Invites"
        description={`Which invite links bring people in, over the last ${DEFAULT_DAYS} days.`}
      />
      <div className="grid">
        <Panel
          wide
          title="Joins through invites per day"
          error={invites.error}
          empty={!key || !invites.value?.rows.length}
        >
          {invites.value && key ? (
            <TrendChart
              data={invites.value.rows}
              series={[{ key, name: "Invite joins" }]}
              height={280}
              summary="Joins through invite links per day"
            />
          ) : null}
        </Panel>

        <Panel
          title="Top invite links"
          description="Campaign and partner links show up here by their invite code."
          error={linksTop.error}
          empty={!linksTop.value?.length}
        >
          {linksTop.value ? <RankedList items={linksTop.value} /> : null}
        </Panel>

        <MemberLeaderboard
          title="Top inviters"
          items={invitersTop.value}
          error={invitersTop.error}
          total={total}
          showNames={showMemberNames}
          unit="invite joins"
        />
      </div>
    </>
  );
}

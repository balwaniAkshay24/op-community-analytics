import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { StatRow } from "@/components/StatRow";
import { TrendChart } from "@/components/TrendChart";
import { fmtNumber, fmtSigned } from "@/lib/format";
import { read } from "@/lib/result";
import { statbot } from "@/lib/statbot/client";
import {
  firstValue,
  lastValue,
  pickKey,
  sumKey,
  toRows,
} from "@/lib/statbot/normalize";
import { DEFAULT_DAYS, rangeParams } from "@/lib/statbot/range";

export const revalidate = 10800;
export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const query = rangeParams(DEFAULT_DAYS);

  const [memberCounts, uniqueMembers, statuses] = await Promise.all([
    statbot("memberCountSeries", { query }),
    statbot("uniqueMemberSeries", { query }),
    statbot("statusSeries", { query }),
  ]);

  const counts = read(memberCounts, toRows);
  const totalKey = counts.value
    ? pickKey(counts.value, ["count", "members", "memberCount", "total"])
    : null;
  const joinsKey = counts.value?.keys.find((k) => /join/i.test(k)) ?? null;
  const leavesKey =
    counts.value?.keys.find((k) => /leave|left/i.test(k)) ?? null;

  const now = counts.value ? lastValue(counts.value, totalKey) : null;
  const then = counts.value ? firstValue(counts.value, totalKey) : null;
  const joins = counts.value ? sumKey(counts.value, joinsKey) : null;
  const leaves = counts.value ? sumKey(counts.value, leavesKey) : null;
  const net = now !== null && then !== null ? now - then : null;

  const active = read(uniqueMembers, toRows);
  const activeKey = active.value
    ? pickKey(active.value, ["count", "members", "value"])
    : null;

  const status = read(statuses, toRows);
  const statusSeries = (status.value?.keys ?? [])
    .slice(0, 3)
    .map((k) => ({ key: k, name: k }));

  return (
    <>
      <PageHeader
        title="Members"
        description={`Growth, joins and leaves over the last ${DEFAULT_DAYS} days.`}
      />
      <StatRow
        stats={[
          { label: "Members", value: now !== null ? fmtNumber(now) : null },
          {
            label: "Net change",
            value: net !== null ? fmtSigned(net) : null,
            tone:
              net === null || net === 0
                ? "neutral"
                : net > 0
                  ? "positive"
                  : "negative",
          },
          { label: "Joined", value: joins !== null ? fmtNumber(joins) : null },
          { label: "Left", value: leaves !== null ? fmtNumber(leaves) : null },
        ]}
      />
      <div className="grid">
        <Panel
          wide
          title="Member count"
          error={counts.error}
          empty={!totalKey || !counts.value?.rows.length}
        >
          {counts.value && totalKey ? (
            <TrendChart
              data={counts.value.rows}
              series={[{ key: totalKey, name: "Members" }]}
              height={280}
              summary="Total members per day"
            />
          ) : null}
        </Panel>

        <Panel
          title="Joins and leaves per day"
          error={counts.error}
          empty={!joinsKey && !leavesKey}
          emptyText="Statbot didn't return join or leave counts."
        >
          {counts.value ? (
            <TrendChart
              data={counts.value.rows}
              series={[
                ...(joinsKey ? [{ key: joinsKey, name: "Joined" }] : []),
                ...(leavesKey ? [{ key: leavesKey, name: "Left" }] : []),
              ]}
              height={240}
              summary="Members joining and leaving per day"
            />
          ) : null}
        </Panel>

        <Panel
          title="Active members per day"
          description="Members who sent a message or joined voice."
          error={active.error}
          empty={!activeKey || !active.value?.rows.length}
        >
          {active.value && activeKey ? (
            <TrendChart
              data={active.value.rows}
              series={[{ key: activeKey, name: "Active members" }]}
              height={240}
              summary="Active members per day"
            />
          ) : null}
        </Panel>

        <Panel
          wide
          title="Members online"
          description="Members by status. Field names come straight from Statbot until we map them."
          error={status.error}
          empty={statusSeries.length === 0 || !status.value?.rows.length}
        >
          {status.value && statusSeries.length ? (
            <TrendChart
              data={status.value.rows}
              series={statusSeries}
              height={240}
              summary="Members by status per day"
            />
          ) : null}
        </Panel>
      </div>
    </>
  );
}

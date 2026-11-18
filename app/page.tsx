import { Panel } from "@/components/Panel";
import { RankedList } from "@/components/RankedList";
import { StatRow, type Stat } from "@/components/StatRow";
import { TrendChart } from "@/components/TrendChart";
import { fmtNumber, fmtSigned, fmtVoice } from "@/lib/format";
import { keepLastGoodPage, read } from "@/lib/result";
import { statbot } from "@/lib/statbot/client";
import {
  firstValue,
  lastValue,
  pickKey,
  sumKey,
  toNameMap,
  toRanked,
  toRows,
  toTotal,
  withNames,
} from "@/lib/statbot/normalize";
import { DEFAULT_DAYS, rangeParams } from "@/lib/statbot/range";

// Rebuilt hourly from the shared data cache, which only calls Statbot every 3 hours
// (see cachedCall in lib/statbot/client.ts). So this costs no extra Statbot requests.
export const revalidate = 3600;
export const maxDuration = 60;

export default async function OverviewPage() {
  const query = rangeParams(DEFAULT_DAYS);

  const [
    messageSeries,
    messageSums,
    voiceSums,
    memberCounts,
    activeMembers,
    topChannels,
    channels,
  ] = await Promise.all([
    statbot("messageSeries", { query }),
    statbot("messageSums", { query }),
    statbot("voiceSums", { query }),
    statbot("memberCountSeries", { query }),
    statbot("uniqueMemberSeries", { query }),
    statbot("topMessageChannels", { query }),
    statbot("channels"),
  ]);
  keepLastGoodPage([
    messageSeries,
    messageSums,
    voiceSums,
    memberCounts,
    activeMembers,
    topChannels,
    channels,
  ]);

  const messages = read(messageSeries, toRows);
  const messageKey = messages.value
    ? pickKey(messages.value, ["count", "messages", "value"])
    : null;
  const messageTotal =
    read(messageSums, toTotal).value ??
    (messages.value ? sumKey(messages.value, messageKey) : null);

  const members = read(memberCounts, toRows).value;
  const memberKey = members
    ? pickKey(members, ["count", "members", "memberCount", "total"])
    : null;
  const membersNow = members ? lastValue(members, memberKey) : null;
  const membersThen = members ? firstValue(members, memberKey) : null;
  const memberChange =
    membersNow !== null && membersThen !== null
      ? membersNow - membersThen
      : null;

  const activeRes = read(activeMembers, toRows);
  const active = activeRes.value;
  const activeKey = active
    ? pickKey(active, ["count", "members", "value"])
    : null;
  const activeToday = active ? lastValue(active, activeKey) : null;

  const voiceTotal = read(voiceSums, toTotal).value;

  const names = read(channels, toNameMap).value ?? new Map<string, string>();
  const channelsTop = read(topChannels, (d) =>
    withNames(toRanked(d, 5), names),
  );

  const stats: Stat[] = [
    {
      label: "Members",
      value: membersNow !== null ? fmtNumber(membersNow) : null,
      detail:
        memberChange !== null
          ? `${fmtSigned(memberChange)} in ${DEFAULT_DAYS} days`
          : null,
      tone:
        memberChange === null || memberChange === 0
          ? "neutral"
          : memberChange > 0
            ? "positive"
            : "negative",
    },
    {
      label: "Members active today",
      value: activeToday !== null ? fmtNumber(activeToday) : null,
    },
    {
      label: `Voice time, ${DEFAULT_DAYS} days`,
      value: voiceTotal !== null ? fmtVoice(voiceTotal) : null,
    },
    {
      label: "Busiest channel",
      value: channelsTop.value?.[0]?.label ?? null,
    },
  ];

  return (
    <>
      <section className="hero" aria-labelledby="hero-number">
        <p id="hero-number" className="hero-number">
          {messageTotal !== null ? fmtNumber(messageTotal) : "\u2013"}
        </p>
        <p className="hero-caption">
          messages sent in the last {DEFAULT_DAYS} days.
        </p>
      </section>

      <StatRow stats={stats} />

      <div className="grid">
        <Panel
          wide
          title="Messages per day"
          href="/messages"
          linkLabel="All message stats"
          error={messages.error}
          empty={
            !messages.value || !messageKey || messages.value.rows.length === 0
          }
        >
          {messages.value && messageKey ? (
            <TrendChart
              data={messages.value.rows}
              series={[{ key: messageKey, name: "Messages" }]}
              height={320}
              summary={`Messages per day over the last ${DEFAULT_DAYS} days`}
            />
          ) : null}
        </Panel>

        <Panel
          title="Most active channels"
          href="/messages"
          linkLabel="Top 10"
          description={`By messages, last ${DEFAULT_DAYS} days.`}
          error={channelsTop.error}
          empty={!channelsTop.value?.length}
        >
          {channelsTop.value ? <RankedList items={channelsTop.value} /> : null}
        </Panel>

        <Panel
          title="Active members per day"
          href="/members"
          linkLabel="Member growth"
          description="Members who sent a message or joined voice."
          error={activeRes.error}
          empty={!active || !activeKey || active.rows.length === 0}
        >
          {active && activeKey ? (
            <TrendChart
              data={active.rows}
              series={[{ key: activeKey, name: "Active members" }]}
              height={220}
              summary={`Active members per day over the last ${DEFAULT_DAYS} days`}
            />
          ) : null}
        </Panel>
      </div>
    </>
  );
}

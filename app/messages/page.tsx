import type { Metadata } from "next";
import { MemberLeaderboard } from "@/components/MemberLeaderboard";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { RankedList } from "@/components/RankedList";
import { TrendChart } from "@/components/TrendChart";
import { read } from "@/lib/result";
import { statbot } from "@/lib/statbot/client";
import { getConfig } from "@/lib/statbot/config";
import {
  pickKey,
  sumKey,
  toNameMap,
  toRanked,
  toRows,
  toTotal,
  withNames,
} from "@/lib/statbot/normalize";
import { DEFAULT_DAYS, rangeParams } from "@/lib/statbot/range";

export const revalidate = 10800;
export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { showMemberNames } = getConfig();
  const query = rangeParams(DEFAULT_DAYS);

  const [series, sums, topChannels, topMembers, channelCounts, channels] =
    await Promise.all([
      statbot("messageSeries", { query }),
      statbot("messageSums", { query }),
      statbot("topMessageChannels", { query }),
      statbot("topMessageMembers", {
        query: { ...query, full: showMemberNames ? "true" : undefined },
      }),
      statbot("uniqueChannelSeries", { query }),
      statbot("channels"),
    ]);

  const messages = read(series, toRows);
  const key = messages.value
    ? pickKey(messages.value, ["count", "messages", "value"])
    : null;
  const total =
    read(sums, toTotal).value ??
    (messages.value ? sumKey(messages.value, key) : null);

  const names = read(channels, toNameMap).value ?? new Map<string, string>();
  const channelsTop = read(topChannels, (d) =>
    withNames(toRanked(d, 10), names),
  );
  const membersTop = read(topMembers, (d) => toRanked(d, 10));

  const activeChannels = read(channelCounts, toRows);
  const activeChannelKey = activeChannels.value
    ? pickKey(activeChannels.value, ["count", "channels", "value"])
    : null;

  return (
    <>
      <PageHeader
        title="Messages"
        description={`Where and when the community talks, over the last ${DEFAULT_DAYS} days.`}
      />
      <div className="grid">
        <Panel
          wide
          title="Messages per day"
          error={messages.error}
          empty={!key || !messages.value?.rows.length}
        >
          {messages.value && key ? (
            <TrendChart
              data={messages.value.rows}
              series={[{ key, name: "Messages" }]}
              height={320}
              summary="Messages per day"
            />
          ) : null}
        </Panel>

        <Panel
          title="Top channels"
          description="By messages sent."
          error={channelsTop.error}
          empty={!channelsTop.value?.length}
        >
          {channelsTop.value ? <RankedList items={channelsTop.value} /> : null}
        </Panel>

        <MemberLeaderboard
          title="Top members"
          items={membersTop.value}
          error={membersTop.error}
          total={total}
          showNames={showMemberNames}
          unit="messages"
        />

        <Panel
          wide
          title="Channels with activity per day"
          description="How many channels had at least one message."
          error={activeChannels.error}
          empty={!activeChannelKey || !activeChannels.value?.rows.length}
        >
          {activeChannels.value && activeChannelKey ? (
            <TrendChart
              data={activeChannels.value.rows}
              series={[{ key: activeChannelKey, name: "Active channels" }]}
              height={220}
              summary="Channels with activity per day"
            />
          ) : null}
        </Panel>
      </div>
    </>
  );
}

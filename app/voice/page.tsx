import type { Metadata } from "next";
import { MemberLeaderboard } from "@/components/MemberLeaderboard";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { RankedList } from "@/components/RankedList";
import { StatRow } from "@/components/StatRow";
import { TrendChart } from "@/components/TrendChart";
import { fmtVoice } from "@/lib/format";
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
export const metadata: Metadata = { title: "Voice" };

export default async function VoicePage() {
  const { showMemberNames } = getConfig();
  const query = rangeParams(DEFAULT_DAYS);

  const [series, sums, topChannels, topMembers, channels] = await Promise.all([
    statbot("voiceSeries", { query }),
    statbot("voiceSums", { query }),
    statbot("topVoiceChannels", { query }),
    statbot("topVoiceMembers", {
      query: { ...query, full: showMemberNames ? "true" : undefined },
    }),
    statbot("channels"),
  ]);

  const voice = read(series, toRows);
  const key = voice.value
    ? pickKey(voice.value, ["count", "seconds", "minutes", "value"])
    : null;
  const total =
    read(sums, toTotal).value ??
    (voice.value ? sumKey(voice.value, key) : null);
  const days = voice.value?.rows.length || DEFAULT_DAYS;

  const names = read(channels, toNameMap).value ?? new Map<string, string>();
  const channelsTop = read(topChannels, (d) =>
    withNames(toRanked(d, 10), names, ""),
  );
  const membersTop = read(topMembers, (d) => toRanked(d, 10));

  return (
    <>
      <PageHeader
        title="Voice"
        description={`Time spent in voice channels over the last ${DEFAULT_DAYS} days.`}
      />
      <StatRow
        stats={[
          {
            label: `Voice time, ${DEFAULT_DAYS} days`,
            value: total !== null ? fmtVoice(total) : null,
          },
          {
            label: "Average per day",
            value: total !== null ? fmtVoice(total / days) : null,
          },
          {
            label: "Busiest voice channel",
            value: channelsTop.value?.[0]?.label ?? null,
          },
        ]}
      />
      <div className="grid">
        <Panel
          wide
          title="Voice time per day"
          error={voice.error}
          empty={!key || !voice.value?.rows.length}
        >
          {voice.value && key ? (
            <TrendChart
              data={voice.value.rows}
              series={[{ key, name: "Voice time" }]}
              format="voice"
              height={300}
              summary="Voice time per day"
            />
          ) : null}
        </Panel>

        <Panel
          title="Top voice channels"
          error={channelsTop.error}
          empty={!channelsTop.value?.length}
        >
          {channelsTop.value ? (
            <RankedList items={channelsTop.value} format="voice" />
          ) : null}
        </Panel>

        <MemberLeaderboard
          title="Top members in voice"
          items={membersTop.value}
          error={membersTop.error}
          total={total}
          showNames={showMemberNames}
          unit="voice time"
          format="voice"
        />
      </div>
    </>
  );
}

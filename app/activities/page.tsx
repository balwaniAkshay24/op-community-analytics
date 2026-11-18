import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { RankedList } from "@/components/RankedList";
import { StatRow } from "@/components/StatRow";
import { TrendChart } from "@/components/TrendChart";
import { keepLastGoodPage, read } from "@/lib/result";
import { statbot } from "@/lib/statbot/client";
import {
  pickKey,
  toNameMap,
  toRanked,
  toRows,
  withNames,
} from "@/lib/statbot/normalize";
import { DEFAULT_DAYS, rangeParams } from "@/lib/statbot/range";

// Rebuilt hourly from the shared data cache, which only calls Statbot every 3 hours
// (see cachedCall in lib/statbot/client.ts). So this costs no extra Statbot requests.
export const revalidate = 3600;
export const maxDuration = 60;
export const metadata: Metadata = { title: "Activities" };

/**
 * Games and apps members have showing on their Discord profile.
 *
 * The docs don't state the unit of the activity counts, so values are shown as plain
 * numbers. Once /explorer and the Statbot dashboard confirm it (likely minutes, like
 * voice), pass format="voice" to the chart and list below.
 */
export default async function ActivitiesPage() {
  const query = rangeParams(DEFAULT_DAYS);

  const [series, top, catalogue] = await Promise.all([
    statbot("activitySeries", { query }),
    statbot("topActivities", { query }),
    statbot("activities"),
  ]);
  keepLastGoodPage([series, top, catalogue]);

  const activity = read(series, toRows);
  const key = activity.value
    ? pickKey(activity.value, ["count", "minutes", "value"])
    : null;

  const names = read(catalogue, toNameMap).value ?? new Map<string, string>();
  const ranked = read(top, (d) => withNames(toRanked(d, 15), names, ""));
  // Without a name there is only Statbot's internal id, which means nothing to visitors.
  const named = ranked.value?.filter((item) => item.label !== item.id) ?? null;

  return (
    <>
      <PageHeader
        title="Activities"
        description={`What the community plays and uses on Discord, over the last ${DEFAULT_DAYS} days.`}
      />
      <StatRow
        stats={[
          { label: "Most popular", value: named?.[0]?.label ?? null },
          { label: "Runner-up", value: named?.[1]?.label ?? null },
          { label: "Third", value: named?.[2]?.label ?? null },
        ]}
      />
      <div className="grid">
        <Panel
          wide
          title="Activity per day"
          description="Games and apps shown on members' Discord profiles."
          error={activity.error}
          empty={!key || !activity.value?.rows.length}
        >
          {activity.value && key ? (
            <TrendChart
              data={activity.value.rows}
              series={[{ key, name: "Activity" }]}
              height={300}
              summary="Tracked activity per day"
            />
          ) : null}
        </Panel>

        <Panel
          wide
          title="Top activities"
          description="Ranked by Statbot's activity count for the period."
          error={ranked.error}
          empty={!named?.length}
          emptyText={
            ranked.value?.length
              ? "Statbot returned activities without names. Check the activities endpoints in /explorer."
              : undefined
          }
        >
          {named ? <RankedList items={named} /> : null}
        </Panel>
      </div>
    </>
  );
}

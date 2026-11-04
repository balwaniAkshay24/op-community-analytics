import { fmtPercent, type ValueFormat } from "@/lib/format";
import type { Ranked } from "@/lib/statbot/normalize";
import { Panel } from "./Panel";
import { RankedList } from "./RankedList";

type Props = {
  title: string;
  items: Ranked[] | null;
  error: string | null;
  total: number | null;
  showNames: boolean;
  unit: string;
  format?: ValueFormat;
};

/**
 * Shows named leaderboards only when SHOW_MEMBER_NAMES=true. Otherwise shows how much
 * of the activity the top members account for, which needs no names.
 */
export function MemberLeaderboard({
  title,
  items,
  error,
  total,
  showNames,
  unit,
  format,
}: Props) {
  if (showNames) {
    return (
      <Panel title={title} error={error} empty={!items?.length}>
        {items ? <RankedList items={items} format={format} /> : null}
      </Panel>
    );
  }

  const topSum = items?.reduce((sum, i) => sum + i.value, 0) ?? null;
  const share = topSum !== null && total ? topSum / total : null;

  return (
    <Panel
      title={title}
      description="Member names are hidden on this public site."
      error={error}
      empty={share === null}
      emptyText="Not enough data to work this out yet."
    >
      <p className="stat-value">{share !== null ? fmtPercent(share) : null}</p>
      <p className="panel-description">
        of all {unit} came from the {items?.length ?? 0} most active members.
      </p>
    </Panel>
  );
}

import { fmtPercent, fmtValue, type ValueFormat } from "@/lib/format";
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
  // A row whose label is still its Discord id came back from Statbot without a name.
  const hasNames = items?.some((i) => i.label && i.label !== i.id) ?? false;

  // Names on, and Statbot sent them (or sent nothing at all): show the leaderboard.
  // If it sent rows but no names, fall through to the share figure rather than
  // publishing a list of raw Discord ids.
  if (showNames && (hasNames || !items?.length)) {
    const named = items?.map((i) =>
      i.label && i.label !== i.id ? i : { ...i, label: "Unknown member" },
    );
    return (
      <Panel title={title} error={error} empty={!named?.length}>
        {named ? <RankedList items={named} format={format} /> : null}
      </Panel>
    );
  }

  const topSum = items?.length
    ? items.reduce((sum, i) => sum + i.value, 0)
    : null;
  // Clamped: the two figures come from different endpoints and can disagree slightly.
  const share = topSum !== null && total ? Math.min(topSum / total, 1) : null;

  return (
    <Panel
      title={title}
      description={
        showNames
          ? "Statbot didn't return member names for this list."
          : "Member names are hidden on this public site."
      }
      error={error}
      empty={share === null && !topSum}
      emptyText="Not enough data to work this out yet."
    >
      {share !== null ? (
        <>
          <p className="stat-value">{fmtPercent(share)}</p>
          <p className="panel-description">
            of all {unit} came from the {items?.length ?? 0} most active
            members.
          </p>
        </>
      ) : (
        // No overall total to compare against (e.g. invites), so give the amount instead.
        <>
          <p className="stat-value">{fmtValue(topSum ?? 0, format)}</p>
          <p className="panel-description">
            {unit} came from the {items?.length ?? 0} most active members.
          </p>
        </>
      )}
    </Panel>
  );
}

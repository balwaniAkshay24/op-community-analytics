import { fmtValue, type ValueFormat } from "@/lib/format";
import type { Ranked } from "@/lib/statbot/normalize";

export function RankedList({
  items,
  format = "number",
}: {
  items: Ranked[];
  format?: ValueFormat;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="ranked">
      {items.map((item, index) => (
        <li key={item.id || `${item.label}-${index}`} className="ranked-item">
          <span className="ranked-label">{item.label || "Unknown"}</span>
          <span className="ranked-value">{fmtValue(item.value, format)}</span>
          <span className="ranked-bar" aria-hidden="true">
            <span style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

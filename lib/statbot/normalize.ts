/**
 * Turns Statbot responses into shapes the charts and lists can use.
 *
 * The docs list each response by name but not field by field, so these functions
 * look for common field names instead of assuming one exact shape. Once you've seen
 * real responses in /explorer, tighten them up with proper types.
 */
import { fmtDay } from "../format";

type Obj = Record<string, unknown>;

export type ChartDatum = Record<string, string | number>;
export type Rows = { rows: ChartDatum[]; keys: string[] };
export type Ranked = { id: string; label: string; value: number };

const TIME_KEYS = [
  "unixTimestamp",
  "time",
  "timestamp",
  "date",
  "t",
  "start",
  "bucket",
  "period",
  "day",
  "x",
];
const LABEL_KEYS = [
  "name",
  "displayName",
  "globalName",
  "username",
  "nick",
  "title",
  "code",
  "activity",
];
const VALUE_KEYS = [
  "count",
  "total",
  "sum",
  "value",
  "messages",
  "seconds",
  "minutes",
  "uses",
  "joins",
];
const NESTED_KEYS = [
  "member",
  "user",
  "channel",
  "invite",
  "activity",
  "inviter",
];
const WRAPPER_KEYS = [
  "data",
  "series",
  "results",
  "items",
  "counts",
  "values",
  "members",
  "channels",
  "invites",
];

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isIdKey = (k: string) => /id$/i.test(k);
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Find the list inside a response: the response itself, `data`, `series`, or the first array field. */
export function findArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (isObj(json)) {
    for (const k of WRAPPER_KEYS) {
      const v = json[k];
      if (Array.isArray(v)) return v;
      if (isObj(v)) {
        const inner = findArray(v);
        if (inner.length) return inner;
      }
    }
    for (const v of Object.values(json)) if (Array.isArray(v)) return v;
  }
  return [];
}

/** Accepts seconds, milliseconds, numeric strings or ISO dates. */
export function toTimestamp(v: unknown): number | null {
  if (isNum(v)) return v < 1e11 ? v * 1000 : v;
  if (typeof v === "string" && v.trim() !== "") {
    if (/^\d+$/.test(v)) return toTimestamp(Number(v));
    const parsed = Date.parse(v);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/** Time series → rows sorted by time, each with `t`, `label` and every numeric field. */
export function toRows(json: unknown): Rows {
  const keys = new Set<string>();
  const rows: ChartDatum[] = [];

  for (const item of findArray(json)) {
    let t: number | null = null;
    const values: Record<string, number> = {};

    if (Array.isArray(item)) {
      t = toTimestamp(item[0]);
      if (isNum(item[1])) values.value = item[1];
    } else if (isObj(item)) {
      for (const k of TIME_KEYS) {
        if (k in item) {
          t = toTimestamp(item[k]);
          if (t !== null) break;
        }
      }
      for (const [k, v] of Object.entries(item)) {
        if (TIME_KEYS.includes(k) || isIdKey(k)) continue;
        if (isNum(v)) values[k] = v;
      }
    }

    if (t === null || Object.keys(values).length === 0) continue;
    Object.keys(values).forEach((k) => keys.add(k));
    rows.push({ t, label: fmtDay(t), ...values });
  }

  rows.sort((a, b) => Number(a.t) - Number(b.t));
  return { rows, keys: [...keys] };
}

/** First of `preferred` that exists in the rows, else the first numeric key. */
export function pickKey(data: Rows, preferred: string[] = []): string | null {
  return preferred.find((k) => data.keys.includes(k)) ?? data.keys[0] ?? null;
}

export function sumKey(data: Rows, key: string | null): number | null {
  if (!key || data.rows.length === 0) return null;
  return data.rows.reduce(
    (sum, row) => sum + (isNum(row[key]) ? (row[key] as number) : 0),
    0,
  );
}

export function lastValue(data: Rows, key: string | null): number | null {
  if (!key) return null;
  for (let i = data.rows.length - 1; i >= 0; i--) {
    const v = data.rows[i][key];
    if (isNum(v)) return v;
  }
  return null;
}

export function firstValue(data: Rows, key: string | null): number | null {
  if (!key) return null;
  for (const row of data.rows) {
    const v = row[key];
    if (isNum(v)) return v;
  }
  return null;
}

/** A single total from a "sums" response. Falls back to summing a series. */
export function toTotal(json: unknown): number | null {
  if (isNum(json)) return json;
  if (isObj(json)) {
    for (const k of VALUE_KEYS) if (isNum(json[k])) return json[k] as number;
    if (isObj(json.data)) {
      const inner = toTotal(json.data);
      if (inner !== null) return inner;
    }
    for (const v of Object.values(json)) if (isNum(v)) return v;
  }
  const series = toRows(json);
  return sumKey(series, pickKey(series, VALUE_KEYS));
}

function findId(o: Obj): string {
  if (typeof o.id === "string" || isNum(o.id)) return String(o.id);
  for (const [k, v] of Object.entries(o)) {
    if (isIdKey(k) && (typeof v === "string" || isNum(v))) return String(v);
  }
  for (const k of NESTED_KEYS) {
    const nested = o[k];
    if (isObj(nested)) {
      const id = findId(nested);
      if (id) return id;
    }
  }
  return "";
}

function findLabel(o: Obj): string | null {
  for (const k of LABEL_KEYS) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  for (const k of NESTED_KEYS) {
    const nested = o[k];
    if (isObj(nested)) {
      const label = findLabel(nested);
      if (label) return label;
    }
  }
  return null;
}

function findValue(o: Obj): number | null {
  for (const k of VALUE_KEYS) if (isNum(o[k])) return o[k] as number;
  for (const [k, v] of Object.entries(o)) if (!isIdKey(k) && isNum(v)) return v;
  return null;
}

/** A "tops" response → ranked list, highest first. */
export function toRanked(json: unknown, limit = 10): Ranked[] {
  const out: Ranked[] = [];
  for (const item of findArray(json)) {
    if (!isObj(item)) continue;
    const value = findValue(item);
    if (value === null) continue;
    const id = findId(item);
    out.push({ id, label: findLabel(item) ?? id, value });
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** A channel list → Map of id to name, for labelling top-channel results. */
export function toNameMap(json: unknown): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of findArray(json)) {
    if (!isObj(item)) continue;
    const id = findId(item);
    const name = findLabel(item);
    if (id && name) map.set(id, name);
  }
  return map;
}

export function withNames(
  items: Ranked[],
  names: Map<string, string>,
  prefix = "#",
): Ranked[] {
  return items.map((item) => {
    const name = names.get(item.id);
    return name ? { ...item, label: `${prefix}${name}` } : item;
  });
}

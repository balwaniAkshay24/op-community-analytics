export const LOCALE = "en-IN";
export const TIME_ZONE = "Asia/Kolkata";

/**
 * Statbot returns voice time in minutes (confirmed against the dashboard).
 */
export const VOICE_UNIT: "seconds" | "minutes" = "minutes";

export type ValueFormat = "number" | "voice";

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(Math.round(n));
}

export function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function fmtSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "\u2212" : "";
  return `${sign}${fmtNumber(Math.abs(n))}`;
}

export function fmtPercent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function fmtDay(t: number): string {
  return new Date(t).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  });
}

export function fmtVoice(value: number): string {
  const minutes = VOICE_UNIT === "seconds" ? value / 60 : value;
  if (minutes < 60) return `${fmtNumber(minutes)} min`;
  return `${fmtNumber(minutes / 60)} h`;
}

export function fmtValue(
  value: number,
  format: ValueFormat = "number",
): string {
  return format === "voice" ? fmtVoice(value) : fmtNumber(value);
}

export function fmtAxis(value: number, format: ValueFormat = "number"): string {
  if (format === "voice") {
    const hours = VOICE_UNIT === "seconds" ? value / 3600 : value / 60;
    return `${fmtCompact(hours)}h`;
  }
  return fmtCompact(value);
}

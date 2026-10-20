export type PeriodKind = "day" | "week" | "month" | "custom";

export function todayInTimezone(timezone: string, instant: Date = new Date()): string {
  try {
    const pieces = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(instant);
    const value = Object.fromEntries(pieces.map((piece) => [piece.type, piece.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

export type ReportRange = {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  fullEnd: string;
  label: string;
  comparisonLabel: string;
  partial: boolean;
};

const DAY_MS = 86_400_000;

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function iso(date: Date): string { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number): Date { return new Date(date.getTime() + days * DAY_MS); }
function daysBetween(start: Date, end: Date): number { return Math.round((end.getTime() - start.getTime()) / DAY_MS); }
function monthEnd(year: number, month: number): Date { return new Date(Date.UTC(year, month + 1, 0)); }

export function makeReportRange(kind: PeriodKind, todayValue: string, weekStartsOn: number, anchorValue?: string, customStart?: string, customEnd?: string): ReportRange {
  const today = parseDateOnly(todayValue);
  if (!today) throw new Error("The current date is unavailable.");
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) throw new Error("The week start setting is invalid.");
  const anchor = anchorValue ? parseDateOnly(anchorValue) : today;
  if (!anchor) throw new Error("Choose a valid report date.");

  let start: Date;
  let fullEnd: Date;
  let previousStart: Date;
  let label: string;

  if (kind === "day") {
    start = anchor;
    fullEnd = anchor;
    previousStart = addDays(start, -1);
    label = "Daily report";
  } else if (kind === "week") {
    start = addDays(anchor, -((anchor.getUTCDay() - weekStartsOn + 7) % 7));
    fullEnd = addDays(start, 6);
    previousStart = addDays(start, -7);
    label = "Weekly report";
  } else if (kind === "month") {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    fullEnd = monthEnd(anchor.getUTCFullYear(), anchor.getUTCMonth());
    previousStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
    label = "Monthly report";
  } else {
    const from = parseDateOnly(customStart || "");
    const to = parseDateOnly(customEnd || "");
    if (!from || !to || from > to) throw new Error("Choose a valid custom date range.");
    if (daysBetween(from, to) > 365) throw new Error("Custom reports can cover up to 366 days.");
    start = from;
    fullEnd = to;
    previousStart = addDays(start, -(daysBetween(start, fullEnd) + 1));
    label = "Custom report";
  }

  if (start > today) throw new Error("Choose a period that has started.");
  const end = fullEnd > today ? today : fullEnd;
  const elapsedDays = daysBetween(start, end);
  if (kind === "custom") previousStart = addDays(start, -(elapsedDays + 1));
  const previousFullEnd = kind === "month"
    ? monthEnd(previousStart.getUTCFullYear(), previousStart.getUTCMonth())
    : addDays(previousStart, daysBetween(start, fullEnd));
  const previousEnd = addDays(previousStart, Math.min(elapsedDays, daysBetween(previousStart, previousFullEnd)));
  const partial = end < fullEnd;
  const comparisonDays = daysBetween(previousStart, previousEnd) + 1;
  const currentDays = elapsedDays + 1;
  const prefix = comparisonDays < currentDays
    ? `Previous calendar month is shorter (${comparisonDays} days versus ${currentDays} days)`
    : partial ? "Previous equivalent elapsed period" : "Previous equivalent period";

  return {
    start: iso(start), end: iso(end), previousStart: iso(previousStart),
    previousEnd: iso(previousEnd), fullEnd: iso(fullEnd), label, partial,
    comparisonLabel: `${prefix}: ${iso(previousStart)} to ${iso(previousEnd)}`,
  };
}

export function comparisonText(currentMinor: string, previousMinor: string): string {
  const current = BigInt(currentMinor);
  const previous = BigInt(previousMinor);
  if (previous === 0n) return current === 0n ? "No change; both periods are zero." : "No percentage comparison; the previous period was zero.";
  const difference = current - previous;
  if (difference === 0n) return "No change from the previous period.";
  const absolute = difference < 0n ? -difference : difference;
  const percentTenths = (absolute * 1000n + previous / 2n) / previous;
  const whole = percentTenths / 10n;
  const fraction = percentTenths % 10n;
  return `${whole}.${fraction}% ${difference > 0n ? "higher" : "lower"} than the previous equivalent period.`;
}

import type { GoalHorizon, OccurrenceStatus, Pillar, Priority } from "@/types/domain";

export function formatDuration(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes)) return "-";
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function formatHours(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(totalMinutes >= 600 ? 0 : 1)}h`;
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(sec)}`;
}

/** Instant → "10:30 AM" in the user's timezone. */
export function formatClock(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}

/** Instant → "HH:mm" (24h, for inputs) in the user's timezone. */
export function toTimeInput(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: tz,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** "HH:mm[:ss]" wall-clock → "10:30 AM". */
export function formatWallTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

const dateFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
const asUTC = (d: string) => new Date(`${d}T00:00:00Z`);

/** yyyy-MM-dd → "Wednesday, November 11" */
export function formatLongDate(d: string) {
  return dateFmt({ weekday: "long", month: "long", day: "numeric" }).format(asUTC(d));
}
/** yyyy-MM-dd → "Wed, Nov 11" */
export function formatShortDate(d: string) {
  return dateFmt({ weekday: "short", month: "short", day: "numeric" }).format(asUTC(d));
}
/** yyyy-MM-dd → "Nov 11" */
export function formatMonthDay(d: string) {
  return dateFmt({ month: "short", day: "numeric" }).format(asUTC(d));
}
/** yyyy-MM-dd → "Nov 11, 2026" */
export function formatFullDate(d: string) {
  return dateFmt({ month: "short", day: "numeric", year: "numeric" }).format(asUTC(d));
}
export function formatWeekdayShort(d: string) {
  return dateFmt({ weekday: "short" }).format(asUTC(d));
}

export function relativeDayLabel(d: string, today: string, addDays: (x: string, n: number) => string) {
  if (d === today) return "Today";
  if (d === addDays(today, 1)) return "Tomorrow";
  if (d === addDays(today, -1)) return "Yesterday";
  return formatShortDate(d);
}

export function formatPercent(v: number | null | undefined, digits = 0) {
  return v == null ? "-" : `${v.toFixed(digits)}%`;
}

export function formatNumber(v: number | null | undefined) {
  if (v == null) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
}

// ---------------- labels ----------------

export const PILLAR_LABEL: Record<Pillar, string> = { health: "Health", finance: "Finance", growth: "Growth" };
export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };
export const HORIZON_LABEL: Record<GoalHorizon, string> = {
  daily: "Daily",
  monthly: "Monthly",
  six_month: "Six-month",
  yearly: "Yearly",
};
export const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  missed: "Missed",
  rescheduled: "Rescheduled",
};
export const WEEKDAYS = [
  { value: 1, short: "Mo", label: "Monday" },
  { value: 2, short: "Tu", label: "Tuesday" },
  { value: 3, short: "We", label: "Wednesday" },
  { value: 4, short: "Th", label: "Thursday" },
  { value: 5, short: "Fr", label: "Friday" },
  { value: 6, short: "Sa", label: "Saturday" },
  { value: 0, short: "Su", label: "Sunday" },
];

export function greeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

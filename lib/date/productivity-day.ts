/**
 * Productivity-day engine.
 *
 * A productivity day D starts at `dayStartMinutes` (local wall-clock time,
 * in the user's IANA timezone) on calendar date D and ends immediately
 * before the same wall-clock time on D + 1.
 *
 * Instants are always stored as UTC; productivity dates ("yyyy-MM-dd") are
 * derived here. Pure module with no framework imports, so it is unit tested
 * directly with `node --test`.
 */
import { TZDate } from "@date-fns/tz";

export const DEFAULT_DAY_START_MINUTES = 6 * 60;

export type ISODate = string; // yyyy-MM-dd

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

/** Calendar date arithmetic on yyyy-MM-dd strings (timezone-free). */
export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** First day of the week containing `date`. */
export function startOfWeek(date: ISODate, weekStartsOn: 0 | 1): ISODate {
  const offset = (weekdayOf(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

/** Local calendar date of an instant in `tz`. */
export function localDateOf(instant: Date, tz: string): ISODate {
  const z = new TZDate(instant.getTime(), tz);
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
}

/** Productivity date that an instant belongs to. */
export function productivityDateOf(
  instant: Date,
  tz: string,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES,
): ISODate {
  const z = new TZDate(instant.getTime(), tz);
  const minutes = z.getHours() * 60 + z.getMinutes();
  const calendar = `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
  return minutes < dayStartMinutes ? addDays(calendar, -1) : calendar;
}

/** Converts a local wall-clock time on a calendar date to a UTC instant. */
export function zonedInstant(date: ISODate, minutesOfDay: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const h = Math.floor(minutesOfDay / 60);
  const min = minutesOfDay % 60;
  return new Date(new TZDate(y, m - 1, d, h, min, 0, 0, tz).getTime());
}

/** [start, end) instants covering productivity day `date`. */
export function productivityDayRange(
  date: ISODate,
  tz: string,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES,
): { start: Date; end: Date } {
  return {
    start: zonedInstant(date, dayStartMinutes, tz),
    end: zonedInstant(addDays(date, 1), dayStartMinutes, tz),
  };
}

export function currentProductivityDate(
  tz: string,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES,
  now: Date = new Date(),
): ISODate {
  return productivityDateOf(now, tz, dayStartMinutes);
}

/** "HH:mm" or "HH:mm:ss" → minutes after midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

/**
 * Converts a local date + "HH:mm" entered by the user to a UTC instant. A
 * time earlier than the day boundary is interpreted as belonging to the
 * *following* calendar day, so on productivity day Nov 11 (6 AM boundary)
 * "01:30" means Nov 12 01:30 local.
 */
export function productivityTimeToInstant(
  productivityDate: ISODate,
  time: string,
  tz: string,
  dayStartMinutes: number = DEFAULT_DAY_START_MINUTES,
): Date {
  const minutes = timeToMinutes(time);
  const calendar = minutes < dayStartMinutes ? addDays(productivityDate, 1) : productivityDate;
  return zonedInstant(calendar, minutes, tz);
}

/** Sort key for a planned time within a productivity day (boundary-relative). */
export function minutesIntoProductivityDay(time: string, dayStartMinutes: number): number {
  return (timeToMinutes(time) - dayStartMinutes + 1440) % 1440;
}

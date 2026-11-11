import type { Recurrence } from "../../types/domain.ts";
import { addDays, diffDays, weekdayOf, type ISODate } from "../date/productivity-day.ts";

/** How far ahead recurring occurrences are materialised. */
export const MATERIALIZE_HORIZON_DAYS = 35;

export function occursOn(rule: Recurrence, start: ISODate, date: ISODate, end?: ISODate | null): boolean {
  if (date < start) return false;
  if (end && date > end) return false;
  switch (rule.type) {
    case "daily":
      return true;
    case "weekly":
      return rule.weekdays.includes(weekdayOf(date));
    case "interval":
      return rule.every >= 1 && diffDays(start, date) % rule.every === 0;
  }
}

/** All dates in [from, to] on which the rule occurs. */
export function recurrenceDates(
  rule: Recurrence,
  start: ISODate,
  from: ISODate,
  to: ISODate,
  end?: ISODate | null,
): ISODate[] {
  const out: ISODate[] = [];
  let d = from < start ? start : from;
  const last = end && end < to ? end : to;
  for (; d <= last; d = addDays(d, 1)) {
    if (occursOn(rule, start, d, end)) out.push(d);
  }
  return out;
}

/**
 * Which dates still need materialising for a recurring task, given how far
 * it has already been materialised and the window the caller needs.
 */
export function pendingMaterialization(
  rule: Recurrence,
  start: ISODate,
  end: ISODate | null,
  materializedUntil: ISODate | null,
  needUntil: ISODate,
): { dates: ISODate[]; newMaterializedUntil: ISODate } | null {
  if (materializedUntil && materializedUntil >= needUntil) return null;
  const from = materializedUntil ? addDays(materializedUntil, 1) : start;
  return {
    dates: recurrenceDates(rule, start, from, needUntil, end),
    newMaterializedUntil: needUntil,
  };
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeRecurrence(rule: Recurrence | null): string | null {
  if (!rule) return null;
  switch (rule.type) {
    case "daily":
      return "Every day";
    case "weekly": {
      const days = [...rule.weekdays].sort();
      if (days.join() === "1,2,3,4,5") return "Weekdays";
      if (days.join() === "0,6") return "Weekends";
      return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
    }
    case "interval":
      return rule.every === 1 ? "Every day" : `Every ${rule.every} days`;
  }
}

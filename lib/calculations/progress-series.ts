/**
 * Groups daily stats into chart buckets whose size grows with the span, so a
 * progress chart stays readable as history accumulates:
 *   ≤ 45 days → daily · ≤ 210 days → weekly · longer → monthly.
 */
import type { ISODate } from "../date/productivity-day.ts";
import { startOfWeek } from "../date/productivity-day.ts";
import type { DayStat } from "./daily-series.ts";

export type Granularity = "day" | "week" | "month";

export interface ProgressPoint {
  /** first date of the bucket */
  start: ISODate;
  /** number of days in the bucket */
  days: number;
  score: number | null;
  tasks: number | null;
  habits: number | null;
  reduce: number | null;
  /** average hours per day */
  deep: number;
  external: number;
  personal: number;
}

export function granularityFor(spanDays: number): Granularity {
  if (spanDays <= 45) return "day";
  if (spanDays <= 210) return "week";
  return "month";
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

export function buildProgressSeries(days: DayStat[], weekStartsOn: 0 | 1): { granularity: Granularity; points: ProgressPoint[] } {
  const granularity = granularityFor(days.length);
  const keyOf = (d: ISODate) =>
    granularity === "day" ? d : granularity === "week" ? startOfWeek(d, weekStartsOn) : `${d.slice(0, 7)}-01`;

  const groups = new Map<ISODate, DayStat[]>();
  for (const d of days) {
    const k = keyOf(d.date);
    const g = groups.get(k);
    if (g) g.push(d);
    else groups.set(k, [d]);
  }

  const points: ProgressPoint[] = [];
  for (const [start, ds] of groups) {
    const sum = (f: (d: DayStat) => number) => ds.reduce((s, d) => s + f(d), 0);
    const scores = ds.map((d) => d.score).filter((s): s is number => s != null);
    points.push({
      start,
      days: ds.length,
      score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      tasks: pct(sum((d) => d.tasks.completed), sum((d) => d.tasks.total)),
      habits: pct(sum((d) => d.goodHabits.met), sum((d) => d.goodHabits.scheduled)),
      reduce: pct(sum((d) => d.badHabits.met), sum((d) => d.badHabits.scheduled)),
      deep: sum((d) => d.minutes.deep) / 60 / ds.length,
      external: sum((d) => d.minutes.external) / 60 / ds.length,
      personal: sum((d) => d.minutes.personal) / 60 / ds.length,
    });
  }
  return { granularity, points };
}

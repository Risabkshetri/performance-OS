/**
 * Builds per-productivity-day statistics from raw records. Pure: the data
 * layer fetches rows, this module does the aggregation.
 */
import type {
  ActivityKind,
  Habit,
  HabitKind,
  HabitLog,
  OccurrenceStatus,
  Pillar,
  ScoreWeights,
} from "../../types/domain.ts";
import type { ISODate } from "../date/productivity-day.ts";
import { isScheduledOn } from "./habits.ts";
import { computeDayScore, type DayScore } from "./score.ts";

export const PILLARS: Pillar[] = ["health", "finance", "growth"];

export interface SeriesInputs {
  dates: ISODate[];
  occurrences: { scheduled_date: ISODate; status: OccurrenceStatus; pillar: Pillar }[];
  habits: Pick<Habit, "id" | "kind" | "pillar" | "frequency" | "start_date" | "active" | "archived_at">[];
  logs: Pick<HabitLog, "habit_id" | "log_date" | "met" | "kind_snapshot">[];
  reviewDates: Set<ISODate>;
  activities: { productivity_date: ISODate; kind: ActivityKind; minutes: number }[];
  weights: ScoreWeights;
  /** Converts an archived_at timestamp to the productivity date it happened on. */
  archivedDate?: (archivedAt: string) => ISODate;
}

export interface DayStat extends DayScore {
  date: ISODate;
  tasks: { total: number; completed: number; missed: number; rescheduled: number; open: number };
  goodHabits: { scheduled: number; met: number };
  badHabits: { scheduled: number; met: number };
  reviewed: boolean;
  minutes: Record<ActivityKind, number>;
  pillars: Record<Pillar, { done: number; total: number }>;
}

export function buildDailySeries(input: SeriesInputs): DayStat[] {
  const byDate = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      const list = m.get(k);
      if (list) list.push(r);
      else m.set(k, [r]);
    }
    return m;
  };
  const occByDate = byDate(input.occurrences, (o) => o.scheduled_date);
  const logsByDate = byDate(input.logs, (l) => l.log_date);
  const actByDate = byDate(input.activities, (a) => a.productivity_date);
  const habitById = new Map(input.habits.map((h) => [h.id, h]));

  return input.dates.map((date) => {
    const pillars: DayStat["pillars"] = {
      health: { done: 0, total: 0 },
      finance: { done: 0, total: 0 },
      growth: { done: 0, total: 0 },
    };

    // tasks
    const occ = occByDate.get(date) ?? [];
    const tasks = { total: occ.length, completed: 0, missed: 0, rescheduled: 0, open: 0 };
    for (const o of occ) {
      const done = o.status === "completed";
      if (done) tasks.completed++;
      else if (o.status === "missed") tasks.missed++;
      else if (o.status === "rescheduled") tasks.rescheduled++;
      else tasks.open++;
      pillars[o.pillar].total++;
      if (done) pillars[o.pillar].done++;
    }

    // habits: every log counts (with its snapshot); scheduled-but-unlogged counts as not met
    const good = { scheduled: 0, met: 0 };
    const bad = { scheduled: 0, met: 0 };
    const tally = (kind: HabitKind, met: boolean, pillar: Pillar | undefined) => {
      const bucket = kind === "good" ? good : bad;
      bucket.scheduled++;
      if (met) bucket.met++;
      if (pillar) {
        pillars[pillar].total++;
        if (met) pillars[pillar].done++;
      }
    };
    const dayLogs = logsByDate.get(date) ?? [];
    const logged = new Set<string>();
    for (const l of dayLogs) {
      logged.add(l.habit_id);
      tally(l.kind_snapshot, l.met, habitById.get(l.habit_id)?.pillar);
    }
    for (const h of input.habits) {
      if (logged.has(h.id) || !h.active) continue;
      if (h.archived_at && input.archivedDate && input.archivedDate(h.archived_at) <= date) continue;
      if (!isScheduledOn(h, date)) continue;
      tally(h.kind, false, h.pillar);
    }

    // time
    const minutes: Record<ActivityKind, number> = { deep: 0, external: 0, personal: 0, other: 0 };
    for (const a of actByDate.get(date) ?? []) minutes[a.kind] += a.minutes;

    const reviewed = input.reviewDates.has(date);
    const score = computeDayScore(
      { tasks: { total: tasks.total, completed: tasks.completed }, goodHabits: good, badHabits: bad, reviewed },
      input.weights,
    );

    return { date, ...score, tasks, goodHabits: good, badHabits: bad, reviewed, minutes, pillars };
  });
}

/** Aggregate pillar completion over a set of days (0..100 or null). */
export function pillarPercent(days: DayStat[], pillar: Pillar): number | null {
  let done = 0;
  let total = 0;
  for (const d of days) {
    done += d.pillars[pillar].done;
    total += d.pillars[pillar].total;
  }
  return total ? Math.round((done / total) * 100) : null;
}

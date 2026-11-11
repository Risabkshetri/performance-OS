import "server-only";
import type { AppContext } from "./context";
import { getHabits, getHabitLogs } from "./queries";
import { dateRange, productivityDateOf, type ISODate } from "@/lib/date/productivity-day";
import { buildDailySeries, type DayStat } from "@/lib/calculations/daily-series";
import type { ActivityKind, Habit, HabitLog, OccurrenceStatus, Pillar } from "@/types/domain";

interface OccRow {
  scheduled_date: string;
  status: OccurrenceStatus;
  task: { pillar: Pillar };
}
interface ActRow {
  productivity_date: string;
  started_at: string;
  ended_at: string | null;
  category: { kind: ActivityKind } | null;
}

export interface DailyStatsBundle {
  days: DayStat[];
  habits: Habit[];
  logs: HabitLog[];
}

/** Per-day stats for [from, to], computed server-side from real records. */
export async function getDailyStats(ctx: AppContext, from: ISODate, to: ISODate): Promise<DailyStatsBundle> {
  const { supabase } = ctx;
  const [occRes, actRes, revRes, habits, logs] = await Promise.all([
    supabase
      .from("task_occurrences")
      .select("scheduled_date, status, task:tasks!inner(pillar)")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .overrideTypes<OccRow[], { merge: false }>(),
    supabase
      .from("activities")
      .select("productivity_date, started_at, ended_at, category:activity_categories(kind)")
      .gte("productivity_date", from)
      .lte("productivity_date", to)
      .overrideTypes<ActRow[], { merge: false }>(),
    supabase.from("daily_reviews").select("review_date").gte("review_date", from).lte("review_date", to),
    getHabits(ctx, true),
    getHabitLogs(ctx, from, to),
  ]);
  for (const r of [occRes, actRes, revRes]) if (r.error) throw new Error(r.error.message);

  const now = Date.now();
  const days = buildDailySeries({
    dates: dateRange(from, to),
    occurrences: (occRes.data ?? []).map((o) => ({
      scheduled_date: o.scheduled_date,
      status: o.status,
      pillar: o.task.pillar,
    })),
    habits,
    logs,
    reviewDates: new Set((revRes.data ?? []).map((r: { review_date: string }) => r.review_date)),
    activities: (actRes.data ?? []).map((a) => ({
      productivity_date: a.productivity_date,
      kind: a.category?.kind ?? "other",
      minutes: Math.max(0, ((a.ended_at ? Date.parse(a.ended_at) : now) - Date.parse(a.started_at)) / 60000),
    })),
    weights: ctx.profile.score_weights,
    archivedDate: (ts) => productivityDateOf(new Date(ts), ctx.tz, ctx.dayStart),
  });
  return { days, habits, logs };
}

/** Earliest productivity date with any task, habit check-in or activity (null if none). */
export async function getFirstRecordDate(ctx: AppContext): Promise<ISODate | null> {
  const { supabase } = ctx;
  const first = async (table: string, col: string) => {
    const { data } = await supabase.from(table).select(col).order(col, { ascending: true }).limit(1).maybeSingle<Record<string, string>>();
    return data?.[col] ?? null;
  };
  const dates = (
    await Promise.all([
      first("task_occurrences", "scheduled_date"),
      first("habit_logs", "log_date"),
      first("activities", "productivity_date"),
    ])
  ).filter((d): d is string => d != null && d <= ctx.today);
  return dates.length ? dates.sort()[0] : null;
}

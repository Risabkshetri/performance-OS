import "server-only";
import type { AppContext } from "./context";
import { addDays, minutesIntoProductivityDay, type ISODate } from "@/lib/date/productivity-day";
import { MATERIALIZE_HORIZON_DAYS, pendingMaterialization } from "@/lib/calculations/recurrence";
import type { PlannedTask, Task } from "@/types/domain";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * Brings task occurrences up to date:
 *  1. materialises recurring occurrences up to `needUntil` (idempotent via a
 *     partial unique index), and
 *  2. marks pending / in-progress occurrences from past productivity days
 *     as missed.
 */
export async function syncTasks(ctx: AppContext, needUntil?: ISODate) {
  const { supabase, userId, today } = ctx;
  const target = needUntil && needUntil > addDays(today, MATERIALIZE_HORIZON_DAYS)
    ? needUntil
    : addDays(today, MATERIALIZE_HORIZON_DAYS);

  const { data: recurring } = await supabase
    .from("tasks")
    .select("id, recurrence, recurrence_start, recurrence_end, materialized_until, planned_start, planned_end")
    .not("recurrence", "is", null)
    .is("archived_at", null)
    .or(`materialized_until.is.null,materialized_until.lt.${target}`)
    .overrideTypes<Pick<Task, "id" | "recurrence" | "recurrence_start" | "recurrence_end" | "materialized_until" | "planned_start" | "planned_end">[], { merge: false }>();

  for (const t of recurring ?? []) {
    if (!t.recurrence || !t.recurrence_start) continue;
    const plan = pendingMaterialization(t.recurrence, t.recurrence_start, t.recurrence_end, t.materialized_until, target);
    if (!plan) continue;
    if (plan.dates.length) {
      const { error } = await supabase.from("task_occurrences").upsert(
        plan.dates.map((d) => ({
          user_id: userId,
          task_id: t.id,
          scheduled_date: d,
          planned_start: t.planned_start,
          planned_end: t.planned_end,
          origin: "recurrence",
        })),
        { onConflict: "task_id,scheduled_date", ignoreDuplicates: true },
      );
      if (error) continue;
    }
    await supabase.from("tasks").update({ materialized_until: plan.newMaterializedUntil }).eq("id", t.id);
  }

  await supabase
    .from("task_occurrences")
    .update({ status: "missed" })
    .in("status", ["pending", "in_progress"])
    .lt("scheduled_date", today);
}

export async function getPlannedTasks(ctx: AppContext, from: ISODate, to: ISODate): Promise<PlannedTask[]> {
  const { data, error } = await ctx.supabase
    .from("task_occurrences")
    .select("*, task:tasks!inner(*)")
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .overrideTypes<PlannedTask[], { merge: false }>();
  if (error) throw new Error(error.message);
  return sortTasks(data ?? [], ctx.dayStart);
}

export function sortTasks(tasks: PlannedTask[], dayStart: number): PlannedTask[] {
  const statusRank = (s: PlannedTask["status"]) =>
    s === "in_progress" ? 0 : s === "pending" ? 1 : s === "missed" ? 2 : s === "completed" ? 3 : 4;
  return [...tasks].sort((a, b) => {
    if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date < b.scheduled_date ? -1 : 1;
    const sa = statusRank(a.status);
    const sb = statusRank(b.status);
    if (sa !== sb) return sa - sb;
    const ta = a.planned_start ? minutesIntoProductivityDay(a.planned_start, dayStart) : 9999;
    const tb = b.planned_start ? minutesIntoProductivityDay(b.planned_start, dayStart) : 9999;
    if (ta !== tb) return ta - tb;
    return PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
  });
}

/** Minutes of activity logged against each occurrence (for planned vs actual). */
export async function getActualMinutesByOccurrence(ctx: AppContext, occurrenceIds: string[]) {
  const map = new Map<string, number>();
  if (!occurrenceIds.length) return map;
  const { data } = await ctx.supabase
    .from("activities")
    .select("task_occurrence_id, started_at, ended_at")
    .in("task_occurrence_id", occurrenceIds)
    .not("ended_at", "is", null)
    .overrideTypes<{ task_occurrence_id: string; started_at: string; ended_at: string }[], { merge: false }>();
  for (const a of data ?? []) {
    const m = (Date.parse(a.ended_at) - Date.parse(a.started_at)) / 60000;
    map.set(a.task_occurrence_id, (map.get(a.task_occurrence_id) ?? 0) + m);
  }
  return map;
}

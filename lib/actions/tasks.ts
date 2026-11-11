"use server";

import { z } from "zod";
import { dbFail, invalid, withAuth } from "./helpers";
import { rescheduleSchema, taskSchema, type TaskInput } from "@/lib/validations";
import { syncTasks } from "@/lib/data/tasks";
import { addDays } from "@/lib/date/productivity-day";
import type { ActionResult, OccurrenceStatus, Recurrence } from "@/types/domain";

function toRecurrence(r: z.output<typeof taskSchema>["repeat"]): Recurrence | null {
  switch (r.type) {
    case "none":
      return null;
    case "daily":
      return { type: "daily" };
    case "weekly":
      return { type: "weekly", weekdays: [...new Set(r.weekdays)].sort() };
    case "interval":
      return { type: "interval", every: r.every };
  }
}

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const t = parsed.data;

  return withAuth(async (ctx) => {
    const recurrence = toRecurrence(t.repeat);
    const { data: task, error } = await ctx.supabase
      .from("tasks")
      .insert({
        user_id: ctx.userId,
        title: t.title,
        description: t.description,
        pillar: t.pillar,
        priority: t.priority,
        goal_id: t.goal_id,
        estimated_minutes: t.estimated_minutes,
        planned_start: t.planned_start,
        planned_end: t.planned_end,
        recurrence,
        recurrence_start: recurrence ? t.scheduled_date : null,
        recurrence_end: recurrence ? t.repeat.until : null,
      })
      .select("id")
      .single();
    if (error) return dbFail(error);

    if (recurrence) {
      await syncTasks(ctx);
    } else {
      const { error: occError } = await ctx.supabase.from("task_occurrences").insert({
        user_id: ctx.userId,
        task_id: task.id,
        scheduled_date: t.scheduled_date,
        planned_start: t.planned_start,
        planned_end: t.planned_end,
        origin: "single",
      });
      if (occError) {
        await ctx.supabase.from("tasks").delete().eq("id", task.id);
        return dbFail(occError);
      }
    }
    return { ok: true, message: recurrence ? "Recurring task created" : "Task added" };
  });
}

/**
 * Updates a task. Definition fields apply to the whole series; for a
 * recurring task, changed times/recurrence affect only *future pending*
 * occurrences; history is left untouched.
 */
export async function updateTask(occurrenceId: string, input: TaskInput): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!z.uuid().safeParse(occurrenceId).success) return { ok: false, error: "Unknown task" };
  const t = parsed.data;

  return withAuth(async (ctx) => {
    const { data: occ, error: occErr } = await ctx.supabase
      .from("task_occurrences")
      .select("id, task_id, status, scheduled_date, task:tasks!inner(recurrence, recurrence_start)")
      .eq("id", occurrenceId)
      .single<{
        id: string;
        task_id: string;
        status: OccurrenceStatus;
        scheduled_date: string;
        task: { recurrence: Recurrence | null; recurrence_start: string | null };
      }>();
    if (occErr || !occ) return { ok: false, error: "Task not found" };

    const wasRecurring = occ.task.recurrence != null;
    const recurrence = toRecurrence(t.repeat);
    const ruleChanged = JSON.stringify(recurrence) !== JSON.stringify(occ.task.recurrence);

    const update: Record<string, unknown> = {
      title: t.title,
      description: t.description,
      pillar: t.pillar,
      priority: t.priority,
      goal_id: t.goal_id,
      estimated_minutes: t.estimated_minutes,
      planned_start: t.planned_start,
      planned_end: t.planned_end,
    };

    if (!wasRecurring && !recurrence) {
      const { error } = await ctx.supabase.from("tasks").update(update).eq("id", occ.task_id);
      if (error) return dbFail(error);
      const { error: e2 } = await ctx.supabase
        .from("task_occurrences")
        .update({ scheduled_date: t.scheduled_date, planned_start: t.planned_start, planned_end: t.planned_end })
        .eq("id", occ.id);
      if (e2) return dbFail(e2);
      return { ok: true, message: "Task updated" };
    }

    // Recurring (or becoming recurring / one-off).
    if (ruleChanged) {
      Object.assign(update, {
        recurrence,
        recurrence_start: recurrence ? (wasRecurring ? occ.task.recurrence_start : t.scheduled_date) : null,
        recurrence_end: recurrence ? t.repeat.until : null,
        // Generate only after today and, when a one-off becomes recurring, after its
        // existing occurrence, so that date is not duplicated.
        materialized_until: recurrence
          ? !wasRecurring && occ.scheduled_date > ctx.today
            ? occ.scheduled_date
            : ctx.today
          : null,
      });
    } else if (recurrence) {
      update.recurrence_end = t.repeat.until;
    }
    const { error } = await ctx.supabase.from("tasks").update(update).eq("id", occ.task_id);
    if (error) return dbFail(error);

    // Future generated occurrences: drop & regenerate if the rule changed, else update planned times.
    if (ruleChanged || (recurrence && t.repeat.until)) {
      let del = ctx.supabase
        .from("task_occurrences")
        .delete()
        .eq("task_id", occ.task_id)
        .eq("status", "pending")
        .eq("origin", "recurrence")
        .gt("scheduled_date", ruleChanged ? ctx.today : (t.repeat.until ?? "9999-12-31"));
      if (ruleChanged && wasRecurring && !recurrence) {
        // became one-off: keep this occurrence, drop the other future ones
        del = del.neq("id", occ.id);
      }
      await del;
    }
    await ctx.supabase
      .from("task_occurrences")
      .update({ planned_start: t.planned_start, planned_end: t.planned_end })
      .eq("task_id", occ.task_id)
      .in("status", ["pending", "in_progress"])
      .gte("scheduled_date", ctx.today);

    if (recurrence) await syncTasks(ctx);
    return { ok: true, message: "Task updated" };
  });
}

export async function setOccurrenceStatus(
  occurrenceId: string,
  status: Extract<OccurrenceStatus, "pending" | "in_progress" | "completed">,
): Promise<ActionResult> {
  if (!z.uuid().safeParse(occurrenceId).success) return { ok: false, error: "Unknown task" };
  if (!["pending", "in_progress", "completed"].includes(status)) return { ok: false, error: "Invalid status" };

  return withAuth(async (ctx) => {
    const { data: occ } = await ctx.supabase
      .from("task_occurrences")
      .select("status, scheduled_date")
      .eq("id", occurrenceId)
      .single<{ status: OccurrenceStatus; scheduled_date: string }>();
    if (!occ) return { ok: false, error: "Task not found" };
    if (occ.status === "rescheduled") return { ok: false, error: "This task was moved to another day." };
    // A missed task can still be completed late (it stays on its original day).
    if (status !== "completed" && occ.scheduled_date < ctx.today) {
      return { ok: false, error: "Past tasks can only be marked completed." };
    }
    const { error } = await ctx.supabase
      .from("task_occurrences")
      .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
      .eq("id", occurrenceId);
    if (error) return dbFail(error);
    return { ok: true, message: status === "completed" ? "Completed" : undefined };
  });
}

/** Reverts a completed task: back to pending (today/future) or missed (past). */
export async function uncompleteOccurrence(occurrenceId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(occurrenceId).success) return { ok: false, error: "Unknown task" };
  return withAuth(async (ctx) => {
    const { data: occ } = await ctx.supabase
      .from("task_occurrences")
      .select("scheduled_date")
      .eq("id", occurrenceId)
      .single<{ scheduled_date: string }>();
    if (!occ) return { ok: false, error: "Task not found" };
    const { error } = await ctx.supabase
      .from("task_occurrences")
      .update({ status: occ.scheduled_date < ctx.today ? "missed" : "pending", completed_at: null })
      .eq("id", occurrenceId)
      .eq("status", "completed");
    if (error) return dbFail(error);
    return { ok: true };
  });
}

export async function rescheduleOccurrence(input: z.input<typeof rescheduleSchema>): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    if (parsed.data.new_date < ctx.today) return { ok: false, error: "Choose today or a future date." };
    const { error } = await ctx.supabase.rpc("reschedule_occurrence", {
      p_occurrence_id: parsed.data.occurrence_id,
      p_new_date: parsed.data.new_date,
    });
    if (error) return dbFail(error);
    return { ok: true, message: "Task rescheduled" };
  });
}

/**
 * Deletes one occurrence. A one-off task is deleted entirely. For a
 * recurring task, `scope: "series"` ends the series: future pending
 * occurrences are removed and recurrence stops, while past history stays.
 */
export async function deleteOccurrence(occurrenceId: string, scope: "one" | "series"): Promise<ActionResult> {
  if (!z.uuid().safeParse(occurrenceId).success) return { ok: false, error: "Unknown task" };
  return withAuth(async (ctx) => {
    const { data: occ } = await ctx.supabase
      .from("task_occurrences")
      .select("id, task_id, scheduled_date, task:tasks!inner(recurrence, recurrence_start)")
      .eq("id", occurrenceId)
      .single<{
        id: string;
        task_id: string;
        scheduled_date: string;
        task: { recurrence: Recurrence | null; recurrence_start: string | null };
      }>();
    if (!occ) return { ok: false, error: "Task not found" };

    if (!occ.task.recurrence) {
      const { count } = await ctx.supabase
        .from("task_occurrences")
        .select("id", { count: "exact", head: true })
        .eq("task_id", occ.task_id);
      const { error } =
        (count ?? 0) <= 1
          ? await ctx.supabase.from("tasks").delete().eq("id", occ.task_id)
          : await ctx.supabase.from("task_occurrences").delete().eq("id", occ.id);
      if (error) return dbFail(error);
      return { ok: true, message: "Task deleted" };
    }

    if (scope === "one") {
      const { error } = await ctx.supabase.from("task_occurrences").delete().eq("id", occ.id);
      if (error) return dbFail(error);
      return { ok: true, message: "Occurrence deleted" };
    }

    // End the series the day before this occurrence (never before it started).
    const start = occ.task.recurrence_start ?? occ.scheduled_date;
    const dayBefore = addDays(occ.scheduled_date, -1);
    const { error } = await ctx.supabase
      .from("tasks")
      .update({ recurrence_end: dayBefore < start ? start : dayBefore })
      .eq("id", occ.task_id);
    if (error) return dbFail(error);
    await ctx.supabase
      .from("task_occurrences")
      .delete()
      .eq("task_id", occ.task_id)
      .in("status", ["pending", "in_progress"])
      .gte("scheduled_date", occ.scheduled_date);
    return { ok: true, message: "Series ended, history kept" };
  });
}

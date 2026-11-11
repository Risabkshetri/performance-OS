"use server";

import { z } from "zod";
import { dbFail, invalid, withAuth } from "./helpers";
import {
  activityCategorySchema,
  activitySchema,
  sleepSchema,
  startTimerSchema,
  type ActivityInput,
  type SleepInput,
} from "@/lib/validations";
import {
  addDays,
  localDateOf,
  productivityDateOf,
  productivityTimeToInstant,
  timeToMinutes,
  zonedInstant,
} from "@/lib/date/productivity-day";
import type { AppContext } from "@/lib/data/context";
import type { ActionResult } from "@/types/domain";

const MAX_ACTIVITY_MS = 48 * 3_600_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

// ---------------- timer ----------------

export async function startTimer(input: z.input<typeof startTimerSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = startTimerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const a = parsed.data;
  return withAuth<{ id: string }>(async (ctx) => {
    const now = new Date();
    const { data, error } = await ctx.supabase.rpc("start_activity", {
      p_category_id: a.category_id,
      p_title: a.title,
      p_pillar: a.pillar,
      p_task_occurrence_id: a.task_occurrence_id,
      p_started_at: now.toISOString(),
      p_productivity_date: productivityDateOf(now, ctx.tz, ctx.dayStart),
    });
    if (error) return dbFail(error);
    if (a.task_occurrence_id) {
      await ctx.supabase
        .from("task_occurrences")
        .update({ status: "in_progress" })
        .eq("id", a.task_occurrence_id)
        .eq("status", "pending");
    }
    return { ok: true, data: { id: data as string }, message: "Timer started" };
  });
}

export async function stopTimer(): Promise<ActionResult> {
  return withAuth(async (ctx) => {
    const { data: running } = await ctx.supabase
      .from("activities")
      .select("id, started_at")
      .is("ended_at", null)
      .maybeSingle<{ id: string; started_at: string }>();
    if (!running) return { ok: false, error: "No timer is running." };

    const started = Date.parse(running.started_at);
    let end = Date.now();
    let message = "Activity saved";
    if (end - started > MAX_ACTIVITY_MS) {
      end = started + MAX_ACTIVITY_MS;
      message = "Timer was capped at 48 hours. Adjust the end time if needed.";
    }
    end = Math.max(end, started + 1000);
    const { error } = await ctx.supabase
      .from("activities")
      .update({ ended_at: new Date(end).toISOString() })
      .eq("id", running.id);
    if (error) return dbFail(error);
    return { ok: true, message };
  });
}

// ---------------- manual entries ----------------

function resolveActivityTimes(ctx: AppContext, a: z.output<typeof activitySchema>) {
  // Times are read relative to the productivity day, so on day Nov 11 (6 AM
  // boundary) 22:00 → 01:30 means Nov 11 22:00 → Nov 12 01:30.
  const start = productivityTimeToInstant(a.date, a.start_time, ctx.tz, ctx.dayStart);
  let end = productivityTimeToInstant(a.date, a.end_time, ctx.tz, ctx.dayStart);
  if (end <= start) end = new Date(end.getTime() + 86_400_000); // spans the day boundary
  return { start, end };
}

function validateTimes(start: Date, end: Date): string | null {
  if (start.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return "Activities can't start in the future.";
  if (end.getTime() - start.getTime() > MAX_ACTIVITY_MS) return "An activity can be at most 48 hours long.";
  return null;
}

export async function createActivity(input: ActivityInput): Promise<ActionResult> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const a = parsed.data;
    const { start, end } = resolveActivityTimes(ctx, a);
    const problem = validateTimes(start, end);
    if (problem) return { ok: false, error: problem };
    const { error } = await ctx.supabase.from("activities").insert({
      user_id: ctx.userId,
      category_id: a.category_id,
      title: a.title,
      pillar: a.pillar,
      notes: a.notes,
      task_occurrence_id: a.task_occurrence_id,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      productivity_date: productivityDateOf(start, ctx.tz, ctx.dayStart),
    });
    if (error) return dbFail(error);
    return { ok: true, message: "Activity logged" };
  });
}

/**
 * Edits an activity. For a running timer, `end_time` may be omitted (empty)
 * to correct only the start time while it keeps running.
 */
export async function updateActivity(
  id: string,
  input: Omit<ActivityInput, "end_time"> & { end_time: string | null },
): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown activity" };
  const keepRunning = !input.end_time;
  const parsed = activitySchema.safeParse({ ...input, end_time: input.end_time || input.start_time });
  if (!parsed.success) return invalid(parsed.error);

  return withAuth(async (ctx) => {
    const a = parsed.data;
    const { data: existing } = await ctx.supabase
      .from("activities")
      .select("ended_at")
      .eq("id", id)
      .single<{ ended_at: string | null }>();
    if (!existing) return { ok: false, error: "Activity not found" };
    if (keepRunning && existing.ended_at) return { ok: false, error: "Add an end time." };

    const { start, end } = resolveActivityTimes(ctx, a);
    if (!keepRunning) {
      const problem = validateTimes(start, end);
      if (problem) return { ok: false, error: problem };
    } else if (start.getTime() > Date.now()) {
      return { ok: false, error: "A running timer can't start in the future." };
    }

    const { error } = await ctx.supabase
      .from("activities")
      .update({
        category_id: a.category_id,
        title: a.title,
        pillar: a.pillar,
        notes: a.notes,
        task_occurrence_id: a.task_occurrence_id,
        started_at: start.toISOString(),
        ended_at: keepRunning ? null : end.toISOString(),
        productivity_date: productivityDateOf(start, ctx.tz, ctx.dayStart),
      })
      .eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: "Activity updated" };
  });
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown activity" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("activities").delete().eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: "Activity deleted" };
  });
}

// ---------------- categories ----------------

export async function createCategory(input: z.input<typeof activityCategorySchema>): Promise<ActionResult> {
  const parsed = activityCategorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("activity_categories").insert({
      user_id: ctx.userId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      sort_order: 100,
    });
    if (error) return dbFail(error);
    return { ok: true, message: "Category added" };
  });
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown category" };
  return withAuth(async (ctx) => {
    const { data: cat } = await ctx.supabase
      .from("activity_categories")
      .select("is_default")
      .eq("id", id)
      .single<{ is_default: boolean }>();
    if (!cat) return { ok: false, error: "Category not found" };
    if (cat.is_default) return { ok: false, error: "Default categories can't be removed." };
    const { error } = await ctx.supabase
      .from("activity_categories")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: "Category archived. Past activities keep it." };
  });
}

// ---------------- sleep ----------------

function resolveSleep(ctx: AppContext, s: z.output<typeof sleepSchema>) {
  const wakeMin = timeToMinutes(s.wake_time);
  const sleepMin = timeToMinutes(s.sleep_time);
  const woke = zonedInstant(s.wake_date, wakeMin, ctx.tz);
  // 23:30 → 07:00 means the night before; 01:00 → 08:00 is the same calendar date.
  const sleptDate = sleepMin >= wakeMin ? addDays(s.wake_date, -1) : s.wake_date;
  const slept = zonedInstant(sleptDate, sleepMin, ctx.tz);
  return { slept, woke };
}

async function saveSleep(id: string | null, input: SleepInput): Promise<ActionResult> {
  const parsed = sleepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const s = parsed.data;
    const { slept, woke } = resolveSleep(ctx, s);
    if (woke.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return { ok: false, error: "Wake-up time is in the future." };
    const row = {
      slept_at: slept.toISOString(),
      woke_at: woke.toISOString(),
      wake_date: localDateOf(woke, ctx.tz),
      quality: s.quality,
      notes: s.notes,
    };
    const { error } = id
      ? await ctx.supabase.from("sleep_logs").update(row).eq("id", id)
      : await ctx.supabase.from("sleep_logs").insert({ ...row, user_id: ctx.userId });
    if (error) {
      if (error.code === "23P01") return { ok: false, error: "This overlaps sleep you've already logged." };
      return dbFail(error);
    }
    return { ok: true, message: id ? "Sleep updated" : "Sleep logged" };
  });
}

export async function logSleep(input: SleepInput) {
  return saveSleep(null, input);
}

export async function updateSleep(id: string, input: SleepInput) {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown entry" } as ActionResult;
  return saveSleep(id, input);
}

export async function deleteSleep(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown entry" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("sleep_logs").delete().eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: "Sleep entry deleted" };
  });
}

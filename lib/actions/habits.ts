"use server";

import { z } from "zod";
import { dbFail, invalid, withAuth } from "./helpers";
import { checkInSchema, habitSchema, type HabitInput } from "@/lib/validations";
import { evaluateCheckIn } from "@/lib/calculations/habits";
import { addDays } from "@/lib/date/productivity-day";
import type { ActionResult, Habit } from "@/types/domain";

const BACKFILL_DAYS = 60;

function toRow(h: z.output<typeof habitSchema>) {
  const numeric = h.tracking === "numeric";
  return {
    name: h.name,
    description: h.description,
    kind: h.kind,
    pillar: h.pillar,
    tracking: h.tracking,
    unit: numeric ? h.unit : null,
    target_value: numeric ? h.target_value : null,
    target_direction: numeric ? h.target_direction : null,
    frequency:
      h.frequency_type === "daily"
        ? { type: "daily" }
        : { type: "weekly", weekdays: [...new Set(h.weekdays)].sort() },
    start_date: h.start_date,
  };
}

export async function createHabit(input: HabitInput): Promise<ActionResult> {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("habits").insert({ ...toRow(parsed.data), user_id: ctx.userId });
    if (error) return dbFail(error);
    return { ok: true, message: "Habit created" };
  });
}

/** Edits the definition only. Past logs keep the target they were judged against. */
export async function updateHabit(id: string, input: HabitInput): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown habit" };
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("habits").update(toRow(parsed.data)).eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: "Habit updated, history unchanged" };
  });
}

export async function setHabitArchived(id: string, archived: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown habit" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase
      .from("habits")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: archived ? "Habit archived" : "Habit restored" };
  });
}

export async function setHabitActive(id: string, active: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Unknown habit" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("habits").update({ active }).eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: active ? "Habit resumed" : "Habit paused" };
  });
}

export async function checkInHabit(input: z.input<typeof checkInSchema>): Promise<ActionResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const c = parsed.data;
    if (c.date > ctx.today) return { ok: false, error: "You can't check in for a future day." };
    if (c.date < addDays(ctx.today, -BACKFILL_DAYS)) return { ok: false, error: "That day is too far back to edit." };

    const { data: habit } = await ctx.supabase.from("habits").select("*").eq("id", c.habit_id).single<Habit>();
    if (!habit) return { ok: false, error: "Habit not found" };
    if (habit.tracking === "numeric" && c.value == null) return { ok: false, error: "Enter a value." };
    if (habit.tracking === "binary" && c.done == null) return { ok: false, error: "Choose an outcome." };

    const met = evaluateCheckIn(habit.tracking, { done: c.done, value: c.value }, {
      value: habit.target_value,
      direction: habit.target_direction,
    });
    const { error } = await ctx.supabase.from("habit_logs").upsert(
      {
        user_id: ctx.userId,
        habit_id: habit.id,
        log_date: c.date,
        value: habit.tracking === "numeric" ? c.value : null,
        met,
        kind_snapshot: habit.kind,
        tracking_snapshot: habit.tracking,
        target_value_snapshot: habit.target_value,
        target_direction_snapshot: habit.target_direction,
      },
      { onConflict: "habit_id,log_date" },
    );
    if (error) return dbFail(error);
    return { ok: true };
  });
}

export async function clearCheckIn(habitId: string, date: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(habitId).success) return { ok: false, error: "Unknown habit" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid date" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", date);
    if (error) return dbFail(error);
    return { ok: true };
  });
}

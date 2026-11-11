"use server";

import { z } from "zod";
import { dbFail, invalid, withAuth } from "./helpers";
import { goalSchema, milestoneSchema, progressSchema, type GoalInput } from "@/lib/validations";
import type { ActionResult } from "@/types/domain";

const uuid = z.uuid();

export async function createGoal(input: GoalInput): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("goals").insert({ ...parsed.data, user_id: ctx.userId });
    if (error) return dbFail(error);
    return { ok: true, message: "Goal created" };
  });
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown goal" };
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("goals").update(parsed.data).eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: "Goal updated" };
  });
}

export async function setGoalArchived(id: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown goal" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase
      .from("goals")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: archived ? "Goal archived" : "Goal restored" };
  });
}

export async function setGoalStatus(id: string, status: "active" | "completed" | "paused" | "abandoned"): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown goal" };
  if (!["active", "completed", "paused", "abandoned"].includes(status)) return { ok: false, error: "Invalid status" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("goals").update({ status }).eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: status === "completed" ? "Goal completed" : "Goal updated" };
  });
}

/** Records progress (value and/or %) and logs it, in one transaction. */
export async function logGoalProgress(input: z.input<typeof progressSchema>): Promise<ActionResult> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const p = parsed.data;
  if (p.value == null && p.progress == null) return { ok: false, error: "Enter a value." };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.rpc("log_goal_progress", {
      p_goal_id: p.goal_id,
      p_value: p.value,
      p_progress: p.progress,
      p_note: p.note,
    });
    if (error) return dbFail(error);
    return { ok: true, message: "Progress recorded" };
  });
}

export async function addMilestone(input: z.input<typeof milestoneSchema>): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const { count } = await ctx.supabase
      .from("goal_milestones")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", parsed.data.goal_id);
    const { error } = await ctx.supabase
      .from("goal_milestones")
      .insert({ ...parsed.data, user_id: ctx.userId, sort_order: count ?? 0 });
    if (error) return dbFail(error);
    return { ok: true, message: "Milestone added" };
  });
}

export async function toggleMilestone(id: string, done: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown milestone" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase
      .from("goal_milestones")
      .update({ completed_at: done ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return dbFail(error);
    return { ok: true };
  });
}

export async function deleteMilestone(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown milestone" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("goal_milestones").delete().eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: "Milestone removed" };
  });
}

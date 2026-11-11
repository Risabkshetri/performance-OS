"use server";

import { z } from "zod";
import { dbFail, invalid, withAuth } from "./helpers";
import {
  affirmationSchema,
  reviewSchema,
  settingsSchema,
  type AffirmationInput,
  type ReviewInput,
  type SettingsInput,
} from "@/lib/validations";
import { isValidTimeZone, timeToMinutes } from "@/lib/date/productivity-day";
import type { ActionResult, ThemePreference } from "@/types/domain";

const uuid = z.uuid();

// ---------------- affirmations ----------------

export async function saveAffirmation(id: string | null, input: AffirmationInput): Promise<ActionResult> {
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Unknown affirmation" };
  const parsed = affirmationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const { error } = id
      ? await ctx.supabase.from("affirmations").update(parsed.data).eq("id", id)
      : await ctx.supabase.from("affirmations").insert({ ...parsed.data, user_id: ctx.userId });
    if (error) return dbFail(error);
    return { ok: true, message: id ? "Affirmation updated" : "Affirmation added" };
  });
}

export async function featureAffirmation(id: string, featured: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown affirmation" };
  return withAuth(async (ctx) => {
    const { error } = featured
      ? await ctx.supabase.rpc("feature_affirmation", { p_id: id })
      : await ctx.supabase.from("affirmations").update({ is_featured: false }).eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: featured ? "Shown on your dashboard" : "Back to daily rotation" };
  });
}

export async function setAffirmationArchived(id: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown affirmation" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase
      .from("affirmations")
      .update({ archived_at: archived ? new Date().toISOString() : null, ...(archived ? { is_featured: false } : {}) })
      .eq("id", id);
    if (error) return dbFail(error);
    return { ok: true, message: archived ? "Affirmation archived" : "Affirmation restored" };
  });
}

// ---------------- daily review ----------------

export async function saveReview(input: ReviewInput): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return withAuth(async (ctx) => {
    const r = parsed.data;
    if (r.review_date > ctx.today) return { ok: false, error: "You can't review a future day." };
    const empty = !r.accomplishments && !r.incomplete && !r.learnings && !r.improvements;
    if (empty) {
      await ctx.supabase.from("daily_reviews").delete().eq("review_date", r.review_date);
      return { ok: true, message: "Review cleared" };
    }
    const { error } = await ctx.supabase
      .from("daily_reviews")
      .upsert({ ...r, user_id: ctx.userId }, { onConflict: "user_id,review_date" });
    if (error) return dbFail(error);
    return { ok: true, message: "Review saved" };
  });
}

// ---------------- settings ----------------

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const s = parsed.data;
  if (!isValidTimeZone(s.timezone)) return { ok: false, error: "Unknown timezone" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase
      .from("profiles")
      .update({
        display_name: s.display_name,
        timezone: s.timezone,
        day_start_minutes: timeToMinutes(s.day_start),
        week_starts_on: s.week_starts_on,
        theme: s.theme,
        default_task_priority: s.default_task_priority,
        score_weights: s.score_weights,
      })
      .eq("id", ctx.userId);
    if (error) return dbFail(error);
    return { ok: true, message: "Settings saved" };
  });
}

export async function saveTheme(theme: ThemePreference): Promise<ActionResult> {
  if (!["light", "dark", "system"].includes(theme)) return { ok: false, error: "Invalid theme" };
  return withAuth(async (ctx) => {
    const { error } = await ctx.supabase.from("profiles").update({ theme }).eq("id", ctx.userId);
    if (error) return dbFail(error);
    return { ok: true };
  });
}

/** First-run: store the browser's timezone if none is set yet. */
export async function initTimezone(timezone: string): Promise<ActionResult> {
  if (!isValidTimeZone(timezone)) return { ok: false, error: "Unknown timezone" };
  return withAuth(async (ctx) => {
    if (ctx.profile.timezone) return { ok: true };
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ timezone })
      .eq("id", ctx.userId)
      .is("timezone", null);
    if (error) return dbFail(error);
    return { ok: true };
  });
}

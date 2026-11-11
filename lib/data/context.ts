import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { currentProductivityDate, safeTimeZone, type ISODate } from "@/lib/date/productivity-day";
import { normalizeWeights } from "@/lib/calculations/score";
import type { Profile } from "@/types/domain";

export interface AppContext {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
  profile: Profile;
  tz: string;
  dayStart: number;
  /** current productivity date */
  today: ISODate;
}

async function loadContext(): Promise<AppContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const res = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  let profile = res.data;
  if (res.error?.code === "PGRST205" || res.error?.code === "42P01") {
    throw new Error(
      "Database schema not found. Run supabase/migrations/20261111000000_init.sql in your Supabase SQL editor, then reload.",
    );
  }
  if (res.error) throw new Error(`Could not load your profile: ${res.error.message}`);
  if (!profile) {
    // Safety net if the signup trigger did not run (e.g. users created before the migration).
    const { data } = await supabase.from("profiles").upsert({ id: user.id }).select("*").single<Profile>();
    profile = data;
    await supabase.from("activity_categories").insert([
      { user_id: user.id, name: "Deep Work", kind: "deep", is_default: true, sort_order: 0 },
      { user_id: user.id, name: "External Work", kind: "external", is_default: true, sort_order: 1 },
      { user_id: user.id, name: "Personal", kind: "personal", is_default: true, sort_order: 2 },
    ]);
  }
  if (!profile) throw new Error("Could not load your profile.");

  profile = { ...profile, score_weights: normalizeWeights(profile.score_weights) };
  const tz = safeTimeZone(profile.timezone);
  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    profile,
    tz,
    dayStart: profile.day_start_minutes,
    today: currentProductivityDate(tz, profile.day_start_minutes),
  };
}

/** For Server Components. Memoised per request. */
export const getContext = cache(async (): Promise<AppContext> => {
  const ctx = await loadContext();
  if (!ctx) redirect("/setup?reason=signin");
  return ctx;
});

/** For Server Actions: returns null instead of redirecting. */
export const getActionContext = cache(loadContext);

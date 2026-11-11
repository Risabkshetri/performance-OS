import "server-only";
import type { AppContext } from "./context";
import type { ISODate } from "@/lib/date/productivity-day";
import type {
  Activity,
  ActivityCategory,
  Affirmation,
  DailyReview,
  Goal,
  GoalMilestone,
  GoalProgressLog,
  Habit,
  HabitLog,
  SleepLog,
} from "@/types/domain";

function check<T>(res: { data: T | null; error: { message: string } | null }, fallback: T): T {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? fallback;
}

// ---------------- activities ----------------

export async function getCategories(ctx: AppContext, includeArchived = false) {
  let q = ctx.supabase.from("activity_categories").select("*").order("sort_order").order("name");
  if (!includeArchived) q = q.is("archived_at", null);
  return check(await q.overrideTypes<ActivityCategory[], { merge: false }>(), []);
}

export async function getActivities(ctx: AppContext, from: ISODate, to: ISODate) {
  return check(
    await ctx.supabase
      .from("activities")
      .select("*")
      .gte("productivity_date", from)
      .lte("productivity_date", to)
      .order("started_at", { ascending: true })
      .overrideTypes<Activity[], { merge: false }>(),
    [],
  );
}

export async function getRunningActivity(ctx: AppContext) {
  return check(
    await ctx.supabase
      .from("activities")
      .select("*")
      .is("ended_at", null)
      .maybeSingle<Activity>(),
    null,
  );
}

export async function getSleepLogs(ctx: AppContext, limit = 14) {
  return check(
    await ctx.supabase
      .from("sleep_logs")
      .select("*")
      .order("woke_at", { ascending: false })
      .limit(limit)
      .overrideTypes<SleepLog[], { merge: false }>(),
    [],
  );
}

export async function getSleepLogsBetween(ctx: AppContext, from: ISODate, to: ISODate) {
  return check(
    await ctx.supabase
      .from("sleep_logs")
      .select("*")
      .gte("wake_date", from)
      .lte("wake_date", to)
      .order("woke_at")
      .overrideTypes<SleepLog[], { merge: false }>(),
    [],
  );
}

// ---------------- habits ----------------

export async function getHabits(ctx: AppContext, includeArchived = false) {
  let q = ctx.supabase.from("habits").select("*").order("sort_order").order("created_at");
  if (!includeArchived) q = q.is("archived_at", null);
  return check(await q.overrideTypes<Habit[], { merge: false }>(), []);
}

export async function getHabitLogs(ctx: AppContext, from: ISODate, to: ISODate) {
  return check(
    await ctx.supabase
      .from("habit_logs")
      .select("*")
      .gte("log_date", from)
      .lte("log_date", to)
      .overrideTypes<HabitLog[], { merge: false }>(),
    [],
  );
}

// ---------------- goals ----------------

export interface GoalWithDetail extends Goal {
  milestones: GoalMilestone[];
  progress_logs: GoalProgressLog[];
}

export async function getGoals(ctx: AppContext, includeArchived = false) {
  let q = ctx.supabase
    .from("goals")
    .select("*, milestones:goal_milestones(*), progress_logs:goal_progress_logs(*)")
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (!includeArchived) q = q.is("archived_at", null);
  const goals = check(await q.overrideTypes<GoalWithDetail[], { merge: false }>(), []);
  for (const g of goals) {
    g.milestones.sort((a, b) => a.sort_order - b.sort_order || (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    g.progress_logs.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  }
  return goals;
}

export type GoalOption = Pick<Goal, "id" | "title" | "horizon" | "pillar">;

export async function getGoalOptions(ctx: AppContext) {
  return check(
    await ctx.supabase
      .from("goals")
      .select("id, title, horizon, pillar")
      .is("archived_at", null)
      .in("status", ["active", "paused"])
      .order("title")
      .overrideTypes<GoalOption[], { merge: false }>(),
    [],
  );
}

// ---------------- affirmations ----------------

export async function getAffirmations(ctx: AppContext, includeArchived = false) {
  let q = ctx.supabase.from("affirmations").select("*").order("is_featured", { ascending: false }).order("created_at");
  if (!includeArchived) q = q.is("archived_at", null);
  return check(await q.overrideTypes<Affirmation[], { merge: false }>(), []);
}

/** Featured affirmation, or a stable daily rotation through active ones. */
export async function getDailyAffirmation(ctx: AppContext) {
  const all = await getAffirmations(ctx);
  if (!all.length) return null;
  const featured = all.find((a) => a.is_featured);
  if (featured) return featured;
  const seed = Number(ctx.today.replaceAll("-", ""));
  return all[seed % all.length];
}

// ---------------- reviews ----------------

export async function getReview(ctx: AppContext, date: ISODate) {
  return check(
    await ctx.supabase
      .from("daily_reviews")
      .select("*")
      .eq("review_date", date)
      .maybeSingle<DailyReview>(),
    null,
  );
}

export async function getReviews(ctx: AppContext, limit = 60) {
  return check(
    await ctx.supabase
      .from("daily_reviews")
      .select("*")
      .order("review_date", { ascending: false })
      .limit(limit)
      .overrideTypes<DailyReview[], { merge: false }>(),
    [],
  );
}

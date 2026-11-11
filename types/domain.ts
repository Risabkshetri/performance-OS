// Row types mirroring supabase/migrations. Dates are ISO strings
// ("yyyy-MM-dd" for `date`, full ISO for `timestamptz`, "HH:mm:ss" for `time`).

export type Pillar = "health" | "finance" | "growth";
export type Priority = "high" | "medium" | "low";
export type OccurrenceStatus = "pending" | "in_progress" | "completed" | "missed" | "rescheduled";
export type OccurrenceOrigin = "single" | "recurrence" | "reschedule";
export type ActivityKind = "deep" | "external" | "personal" | "other";
export type HabitKind = "good" | "bad";
export type HabitTracking = "binary" | "numeric";
export type TargetDirection = "min" | "max";
export type GoalHorizon = "daily" | "monthly" | "six_month" | "yearly";
export type GoalStatus = "active" | "completed" | "paused" | "abandoned";
export type ThemePreference = "light" | "dark" | "system";

export type Recurrence =
  | { type: "daily" }
  | { type: "weekly"; weekdays: number[] } // 0 = Sunday … 6 = Saturday
  | { type: "interval"; every: number }; // every N days from recurrence_start

export type HabitFrequency = { type: "daily" } | { type: "weekly"; weekdays: number[] };

export interface ScoreWeights {
  tasks: number;
  goodHabits: number;
  badHabits: number;
  review: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string | null;
  day_start_minutes: number;
  week_starts_on: 0 | 1;
  theme: ThemePreference;
  default_task_priority: Priority;
  score_weights: ScoreWeights;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  pillar: Pillar;
  horizon: GoalHorizon;
  start_date: string;
  deadline: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  manual_progress: number;
  status: GoalStatus;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
}

export interface GoalProgressLog {
  id: string;
  goal_id: string;
  value: number | null;
  progress: number | null;
  note: string | null;
  logged_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  pillar: Pillar;
  priority: Priority;
  goal_id: string | null;
  estimated_minutes: number | null;
  planned_start: string | null;
  planned_end: string | null;
  recurrence: Recurrence | null;
  recurrence_start: string | null;
  recurrence_end: string | null;
  materialized_until: string | null;
  archived_at: string | null;
}

export interface TaskOccurrence {
  id: string;
  task_id: string;
  scheduled_date: string;
  planned_start: string | null;
  planned_end: string | null;
  status: OccurrenceStatus;
  origin: OccurrenceOrigin;
  rescheduled_from: string | null;
  completed_at: string | null;
}

/** Occurrence joined with its task definition, as used throughout the UI. */
export interface PlannedTask extends TaskOccurrence {
  task: Task;
}

export interface ActivityCategory {
  id: string;
  name: string;
  kind: ActivityKind;
  is_default: boolean;
  sort_order: number;
  archived_at: string | null;
}

export interface Activity {
  id: string;
  category_id: string;
  title: string;
  pillar: Pillar | null;
  task_occurrence_id: string | null;
  started_at: string;
  ended_at: string | null;
  productivity_date: string;
  notes: string | null;
}

export interface SleepLog {
  id: string;
  slept_at: string;
  woke_at: string;
  wake_date: string;
  quality: number | null;
  notes: string | null;
}

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  kind: HabitKind;
  pillar: Pillar;
  tracking: HabitTracking;
  unit: string | null;
  target_value: number | null;
  target_direction: TargetDirection | null;
  frequency: HabitFrequency;
  start_date: string;
  active: boolean;
  archived_at: string | null;
  sort_order: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  value: number | null;
  met: boolean;
  kind_snapshot: HabitKind;
  tracking_snapshot: HabitTracking;
  target_value_snapshot: number | null;
  target_direction_snapshot: TargetDirection | null;
  note: string | null;
}

export interface Affirmation {
  id: string;
  text: string;
  pillar: Pillar;
  horizon: GoalHorizon | null;
  goal_id: string | null;
  is_featured: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface DailyReview {
  id: string;
  review_date: string;
  accomplishments: string | null;
  incomplete: string | null;
  learnings: string | null;
  improvements: string | null;
  updated_at: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

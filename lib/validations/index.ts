import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use a valid time");
const optionalTime = z.union([time, z.literal("")]).optional().transform((v) => v || null);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const optionalUuid = z.union([z.uuid(), z.literal(""), z.null()]).optional().transform((v) => v || null);
const optionalNumber = z
  .union([z.number(), z.nan(), z.null()])
  .optional()
  .transform((v) => (v == null || Number.isNaN(v) ? null : v));

export const pillarEnum = z.enum(["health", "finance", "growth"]);
export const priorityEnum = z.enum(["high", "medium", "low"]);
export const horizonEnum = z.enum(["daily", "monthly", "six_month", "yearly"]);
const weekdays = z.array(z.number().int().min(0).max(6));

// ---------------- tasks ----------------

export const repeatSchema = z
  .object({
    type: z.enum(["none", "daily", "weekly", "interval"]),
    weekdays: weekdays.default([]),
    every: z.number().int().min(1).max(365).default(2),
    until: z.union([isoDate, z.literal("")]).optional().transform((v) => v || null),
  })
  .refine((r) => r.type !== "weekly" || r.weekdays.length > 0, {
    message: "Pick at least one weekday",
    path: ["weekdays"],
  });

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Give the task a title").max(200),
    description: optionalText(2000),
    pillar: pillarEnum,
    priority: priorityEnum,
    scheduled_date: isoDate,
    planned_start: optionalTime,
    planned_end: optionalTime,
    estimated_minutes: optionalNumber.pipe(z.number().int().min(1).max(1440).nullable()),
    goal_id: optionalUuid,
    repeat: repeatSchema,
  })
  .refine((t) => !(t.planned_end && !t.planned_start), {
    message: "Add a start time too",
    path: ["planned_start"],
  })
  .refine((t) => !t.repeat.until || t.repeat.until >= t.scheduled_date, {
    message: "End date must be after the start date",
    path: ["repeat", "until"],
  });
export type TaskInput = z.input<typeof taskSchema>;

export const rescheduleSchema = z.object({
  occurrence_id: z.uuid(),
  new_date: isoDate,
});

// ---------------- activities ----------------

export const activityCategorySchema = z.object({
  name: z.string().trim().min(1, "Name the category").max(60),
  kind: z.enum(["deep", "external", "personal", "other"]),
});

export const startTimerSchema = z.object({
  title: z.string().trim().min(1, "What are you working on?").max(200),
  category_id: z.uuid("Pick a category"),
  pillar: pillarEnum.nullable().optional().transform((v) => v ?? null),
  task_occurrence_id: optionalUuid,
});

export const activitySchema = z.object({
  title: z.string().trim().min(1, "Give the activity a title").max(200),
  category_id: z.uuid("Pick a category"),
  pillar: z.union([pillarEnum, z.literal(""), z.null()]).optional().transform((v) => v || null),
  date: isoDate,
  start_time: time,
  end_time: time,
  notes: optionalText(2000),
  task_occurrence_id: optionalUuid,
});
export type ActivityInput = z.input<typeof activitySchema>;

export const sleepSchema = z.object({
  wake_date: isoDate,
  sleep_time: time,
  wake_time: time,
  quality: optionalNumber.pipe(z.number().int().min(1).max(5).nullable()),
  notes: optionalText(1000),
});
export type SleepInput = z.input<typeof sleepSchema>;

// ---------------- habits ----------------

export const habitSchema = z
  .object({
    name: z.string().trim().min(1, "Name the habit").max(100),
    description: optionalText(1000),
    kind: z.enum(["good", "bad"]),
    pillar: pillarEnum,
    tracking: z.enum(["binary", "numeric"]),
    unit: optionalText(24),
    target_value: optionalNumber.pipe(z.number().min(0).max(1_000_000).nullable()),
    target_direction: z.union([z.enum(["min", "max"]), z.null()]).optional().transform((v) => v ?? null),
    frequency_type: z.enum(["daily", "weekly"]),
    weekdays: weekdays.default([]),
    start_date: isoDate,
  })
  .refine((h) => h.tracking === "binary" || h.target_value != null, {
    message: "Set a target value",
    path: ["target_value"],
  })
  .refine((h) => h.tracking === "binary" || h.target_direction != null, {
    message: "Choose minimum or maximum",
    path: ["target_direction"],
  })
  .refine((h) => h.frequency_type === "daily" || h.weekdays.length > 0, {
    message: "Pick at least one weekday",
    path: ["weekdays"],
  });
export type HabitInput = z.input<typeof habitSchema>;

export const checkInSchema = z.object({
  habit_id: z.uuid(),
  date: isoDate,
  done: z.boolean().optional(),
  value: optionalNumber.pipe(z.number().min(0).max(1_000_000).nullable()),
});

// ---------------- goals ----------------

export const goalSchema = z
  .object({
    title: z.string().trim().min(1, "Name the goal").max(200),
    description: optionalText(2000),
    pillar: pillarEnum,
    horizon: horizonEnum,
    start_date: isoDate,
    deadline: z.union([isoDate, z.literal(""), z.null()]).optional().transform((v) => v || null),
    target_value: optionalNumber.pipe(z.number().positive("Target must be above zero").nullable()),
    current_value: optionalNumber,
    unit: optionalText(24),
    manual_progress: z.number().int().min(0).max(100).default(0),
    status: z.enum(["active", "completed", "paused", "abandoned"]).default("active"),
    notes: optionalText(4000),
  })
  .refine((g) => !g.deadline || g.deadline >= g.start_date, {
    message: "Deadline must be after the start date",
    path: ["deadline"],
  });
export type GoalInput = z.input<typeof goalSchema>;

export const milestoneSchema = z.object({
  goal_id: z.uuid(),
  title: z.string().trim().min(1, "Name the milestone").max(200),
  due_date: z.union([isoDate, z.literal(""), z.null()]).optional().transform((v) => v || null),
});

export const progressSchema = z.object({
  goal_id: z.uuid(),
  value: optionalNumber,
  progress: optionalNumber.pipe(z.number().int().min(0).max(100).nullable()),
  note: optionalText(1000),
});

// ---------------- affirmations / reviews ----------------

export const affirmationSchema = z.object({
  text: z.string().trim().min(1, "Write the affirmation").max(2000),
  pillar: pillarEnum,
  horizon: z.union([horizonEnum, z.literal(""), z.null()]).optional().transform((v) => v || null),
  goal_id: optionalUuid,
});
export type AffirmationInput = z.input<typeof affirmationSchema>;

export const reviewSchema = z.object({
  review_date: isoDate,
  accomplishments: optionalText(4000),
  incomplete: optionalText(4000),
  learnings: optionalText(4000),
  improvements: optionalText(4000),
});
export type ReviewInput = z.input<typeof reviewSchema>;

// ---------------- settings ----------------

const weight = z.number().int().min(0).max(100);
export const settingsSchema = z
  .object({
    display_name: optionalText(80),
    timezone: z.string().min(1),
    day_start: time,
    week_starts_on: z.union([z.literal(0), z.literal(1)]),
    theme: z.enum(["light", "dark", "system"]),
    default_task_priority: priorityEnum,
    score_weights: z.object({ tasks: weight, goodHabits: weight, badHabits: weight, review: weight }),
  })
  .refine((s) => Object.values(s.score_weights).reduce((a, b) => a + b, 0) > 0, {
    message: "At least one weight must be above zero",
    path: ["score_weights", "tasks"],
  });
export type SettingsInput = z.input<typeof settingsSchema>;

import type { Goal, GoalMilestone } from "../../types/domain.ts";
import { diffDays, type ISODate } from "../date/productivity-day.ts";

export type ProgressSource = "numeric" | "milestones" | "manual";

/**
 * Goal progress (0..100):
 *  - numeric target → current / target
 *  - otherwise, milestones (if any) → completed / total
 *  - otherwise the manually-set percentage (qualitative goals)
 */
export function goalProgress(
  goal: Pick<Goal, "target_value" | "current_value" | "manual_progress" | "status">,
  milestones: Pick<GoalMilestone, "completed_at">[] = [],
): { percent: number; source: ProgressSource } {
  if (goal.status === "completed") return { percent: 100, source: goal.target_value ? "numeric" : "manual" };
  if (goal.target_value && goal.target_value > 0) {
    const pct = ((goal.current_value ?? 0) / goal.target_value) * 100;
    return { percent: clamp(Math.round(pct)), source: "numeric" };
  }
  if (milestones.length) {
    const done = milestones.filter((m) => m.completed_at).length;
    return { percent: Math.round((done / milestones.length) * 100), source: "milestones" };
  }
  return { percent: clamp(goal.manual_progress), source: "manual" };
}

export type GoalHealth = "completed" | "overdue" | "on_track" | "behind" | "no_deadline" | "inactive";

/**
 * Compares actual progress with linear expected progress between start and
 * deadline. Within 10 points of expectation counts as on track.
 */
export function goalHealth(
  goal: Pick<Goal, "status" | "start_date" | "deadline">,
  percent: number,
  today: ISODate,
): { health: GoalHealth; expected: number | null } {
  if (goal.status === "completed" || percent >= 100) return { health: "completed", expected: null };
  if (goal.status !== "active") return { health: "inactive", expected: null };
  if (!goal.deadline) return { health: "no_deadline", expected: null };
  if (today > goal.deadline) return { health: "overdue", expected: 100 };
  const span = Math.max(1, diffDays(goal.start_date, goal.deadline));
  const elapsed = Math.max(0, diffDays(goal.start_date, today));
  const expected = Math.round(Math.min(1, elapsed / span) * 100);
  return { health: percent >= expected - 10 ? "on_track" : "behind", expected };
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

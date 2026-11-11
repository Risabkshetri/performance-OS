import type { Habit, HabitFrequency, HabitLog, HabitKind, TargetDirection } from "../../types/domain.ts";
import { addDays, weekdayOf, type ISODate } from "../date/productivity-day.ts";

export function isScheduledOn(
  habit: Pick<Habit, "frequency" | "start_date">,
  date: ISODate,
): boolean {
  if (date < habit.start_date) return false;
  return frequencyMatches(habit.frequency, date);
}

export function frequencyMatches(freq: HabitFrequency, date: ISODate): boolean {
  return freq.type === "daily" || freq.weekdays.includes(weekdayOf(date));
}

/**
 * Whether a check-in meets the habit's target.
 *  - binary: the user's answer is the outcome. For a good habit "done" is a
 *    success; for a bad habit the UI asks "avoided?", so `true` is a success.
 *  - numeric: compared against the threshold (min = at least, max = at most).
 */
export function evaluateCheckIn(
  tracking: "binary" | "numeric",
  input: { done?: boolean; value?: number | null },
  target: { value: number | null; direction: TargetDirection | null },
): boolean {
  if (tracking === "binary") return input.done === true;
  if (input.value == null || target.value == null || !target.direction) return false;
  return target.direction === "min" ? input.value >= target.value : input.value <= target.value;
}

export function describeTarget(h: {
  tracking: "binary" | "numeric";
  kind: HabitKind;
  target_value: number | null;
  target_direction: TargetDirection | null;
  unit: string | null;
}): string {
  if (h.tracking === "binary") return h.kind === "good" ? "Done / not done" : "Avoided / slipped";
  const unit = h.unit ? ` ${h.unit}` : "";
  return h.target_direction === "max"
    ? `At most ${h.target_value}${unit}`
    : `At least ${h.target_value}${unit}`;
}

/**
 * Current streak: consecutive scheduled days (ending at `today`) on which
 * the habit was met. Today not yet logged does not break the streak.
 * Unscheduled days are skipped.
 */
export function currentStreak(
  habit: Pick<Habit, "frequency" | "start_date">,
  logsByDate: Map<ISODate, Pick<HabitLog, "met">>,
  today: ISODate,
  maxLookbackDays = 730,
): number {
  let streak = 0;
  for (let i = 0; i < maxLookbackDays; i++) {
    const d = addDays(today, -i);
    if (d < habit.start_date) break;
    if (!isScheduledOn(habit, d)) continue;
    const log = logsByDate.get(d);
    if (!log) {
      if (i === 0) continue; // today still open
      break;
    }
    if (!log.met) break;
    streak++;
  }
  return streak;
}

export function longestStreak(
  habit: Pick<Habit, "frequency" | "start_date">,
  logsByDate: Map<ISODate, Pick<HabitLog, "met">>,
  from: ISODate,
  to: ISODate,
): number {
  let best = 0;
  let run = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isScheduledOn(habit, d)) continue;
    if (logsByDate.get(d)?.met) {
      run++;
      best = Math.max(best, run);
    } else if (d !== to) {
      run = 0;
    }
  }
  return best;
}

/**
 * Consistency over [from, to]: met / scheduled days. When `to` is today and
 * today has no log yet, today is excluded (it is still in progress).
 * Returns null when nothing was scheduled.
 */
export function consistency(
  habit: Pick<Habit, "frequency" | "start_date">,
  logsByDate: Map<ISODate, Pick<HabitLog, "met">>,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): { met: number; scheduled: number; rate: number | null } {
  let met = 0;
  let scheduled = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isScheduledOn(habit, d)) continue;
    const log = logsByDate.get(d);
    if (d === today && !log) continue;
    if (d > today) continue;
    scheduled++;
    if (log?.met) met++;
  }
  return { met, scheduled, rate: scheduled ? met / scheduled : null };
}

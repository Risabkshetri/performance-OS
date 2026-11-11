/**
 * Daily Execution Score.
 *
 * score = Σ(weight_i × rate_i) / Σ(weight_i)   over *applicable* components
 *
 * Components
 *   tasks       completed / (all occurrences scheduled that day)
 *               Rescheduled and missed occurrences count as not completed.
 *   goodHabits  good habits met / good habits scheduled
 *   badHabits   bad habits within target / bad habits scheduled
 *   review      1 if a daily review was saved, else 0
 *
 * A component with nothing scheduled is *not applicable* and its weight is
 * redistributed, so quiet days are not penalised. If there are no tasks and
 * no habits at all, the day has no score (null). Working hours, deep-work
 * duration and sleep are deliberately NOT inputs.
 */
import type { ScoreWeights } from "../../types/domain.ts";

export const DEFAULT_WEIGHTS: ScoreWeights = { tasks: 50, goodHabits: 25, badHabits: 15, review: 10 };

export type ComponentKey = keyof ScoreWeights;

export interface DayInputs {
  tasks: { total: number; completed: number };
  goodHabits: { scheduled: number; met: number };
  badHabits: { scheduled: number; met: number };
  reviewed: boolean;
}

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  weight: number;
  /** share of the final score after redistribution (0..1), 0 if not applicable */
  effectiveWeight: number;
  rate: number | null;
  applicable: boolean;
  detail: string;
}

export interface DayScore {
  score: number | null; // 0..100, rounded
  components: ScoreComponent[];
}

export function normalizeWeights(w: Partial<ScoreWeights> | null | undefined): ScoreWeights {
  const out = { ...DEFAULT_WEIGHTS };
  if (w) {
    for (const k of Object.keys(DEFAULT_WEIGHTS) as ComponentKey[]) {
      const v = Number(w[k]);
      if (Number.isFinite(v) && v >= 0) out[k] = v;
    }
  }
  return out;
}

export function computeDayScore(inputs: DayInputs, weightsIn?: Partial<ScoreWeights>): DayScore {
  const weights = normalizeWeights(weightsIn);
  const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

  const raw: Omit<ScoreComponent, "effectiveWeight">[] = [
    {
      key: "tasks",
      label: "Task completion",
      weight: weights.tasks,
      rate: ratio(inputs.tasks.completed, inputs.tasks.total),
      applicable: inputs.tasks.total > 0,
      detail: `${inputs.tasks.completed} of ${inputs.tasks.total} tasks`,
    },
    {
      key: "goodHabits",
      label: "Good habits",
      weight: weights.goodHabits,
      rate: ratio(inputs.goodHabits.met, inputs.goodHabits.scheduled),
      applicable: inputs.goodHabits.scheduled > 0,
      detail: `${inputs.goodHabits.met} of ${inputs.goodHabits.scheduled} kept`,
    },
    {
      key: "badHabits",
      label: "Reduction targets",
      weight: weights.badHabits,
      rate: ratio(inputs.badHabits.met, inputs.badHabits.scheduled),
      applicable: inputs.badHabits.scheduled > 0,
      detail: `${inputs.badHabits.met} of ${inputs.badHabits.scheduled} within target`,
    },
    {
      key: "review",
      label: "Daily review",
      weight: weights.review,
      rate: inputs.reviewed ? 1 : 0,
      applicable: true,
      detail: inputs.reviewed ? "Completed" : "Not written",
    },
  ];

  const hasExecutionItems = raw.some((c) => c.key !== "review" && c.applicable);
  if (!hasExecutionItems) {
    return { score: null, components: raw.map((c) => ({ ...c, applicable: c.key === "review" ? false : c.applicable, effectiveWeight: 0 })) };
  }

  const totalWeight = raw.reduce((s, c) => s + (c.applicable ? c.weight : 0), 0);
  if (totalWeight <= 0) {
    return { score: null, components: raw.map((c) => ({ ...c, effectiveWeight: 0 })) };
  }

  const components = raw.map((c) => ({
    ...c,
    effectiveWeight: c.applicable ? c.weight / totalWeight : 0,
  }));
  const score = components.reduce((s, c) => s + c.effectiveWeight * (c.rate ?? 0), 0);
  return { score: Math.round(score * 100), components };
}

/**
 * Pillar performance: share of scheduled items (task occurrences + habit
 * check-ins) attributed to the pillar that were completed / met.
 */
export function pillarRate(items: { done: boolean }[]): number | null {
  if (!items.length) return null;
  return items.filter((i) => i.done).length / items.length;
}

export function average(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

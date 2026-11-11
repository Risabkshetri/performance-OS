import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRecurrence, occursOn, pendingMaterialization, recurrenceDates } from "./recurrence.ts";
import { consistency, currentStreak, evaluateCheckIn, isScheduledOn, longestStreak } from "./habits.ts";
import { computeDayScore, normalizeWeights } from "./score.ts";
import { goalHealth, goalProgress } from "./goals.ts";

// ---------------- recurrence ----------------

test("daily recurrence", () => {
  assert.deepEqual(recurrenceDates({ type: "daily" }, "2026-11-10", "2026-11-09", "2026-11-12"), [
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
  ]);
});

test("weekday recurrence (Mon/Wed/Fri)", () => {
  const dates = recurrenceDates({ type: "weekly", weekdays: [1, 3, 5] }, "2026-11-01", "2026-11-09", "2026-11-15");
  assert.deepEqual(dates, ["2026-11-09", "2026-11-11", "2026-11-13"]);
});

test("every-N-days recurrence is anchored to the start date", () => {
  const dates = recurrenceDates({ type: "interval", every: 3 }, "2026-11-01", "2026-11-05", "2026-11-14");
  assert.deepEqual(dates, ["2026-11-07", "2026-11-10", "2026-11-13"]);
});

test("recurrence respects end date", () => {
  assert.deepEqual(recurrenceDates({ type: "daily" }, "2026-11-01", "2026-11-01", "2026-11-30", "2026-11-03"), [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
  ]);
  assert.equal(occursOn({ type: "daily" }, "2026-11-01", "2026-11-04", "2026-11-03"), false);
});

test("materialisation is incremental and idempotent", () => {
  const first = pendingMaterialization({ type: "daily" }, "2026-11-01", null, null, "2026-11-03");
  assert.deepEqual(first?.dates, ["2026-11-01", "2026-11-02", "2026-11-03"]);
  const second = pendingMaterialization({ type: "daily" }, "2026-11-01", null, "2026-11-03", "2026-11-05");
  assert.deepEqual(second?.dates, ["2026-11-04", "2026-11-05"]);
  assert.equal(pendingMaterialization({ type: "daily" }, "2026-11-01", null, "2026-11-05", "2026-11-04"), null);
});

test("describe recurrence", () => {
  assert.equal(describeRecurrence({ type: "weekly", weekdays: [5, 1, 2, 3, 4] }), "Weekdays");
  assert.equal(describeRecurrence({ type: "interval", every: 2 }), "Every 2 days");
});

// ---------------- habits ----------------

const daily = { frequency: { type: "daily" as const }, start_date: "2026-11-01" };
const logs = (entries: [string, boolean][]) => new Map(entries.map(([d, met]) => [d, { met }]));

test("numeric targets: min and max thresholds", () => {
  // screen time below 2h (120 min)
  assert.equal(evaluateCheckIn("numeric", { value: 105 }, { value: 120, direction: "max" }), true);
  assert.equal(evaluateCheckIn("numeric", { value: 121 }, { value: 120, direction: "max" }), false);
  assert.equal(evaluateCheckIn("numeric", { value: 120 }, { value: 120, direction: "max" }), true);
  // water at least 8 glasses
  assert.equal(evaluateCheckIn("numeric", { value: 8 }, { value: 8, direction: "min" }), true);
  assert.equal(evaluateCheckIn("numeric", { value: 6 }, { value: 8, direction: "min" }), false);
  assert.equal(evaluateCheckIn("numeric", { value: null }, { value: 8, direction: "min" }), false);
});

test("binary check-ins", () => {
  assert.equal(evaluateCheckIn("binary", { done: true }, { value: null, direction: null }), true);
  assert.equal(evaluateCheckIn("binary", { done: false }, { value: null, direction: null }), false);
});

test("habit scheduling honours weekdays and start date", () => {
  const h = { frequency: { type: "weekly" as const, weekdays: [1, 3] }, start_date: "2026-11-10" };
  assert.equal(isScheduledOn(h, "2026-11-09"), false); // Monday, before start
  assert.equal(isScheduledOn(h, "2026-11-11"), true); // Wednesday
  assert.equal(isScheduledOn(h, "2026-11-12"), false); // Thursday
});

test("streak: today unlogged does not break it, a miss does", () => {
  const l = logs([
    ["2026-11-08", false],
    ["2026-11-09", true],
    ["2026-11-10", true],
  ]);
  assert.equal(currentStreak(daily, l, "2026-11-11"), 2);
  l.set("2026-11-11", { met: true });
  assert.equal(currentStreak(daily, l, "2026-11-11"), 3);
  l.set("2026-11-11", { met: false });
  assert.equal(currentStreak(daily, l, "2026-11-11"), 0);
});

test("streak skips unscheduled days", () => {
  const mwf = { frequency: { type: "weekly" as const, weekdays: [1, 3, 5] }, start_date: "2026-11-01" };
  const l = logs([
    ["2026-11-06", true], // Fri
    ["2026-11-09", true], // Mon
    ["2026-11-11", true], // Wed
  ]);
  assert.equal(currentStreak(mwf, l, "2026-11-11"), 3);
});

test("consistency excludes open today and counts missing past logs as not met", () => {
  const l = logs([
    ["2026-11-01", true],
    ["2026-11-02", true],
    ["2026-11-04", true],
  ]);
  const c = consistency(daily, l, "2026-11-01", "2026-11-05", "2026-11-05");
  assert.deepEqual(c, { met: 3, scheduled: 4, rate: 0.75 });
});

test("longest streak", () => {
  const l = logs([
    ["2026-11-01", true],
    ["2026-11-02", true],
    ["2026-11-03", true],
    ["2026-11-04", false],
    ["2026-11-05", true],
  ]);
  assert.equal(longestStreak(daily, l, "2026-11-01", "2026-11-05"), 3);
});

// ---------------- score ----------------

const base = {
  tasks: { total: 4, completed: 3 },
  goodHabits: { scheduled: 2, met: 2 },
  badHabits: { scheduled: 1, met: 0 },
  reviewed: true,
};

test("score uses default weights 50/25/15/10", () => {
  // 0.5*0.75 + 0.25*1 + 0.15*0 + 0.10*1 = 0.725
  assert.equal(computeDayScore(base).score, 73);
});

test("inapplicable components are redistributed, not penalised", () => {
  const s = computeDayScore({ ...base, badHabits: { scheduled: 0, met: 0 } });
  // weights 50/25/10 over 85: (37.5 + 25 + 10) / 85 = 0.853
  assert.equal(s.score, 85);
  const bad = s.components.find((c) => c.key === "badHabits")!;
  assert.equal(bad.applicable, false);
  assert.equal(bad.effectiveWeight, 0);
});

test("a day with no tasks and no habits has no score", () => {
  const s = computeDayScore({
    tasks: { total: 0, completed: 0 },
    goodHabits: { scheduled: 0, met: 0 },
    badHabits: { scheduled: 0, met: 0 },
    reviewed: true,
  });
  assert.equal(s.score, null);
});

test("rescheduled tasks are not completed (they stay in the denominator)", () => {
  // caller passes total including rescheduled occurrences
  const s = computeDayScore({
    tasks: { total: 2, completed: 1 },
    goodHabits: { scheduled: 0, met: 0 },
    badHabits: { scheduled: 0, met: 0 },
    reviewed: false,
  });
  // 50*0.5 + 10*0 over 60
  assert.equal(s.score, 42);
});

test("custom weights and invalid input fall back to defaults", () => {
  assert.equal(computeDayScore(base, { tasks: 100, goodHabits: 0, badHabits: 0, review: 0 }).score, 75);
  assert.deepEqual(normalizeWeights({ tasks: -5 } as never), { tasks: 50, goodHabits: 25, badHabits: 15, review: 10 });
});

test("effective weights sum to 1", () => {
  const s = computeDayScore(base);
  const sum = s.components.reduce((a, c) => a + c.effectiveWeight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

// ---------------- goals ----------------

test("goal progress: numeric, milestones, manual", () => {
  assert.deepEqual(
    goalProgress({ target_value: 200, current_value: 50, manual_progress: 0, status: "active" }),
    { percent: 25, source: "numeric" },
  );
  assert.deepEqual(
    goalProgress({ target_value: null, current_value: null, manual_progress: 0, status: "active" }, [
      { completed_at: "x" },
      { completed_at: null },
    ]),
    { percent: 50, source: "milestones" },
  );
  assert.deepEqual(
    goalProgress({ target_value: null, current_value: null, manual_progress: 40, status: "active" }),
    { percent: 40, source: "manual" },
  );
  assert.equal(goalProgress({ target_value: 10, current_value: 50, manual_progress: 0, status: "active" }).percent, 100);
});

test("goal health", () => {
  const g = { status: "active" as const, start_date: "2026-11-01", deadline: "2026-11-30" };
  assert.equal(goalHealth(g, 40, "2026-11-11").health, "on_track"); // expected ~34
  assert.equal(goalHealth(g, 10, "2026-11-20").health, "behind");
  assert.equal(goalHealth(g, 90, "2026-12-01").health, "overdue");
  assert.equal(goalHealth(g, 100, "2026-12-01").health, "completed");
  assert.equal(goalHealth({ ...g, deadline: null }, 10, "2026-11-11").health, "no_deadline");
});

// ---------------- daily series ----------------
import { buildDailySeries, pillarPercent } from "./daily-series.ts";
import { DEFAULT_WEIGHTS } from "./score.ts";

test("daily series aggregates tasks, habits (with snapshots), time and pillars", () => {
  const [day] = buildDailySeries({
    dates: ["2026-11-10"],
    occurrences: [
      { scheduled_date: "2026-11-10", status: "completed", pillar: "growth" },
      { scheduled_date: "2026-11-10", status: "rescheduled", pillar: "growth" },
      { scheduled_date: "2026-11-10", status: "missed", pillar: "finance" },
      { scheduled_date: "2026-11-11", status: "completed", pillar: "health" },
    ],
    habits: [
      { id: "gym", kind: "good", pillar: "health", frequency: { type: "daily" }, start_date: "2026-11-01", active: true, archived_at: null },
      { id: "read", kind: "good", pillar: "growth", frequency: { type: "daily" }, start_date: "2026-11-01", active: true, archived_at: null },
      // habit was "good" when logged but later redefined as "bad": snapshot wins
      { id: "screen", kind: "bad", pillar: "health", frequency: { type: "daily" }, start_date: "2026-11-01", active: true, archived_at: null },
      { id: "paused", kind: "good", pillar: "health", frequency: { type: "daily" }, start_date: "2026-11-01", active: false, archived_at: null },
    ],
    logs: [
      { habit_id: "gym", log_date: "2026-11-10", met: true, kind_snapshot: "good" },
      { habit_id: "screen", log_date: "2026-11-10", met: true, kind_snapshot: "good" },
    ],
    reviewDates: new Set(["2026-11-10"]),
    activities: [
      { productivity_date: "2026-11-10", kind: "deep", minutes: 90 },
      { productivity_date: "2026-11-10", kind: "external", minutes: 45 },
      { productivity_date: "2026-11-10", kind: "deep", minutes: 30 },
    ],
    weights: DEFAULT_WEIGHTS,
  });
  assert.deepEqual(day.tasks, { total: 3, completed: 1, missed: 1, rescheduled: 1, open: 0 });
  assert.deepEqual(day.goodHabits, { scheduled: 3, met: 2 }); // gym ✓, screen(snapshot good) ✓, read ✗
  assert.deepEqual(day.badHabits, { scheduled: 0, met: 0 });
  assert.equal(day.minutes.deep, 120);
  assert.equal(day.minutes.external, 45);
  assert.deepEqual(day.pillars.growth, { done: 1, total: 3 }); // 2 tasks + read
  assert.equal(pillarPercent([day], "health"), 100);
  // tasks 1/3*50 + habits 2/3*25 + review 10, over 85
  assert.equal(day.score, Math.round(((50 / 3 + 50 / 3 + 10) / 85) * 100));
});

// ---------------- progress series (auto-scaling buckets) ----------------
import { buildProgressSeries, granularityFor } from "./progress-series.ts";
import { dateRange } from "../date/productivity-day.ts";

test("progress granularity grows with the span", () => {
  assert.equal(granularityFor(7), "day");
  assert.equal(granularityFor(45), "day");
  assert.equal(granularityFor(46), "week");
  assert.equal(granularityFor(210), "week");
  assert.equal(granularityFor(400), "month");
});

test("progress series buckets by week and averages scored days only", () => {
  const dates = dateRange("2026-11-02", "2026-11-15"); // Mon..Sun x2
  const days = buildDailySeries({
    dates,
    occurrences: [
      { scheduled_date: "2026-11-02", status: "completed", pillar: "growth" },
      { scheduled_date: "2026-11-03", status: "missed", pillar: "growth" },
    ],
    habits: [],
    logs: [],
    reviewDates: new Set(),
    activities: [{ productivity_date: "2026-11-02", kind: "deep", minutes: 420 }],
    weights: { tasks: 50, goodHabits: 25, badHabits: 15, review: 10 },
  });
  // force weekly by using a long fake span
  const long = [...days, ...Array.from({ length: 60 }, () => days[13])].slice(0, 74);
  const { granularity, points } = buildProgressSeries(long.slice(0, 74), 1);
  assert.equal(granularity, "week");
  assert.equal(points[0].start, "2026-11-02");
  assert.equal(points[0].tasks, 50);
  // day 1: tasks 100% + no review → 83; day 2: 0 → avg 42; unscheduled days excluded
  assert.equal(points[0].score, 42);
  assert.equal(points[0].deep, 1); // 7h over 7 days
  assert.equal(buildProgressSeries(days, 1).granularity, "day");
});

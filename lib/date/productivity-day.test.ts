import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dateRange,
  diffDays,
  minutesIntoProductivityDay,
  productivityDateOf,
  productivityDayRange,
  productivityTimeToInstant,
  startOfWeek,
  weekdayOf,
} from "./productivity-day.ts";

const NY = "America/New_York";
const KOL = "Asia/Kolkata";

// Spec examples (6 AM boundary), expressed in Asia/Kolkata (UTC+5:30).
const kolkata = (local: string) => new Date(`${local}+05:30`);

test("spec examples: 6 AM boundary", () => {
  const cases: [string, string][] = [
    ["2026-11-11T06:00:00", "2026-11-11"],
    ["2026-11-11T23:30:00", "2026-11-11"],
    ["2026-11-12T01:30:00", "2026-11-11"],
    ["2026-11-12T05:59:00", "2026-11-11"],
    ["2026-11-12T06:00:00", "2026-11-12"],
  ];
  for (const [local, expected] of cases) {
    assert.equal(productivityDateOf(kolkata(local), KOL, 360), expected, local);
  }
});

test("custom 5 AM boundary", () => {
  assert.equal(productivityDateOf(kolkata("2026-11-12T05:30:00"), KOL, 300), "2026-11-12");
  assert.equal(productivityDateOf(kolkata("2026-11-12T04:59:00"), KOL, 300), "2026-11-11");
});

test("midnight boundary behaves like calendar dates", () => {
  assert.equal(productivityDateOf(kolkata("2026-11-12T00:00:00"), KOL, 0), "2026-11-12");
  assert.equal(productivityDateOf(kolkata("2026-11-11T23:59:00"), KOL, 0), "2026-11-11");
});

test("same instant maps to different productivity dates in different zones", () => {
  const instant = new Date("2026-11-12T03:00:00Z"); // 22:00 NY (Nov 11), 08:30 Kolkata (Nov 12)
  assert.equal(productivityDateOf(instant, NY, 360), "2026-11-11");
  assert.equal(productivityDateOf(instant, KOL, 360), "2026-11-12");
});

test("day range is [boundary, next boundary)", () => {
  const { start, end } = productivityDayRange("2026-11-11", KOL, 360);
  assert.equal(start.toISOString(), "2026-11-11T00:30:00.000Z");
  assert.equal(end.toISOString(), "2026-11-12T00:30:00.000Z");
});

test("DST spring-forward day is 23 hours long (New York)", () => {
  // DST begins 02:00 on 2026-03-08, inside productivity day Mar 7 (06:00 Mar 7 → 06:00 Mar 8)
  const { start, end } = productivityDayRange("2026-03-07", NY, 360);
  assert.equal((end.getTime() - start.getTime()) / 3_600_000, 23);
  assert.equal(start.toISOString(), "2026-03-07T11:00:00.000Z"); // 06:00 EST
  assert.equal(end.toISOString(), "2026-03-08T10:00:00.000Z"); // 06:00 EDT
});

test("DST fall-back day is 25 hours long (New York)", () => {
  const { start, end } = productivityDayRange("2026-10-31", NY, 360);
  // 2026-10-31 06:00 EDT → 2026-11-01 06:00 EST (fall back occurs 02:00 Nov 1)
  assert.equal((end.getTime() - start.getTime()) / 3_600_000, 25);
});

test("DST: 01:30 during fall-back night still belongs to previous day", () => {
  const instant = new Date("2026-11-01T05:30:00Z"); // 01:30 EDT
  assert.equal(productivityDateOf(instant, NY, 360), "2026-10-31");
});

test("times before the boundary resolve to the next calendar day", () => {
  const late = productivityTimeToInstant("2026-11-11", "01:30", KOL, 360);
  assert.equal(late.toISOString(), "2026-11-11T20:00:00.000Z"); // Nov 12 01:30 IST
  assert.equal(productivityDateOf(late, KOL, 360), "2026-11-11");
  const day = productivityTimeToInstant("2026-11-11", "10:00", KOL, 360);
  assert.equal(day.toISOString(), "2026-11-11T04:30:00.000Z");
});

test("calendar helpers", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  assert.equal(diffDays("2026-11-01", "2026-11-11"), 10);
  assert.equal(weekdayOf("2026-11-11"), 3); // Wednesday
  assert.equal(startOfWeek("2026-11-11", 1), "2026-11-09");
  assert.equal(startOfWeek("2026-11-11", 0), "2026-11-08");
  assert.deepEqual(dateRange("2026-11-10", "2026-11-12"), ["2026-11-10", "2026-11-11", "2026-11-12"]);
});

test("sorting key places after-midnight times at the end of the day", () => {
  assert.ok(minutesIntoProductivityDay("01:00", 360) > minutesIntoProductivityDay("22:00", 360));
  assert.equal(minutesIntoProductivityDay("06:00", 360), 0);
});

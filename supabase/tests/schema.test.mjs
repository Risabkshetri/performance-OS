// Database tests: runs the real migration in PGlite (Postgres compiled to WASM)
// with a stubbed Supabase auth schema, then checks RLS, constraints and RPCs.
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const migration = readFileSync(new URL("../migrations/20261111000000_init.sql", import.meta.url), "utf8");
const db = new PGlite({ extensions: { btree_gist } });

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create role authenticated;
  create role anon;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`);
await db.exec(migration);
await db.exec(`
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`);

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
await db.exec(`insert into auth.users values ('${A}', 'alice@example.com'), ('${B}', 'bob@example.com');`);

let passed = 0;
const ok = (name) => { passed++; console.log("  ✓", name); };

// Run statements as a given authenticated user (switches role + JWT sub claim).
async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
async function expectError(promise, code, name) {
  try { await promise; } catch (e) { assert.equal(e.code, code, `${name}: expected ${code}, got ${e.code} ${e.message}`); return ok(name); }
  assert.fail(`${name}: expected error ${code}`);
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

// 1. signup bootstrap
{
  const r = await one(`select count(*)::int c from profiles`);
  assert.equal(r.c, 2);
  const cats = await one(`select count(*)::int c from activity_categories where user_id = $1`, [A]);
  assert.equal(cats.c, 3);
  const p = await one(`select day_start_minutes, score_weights from profiles where id = $1`, [A]);
  assert.equal(p.day_start_minutes, 360);
  assert.deepEqual(p.score_weights, { tasks: 50, goodHabits: 25, badHabits: 15, review: 10 });
  ok("signup trigger creates profile (6 AM default, 50/25/15/10) and 3 default categories");
}

// 2. RLS isolation
const goalA = await as(A, () => one(`insert into goals (user_id, title, pillar, horizon) values ($1, 'Run a half marathon', 'health', 'six_month') returning id`, [A]));
const taskA = await as(A, () => one(`insert into tasks (user_id, title, pillar, goal_id) values ($1, 'Long run', 'health', $2) returning id`, [A, goalA.id]));
const occA = await as(A, () => one(`insert into task_occurrences (user_id, task_id, scheduled_date) values ($1, $2, '2026-11-11') returning id`, [A, taskA.id]));
{
  const seen = await as(B, () => one(`select (select count(*) from goals)::int g, (select count(*) from tasks)::int t, (select count(*) from profiles)::int p`));
  assert.deepEqual(seen, { g: 0, t: 0, p: 1 });
  ok("RLS: user B sees none of A's goals/tasks and only their own profile");
  const upd = await as(B, () => db.query(`update tasks set title = 'hacked' where id = $1`, [taskA.id]));
  assert.equal(upd.affectedRows, 0);
  ok("RLS: user B cannot update A's task");
}
await expectError(as(B, () => db.query(`insert into tasks (user_id, title, pillar) values ($1, 'x', 'health')`, [A])), "42501", "RLS: cannot insert rows owned by another user");
await expectError(
  as(B, () => db.query(`insert into tasks (user_id, title, pillar, goal_id) values ($1, 'x', 'health', $2)`, [B, goalA.id])),
  "23503",
  "composite FK: B cannot link a task to A's goal",
);

// 3. constraints
await expectError(as(A, () => db.query(`update task_occurrences set status = 'completed' where id = $1`, [occA.id])), "23514", "completed status requires completed_at");
await expectError(as(A, () => db.query(`insert into task_occurrences (user_id, task_id, scheduled_date, origin) values ($1,$2,'2026-11-12','recurrence'), ($1,$2,'2026-11-12','recurrence')`, [A, taskA.id])), "23505", "recurrence materialisation is unique per (task, date)");

// 4. reschedule (transactional)
{
  const r = await as(A, () => one(`select reschedule_occurrence($1, '2026-11-13') as id`, [occA.id]));
  const old = await one(`select status from task_occurrences where id = $1`, [occA.id]);
  const neu = await one(`select status, scheduled_date::text d, origin, rescheduled_from from task_occurrences where id = $1`, [r.id]);
  assert.equal(old.status, "rescheduled");
  assert.deepEqual({ ...neu }, { status: "pending", d: "2026-11-13", origin: "reschedule", rescheduled_from: occA.id });
  ok("reschedule_occurrence marks the original rescheduled and creates a pending copy");
  await expectError(as(A, () => db.query(`select reschedule_occurrence($1, '2026-11-20')`, [occA.id])), "P0001", "cannot reschedule an already-rescheduled occurrence");
  await expectError(as(B, () => db.query(`select reschedule_occurrence($1, '2026-11-20')`, [r.id])), "P0001", "reschedule RPC respects ownership");
}

// 5. timer: one running per user
{
  const deep = await one(`select id from activity_categories where user_id = $1 and kind = 'deep'`, [A]);
  await as(A, () => db.query(`select start_activity($1, 'Research', 'growth', null, '2026-11-11T18:00:00Z', '2026-11-11')`, [deep.id]));
  await as(A, () => db.query(`select start_activity($1, 'Architecture', 'growth', null, '2026-11-11T19:30:00Z', '2026-11-11')`, [deep.id]));
  const rows = (await db.query(`select title, ended_at from activities where user_id = $1 order by started_at`, [A])).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ended_at.toISOString(), "2026-11-11T19:30:00.000Z");
  assert.equal(rows[1].ended_at, null);
  ok("start_activity stops the running timer at the new start time");
  await expectError(
    as(A, () => db.query(`insert into activities (user_id, category_id, title, started_at, productivity_date) values ($1, $2, 'dup', now(), '2026-11-11')`, [A, deep.id])),
    "23505",
    "unique index allows only one running timer per user",
  );
  // crossing midnight is fine
  await as(A, () => db.query(`update activities set ended_at = '2026-11-11T21:00:00Z' where ended_at is null`));
  await as(A, () => db.query(`insert into activities (user_id, category_id, title, started_at, ended_at, productivity_date) values ($1, $2, 'Late session', '2026-11-11T22:30:00Z', '2026-11-12T01:30:00Z', '2026-11-11')`, [A, deep.id]));
  ok("activities may cross midnight");
  await expectError(
    as(A, () => db.query(`insert into activities (user_id, category_id, title, started_at, ended_at, productivity_date) values ($1, $2, 'bad', '2026-11-11T10:00:00Z', '2026-11-11T09:00:00Z', '2026-11-11')`, [A, deep.id])),
    "23514",
    "activity end must be after start",
  );
  const cB = await one(`select id from activity_categories where user_id = $1 limit 1`, [B]);
  await expectError(
    as(A, () => db.query(`insert into activities (user_id, category_id, title, started_at, ended_at, productivity_date) values ($1, $2, 'x', '2026-11-11T10:00:00Z', '2026-11-11T11:00:00Z', '2026-11-11')`, [A, cB.id])),
    "23503",
    "cannot use another user's activity category",
  );
}

// 6. sleep: no overlapping intervals
{
  await as(A, () => db.query(`insert into sleep_logs (user_id, slept_at, woke_at, wake_date) values ($1, '2026-11-10T17:30:00Z', '2026-11-11T01:00:00Z', '2026-11-11')`, [A]));
  await expectError(
    as(A, () => db.query(`insert into sleep_logs (user_id, slept_at, woke_at, wake_date) values ($1, '2026-11-11T00:00:00Z', '2026-11-11T02:00:00Z', '2026-11-11')`, [A])),
    "23P01",
    "overlapping sleep intervals are rejected (no double counting)",
  );
  await as(B, () => db.query(`insert into sleep_logs (user_id, slept_at, woke_at, wake_date) values ($1, '2026-11-11T00:00:00Z', '2026-11-11T02:00:00Z', '2026-11-11')`, [B]));
  ok("different users' sleep may overlap");
}

// 7. habits: snapshot history survives definition change
{
  const h = await as(A, () => one(`insert into habits (user_id, name, kind, pillar, tracking, unit, target_value, target_direction) values ($1, 'Screen time', 'bad', 'health', 'numeric', 'min', 120, 'max') returning id`, [A]));
  await as(A, () => db.query(`insert into habit_logs (user_id, habit_id, log_date, value, met, kind_snapshot, tracking_snapshot, target_value_snapshot, target_direction_snapshot) values ($1, $2, '2026-11-10', 105, true, 'bad', 'numeric', 120, 'max')`, [A, h.id]));
  await as(A, () => db.query(`update habits set target_value = 90 where id = $1`, [h.id]));
  const log = await one(`select target_value_snapshot::int t, met from habit_logs where habit_id = $1`, [h.id]);
  assert.deepEqual({ ...log }, { t: 120, met: true });
  ok("editing a habit target leaves historical logs untouched");
  await expectError(
    as(A, () => db.query(`insert into habits (user_id, name, kind, pillar, tracking) values ($1, 'x', 'bad', 'health', 'numeric')`, [A])),
    "23514",
    "numeric habits require a target and direction",
  );
}

// 8. goals: progress rpc + delete keeps tasks
{
  await as(A, () => db.query(`update goals set target_value = 21.1, unit = 'km' where id = $1`, [goalA.id]));
  await as(A, () => db.query(`select log_goal_progress($1, 12.5, null, 'Long run done')`, [goalA.id]));
  const g = await one(`select current_value::float v, (select count(*)::int from goal_progress_logs where goal_id = $1) n from goals where id = $1`, [goalA.id]);
  assert.deepEqual({ ...g }, { v: 12.5, n: 1 });
  ok("log_goal_progress updates the goal and appends a log atomically");
  await as(A, () => db.query(`delete from goals where id = $1`, [goalA.id]));
  const t = await one(`select goal_id, user_id from tasks where id = $1`, [taskA.id]);
  assert.equal(t.goal_id, null);
  assert.equal(t.user_id, A);
  ok("deleting a goal unlinks tasks without touching ownership (SET NULL (goal_id))");
}

// 9. affirmations: one featured
{
  const a1 = await as(A, () => one(`insert into affirmations (user_id, text, pillar) values ($1, 'One', 'growth') returning id`, [A]));
  const a2 = await as(A, () => one(`insert into affirmations (user_id, text, pillar) values ($1, 'Two', 'health') returning id`, [A]));
  await as(A, () => db.query(`select feature_affirmation($1)`, [a1.id]));
  await as(A, () => db.query(`select feature_affirmation($1)`, [a2.id]));
  const f = (await db.query(`select id from affirmations where user_id = $1 and is_featured`, [A])).rows;
  assert.deepEqual(f.map((r) => r.id), [a2.id]);
  ok("feature_affirmation keeps exactly one featured affirmation");
}

// 10. reviews unique per day; updated_at trigger
{
  await as(A, () => db.query(`insert into daily_reviews (user_id, review_date, learnings) values ($1, '2026-11-11', 'x') on conflict (user_id, review_date) do update set learnings = excluded.learnings`, [A]));
  await as(A, () => db.query(`insert into daily_reviews (user_id, review_date, learnings) values ($1, '2026-11-11', 'y') on conflict (user_id, review_date) do update set learnings = excluded.learnings`, [A]));
  const r = await one(`select count(*)::int c, max(learnings) l from daily_reviews where user_id = $1`, [A]);
  assert.deepEqual({ ...r }, { c: 1, l: "y" });
  ok("daily review upserts one row per productivity day");
}

// 11. anon has no access
await expectError(
  (async () => {
    await db.exec(`set role anon;`);
    try { await db.query(`select * from tasks`); } finally { await db.exec(`reset role;`); }
  })(),
  "42501",
  "anonymous role cannot read tables",
);

// reset-data.sql wipes records but keeps the account, settings and default categories
{
  await db.exec(`
    insert into goals (user_id, title, pillar, horizon, start_date) values ('${A}', 'G', 'growth', 'yearly', '2026-01-01');
    insert into tasks (user_id, title, pillar, priority) values ('${A}', 'T', 'growth', 'high');
    insert into habits (user_id, name, kind, pillar, tracking, start_date) values ('${A}', 'H', 'good', 'health', 'binary', '2026-01-01');
    insert into affirmations (user_id, text, pillar) values ('${A}', 'I act', 'growth');
    insert into activity_categories (user_id, name, kind) values ('${A}', 'Custom', 'other');
    update profiles set day_start_minutes = 300 where id = '${A}';
  `);
  const reset = readFileSync(new URL("../reset-data.sql", import.meta.url), "utf8");
  await db.exec(reset);
  for (const t of ["goals", "tasks", "task_occurrences", "activities", "sleep_logs", "habits", "habit_logs", "affirmations", "daily_reviews"]) {
    assert.equal(Number((await one(`select count(*)::int as n from ${t}`)).n), 0, `${t} emptied`);
  }
  assert.equal((await one(`select count(*)::int as n from activity_categories where not is_default`)).n, 0);
  assert.ok((await one(`select count(*)::int as n from activity_categories where is_default`)).n >= 3);
  assert.equal((await one(`select day_start_minutes from profiles where id = '${A}'`)).day_start_minutes, 300);
  ok("reset-data.sql clears records, keeps account, settings and default categories");
}

console.log(`\n${passed} database checks passed`);

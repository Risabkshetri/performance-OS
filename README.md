# Performance OS

A private personal performance system: **plan → execute → track → review → improve**.
Daily planning, activity and sleep tracking, good/bad habits, goals across Health, Finance and
Growth, affirmations, daily reviews and transparent analytics, all built on your own records.

Next.js 16 (App Router, Server Components, Server Actions) · TypeScript strict · Tailwind v4 ·
shadcn/ui (Radix) · Supabase Postgres + Auth with RLS · Recharts · Zod + React Hook Form · date-fns/tz.
There are no external integrations.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Apply the schema.** In the SQL editor, run `supabase/migrations/20261111000000_init.sql`
   (or, with the Supabase CLI: `supabase link` then `supabase db push`).
3. **Create your owner account.** In Authentication → Users → *Add user*, create one user with
   "Auto confirm" ticked. This is the only account; there is no sign-up or login screen.
4. **Environment variables.** Copy `.env.example` to `.env.local` and fill in:

   | Variable | Required | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted) |
   | `OWNER_EMAIL` / `OWNER_PASSWORD` | yes | The owner account. Server-only; the app signs in with it automatically |

   The service-role key is never used.
5. **Starting fresh.** `supabase/reset-data.sql` deletes every record (tasks, activities, habits,
   goals, affirmations, reviews) but keeps your account, settings and default categories.
   It cannot be undone.
6. Install and run:

   ```bash
   npm install
   npm run dev          # http://localhost:3000
   ```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests: productivity day, recurrence, habits, scoring, goals, daily series |
| `npm run test:db` | Runs the real migration in PGlite (Postgres in WASM) and checks RLS, constraints and RPCs |
| `npm run test:all` | Both |

Requires Node ≥ 22.18 (tests use Node's built-in TypeScript support).

## Key concepts

**Productivity day.** A day runs from your configured start time (default 06:00) to the same time
the next calendar day, in your timezone. 01:30 on Nov 12 belongs to the Nov 11 productivity day.
Timestamps are stored in UTC; productivity dates are derived (`lib/date/productivity-day.ts`) and
DST-safe (23 and 25-hour days are tested). No working hours are enforced.

**Tasks vs activities.** A *task* is what you planned (`tasks` = definition, `task_occurrences` = each
dated instance). An *activity* is what you actually spent time on. Activities can link to a task,
which gives you planned vs actual time.

**Recurring tasks** (daily, chosen weekdays, every N days) are materialised lazily, about 5 weeks ahead,
as individual occurrences behind a unique index, so completing one never completes another. Editing a series
changes future pending occurrences only. Ending a series keeps its history.

**Timer.** The start timestamp lives in the database; elapsed time is computed from it. It stays
accurate across refreshes, devices and sleep/wake. A partial unique index guarantees a single running timer.

**Habits** are good (build) or bad (reduce), binary or numeric with a minimum/maximum target. Each
check-in snapshots the target it was judged against, so editing a habit never rewrites history.
Streaks skip unscheduled days, and an unlogged *today* never breaks one.

**Execution score** (configurable in Settings):

```
score = Σ weightᵢ × rateᵢ / Σ weightᵢ     (applicable components only)
tasks 50 · good habits 25 · reduction targets 15 · daily review 10
```

Averages and rates on Performance, and the 7-day comparisons on Overview, use completed days only;
today is in progress and shown on the chart. A component with nothing scheduled is excluded and its weight redistributed. A day with no tasks
and no habits has no score. Rescheduled and missed occurrences count as not completed. Hours worked,
deep work and sleep are never inputs. The breakdown is shown wherever the score appears.

## Database (`supabase/migrations`)

`profiles` (timezone, day start, week start, theme, default priority, score weights) ·
`goals`, `goal_milestones`, `goal_progress_logs` · `tasks`, `task_occurrences` ·
`activity_categories` (defaults: Deep Work / External Work / Personal; custom categories map to a
kind), `activities` · `sleep_logs` (overlaps rejected by an exclusion constraint) · `habits`,
`habit_logs` · `affirmations` (one featured) · `daily_reviews` (one per productivity day).

- RLS on every table: `user_id = auth.uid()`.
- Composite `(id, user_id)` foreign keys, so a row can never reference another user's record.
- Multi-row operations are transactional RPCs (`security invoker`, so RLS applies):
  `reschedule_occurrence`, `start_activity`, `log_goal_progress`, `feature_affirmation`.
- A trigger creates the profile and default categories when the owner account is created.
- No analytics snapshots are stored; everything is aggregated server-side from records.

## Project structure

```
app/setup                shown when the owner env vars are missing or wrong
app/(app)/…              dashboard, planner, activities, habits, goals, performance,
                         affirmations, reviews, settings (+ loading / error boundaries)
proxy.ts                 signs in as the owner and refreshes the session (Next 16 "proxy")
components/<feature>/    UI by feature; components/ui = shadcn primitives
lib/date, lib/calculations   pure, unit-tested business logic
lib/data                 server-only loaders (per-request context, queries, analytics)
lib/actions              server actions (Zod-validated, auth-checked)
lib/validations          shared Zod schemas
supabase/                migration, reset-data.sql, database tests
```

## Known limitations

- An activity is attributed to the productivity day it **started** on. A session from 05:00 to 07:00
  with a 06:00 boundary counts entirely toward the earlier day.
- Changing the day-start time or timezone affects new entries only; existing records keep their day.
- Analytics for past days use each habit's *current* schedule to decide whether an unlogged day was
  scheduled. Logged days always use their snapshot.
- Pending tasks from past days are marked *missed* when the app next loads. They can still be completed late.
- Editing a recurring task's title applies to its whole series, including past occurrences (status
  history is preserved).
- Single owner, no login screen. Anyone who can reach the URL can use the app, so keep it on
  localhost/your network, or protect a public deployment (e.g. Vercel Deployment Protection).
- No sharing or offline mode.

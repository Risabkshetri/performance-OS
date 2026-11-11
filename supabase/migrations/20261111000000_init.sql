-- =====================================================================
-- Personal Performance OS: initial schema
--
-- Conventions
--   * Every user-owned table has user_id → auth.users, RLS restricted to
--     auth.uid().
--   * Child rows reference parents through composite (id, user_id) foreign
--     keys, so a row can never point at another user's record even if a
--     client forges an id.
--   * Timestamps are timestamptz (UTC). "Productivity dates" are plain
--     `date` columns computed by the application from the user's timezone
--     and day-start boundary at write time.
--   * History is preserved: definitions are archived, not deleted, and
--     habit logs snapshot the target they were judged against.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------- enums ----------------------------------------------------
create type pillar as enum ('health', 'finance', 'growth');
create type task_priority as enum ('high', 'medium', 'low');
create type occurrence_status as enum ('pending', 'in_progress', 'completed', 'missed', 'rescheduled');
create type occurrence_origin as enum ('single', 'recurrence', 'reschedule');
create type activity_kind as enum ('deep', 'external', 'personal', 'other');
create type habit_kind as enum ('good', 'bad');
create type habit_tracking as enum ('binary', 'numeric');
create type target_direction as enum ('min', 'max');
create type goal_horizon as enum ('daily', 'monthly', 'six_month', 'yearly');
create type goal_status as enum ('active', 'completed', 'paused', 'abandoned');

-- ---------- helpers --------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles -------------------------------------------------
create table profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text check (char_length(display_name) <= 80),
  timezone               text,                       -- IANA name; null until detected in browser
  day_start_minutes      smallint not null default 360
                           check (day_start_minutes between 0 and 1439),
  week_starts_on         smallint not null default 1 check (week_starts_on in (0, 1)),
  theme                  text not null default 'light' check (theme in ('light', 'dark', 'system')),
  default_task_priority  task_priority not null default 'medium',
  score_weights          jsonb not null default
                           '{"tasks":50,"goodHabits":25,"badHabits":15,"review":10}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------- goals ----------------------------------------------------
create table goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 200),
  description      text,
  pillar           pillar not null,
  horizon          goal_horizon not null,
  start_date       date not null default current_date,
  deadline         date,
  target_value     numeric check (target_value is null or target_value > 0),
  current_value    numeric,
  unit             text check (char_length(unit) <= 24),
  manual_progress  smallint not null default 0 check (manual_progress between 0 and 100),
  status           goal_status not null default 'active',
  notes            text,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  check (deadline is null or deadline >= start_date)
);
create index goals_user_idx on goals (user_id, archived_at, horizon);

create table goal_milestones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  goal_id       uuid not null,
  title         text not null check (char_length(title) between 1 and 200),
  due_date      date,
  completed_at  timestamptz,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade
);
create index goal_milestones_goal_idx on goal_milestones (goal_id, sort_order);
create index goal_milestones_user_idx on goal_milestones (user_id);

create table goal_progress_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  goal_id     uuid not null,
  value       numeric,
  progress    smallint check (progress between 0 and 100),
  note        text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  foreign key (goal_id, user_id) references goals (id, user_id) on delete cascade
);
create index goal_progress_logs_goal_idx on goal_progress_logs (goal_id, logged_at desc);
create index goal_progress_logs_user_idx on goal_progress_logs (user_id);

-- ---------- tasks ----------------------------------------------------
-- A task is the definition (what to do). A task_occurrence is a dated,
-- individually trackable instance. One-off tasks have exactly one
-- occurrence; recurring tasks have occurrences materialised lazily.
create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 200),
  description        text,
  pillar             pillar not null,
  priority           task_priority not null default 'medium',
  goal_id            uuid,
  estimated_minutes  integer check (estimated_minutes between 1 and 1440),
  planned_start      time,
  planned_end        time,
  -- {"type":"daily"} | {"type":"weekly","weekdays":[1,3,5]} | {"type":"interval","every":3}
  recurrence         jsonb,
  recurrence_start   date,
  recurrence_end     date,
  materialized_until date,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references goals (id, user_id) on delete set null (goal_id),
  check (recurrence is null or recurrence_start is not null),
  check (recurrence_end is null or recurrence_end >= recurrence_start)
);
create index tasks_user_idx on tasks (user_id) where archived_at is null;
create index tasks_recurring_idx on tasks (user_id, materialized_until) where recurrence is not null;
create index tasks_goal_idx on tasks (goal_id);

create table task_occurrences (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  task_id           uuid not null,
  scheduled_date    date not null,
  planned_start     time,
  planned_end       time,
  status            occurrence_status not null default 'pending',
  origin            occurrence_origin not null default 'single',
  rescheduled_from  uuid references task_occurrences (id) on delete set null,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  foreign key (task_id, user_id) references tasks (id, user_id) on delete cascade,
  check ((status = 'completed') = (completed_at is not null))
);
create index task_occurrences_day_idx on task_occurrences (user_id, scheduled_date);
create index task_occurrences_task_idx on task_occurrences (task_id);
-- recurrence materialisation must be idempotent
create unique index task_occurrences_recurrence_uniq
  on task_occurrences (task_id, scheduled_date) where origin = 'recurrence';

-- ---------- activities -----------------------------------------------
create table activity_categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  kind         activity_kind not null,
  is_default   boolean not null default false,
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);
create unique index activity_categories_name_uniq
  on activity_categories (user_id, lower(name)) where archived_at is null;

create table activities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  category_id         uuid not null,
  title               text not null check (char_length(title) between 1 and 200),
  pillar              pillar,
  task_occurrence_id  uuid,
  started_at          timestamptz not null,
  ended_at            timestamptz,               -- null = timer running
  productivity_date   date not null,             -- attributed by start time
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (category_id, user_id) references activity_categories (id, user_id),
  foreign key (task_occurrence_id, user_id)
    references task_occurrences (id, user_id) on delete set null (task_occurrence_id),
  check (ended_at is null or ended_at > started_at),
  check (ended_at is null or ended_at - started_at <= interval '48 hours')
);
create index activities_day_idx on activities (user_id, productivity_date);
create index activities_started_idx on activities (user_id, started_at desc);
create index activities_occurrence_idx on activities (task_occurrence_id);
-- at most one running timer per user
create unique index activities_one_running on activities (user_id) where ended_at is null;

-- ---------- sleep ----------------------------------------------------
create table sleep_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  slept_at    timestamptz not null,
  woke_at     timestamptz not null,
  wake_date   date not null,          -- local calendar date of waking
  quality     smallint check (quality between 1 and 5),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (woke_at > slept_at),
  check (woke_at - slept_at <= interval '24 hours'),
  -- sleep intervals for a user can never overlap → no double counting
  exclude using gist (user_id with =, tstzrange(slept_at, woke_at) with &&)
);
create index sleep_logs_user_idx on sleep_logs (user_id, woke_at desc);

-- ---------- habits ---------------------------------------------------
create table habits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 100),
  description       text,
  kind              habit_kind not null,
  pillar            pillar not null,
  tracking          habit_tracking not null default 'binary',
  unit              text check (char_length(unit) <= 24),
  target_value      numeric check (target_value is null or target_value >= 0),
  target_direction  target_direction,
  -- {"type":"daily"} | {"type":"weekly","weekdays":[1,2,3,4,5]}
  frequency         jsonb not null default '{"type":"daily"}'::jsonb,
  start_date        date not null default current_date,
  active            boolean not null default true,
  archived_at       timestamptz,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  check (tracking = 'binary' or (target_value is not null and target_direction is not null))
);
create index habits_user_idx on habits (user_id) where archived_at is null;

-- Each log snapshots the definition it was judged against, so editing a
-- habit never rewrites history.
create table habit_logs (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users (id) on delete cascade,
  habit_id                   uuid not null,
  log_date                   date not null,          -- productivity date
  value                      numeric,
  met                        boolean not null,
  kind_snapshot              habit_kind not null,
  tracking_snapshot          habit_tracking not null,
  target_value_snapshot      numeric,
  target_direction_snapshot  target_direction,
  note                       text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (habit_id, log_date),
  foreign key (habit_id, user_id) references habits (id, user_id) on delete cascade
);
create index habit_logs_user_date_idx on habit_logs (user_id, log_date);

-- ---------- affirmations ---------------------------------------------
create table affirmations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 500),
  pillar       pillar not null,
  horizon      goal_horizon,
  goal_id      uuid,
  is_featured  boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (goal_id, user_id) references goals (id, user_id) on delete set null (goal_id)
);
create index affirmations_user_idx on affirmations (user_id) where archived_at is null;
create unique index affirmations_one_featured on affirmations (user_id) where is_featured;

-- ---------- daily reviews --------------------------------------------
create table daily_reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  review_date      date not null,           -- productivity date
  accomplishments  text check (char_length(accomplishments) <= 4000),
  incomplete       text check (char_length(incomplete) <= 4000),
  learnings        text check (char_length(learnings) <= 4000),
  improvements     text check (char_length(improvements) <= 4000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, review_date)
);

-- ---------- updated_at triggers --------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','goals','goal_milestones','tasks','task_occurrences',
    'activity_categories','activities','sleep_logs','habits','habit_logs',
    'affirmations','daily_reviews'
  ] loop
    execute format(
      'create trigger %I_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- row level security ---------------------------------------
alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array[
    'goals','goal_milestones','goal_progress_logs','tasks','task_occurrences',
    'activity_categories','activities','sleep_logs','habits','habit_logs',
    'affirmations','daily_reviews'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------- new-user bootstrap ---------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(split_part(coalesce(new.email, ''), '@', 1), ''));

  insert into public.activity_categories (user_id, name, kind, is_default, sort_order) values
    (new.id, 'Deep Work',     'deep',     true, 0),
    (new.id, 'External Work', 'external', true, 1),
    (new.id, 'Personal',      'personal', true, 2);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- transactional operations (security invoker → RLS applies) --

-- Reschedule: mark the original occurrence as rescheduled and create a new
-- pending occurrence on the target date, atomically.
create or replace function reschedule_occurrence(
  p_occurrence_id uuid,
  p_new_date date,
  p_planned_start time default null,
  p_planned_end time default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_old task_occurrences;
  v_new_id uuid;
begin
  select * into v_old from task_occurrences
   where id = p_occurrence_id and user_id = auth.uid()
   for update;
  if not found then
    raise exception 'Occurrence not found';
  end if;
  if v_old.status in ('completed', 'rescheduled') then
    raise exception 'Cannot reschedule a % task', v_old.status;
  end if;
  if p_new_date = v_old.scheduled_date then
    raise exception 'Choose a different date';
  end if;

  update task_occurrences set status = 'rescheduled' where id = v_old.id;

  insert into task_occurrences
    (user_id, task_id, scheduled_date, planned_start, planned_end, origin, rescheduled_from)
  values
    (v_old.user_id, v_old.task_id, p_new_date,
     coalesce(p_planned_start, v_old.planned_start),
     coalesce(p_planned_end, v_old.planned_end),
     'reschedule', v_old.id)
  returning id into v_new_id;

  return v_new_id;
end $$;

-- Start a timer: stop whatever is running, then start a new activity.
create or replace function start_activity(
  p_category_id uuid,
  p_title text,
  p_pillar pillar,
  p_task_occurrence_id uuid,
  p_started_at timestamptz,
  p_productivity_date date
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  update activities
     set ended_at = greatest(p_started_at, started_at + interval '1 second')
   where user_id = auth.uid() and ended_at is null;

  insert into activities
    (user_id, category_id, title, pillar, task_occurrence_id, started_at, productivity_date)
  values
    (auth.uid(), p_category_id, p_title, p_pillar, p_task_occurrence_id, p_started_at, p_productivity_date)
  returning id into v_id;

  return v_id;
end $$;

-- Record goal progress and update the goal's current value atomically.
create or replace function log_goal_progress(
  p_goal_id uuid,
  p_value numeric,
  p_progress smallint,
  p_note text
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update goals
     set current_value   = coalesce(p_value, current_value),
         manual_progress = coalesce(p_progress, manual_progress)
   where id = p_goal_id and user_id = auth.uid();
  if not found then
    raise exception 'Goal not found';
  end if;

  insert into goal_progress_logs (user_id, goal_id, value, progress, note)
  values (auth.uid(), p_goal_id, p_value, p_progress, p_note);
end $$;

-- Feature a single affirmation (unset the previous one in the same txn).
create or replace function feature_affirmation(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update affirmations set is_featured = false
   where user_id = auth.uid() and is_featured and id <> p_id;
  update affirmations set is_featured = true
   where id = p_id and user_id = auth.uid() and archived_at is null;
  if not found then
    raise exception 'Affirmation not found';
  end if;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;
grant execute on function reschedule_occurrence(uuid, date, time, time) to authenticated;
grant execute on function start_activity(uuid, text, pillar, uuid, timestamptz, date) to authenticated;
grant execute on function log_goal_progress(uuid, numeric, smallint, text) to authenticated;
grant execute on function feature_affirmation(uuid) to authenticated;
revoke execute on function reschedule_occurrence(uuid, date, time, time) from anon;
revoke execute on function start_activity(uuid, text, pillar, uuid, timestamptz, date) from anon;
revoke execute on function log_goal_progress(uuid, numeric, smallint, text) from anon;
revoke execute on function feature_affirmation(uuid) from anon;

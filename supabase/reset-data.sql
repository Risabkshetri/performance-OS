-- =====================================================================
-- RESET DATA: permanently deletes every record in the app.
--
-- Deletes: tasks, activities, sleep logs, habits and check-ins, goals,
-- milestones, affirmations, daily reviews and custom activity categories.
-- Also removes the old demo functions if they were installed.
--
-- Keeps:   your account, your settings (timezone, day start, score weights,
--          theme) and the three default activity categories.
--
-- This cannot be undone. Run it once in the Supabase SQL editor.
-- =====================================================================

begin;

delete from activities;
delete from sleep_logs;
delete from task_occurrences;
delete from tasks;
delete from habit_logs;
delete from habits;
delete from goal_progress_logs;
delete from goal_milestones;
delete from affirmations;
delete from goals;
delete from daily_reviews;
delete from activity_categories where not is_default;
update activity_categories set archived_at = null where is_default;

drop function if exists demo_seed(text);
drop function if exists demo_clear(text);

commit;

-- Check: every count below should be 0, except activity_categories (3).
select 'tasks' as table_name, count(*) from tasks
union all select 'task_occurrences', count(*) from task_occurrences
union all select 'activities', count(*) from activities
union all select 'sleep_logs', count(*) from sleep_logs
union all select 'habits', count(*) from habits
union all select 'habit_logs', count(*) from habit_logs
union all select 'goals', count(*) from goals
union all select 'affirmations', count(*) from affirmations
union all select 'daily_reviews', count(*) from daily_reviews
union all select 'activity_categories', count(*) from activity_categories;

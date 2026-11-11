import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/layout-bits";
import { HabitList, type HabitStats } from "@/components/habits/habit-list";
import { getContext } from "@/lib/data/context";
import { getHabitLogs, getHabits } from "@/lib/data/queries";
import { addDays, dateRange } from "@/lib/date/productivity-day";
import { consistency, currentStreak, isScheduledOn, longestStreak } from "@/lib/calculations/habits";
import type { HabitLog } from "@/types/domain";

export const metadata: Metadata = { title: "Habits" };

const HISTORY_DAYS = 365;

export default async function HabitsPage() {
  const ctx = await getContext();
  const { today } = ctx;
  const from = addDays(today, -HISTORY_DAYS);
  const [habits, logs] = await Promise.all([getHabits(ctx, true), getHabitLogs(ctx, from, today)]);

  const byHabit = new Map<string, Map<string, HabitLog>>();
  for (const l of logs) {
    if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Map());
    byHabit.get(l.habit_id)!.set(l.log_date, l);
  }

  const stripDates = dateRange(addDays(today, -13), today);
  const items: HabitStats[] = habits
    .filter((h) => !h.archived_at)
    .map((habit) => {
      const map = byHabit.get(habit.id) ?? new Map<string, HabitLog>();
      return {
        habit,
        todayScheduled: isScheduledOn(habit, today),
        strip: stripDates.map((date) => ({ date, scheduled: isScheduledOn(habit, date), log: map.get(date) })),
        streak: currentStreak(habit, map, today),
        longest: longestStreak(habit, map, habit.start_date > from ? habit.start_date : from, today),
        week: consistency(habit, map, addDays(today, -6), today, today).rate,
        month: consistency(habit, map, addDays(today, -29), today, today).rate,
      };
    });

  return (
    <>
      <PageHeader
        title="Habits"
        
      />
      <HabitList items={items} archived={habits.filter((h) => h.archived_at)} today={today} />
    </>
  );
}

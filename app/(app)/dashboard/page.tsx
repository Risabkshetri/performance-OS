import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Brain, CalendarCheck, Gauge, Moon, Quote, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, Stat } from "@/components/shared/layout-bits";
import { PILLAR_META, ProgressBar, Trend } from "@/components/shared/indicators";
import { QuickAddTask } from "@/components/planner/quick-add-task";
import { TaskList } from "@/components/planner/task-list";
import { ActivityTimer } from "@/components/activities/activity-timer";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { HabitCheckIn } from "@/components/habits/habit-checkin";
import { ReviewDialogButton } from "@/components/dashboard/review-dialog";
import { ScoreBreakdown } from "@/components/analytics/score-breakdown";
import { getContext } from "@/lib/data/context";
import { getPlannedTasks, syncTasks } from "@/lib/data/tasks";
import {
  getActivities,
  getCategories,
  getDailyAffirmation,
  getGoalOptions,
  getReview,
  getRunningActivity,
  getSleepLogs,
} from "@/lib/data/queries";
import { getDailyStats } from "@/lib/data/analytics";
import { pillarPercent, PILLARS } from "@/lib/calculations/daily-series";
import { isScheduledOn, describeTarget } from "@/lib/calculations/habits";
import { average } from "@/lib/calculations/score";
import { addDays, localDateOf } from "@/lib/date/productivity-day";
import { formatDuration, formatLongDate, greeting, PILLAR_LABEL } from "@/lib/format";
import type { Pillar } from "@/types/domain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const ctx = await getContext();
  const { today, tz, dayStart } = ctx;
  await syncTasks(ctx);

  const [tasks, recentMissed, goals, categories, activities, running, sleep, affirmation, review, stats] = await Promise.all([
    getPlannedTasks(ctx, today, today),
    getPlannedTasks(ctx, addDays(today, -7), addDays(today, -1)),
    getGoalOptions(ctx),
    getCategories(ctx),
    getActivities(ctx, today, today),
    getRunningActivity(ctx),
    getSleepLogs(ctx, 1),
    getDailyAffirmation(ctx),
    getReview(ctx, today),
    getDailyStats(ctx, addDays(today, -14), today),
  ]);

  const todayStat = stats.days[stats.days.length - 1];
  // Comparisons use completed days only; today is still in progress.
  const last7 = stats.days.slice(-8, -1);
  const prev7 = stats.days.slice(-15, -8);
  const avgPrev = average(last7.map((d) => d.score));

  const missed = recentMissed.filter((t) => t.status === "missed");
  const habitsToday = stats.habits.filter((h) => !h.archived_at && h.active && isScheduledOn(h, today));
  const logsToday = new Map(stats.logs.filter((l) => l.log_date === today).map((l) => [l.habit_id, l]));
  const habitsOnTarget = habitsToday.filter((h) => logsToday.get(h.id)?.met).length;
  const lastSleep = sleep[0];
  const taskOptions = tasks
    .filter((t) => t.status !== "rescheduled")
    .map((t) => ({ id: t.id, title: t.task.title, pillar: t.task.pillar }));

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  const calendarToday = localDateOf(now, tz);
  const name = ctx.profile.display_name || ctx.email?.split("@")[0] || "";

  const done = tasks.filter((t) => t.status === "completed").length;
  const open = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const common = { goals, today, defaultPriority: ctx.profile.default_task_priority };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {formatLongDate(today)}
            {calendarToday !== today ? <span className="text-primary"> · still counts as today</span> : null}
          </p>
          <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">
            {greeting(hour)}
            {name ? `, ${name}` : ""}
          </h1>
          {affirmation ? (
            <p className="mt-2 flex max-w-2xl items-start gap-2 text-sm text-muted-foreground">
              <Quote className={cn("mt-0.5 size-3.5 shrink-0", PILLAR_META[affirmation.pillar].text)} aria-hidden />
              <span className="italic">{affirmation.text}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ReviewDialogButton date={today} review={review} />
          <QuickAddTask {...common} />
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Gauge}
          label="Score"
          value={todayStat.score ?? "-"}
          hint={todayStat.score == null ? "Nothing scheduled" : <Trend delta={avgPrev == null ? null : todayStat.score - avgPrev} suffix=" vs 7d" />}
        />
        <Stat icon={Brain} label="Deep work" value={formatDuration(todayStat.minutes.deep)} />
        <Stat icon={Briefcase} label="External work" value={formatDuration(todayStat.minutes.external)} />
        <Stat
          icon={Moon}
          label="Sleep"
          value={lastSleep ? formatDuration((Date.parse(lastSleep.woke_at) - Date.parse(lastSleep.slept_at)) / 60000) : "-"}
          hint={lastSleep ? undefined : <Link href="/activities" className="text-primary hover:underline">Log sleep</Link>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tasks */}
        <Panel
          className="lg:col-span-2"
          title="Today"
          description={tasks.length ? `${done} done · ${open} open` : undefined}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/planner">
                Planner <ArrowRight />
              </Link>
            </Button>
          }
        >
          <TaskList
            tasks={tasks}
            {...common}
            empty={<EmptyState compact icon={CalendarCheck} title="Nothing planned" action={<QuickAddTask {...common} variant="outline" />} />}
          />
          {missed.length ? (
            <details className="mt-3 border-t pt-3">
              <summary className="cursor-pointer text-xs font-medium text-destructive">{missed.length} missed this week</summary>
              <div className="mt-1">
                <TaskList tasks={missed} {...common} showDate dense />
              </div>
            </details>
          ) : null}
        </Panel>

        {/* Score + pillars */}
        <Panel title="Score breakdown">
          <ScoreBreakdown score={todayStat.score} components={todayStat.components} />
          <ul className="mt-5 space-y-3 border-t pt-4">
            {PILLARS.map((p: Pillar) => {
              const cur = pillarPercent(last7, p);
              const prev = pillarPercent(prev7, p);
              const Icon = PILLAR_META[p].icon;
              return (
                <li key={p}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={cn("inline-flex items-center gap-1.5 font-medium", PILLAR_META[p].text)}>
                      <Icon className="size-3.5" aria-hidden />
                      {PILLAR_LABEL[p]}
                    </span>
                    <span className="flex items-center gap-2">
                      {cur != null && prev != null ? <Trend delta={cur - prev} /> : null}
                      <span className="w-9 text-right font-medium tabular">{cur == null ? "-" : `${cur}%`}</span>
                    </span>
                  </div>
                  <ProgressBar value={cur} pillar={p} label={`${PILLAR_LABEL[p]}, last 7 days`} />
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-subtle-foreground">Pillars: last 7 completed days</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity */}
        <Panel
          className="lg:col-span-2"
          title="Activity"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/activities">
                Log <ArrowRight />
              </Link>
            </Button>
          }
        >
          <div className="mb-4 rounded-lg bg-muted/60 p-3">
            <ActivityTimer running={running} categories={categories} tasks={taskOptions} tz={tz} />
          </div>
          <ActivityTimeline
            activities={activities}
            categories={categories}
            tasks={taskOptions}
            tz={tz}
            dayStart={dayStart}
            date={today}
            emptyText="No activity yet today."
          />
        </Panel>

        {/* Habits */}
        <Panel
          title="Habits"
          description={habitsToday.length ? `${habitsOnTarget}/${habitsToday.length} on target` : undefined}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/habits">
                All <ArrowRight />
              </Link>
            </Button>
          }
        >
          {habitsToday.length ? (
            <ul className="space-y-3">
              {habitsToday.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{h.name}</p>
                    <p className={cn("text-xs", h.kind === "good" ? "text-subtle-foreground" : "text-warning")}>{describeTarget(h)}</p>
                  </div>
                  <HabitCheckIn habit={h} log={logsToday.get(h.id)} date={today} size="sm" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Repeat} title="No habits today" />
          )}
        </Panel>
      </div>
    </div>
  );
}

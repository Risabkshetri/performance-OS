import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/shared/layout-bits";
import { PILLAR_META, PillarBadge, ProgressBar, Trend } from "@/components/shared/indicators";
import { ScoreBreakdown } from "@/components/analytics/score-breakdown";
import { ProgressChart, TimeChart } from "@/components/analytics/charts";
import { getContext } from "@/lib/data/context";
import { getDailyStats, getFirstRecordDate } from "@/lib/data/analytics";
import { getGoals } from "@/lib/data/queries";
import { getActualMinutesByOccurrence, getPlannedTasks, syncTasks } from "@/lib/data/tasks";
import { pillarPercent, PILLARS, type DayStat } from "@/lib/calculations/daily-series";
import { average } from "@/lib/calculations/score";
import { consistency, currentStreak } from "@/lib/calculations/habits";
import { buildProgressSeries } from "@/lib/calculations/progress-series";
import { goalHealth, goalProgress } from "@/lib/calculations/goals";
import { addDays } from "@/lib/date/productivity-day";
import { formatDuration, formatShortDate, HORIZON_LABEL, PILLAR_LABEL } from "@/lib/format";
import { CalendarRange, ChartLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HabitLog } from "@/types/domain";

export const metadata: Metadata = { title: "Performance" };

const RANGES = [
  { key: "7", label: "7D", days: 7 },
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "365", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
] as const;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
const sum = (days: DayStat[], f: (d: DayStat) => number) => days.reduce((s, d) => s + f(d), 0);
const fmtPct = (v: number | null) => (v == null ? "-" : `${v}%`);

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const { today } = ctx;
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  await syncTasks(ctx);

  // "All" starts at the first record; the chart's bucket size scales with the span.
  const first = range.days == null ? await getFirstRecordDate(ctx) : null;
  // N completed days + today (shown on the chart); the previous period is the N days before.
  const from = range.days != null ? addDays(today, -range.days) : (first ?? addDays(today, -30));
  const prevFrom = range.days != null ? addDays(from, -range.days) : from;

  const [bundle, goals, occurrences] = await Promise.all([
    getDailyStats(ctx, prevFrom, today),
    getGoals(ctx),
    getPlannedTasks(ctx, from, today),
  ]);
  const days = bundle.days.filter((d) => d.date >= from);
  const prevDays = range.days != null ? bundle.days.filter((d) => d.date < from) : [];
  const scored = days.filter((d) => d.score != null);
  const hasAnyData =
    scored.length > 0 || sum(days, (d) => d.minutes.deep + d.minutes.external + d.minutes.personal + d.minutes.other) > 0;

  const { granularity, points } = buildProgressSeries(days, ctx.profile.week_starts_on);
  const todayStat = days[days.length - 1];

  // Rates and averages use completed days only (today is still in progress), so the
  // comparison with the previous period is like-for-like. Counts include today.
  const closed = days.filter((d) => d.date < today);
  const avgScore = average(closed.map((d) => d.score));
  const prevAvg = average(prevDays.map((d) => d.score));
  const taskRate = pct(sum(closed, (d) => d.tasks.completed), sum(closed, (d) => d.tasks.total));
  const t = {
    total: sum(days, (d) => d.tasks.total),
    completed: sum(days, (d) => d.tasks.completed),
    missed: sum(days, (d) => d.tasks.missed),
    rescheduled: sum(days, (d) => d.tasks.rescheduled),
  };
  const prevTask = pct(sum(prevDays, (d) => d.tasks.completed), sum(prevDays, (d) => d.tasks.total));
  const good = pct(sum(closed, (d) => d.goodHabits.met), sum(closed, (d) => d.goodHabits.scheduled));
  const prevGood = pct(sum(prevDays, (d) => d.goodHabits.met), sum(prevDays, (d) => d.goodHabits.scheduled));
  const deepPerDay = closed.length ? sum(closed, (d) => d.minutes.deep) / closed.length : 0;
  const prevDeep = prevDays.length ? sum(prevDays, (d) => d.minutes.deep) / prevDays.length : null;
  const delta = (a: number | null, b: number | null) => (a != null && b != null ? a - b : null);

  const estimated = occurrences.filter((o) => o.status === "completed" && o.task.estimated_minutes);
  const actualMap = await getActualMinutesByOccurrence(ctx, estimated.map((o) => o.id));
  const withActual = estimated.filter((o) => actualMap.has(o.id));
  const plannedMin = withActual.reduce((s, o) => s + (o.task.estimated_minutes ?? 0), 0);
  const actualMin = withActual.reduce((s, o) => s + (actualMap.get(o.id) ?? 0), 0);

  const logsByHabit = new Map<string, Map<string, HabitLog>>();
  for (const l of bundle.logs) {
    if (!logsByHabit.has(l.habit_id)) logsByHabit.set(l.habit_id, new Map());
    logsByHabit.get(l.habit_id)!.set(l.log_date, l);
  }
  const habitRows = bundle.habits
    .filter((h) => !h.archived_at)
    .map((h) => {
      const m = logsByHabit.get(h.id) ?? new Map();
      return { habit: h, rate: consistency(h, m, from, today, today).rate, streak: currentStreak(h, m, today) };
    });

  const goalRows = goals
    .filter((g) => g.status !== "abandoned")
    .map((g) => {
      const p = goalProgress(g, g.milestones);
      return { goal: g, progress: p.percent, health: goalHealth(g, p.percent, today).health };
    });

  const vs = range.days != null ? ` vs prev ${range.label}` : "";

  return (
    <>
      <PageHeader
        title="Performance"
        actions={
          <nav aria-label="Range" className="inline-flex rounded-lg bg-muted p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={r.key === "30" ? "/performance" : `/performance?range=${r.key}`}
                aria-current={r.key === range.key ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors touch:py-1.5",
                  r.key === range.key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        }
      />

      {!hasAnyData ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={ChartLine} title="No data yet" description="Plan tasks, check in on habits or log time to see your trends." />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Avg score" value={avgScore == null ? "-" : Math.round(avgScore)} hint={<Trend delta={delta(avgScore, prevAvg)} suffix={vs} />} />
            <Stat label="Tasks done" value={fmtPct(taskRate)} hint={<Trend delta={delta(taskRate, prevTask)} suffix={vs} />} />
            <Stat label="Habits kept" value={fmtPct(good)} hint={<Trend delta={delta(good, prevGood)} suffix={vs} />} />
            <Stat
              label="Deep work / day"
              value={formatDuration(deepPerDay)}
              hint={prevDeep != null ? <Trend delta={Math.round(deepPerDay - prevDeep)} suffix={`m${vs}`} /> : undefined}
            />
          </div>

          <Panel title="Progress">
            <ProgressChart points={points} granularity={granularity} />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2" title="Where your time goes">
              <TimeChart points={points} granularity={granularity} />
            </Panel>
            <Panel title="Today">
              <ScoreBreakdown score={todayStat.score} components={todayStat.components} />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Pillars">
              <ul className="space-y-4">
                {PILLARS.map((p) => {
                  const cur = pillarPercent(closed, p);
                  const prev = pillarPercent(prevDays, p);
                  const Icon = PILLAR_META[p].icon;
                  return (
                    <li key={p}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className={cn("inline-flex items-center gap-1.5 font-medium", PILLAR_META[p].text)}>
                          <Icon className="size-3.5" aria-hidden /> {PILLAR_LABEL[p]}
                        </span>
                        <span className="flex items-center gap-2">
                          <Trend delta={delta(cur, prev)} />
                          <span className="w-9 text-right font-medium tabular">{fmtPct(cur)}</span>
                        </span>
                      </div>
                      <ProgressBar value={cur} pillar={p} label={`${PILLAR_LABEL[p]} performance`} />
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel title="Tasks">
              <dl className="grid grid-cols-3 gap-3">
                <Metric label="Done" value={t.completed} tone="text-success" />
                <Metric label="Missed" value={t.missed} tone="text-destructive" />
                <Metric label="Moved" value={t.rescheduled} tone="text-warning" />
              </dl>
              {withActual.length ? (
                <div className="mt-5 border-t pt-4">
                  <p className="text-xs text-muted-foreground">Actual vs estimate</p>
                  <p className="mt-1 font-display text-2xl font-medium tabular">
                    {plannedMin ? `${Math.round((actualMin / plannedMin) * 100)}%` : "-"}
                  </p>
                  <p className="text-xs text-subtle-foreground tabular">
                    {formatDuration(actualMin)} / {formatDuration(plannedMin)} · {withActual.length} tasks
                  </p>
                </div>
              ) : null}
            </Panel>

            <Panel title="Habits">
              {habitRows.length ? (
                <ul className="space-y-3">
                  {habitRows.map((r) => (
                    <li key={r.habit.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">{r.habit.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {r.rate == null ? "-" : `${Math.round(r.rate * 100)}%`}
                          {r.streak ? ` · ${r.streak}d` : ""}
                        </span>
                      </div>
                      <ProgressBar
                        value={r.rate == null ? null : r.rate * 100}
                        tone={r.habit.kind === "good" ? "success" : "warning"}
                        label={`${r.habit.name} consistency`}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No active habits.</p>
              )}
            </Panel>
          </div>

          {goalRows.length ? (
            <Panel title="Goals" bodyClassName="py-2">
              <ul className="divide-y">
                {goalRows.map((r) => (
                  <li key={r.goal.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[1fr_200px_auto]">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.goal.title}</p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <PillarBadge pillar={r.goal.pillar} /> {HORIZON_LABEL[r.goal.horizon]}
                        {r.goal.deadline ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange className="size-3" aria-hidden /> {formatShortDate(r.goal.deadline)}
                          </span>
                        ) : null}
                        {r.health === "behind" || r.health === "overdue" ? (
                          <span className={r.health === "overdue" ? "text-destructive" : "text-warning"}>
                            {r.health === "overdue" ? "Overdue" : "Behind"}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <ProgressBar value={r.progress} pillar={r.goal.pillar} className="col-span-2 sm:col-span-1" label={`${r.goal.title} progress`} />
                    <span className="row-start-1 text-right text-sm font-medium tabular sm:row-start-auto">{r.progress}%</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-semibold tabular", tone)}>{value}</dd>
      {hint ? <dd className="text-xs text-subtle-foreground">{hint}</dd> : null}
    </div>
  );
}

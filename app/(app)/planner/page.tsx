import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/shared/layout-bits";
import { PILLAR_META } from "@/components/shared/indicators";
import { TaskList } from "@/components/planner/task-list";
import { QuickAddTask } from "@/components/planner/quick-add-task";
import { getContext } from "@/lib/data/context";
import { getActualMinutesByOccurrence, getPlannedTasks, syncTasks } from "@/lib/data/tasks";
import { getGoalOptions } from "@/lib/data/queries";
import { addDays, dateRange, startOfWeek } from "@/lib/date/productivity-day";
import { formatLongDate, formatMonthDay, formatWeekdayShort, PILLAR_LABEL, relativeDayLabel } from "@/lib/format";
import type { Pillar, PlannedTask, Priority } from "@/types/domain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Daily Planner" };

type Search = { date?: string; view?: string; pillar?: string; priority?: string };

const PILLARS: Pillar[] = ["health", "finance", "growth"];
const PRIORITIES: Priority[] = ["high", "medium", "low"];

export default async function PlannerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const { today } = ctx;

  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const view = sp.view === "week" ? "week" : "day";
  const pillar = PILLARS.includes(sp.pillar as Pillar) ? (sp.pillar as Pillar) : null;
  const priority = PRIORITIES.includes(sp.priority as Priority) ? (sp.priority as Priority) : null;

  const from = view === "week" ? startOfWeek(date, ctx.profile.week_starts_on) : date;
  const to = view === "week" ? addDays(from, 6) : date;

  await syncTasks(ctx, to);
  const [allTasks, goals] = await Promise.all([getPlannedTasks(ctx, from, to), getGoalOptions(ctx)]);
  const tasks = allTasks.filter((t) => (!pillar || t.task.pillar === pillar) && (!priority || t.task.priority === priority));
  const actual = Object.fromEntries(await getActualMinutesByOccurrence(ctx, tasks.map((t) => t.id)));

  const href = (patch: Partial<Search>) => {
    const next = { date, view, pillar: pillar ?? undefined, priority: priority ?? undefined, ...patch };
    const q = new URLSearchParams();
    if (next.date && next.date !== today) q.set("date", next.date);
    if (next.view === "week") q.set("view", "week");
    if (next.pillar) q.set("pillar", next.pillar);
    if (next.priority) q.set("priority", next.priority);
    const s = q.toString();
    return `/planner${s ? `?${s}` : ""}`;
  };
  const step = view === "week" ? 7 : 1;
  const common = { goals, today, defaultPriority: ctx.profile.default_task_priority, actualMinutes: actual };

  const title = view === "week" ? `${formatMonthDay(from)} – ${formatMonthDay(to)}` : relativeDayLabel(date, today, addDays);

  return (
    <>
      <PageHeader
        title="Daily Planner"
        description={view === "day" ? formatLongDate(date) : "Weekly overview"}
        actions={<QuickAddTask {...common} defaultDate={date >= today ? date : today} />}
      />

      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="icon-sm" aria-label={view === "week" ? "Previous week" : "Previous day"}>
            <Link href={href({ date: addDays(date, -step) })}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-24 text-center text-sm font-medium tabular sm:min-w-28">{title}</span>
          <Button asChild variant="outline" size="icon-sm" aria-label={view === "week" ? "Next week" : "Next day"}>
            <Link href={href({ date: addDays(date, step) })}>
              <ChevronRight />
            </Link>
          </Button>
          {date !== today ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={href({ date: today })}>Today</Link>
            </Button>
          ) : null}
          <div className="ml-auto inline-flex rounded-lg bg-muted p-0.5 sm:ml-2">
            {(["day", "week"] as const).map((v) => (
              <Link
                key={v}
                href={href({ view: v })}
                aria-current={view === v ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium touch:py-1.5",
                  view === v ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "day" ? "Day" : "Week"}
              </Link>
            ))}
          </div>
        </div>

        <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:flex-wrap sm:px-0">
          <FilterChip href={href({ pillar: undefined })} active={!pillar}>
            All pillars
          </FilterChip>
          {PILLARS.map((p) => (
            <FilterChip key={p} href={href({ pillar: p })} active={pillar === p}>
              <span className={cn("size-1.5 rounded-full", PILLAR_META[p].dot)} aria-hidden />
              {PILLAR_LABEL[p]}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
          <FilterChip href={href({ priority: undefined })} active={!priority}>
            Any priority
          </FilterChip>
          {PRIORITIES.map((p) => (
            <FilterChip key={p} href={href({ priority: p })} active={priority === p}>
              {p[0].toUpperCase() + p.slice(1)}
            </FilterChip>
          ))}
        </div>
      </div>

      {view === "day" ? (
        <DayView tasks={tasks} {...common} filtered={Boolean(pillar || priority)} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {dateRange(from, to).map((d) => {
            const dayTasks = tasks.filter((t) => t.scheduled_date === d);
            const done = dayTasks.filter((t) => t.status === "completed").length;
            return (
              <section
                key={d}
                className={cn("flex min-h-40 flex-col rounded-xl border bg-card p-3", d === today && "border-primary/50")}
              >
                <Link href={href({ view: "day", date: d })} className="mb-1 flex items-baseline justify-between hover:text-primary">
                  <span className="text-sm font-medium">
                    {formatWeekdayShort(d)} <span className="text-muted-foreground">{formatMonthDay(d)}</span>
                  </span>
                  {dayTasks.length ? (
                    <span className="text-xs text-muted-foreground tabular">
                      {done}/{dayTasks.length}
                    </span>
                  ) : null}
                </Link>
                <TaskList
                  tasks={dayTasks}
                  {...common}
                  dense
                  empty={<p className="py-3 text-xs text-subtle-foreground">Nothing planned</p>}
                />
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 transition-colors touch:py-1.5",
        active ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function DayView({
  tasks,
  filtered,
  ...common
}: {
  tasks: PlannedTask[];
  filtered: boolean;
  goals: Awaited<ReturnType<typeof getGoalOptions>>;
  today: string;
  defaultPriority: Priority;
  actualMinutes: Record<string, number>;
}) {
  const timed = tasks.filter((t) => t.planned_start);
  const anytime = tasks.filter((t) => !t.planned_start);
  const done = tasks.filter((t) => t.status === "completed").length;
  const counted = tasks.length;

  if (!tasks.length) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={filtered ? ListTodo : CalendarDays}
          title={filtered ? "No tasks match these filters" : "Nothing planned for this day"}
          description={filtered ? "Clear a filter to see more." : "Add a task to plan your day."}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section className="rounded-xl border bg-card px-4 py-4 sm:px-5 lg:col-span-3">
        <header className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Timeline</h2>
                  </header>
        <TaskList
          tasks={timed}
          {...common}
          empty={<p className="py-4 text-sm text-muted-foreground">No timed tasks.</p>}
        />
      </section>
      <section className="rounded-xl border bg-card px-4 py-4 sm:px-5 lg:col-span-2">
        <header className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Anytime</h2>
          <span className="text-xs text-muted-foreground tabular">
            {done} of {counted} done
          </span>
        </header>
        <TaskList tasks={anytime} {...common} empty={<p className="py-4 text-sm text-muted-foreground">Everything here has a time.</p>} />
      </section>
    </div>
  );
}

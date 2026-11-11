import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/shared/layout-bits";
import { ActivityTimer } from "@/components/activities/activity-timer";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { SleepLogPanel } from "@/components/activities/sleep-log";
import { CategoryManager } from "@/components/activities/category-manager";
import { getContext } from "@/lib/data/context";
import { getActivities, getCategories, getRunningActivity, getSleepLogs } from "@/lib/data/queries";
import { getPlannedTasks, syncTasks } from "@/lib/data/tasks";
import { addDays, localDateOf, minutesToTime } from "@/lib/date/productivity-day";
import { formatDuration, formatLongDate, relativeDayLabel } from "@/lib/format";
import type { ActivityKind } from "@/types/domain";

export const metadata: Metadata = { title: "Activity Log" };

const KIND_LABEL: Record<ActivityKind, string> = {
  deep: "Deep work",
  external: "External work",
  personal: "Personal",
  other: "Other",
};

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= ctx.today ? sp.date : ctx.today;

  await syncTasks(ctx);
  const [categories, allCategories, activities, running, sleep, tasks] = await Promise.all([
    getCategories(ctx),
    getCategories(ctx, true),
    getActivities(ctx, date, date),
    getRunningActivity(ctx),
    getSleepLogs(ctx, 10),
    getPlannedTasks(ctx, date, date),
  ]);
  const taskOptions = tasks
    .filter((t) => t.status !== "rescheduled")
    .map((t) => ({ id: t.id, title: t.task.title, pillar: t.task.pillar }));

  const kindOf = new Map(allCategories.map((c) => [c.id, c.kind]));
  const totals: Record<ActivityKind, number> = { deep: 0, external: 0, personal: 0, other: 0 };
  for (const a of activities) {
    if (!a.ended_at) continue;
    totals[kindOf.get(a.category_id) ?? "other"] += (Date.parse(a.ended_at) - Date.parse(a.started_at)) / 60000;
  }

  const link = (d: string) => (d === ctx.today ? "/activities" : `/activities?date=${d}`);

  return (
    <>
      <PageHeader
        title="Activity Log"
        
        actions={<CategoryManager categories={categories} />}
      />

      <Panel className="mb-6 border-primary/25" bodyClassName="py-5">
        <ActivityTimer running={running} categories={categories} tasks={taskOptions} tz={ctx.tz} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title={
            <span className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon-xs" className="touch:size-9" aria-label="Previous day">
                <Link href={link(addDays(date, -1))}>
                  <ChevronLeft />
                </Link>
              </Button>
              {relativeDayLabel(date, ctx.today, addDays)}
              {date < ctx.today ? (
                <Button asChild variant="ghost" size="icon-xs" className="touch:size-9" aria-label="Next day">
                  <Link href={link(addDays(date, 1))}>
                    <ChevronRight />
                  </Link>
                </Button>
              ) : null}
            </span>
          }
          description={`${formatLongDate(date)} · day runs ${minutesToTime(ctx.dayStart)} → ${minutesToTime(ctx.dayStart)}`}
        >
          <dl className="mb-4 grid grid-cols-2 gap-3 border-b pb-4 sm:grid-cols-4">
            {(Object.keys(KIND_LABEL) as ActivityKind[]).map((k) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{KIND_LABEL[k]}</dt>
                <dd className="text-base font-medium tabular">{formatDuration(totals[k])}</dd>
              </div>
            ))}
          </dl>
          <ActivityTimeline
            activities={activities}
            categories={categories}
            allCategories={allCategories}
            tasks={taskOptions}
            tz={ctx.tz}
            dayStart={ctx.dayStart}
            date={date}
            emptyText="Nothing logged for this day. Start a timer above or log a past activity."
          />
        </Panel>

        <Panel className="lg:col-span-2" title="Sleep">
          <SleepLogPanel logs={sleep} tz={ctx.tz} today={localDateOf(new Date(), ctx.tz)} />
        </Panel>
      </div>
    </>
  );
}

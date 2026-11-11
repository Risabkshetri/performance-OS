"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Flame, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/layout-bits";
import { PillarBadge } from "@/components/shared/indicators";
import { HabitCheckIn } from "./habit-checkin";
import { HabitFormDialog } from "./habit-form-dialog";
import { useAction } from "@/hooks/use-action";
import { setHabitActive, setHabitArchived } from "@/lib/actions/habits";
import { describeTarget } from "@/lib/calculations/habits";
import { formatLongDate, formatShortDate } from "@/lib/format";
import type { Habit, HabitLog } from "@/types/domain";
import { cn } from "@/lib/utils";

export interface HabitStats {
  habit: Habit;
  todayScheduled: boolean;
  /** last 14 days, oldest first */
  strip: { date: string; scheduled: boolean; log?: HabitLog }[];
  streak: number;
  longest: number;
  week: number | null;
  month: number | null;
}

export function HabitList({ items, archived, today }: { items: HabitStats[]; archived: Habit[]; today: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { run, pending } = useAction();

  const good = items.filter((i) => i.habit.kind === "good");
  const bad = items.filter((i) => i.habit.kind === "bad");

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus /> New habit
        </Button>
      </div>

      {!items.length ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Repeat}
            title="No habits yet"
            description="Build good habits, limit bad ones."
            action={<Button onClick={() => setCreating(true)}>Create your first habit</Button>}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { title: "Building", hint: "Good habits", list: good },
            { title: "Reducing", hint: "Limits on bad habits", list: bad },
          ]
            .filter((g) => g.list.length)
            .map((group) => (
              <section key={group.title} className="rounded-xl border bg-card">
                <header className="flex items-baseline justify-between border-b px-4 py-3 sm:px-5">
                  <h2 className="text-sm font-medium">{group.title}</h2>
                  <span className="text-xs text-muted-foreground">{group.hint}</span>
                </header>
                <ul className="divide-y">
                  {group.list.map((s) => (
                    <HabitRow key={s.habit.id} stats={s} today={today} onEdit={() => setEditing(s.habit)} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {archived.length ? (
        <div className="mt-6">
          <button
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowArchived((s) => !s)}
            aria-expanded={showArchived}
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived ? (
            <ul className="mt-2 divide-y rounded-xl border bg-card">
              {archived.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-2.5 sm:px-5 text-sm">
                  <span className="text-muted-foreground">{h.name}</span>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setHabitArchived(h.id, false))}>
                    <ArchiveRestore /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <HabitFormDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        editing={editing}
        today={today}
      />
    </>
  );
}

function pct(v: number | null) {
  return v == null ? "-" : `${Math.round(v * 100)}%`;
}

function HabitRow({ stats, today, onEdit }: { stats: HabitStats; today: string; onEdit: () => void }) {
  const { habit, strip } = stats;
  const { run, pending } = useAction();
  const todayLog = strip.find((d) => d.date === today)?.log;

  return (
    <li className={cn("grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center", !habit.active && "opacity-60")}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onEdit} className="truncate text-left text-sm font-medium hover:underline">
            {habit.name}
          </button>
          {!habit.active ? <span className="text-xs text-muted-foreground">Paused</span> : null}
        </div>
        {habit.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={habit.description}>
            {habit.description}
          </p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <PillarBadge pillar={habit.pillar} />
          <span>{describeTarget(habit)}</span>
          <span>
            {habit.frequency.type === "daily"
              ? "Daily"
              : habit.frequency.weekdays.length === 5 && !habit.frequency.weekdays.some((d) => d === 0 || d === 6)
                ? "Weekdays"
                : `${habit.frequency.weekdays.length}× / week`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <HistoryStrip habit={habit} strip={strip} today={today} />
          <dl className="flex gap-4 text-xs">
            <div className="flex items-center gap-1" title="Current streak (longest in brackets)">
              <Flame className="size-3.5 text-warning" aria-hidden />
              <dt className="sr-only">Current streak</dt>
              <dd className="tabular">
                {stats.streak} <span className="text-muted-foreground">({stats.longest})</span>
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">7d </dt>
              <dd className="inline tabular">{pct(stats.week)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">30d </dt>
              <dd className="inline tabular">{pct(stats.month)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        {habit.active && stats.todayScheduled ? (
          <HabitCheckIn habit={habit} log={todayLog} date={today} />
        ) : (
          <span className="text-xs text-muted-foreground">{habit.active ? "Not scheduled today" : ""}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${habit.name}`} disabled={pending}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run(() => setHabitActive(habit.id, !habit.active))}>
              {habit.active ? <Pause /> : <Play />} {habit.active ? "Pause" : "Resume"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => run(() => setHabitArchived(habit.id, true))}>
              <Archive /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function HistoryStrip({ habit, strip, today }: { habit: Habit; strip: HabitStats["strip"]; today: string }) {
  return (
    <div className="flex gap-1" aria-label="Last 14 days">
      {strip.map((d) => {
        const state = d.log ? (d.log.met ? "met" : "missed") : d.scheduled ? (d.date === today ? "open" : "unlogged") : "off";
        const label = `${formatShortDate(d.date)}: ${
          state === "met" ? "on target" : state === "missed" ? "missed" : state === "off" ? "not scheduled" : "not logged"
        }`;
        const cell = (
          <span
            className={cn(
              "grid size-4 place-items-center rounded-[4px] text-[9px] font-semibold",
              state === "met" && "bg-success text-white",
              state === "missed" && "bg-destructive/80 text-white",
              state === "unlogged" && "border border-dashed border-subtle-foreground/60",
              state === "open" && "border border-primary",
              state === "off" && "bg-muted",
            )}
          >
            {state === "met" ? "✓" : state === "missed" ? "×" : ""}
          </span>
        );
        if (!habit.active || d.date < habit.start_date) {
          return (
            <span key={d.date} title={label} aria-label={label}>
              {cell}
            </span>
          );
        }
        return (
          <Popover key={d.date}>
            <PopoverTrigger asChild>
              <button type="button" title={label} aria-label={`${label}. Edit check-in`} className="rounded-[4px] focus-visible:outline-2 focus-visible:outline-ring">
                {cell}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <p className="mb-2 text-xs text-muted-foreground">
                {formatLongDate(d.date)}
              </p>
              <HabitCheckIn habit={habit} log={d.log} date={d.date} size="sm" />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

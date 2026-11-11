"use client";

import { useEffect, useState } from "react";
import { Brain, Briefcase, Circle, Heart, Loader2, Maximize2, Minimize2, Play, Square, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Chips, submitOnModEnter } from "@/components/shared/form-bits";
import { PILLAR_META } from "@/components/shared/indicators";
import { useAction } from "@/hooks/use-action";
import { useNow } from "@/hooks/use-now";
import { startTimer, stopTimer } from "@/lib/actions/activities";
import { formatClock, PILLAR_LABEL } from "@/lib/format";
import type { Activity, ActivityCategory, ActivityKind, Pillar } from "@/types/domain";
import { cn } from "@/lib/utils";

export interface TaskOption {
  id: string;
  title: string;
  pillar: Pillar;
}

const KIND_ICON: Record<ActivityKind, typeof Brain> = { deep: Brain, external: Briefcase, personal: Heart, other: Circle };
const TARGETS = [25, 50, 90] as const;

// The optional session target is a per-device viewing preference, so it lives in
// localStorage keyed by activity id (the activity itself is stored server-side).
const targetKey = (id: string) => `focus-target:${id}`;
function readTarget(id: string): number | null {
  try {
    const v = Number(localStorage.getItem(targetKey(id)));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
function writeTarget(id: string, minutes: number | null) {
  try {
    if (minutes) localStorage.setItem(targetKey(id), String(minutes));
    else localStorage.removeItem(targetKey(id));
  } catch {}
}

const pad = (n: number) => String(n).padStart(2, "0");
function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return { h, m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
}
const short = (ms: number) => {
  const c = clock(ms);
  return c.h ? `${c.h}:${c.m}:${c.s}` : `${c.m}:${c.s}`;
};

export function ActivityTimer({
  running,
  categories,
  tasks,
  tz,
}: {
  running: Activity | null;
  categories: ActivityCategory[];
  tasks: TaskOption[];
  tz: string;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);

  if (running) {
    return (
      <>
        <RunningStrip running={running} categories={categories} onExpand={() => setFocusOpen(true)} />
        <FocusDialog
          open={focusOpen}
          onOpenChange={setFocusOpen}
          running={running}
          categories={categories}
          tasks={tasks}
          tz={tz}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStartOpen(true)}
        className="group flex w-full items-center gap-4 rounded-lg text-left"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
          <Play className="ml-0.5 size-4 fill-current" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Start a focus session</span>
          <span className="block text-xs text-muted-foreground">Track deep work, meetings or anything else</span>
        </span>
      </button>
      <StartDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        categories={categories}
        tasks={tasks}
        onStarted={() => {
          setStartOpen(false);
          setFocusOpen(true);
        }}
      />
    </>
  );
}

// ------------------------------------------------------------------ running strip

function RunningStrip({
  running,
  categories,
  onExpand,
}: {
  running: Activity;
  categories: ActivityCategory[];
  onExpand: () => void;
}) {
  const now = useNow();
  const { pending, run } = useAction();
  const cat = categories.find((c) => c.id === running.category_id);
  const elapsed = now == null ? null : now - Date.parse(running.started_at);

  // Show the live time in the browser tab while a session runs.
  useEffect(() => {
    if (elapsed == null) return;
    const prev = document.title;
    document.title = `${short(elapsed)} · ${running.title}`;
    return () => {
      document.title = prev;
    };
  }, [elapsed, running.title]);

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onExpand} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative flex size-2.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium group-hover:underline">{running.title}</span>
          <span className="block text-xs text-muted-foreground">{cat?.name ?? "Activity"}</span>
        </span>
        <span className="ml-auto font-mono text-xl font-medium tabular sm:text-2xl" aria-label="Elapsed time">
          {elapsed == null ? "--:--" : short(elapsed)}
        </span>
      </button>
      <Button variant="ghost" size="icon-sm" onClick={onExpand} aria-label="Open focus view" className="hidden sm:inline-flex">
        <Maximize2 />
      </Button>
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => stopTimer())}>
        {pending ? <Loader2 className="animate-spin" /> : <Square className="fill-current" />}
        Stop
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ start dialog

function StartDialog({
  open,
  onOpenChange,
  categories,
  tasks,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: ActivityCategory[];
  tasks: TaskOption[];
  onStarted: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-2xl">
        {open ? <StartForm categories={categories} tasks={tasks} onStarted={onStarted} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function StartForm({ categories, tasks, onStarted }: { categories: ActivityCategory[]; tasks: TaskOption[]; onStarted: () => void }) {
  const { pending, run } = useAction();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(
    categories.find((c) => c.kind === "deep")?.id ?? categories[0]?.id ?? null,
  );
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(50);
  const effectiveTitle = title.trim() || tasks.find((t) => t.id === taskId)?.title || "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !effectiveTitle) return;
    run(() => startTimer({ title: effectiveTitle, category_id: categoryId, pillar, task_occurrence_id: taskId }), {
      quiet: true,
      onSuccess: (d) => {
        if (d?.id) writeTarget(d.id, target);
        onStarted();
      },
    });
  };

  return (
    <form onSubmit={submit} {...submitOnModEnter} className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-10 sm:pb-6 sm:pt-9">
      <DialogHeader className="text-left">
        <DialogDescription className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          New session
        </DialogDescription>
        <DialogTitle className="sr-only">Start a focus session</DialogTitle>
      </DialogHeader>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={taskId ? tasks.find((t) => t.id === taskId)?.title : "What are you working on?"}
        aria-label="What are you working on?"
        maxLength={200}
        className="mt-2 w-full bg-transparent font-display text-3xl font-medium tracking-[-0.01em] outline-none placeholder:text-subtle-foreground sm:text-4xl"
      />

      {tasks.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">From today&apos;s plan</p>
          <div className="flex flex-wrap gap-1.5">
            {tasks.slice(0, 8).map((t) => {
              const on = taskId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setTaskId(on ? null : t.id);
                    if (!on) setPillar(t.pillar);
                  }}
                  className={cn(
                    "inline-flex max-w-64 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all active:scale-95",
                    on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", PILLAR_META[t.pillar].dot)} aria-hidden />
                  <span className="truncate">{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-7">
        <p className="mb-2 text-xs text-muted-foreground">Type</p>
        <div role="radiogroup" aria-label="Category" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categories.map((c) => {
            const Icon = KIND_ICON[c.kind];
            const on = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-all active:scale-[0.98]",
                  on ? "border-primary bg-primary/[0.07] ring-3 ring-primary/15" : "hover:border-foreground/20",
                )}
              >
                <Icon className={cn("size-5", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span className="font-medium leading-tight">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Pillar</p>
          <Chips<Pillar>
            ariaLabel="Pillar"
            value={pillar}
            onChange={setPillar}
            options={(["health", "finance", "growth"] as Pillar[]).map((p) => ({ value: p, label: PILLAR_LABEL[p] }))}
          />
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Target</p>
          <Chips<number>
            ariaLabel="Session target"
            value={target}
            onChange={setTarget}
            options={TARGETS.map((m) => ({ value: m, label: m < 60 ? `${m} min` : `${m / 60}h ${m % 60 ? `${m % 60}m` : ""}`.trim() }))}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end">
        <Button type="submit" size="lg" disabled={pending || !categoryId || !effectiveTitle} className="h-11 rounded-full px-6">
          {pending ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />}
          Start session
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ focus view

function FocusDialog({
  open,
  onOpenChange,
  running,
  categories,
  tasks,
  tz,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  running: Activity;
  categories: ActivityCategory[];
  tasks: TaskOption[];
  tz: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="p-0 sm:max-w-3xl">
        {open ? (
          <FocusView running={running} categories={categories} tasks={tasks} tz={tz} onMinimise={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FocusView({
  running,
  categories,
  tasks,
  tz,
  onMinimise,
}: {
  running: Activity;
  categories: ActivityCategory[];
  tasks: TaskOption[];
  tz: string;
  onMinimise: () => void;
}) {
  const now = useNow();
  const { pending, run } = useAction();
  const [target, setTarget] = useState<number | null>(() => readTarget(running.id));
  const cat = categories.find((c) => c.id === running.category_id);
  const Icon = KIND_ICON[cat?.kind ?? "other"];
  const linked = tasks.find((t) => t.id === running.task_occurrence_id);
  const elapsed = now == null ? 0 : Math.max(0, now - Date.parse(running.started_at));
  const c = clock(elapsed);

  const targetMs = target ? target * 60_000 : null;
  const over = targetMs != null && elapsed > targetMs;
  // With a target the ring fills toward it; without one it laps once per hour.
  const progress = targetMs ? Math.min(1, elapsed / targetMs) : (elapsed % 3_600_000) / 3_600_000;
  const R = 130;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative bg-[radial-gradient(120%_80%_at_50%_0%,color-mix(in_oklab,var(--primary)_9%,transparent),transparent_70%)] px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-5 sm:px-10 sm:pb-7 sm:pt-6">
      <DialogHeader className="flex-row items-center justify-between gap-3 text-left">
        <DialogDescription className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {cat?.name ?? "Activity"}
        </DialogDescription>
        <Button variant="ghost" size="sm" onClick={onMinimise}>
          <Minimize2 /> Minimise
        </Button>
      </DialogHeader>

      <DialogTitle className="mx-auto mt-4 max-w-xl text-center font-display text-2xl font-medium leading-snug text-balance sm:text-3xl">
        {running.title}
      </DialogTitle>

      {/* Ring + clock */}
      <div className="relative mx-auto mt-6 grid size-[min(78vw,300px)] place-items-center">
        <svg viewBox="0 0 300 300" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="150" cy="150" r={R} fill="none" stroke="color-mix(in oklab, var(--primary) 12%, transparent)" strokeWidth="6" />
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke={over ? "var(--success)" : "var(--primary)"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
          />
        </svg>
        <div className="text-center" role="timer" aria-label="Elapsed time">
          <p className="font-sans text-6xl font-light tracking-tight tabular sm:text-7xl">
            {c.h ? <>{c.h}<span className="text-subtle-foreground">:</span></> : null}
            {c.m}
            <span className="text-subtle-foreground">:</span>
            {c.s}
          </p>
          <p className={cn("mt-1 text-xs", over ? "font-medium text-success" : "text-muted-foreground")}>
            {targetMs == null
              ? "No target"
              : over
                ? `Target reached · +${short(elapsed - targetMs)}`
                : `${short(targetMs - elapsed)} to ${target} min`}
          </p>
        </div>
      </div>

      {/* Details */}
      <dl className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border text-sm sm:grid-cols-3">
        <Info label="Started" value={formatClock(running.started_at, tz)} />
        <Info
          label="Pillar"
          value={
            running.pillar ? (
              <span className={PILLAR_META[running.pillar].text}>{PILLAR_LABEL[running.pillar]}</span>
            ) : (
              <span className="text-muted-foreground">None</span>
            )
          }
        />
        <Info
          className="col-span-2 sm:col-span-1"
          label="Task"
          value={linked ? <span className="line-clamp-1">{linked.title}</span> : <span className="text-muted-foreground">Not linked</span>}
        />
      </dl>

      <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="size-3.5 text-muted-foreground" aria-hidden />
          <Chips<number>
            ariaLabel="Session target"
            value={target}
            onChange={(v) => {
              setTarget(v);
              writeTarget(running.id, v);
            }}
            options={TARGETS.map((m) => ({ value: m, label: `${m}m` }))}
          />
        </div>
        <Button
          size="lg"
          variant="destructive"
          disabled={pending}
          onClick={() => run(() => stopTimer())}
          className="h-11 rounded-full px-6"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Square className="fill-current" />}
          Stop session
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card px-4 py-3", className)}>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

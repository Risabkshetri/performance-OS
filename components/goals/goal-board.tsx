"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Clock,
  Goal as GoalIcon,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/layout-bits";
import { Field } from "@/components/shared/form-bits";
import { PillarBadge, ProgressBar } from "@/components/shared/indicators";
import { GoalFormDialog } from "./goal-form-dialog";
import { useAction } from "@/hooks/use-action";
import {
  addMilestone,
  deleteMilestone,
  logGoalProgress,
  setGoalArchived,
  setGoalStatus,
  toggleMilestone,
} from "@/lib/actions/goals";
import { goalHealth, goalProgress, type GoalHealth } from "@/lib/calculations/goals";
import { formatFullDate, formatNumber, formatShortDate, HORIZON_LABEL } from "@/lib/format";
import { diffDays } from "@/lib/date/productivity-day";
import type { GoalWithDetail } from "@/lib/data/queries";
import type { GoalHorizon, Pillar } from "@/types/domain";
import { cn } from "@/lib/utils";

const HEALTH_META: Record<GoalHealth, { label: string; icon: typeof Clock; className: string }> = {
  completed: { label: "Completed", icon: CircleCheck, className: "text-success" },
  on_track: { label: "On track", icon: TrendingUp, className: "text-success" },
  behind: { label: "Behind", icon: TriangleAlert, className: "text-warning" },
  overdue: { label: "Overdue", icon: CalendarClock, className: "text-destructive" },
  no_deadline: { label: "No deadline", icon: CircleDashed, className: "text-muted-foreground" },
  inactive: { label: "Paused", icon: CircleDashed, className: "text-muted-foreground" },
};

export interface GoalLinkStats {
  done: number;
  total: number;
}

export function GoalBoard({
  goals,
  archived,
  links,
  today,
  horizon,
  pillar,
}: {
  goals: GoalWithDetail[];
  archived: GoalWithDetail[];
  links: Record<string, GoalLinkStats>;
  today: string;
  horizon: GoalHorizon | null;
  pillar: Pillar | null;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GoalWithDetail | null>(null);
  const [progressFor, setProgressFor] = useState<GoalWithDetail | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { run, pending } = useAction();

  const groups = (["health", "finance", "growth"] as Pillar[])
    .filter((p) => !pillar || p === pillar)
    .map((p) => ({ pillar: p, goals: goals.filter((g) => g.pillar === p) }))
    .filter((g) => g.goals.length);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus /> New goal
        </Button>
      </div>

      {!groups.length ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={GoalIcon}
            title={horizon || pillar ? "No goals match this view" : "No goals yet"}
            description="Set a goal for Health, Finance or Growth."
            action={<Button onClick={() => setCreating(true)}>Create a goal</Button>}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.pillar}>
              <h2 className="mb-3">
                <PillarBadge pillar={group.pillar} className="text-sm" />
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {group.goals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    today={today}
                    link={links[g.id]}
                    onEdit={() => setEditing(g)}
                    onProgress={() => setProgressFor(g)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {archived.length ? (
        <div className="mt-8">
          <button
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowArchived((s) => !s)}
            aria-expanded={showArchived}
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived ? (
            <ul className="mt-2 divide-y rounded-xl border bg-card">
              {archived.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-4 py-2.5 sm:px-5 text-sm">
                  <span className="text-muted-foreground">
                    {g.title} · {HORIZON_LABEL[g.horizon]}
                  </span>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setGoalArchived(g.id, false))}>
                    <ArchiveRestore /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <GoalFormDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        editing={editing}
        today={today}
        defaultHorizon={horizon ?? "monthly"}
        defaultPillar={pillar ?? "growth"}
      />
      <ProgressDialog goal={progressFor} onClose={() => setProgressFor(null)} />
    </>
  );
}

function GoalCard({
  goal,
  today,
  link,
  onEdit,
  onProgress,
}: {
  goal: GoalWithDetail;
  today: string;
  link?: GoalLinkStats;
  onEdit: () => void;
  onProgress: () => void;
}) {
  const { run, pending } = useAction();
  const [showMilestones, setShowMilestones] = useState(goal.milestones.length > 0 && goal.milestones.length <= 4);
  const [whyOpen, setWhyOpen] = useState(false);
  const progress = goalProgress(goal, goal.milestones);
  const { health, expected } = goalHealth(goal, progress.percent, today);
  const meta = HEALTH_META[health];
  const HealthIcon = meta.icon;
  const msDone = goal.milestones.filter((m) => m.completed_at).length;
  const daysLeft = goal.deadline ? diffDays(today, goal.deadline) : null;
  const tone = {
    "--pillar": `var(--pillar-${goal.pillar})`,
    "--pillar-ink": `color-mix(in oklab, var(--pillar-${goal.pillar}) 55%, var(--foreground))`,
  } as React.CSSProperties;

  return (
    <article
      style={tone}
      className="group/goal relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-shadow hover:shadow-[0_12px_32px_-18px_rgb(0_0_0/0.3)]"
    >
      {/* pillar wash */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--pillar)_10%,transparent),transparent)]" />

      <div className="relative flex items-start gap-4 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-medium" style={{ color: "var(--pillar-ink)" }}>
              {HORIZON_LABEL[goal.horizon]}
            </span>
            {daysLeft != null && goal.status !== "completed" ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 tabular",
                  daysLeft < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                )}
                title={goal.deadline ? `Due ${formatFullDate(goal.deadline)}` : undefined}
              >
                {daysLeft < 0 ? `${-daysLeft}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft} days left`}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-display text-xl font-medium leading-snug text-balance">{goal.title}</h3>
        </div>

        <ProgressRing percent={progress.percent} expected={health === "behind" ? expected : null} />
      </div>

      {goal.description ? (
        <figure className="relative mx-5 mt-4 border-l-2 pl-3" style={{ borderColor: "color-mix(in oklab, var(--pillar) 45%, transparent)" }}>
          <figcaption className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Why</figcaption>
          <blockquote className={cn("mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/85", !whyOpen && "line-clamp-3")}>
            {goal.description}
          </blockquote>
          {goal.description.length > 140 ? (
            <button type="button" onClick={() => setWhyOpen((o) => !o)} className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              {whyOpen ? "Show less" : "Read more"}
            </button>
          ) : null}
        </figure>
      ) : null}
      {goal.notes ? <p className="mx-5 mt-3 line-clamp-2 text-xs text-subtle-foreground" title={goal.notes}>{goal.notes}</p> : null}

      <div className="relative mx-5 mt-5">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium", meta.className, "bg-current/10")}>
            <HealthIcon className="size-3.5" aria-hidden />
            <span>{meta.label}</span>
          </span>
          <span className="text-muted-foreground tabular">
            {progress.source === "numeric"
              ? `${formatNumber(goal.current_value ?? 0)} / ${formatNumber(goal.target_value)}${goal.unit ? ` ${goal.unit}` : ""}`
              : progress.source === "milestones"
                ? `${msDone}/${goal.milestones.length} milestones`
                : "Self-assessed"}
          </span>
        </div>
        <ProgressBar value={progress.percent} pillar={goal.pillar} label={`${goal.title} progress`} />
        {link?.total ? (
          <p className="mt-1.5 text-xs text-muted-foreground tabular">
            {link.done}/{link.total} linked tasks done
          </p>
        ) : null}
      </div>

      <div className="mx-5 mt-4 border-t pt-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setShowMilestones((s) => !s)}
          aria-expanded={showMilestones}
        >
          <ListChecks className="size-3.5" aria-hidden /> Milestones
          {goal.milestones.length ? <span className="tabular">· {msDone}/{goal.milestones.length}</span> : null}
          <ChevronDown className={cn("size-3.5 transition-transform", showMilestones && "rotate-180")} aria-hidden />
        </button>
        {showMilestones ? <Milestones goal={goal} today={today} /> : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 px-5 pb-4 pt-4">
        <Button variant="outline" size="sm" className="rounded-full" onClick={onProgress} disabled={pending}>
          <TrendingUp /> Update progress
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-subtle-foreground hover:text-foreground data-[state=open]:text-foreground"
              aria-label={`Actions for ${goal.title}`}
              disabled={pending}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            {goal.status !== "completed" ? (
              <DropdownMenuItem onSelect={() => run(() => setGoalStatus(goal.id, "completed"))}>
                <CircleCheck /> Mark completed
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => run(() => setGoalStatus(goal.id, "active"))}>
                <CircleDashed /> Reopen
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => run(() => setGoalArchived(goal.id, true))}>
              <Archive /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

/** Circular progress in the goal's pillar colour, with an optional "expected by now" tick. */
function ProgressRing({ percent, expected }: { percent: number; expected: number | null }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const tick = expected != null ? (expected / 100) * 2 * Math.PI - Math.PI / 2 : null;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center" role="img" aria-label={`${percent}% complete`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="color-mix(in oklab, var(--pillar) 15%, transparent)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="var(--pillar)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(100, percent) / 100)}
          transform="rotate(-90 32 32)"
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
        {tick != null ? (
          <line
            x1={32 + (R - 5) * Math.cos(tick)}
            y1={32 + (R - 5) * Math.sin(tick)}
            x2={32 + (R + 5) * Math.cos(tick)}
            y2={32 + (R + 5) * Math.sin(tick)}
            stroke="var(--foreground)"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
        ) : null}
      </svg>
      <span className="font-display text-base font-medium tabular">
        {percent}
        <span className="text-[10px] text-muted-foreground">%</span>
      </span>
    </div>
  );
}

function Milestones({ goal, today }: { goal: GoalWithDetail; today: string }) {
  const { run, pending } = useAction();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="mt-3">
      {goal.milestones.length ? (
        <ol className="relative space-y-0.5 before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-px before:bg-border">
          {goal.milestones.map((m) => {
            const done = Boolean(m.completed_at);
            const late = !done && m.due_date != null && m.due_date < today;
            return (
              <li key={m.id} className="relative flex items-center gap-3 rounded-lg py-1.5 pr-1">
                <Checkbox
                  checked={done}
                  disabled={pending}
                  onCheckedChange={(c) => run(() => toggleMilestone(m.id, c === true), { quiet: true })}
                  aria-label={`Milestone ${m.title}`}
                  className="relative size-[18px] rounded-full bg-card data-checked:border-[var(--pillar)] data-checked:bg-[var(--pillar)]"
                />
                <span className={cn("min-w-0 flex-1 text-sm", done && "text-muted-foreground line-through decoration-subtle-foreground")}>
                  {m.title}
                </span>
                {m.due_date ? (
                  <span className={cn("shrink-0 text-xs tabular", late ? "text-destructive" : "text-muted-foreground")}>
                    {formatShortDate(m.due_date)}
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="touch:size-9 text-subtle-foreground hover:text-foreground"
                  aria-label={`Remove milestone ${m.title}`}
                  onClick={() => run(() => deleteMilestone(m.id))}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ol>
      ) : null}
      <form
        className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-1 transition-colors focus-within:border-ring"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addMilestone({ goal_id: goal.id, title, due_date: due }), {
            onSuccess: () => {
              setTitle("");
              setDue("");
            },
            quiet: true,
          });
        }}
      >
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a milestone"
          aria-label="Milestone title"
          className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle-foreground"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Milestone due date"
          className="h-7 w-[7.5rem] shrink-0 bg-transparent text-xs text-muted-foreground outline-none"
        />
        <Button type="submit" size="xs" variant="ghost" disabled={pending || !title.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

function ProgressDialog({ goal, onClose }: { goal: GoalWithDetail | null; onClose: () => void }) {
  return (
    <Dialog open={!!goal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">{goal ? <ProgressForm key={goal.id} goal={goal} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function ProgressForm({ goal, onClose }: { goal: GoalWithDetail; onClose: () => void }) {
  const { run, pending } = useAction();
  const numeric = Boolean(goal.target_value);
  const usesMilestones = !numeric && goal.milestones.length > 0;
  const [value, setValue] = useState(String(numeric ? (goal.current_value ?? "") : goal.manual_progress));
  const [note, setNote] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (value === "" || !Number.isFinite(n)) return;
        run(
          () =>
            logGoalProgress({
              goal_id: goal.id,
              value: numeric ? n : null,
              progress: numeric ? null : Math.round(Math.max(0, Math.min(100, n))),
              note,
            }),
          { onSuccess: onClose },
        );
      }}
    >
      <DialogHeader>
        <DialogTitle>Update progress</DialogTitle>
        <DialogDescription>{goal.title}</DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        {usesMilestones ? (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Progress for this goal comes from its milestones. You can still log a note below.
          </p>
        ) : null}
        <Field label={numeric ? `Current value${goal.unit ? ` (${goal.unit})` : ""}` : "Progress (%)"} htmlFor="progress-value">
          <Input
            id="progress-value"
            type="number"
            step="any"
            min={numeric ? undefined : 0}
            max={numeric ? undefined : 100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Note (optional)" htmlFor="progress-note">
          <Input id="progress-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {goal.progress_logs.length ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Recent updates</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {goal.progress_logs.slice(0, 4).map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="truncate">{l.note || (l.value != null ? formatNumber(l.value) : `${l.progress}%`)}</span>
                  <span className="shrink-0 tabular">{formatFullDate(l.logged_at.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
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
  const progress = goalProgress(goal, goal.milestones);
  const { health, expected } = goalHealth(goal, progress.percent, today);
  const meta = HEALTH_META[health];
  const HealthIcon = meta.icon;
  const msDone = goal.milestones.filter((m) => m.completed_at).length;

  return (
    <article className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {HORIZON_LABEL[goal.horizon]}
            {goal.deadline ? ` · due ${formatShortDate(goal.deadline)}` : ""}
          </p>
          <h3 className="mt-0.5 text-sm font-medium leading-5">{goal.title}</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="touch:size-9" aria-label={`Actions for ${goal.title}`} disabled={pending}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onProgress}>
              <TrendingUp /> Update progress
            </DropdownMenuItem>
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

      {goal.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={goal.description}>{goal.description}</p> : null}
      {goal.notes ? (
        <p className="mt-1.5 line-clamp-2 border-l-2 pl-2 text-xs text-subtle-foreground" title={goal.notes}>
          {goal.notes}
        </p>
      ) : null}

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className={cn("inline-flex items-center gap-1", meta.className)}>
            <HealthIcon className="size-3.5" aria-hidden />
            {meta.label}
            {health === "behind" && expected != null ? (
              <span className="text-muted-foreground">· expected ~{expected}%</span>
            ) : null}
          </span>
          <span className="font-medium tabular">{progress.percent}%</span>
        </div>
        <ProgressBar value={progress.percent} pillar={goal.pillar} label={`${goal.title} progress`} />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {progress.source === "numeric"
            ? `${formatNumber(goal.current_value ?? 0)} of ${formatNumber(goal.target_value)}${goal.unit ? ` ${goal.unit}` : ""}`
            : progress.source === "milestones"
              ? `${msDone} of ${goal.milestones.length} milestones`
              : "Self-assessed"}
          {link?.total ? ` · ${link.done}/${link.total} linked tasks done` : ""}
        </p>
      </div>

      <div className="mt-3 border-t pt-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowMilestones((s) => !s)}
          aria-expanded={showMilestones}
        >
          <ListChecks className="size-3.5" /> Milestones {goal.milestones.length ? `(${msDone}/${goal.milestones.length})` : ""}
        </button>
        {showMilestones ? <Milestones goal={goal} /> : null}
      </div>
    </article>
  );
}

function Milestones({ goal }: { goal: GoalWithDetail }) {
  const { run, pending } = useAction();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="mt-2 space-y-1">
      {goal.milestones.map((m) => (
        <div key={m.id} className="group flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!m.completed_at}
            disabled={pending}
            onCheckedChange={(c) => run(() => toggleMilestone(m.id, c === true), { quiet: true })}
            aria-label={`Milestone ${m.title}`}
          />
          <span className={cn("flex-1", m.completed_at && "text-muted-foreground line-through")}>{m.title}</span>
          {m.due_date ? <span className="text-xs text-muted-foreground">{formatShortDate(m.due_date)}</span> : null}
          <Button
            variant="ghost"
            size="icon-xs"
            className="touch:size-9 can-hover:opacity-0 can-hover:group-hover:can-hover:focus-visible:opacity-100"
            aria-label={`Remove milestone ${m.title}`}
            onClick={() => run(() => deleteMilestone(m.id))}
          >
            <X />
          </Button>
        </div>
      ))}
      <form
        className="flex items-center gap-1.5 pt-1"
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
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a milestone" className="h-7 text-xs" aria-label="Milestone title" />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-auto text-xs" aria-label="Milestone due date" />
        <Button type="submit" size="xs" variant="outline" disabled={pending || !title.trim()}>
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

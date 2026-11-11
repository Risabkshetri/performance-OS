"use client";

import { useState } from "react";
import { CalendarClock, Clock, Goal as GoalIcon, MoreHorizontal, Pencil, Play, Repeat, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { PillarBadge, PriorityBadge, StatusBadge } from "@/components/shared/indicators";
import { TaskFormDialog } from "./task-form-dialog";
import { useAction } from "@/hooks/use-action";
import {
  deleteOccurrence,
  rescheduleOccurrence,
  setOccurrenceStatus,
  uncompleteOccurrence,
} from "@/lib/actions/tasks";
import { addDays } from "@/lib/date/productivity-day";
import { describeRecurrence } from "@/lib/calculations/recurrence";
import { formatDuration, formatShortDate, formatWallTime } from "@/lib/format";
import type { GoalOption } from "@/lib/data/queries";
import type { PlannedTask, Priority } from "@/types/domain";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: PlannedTask[];
  goals: GoalOption[];
  today: string;
  defaultPriority: Priority;
  showDate?: boolean;
  dense?: boolean;
  actualMinutes?: Record<string, number>;
  empty?: React.ReactNode;
}

export function TaskList({ tasks, goals, today, defaultPriority, showDate, dense, actualMinutes, empty }: TaskListProps) {
  const [editing, setEditing] = useState<PlannedTask | null>(null);
  const [rescheduling, setRescheduling] = useState<PlannedTask | null>(null);
  const [deleting, setDeleting] = useState<PlannedTask | null>(null);
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));

  if (!tasks.length) return <>{empty}</>;

  return (
    <>
      <ul className="divide-y">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            today={today}
            showDate={showDate}
            dense={dense}
            goalTitle={t.task.goal_id ? goalTitle.get(t.task.goal_id) : undefined}
            actual={actualMinutes?.[t.id]}
            onEdit={() => setEditing(t)}
            onReschedule={() => setRescheduling(t)}
            onDelete={() => setDeleting(t)}
          />
        ))}
      </ul>

      <TaskFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        editing={editing}
        goals={goals}
        today={today}
        defaultPriority={defaultPriority}
      />
      <RescheduleDialog task={rescheduling} today={today} onClose={() => setRescheduling(null)} />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function TaskRow({
  task: t,
  today,
  showDate,
  dense,
  goalTitle,
  actual,
  onEdit,
  onReschedule,
  onDelete,
}: {
  task: PlannedTask;
  today: string;
  showDate?: boolean;
  dense?: boolean;
  goalTitle?: string;
  actual?: number;
  onEdit: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}) {
  const { pending, run } = useAction();
  const [expanded, setExpanded] = useState(false);
  const done = t.status === "completed";
  const moved = t.status === "rescheduled";
  const canStart = (t.status === "pending" || t.status === "in_progress") && t.scheduled_date >= today;
  const time = t.planned_start
    ? `${formatWallTime(t.planned_start)}${t.planned_end ? ` – ${formatWallTime(t.planned_end)}` : ""}`
    : null;

  const toggle = (checked: boolean) =>
    run(() => (checked ? setOccurrenceStatus(t.id, "completed") : uncompleteOccurrence(t.id)), { quiet: true });

  return (
    <li className={cn("group flex items-start gap-3", dense ? "py-2" : "py-2.5", pending && "opacity-60")}>
      <Checkbox
        className="mt-0.5"
        checked={done}
        disabled={moved || pending}
        onCheckedChange={(c) => toggle(c === true)}
        aria-label={done ? `Mark "${t.task.title}" as not done` : `Complete "${t.task.title}"`}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "block max-w-full cursor-pointer text-left text-sm leading-5 underline-offset-2 hover:underline",
            (done || moved) && "text-muted-foreground line-through decoration-subtle-foreground",
          )}
        >
          {t.task.title}
        </button>
        {t.task.description ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className={cn(
              "mt-0.5 block max-w-full cursor-pointer whitespace-pre-line text-left text-xs leading-relaxed text-muted-foreground hover:text-foreground",
              !expanded && "line-clamp-1",
            )}
          >
            {t.task.description}
          </button>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <PillarBadge pillar={t.task.pillar} />
          <PriorityBadge priority={t.task.priority} />
          {showDate ? <span>{formatShortDate(t.scheduled_date)}</span> : null}
          {time ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {time}
            </span>
          ) : null}
          {t.task.estimated_minutes ? (
            <span title="Planned vs actual">
              {actual != null ? `${formatDuration(actual)} / ` : ""}
              {formatDuration(t.task.estimated_minutes)}
              {actual == null ? " est." : ""}
            </span>
          ) : null}
          {t.task.recurrence ? (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" aria-hidden />
              {describeRecurrence(t.task.recurrence)}
            </span>
          ) : null}
          {goalTitle ? (
            <span className="inline-flex max-w-48 items-center gap-1 truncate">
              <GoalIcon className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{goalTitle}</span>
            </span>
          ) : null}
          {t.status !== "pending" && t.status !== "completed" ? <StatusBadge status={t.status} /> : null}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="touch:size-9 can-hover:opacity-0 can-hover:group-hover:can-hover:focus-visible:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Actions for "${t.task.title}"`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {canStart && t.status === "pending" ? (
            <DropdownMenuItem onSelect={() => run(() => setOccurrenceStatus(t.id, "in_progress"), { quiet: true })}>
              <Play /> Mark in progress
            </DropdownMenuItem>
          ) : null}
          {t.status === "in_progress" ? (
            <DropdownMenuItem onSelect={() => run(() => setOccurrenceStatus(t.id, "pending"), { quiet: true })}>
              <Undo2 /> Back to pending
            </DropdownMenuItem>
          ) : null}
          {!done && !moved ? (
            <DropdownMenuItem onSelect={onReschedule}>
              <CalendarClock /> Reschedule
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function RescheduleDialog({ task, today, onClose }: { task: PlannedTask | null; today: string; onClose: () => void }) {
  const tomorrow = addDays(today, 1);
  const [date, setDate] = useState(tomorrow);
  const { pending, run } = useAction();
  const submit = (d: string) =>
    task && run(() => rescheduleOccurrence({ occurrence_id: task.id, new_date: d }), { onSuccess: onClose });

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule</DialogTitle>
          <DialogDescription>
            &ldquo;{task?.task.title}&rdquo; will be marked rescheduled on {task ? formatShortDate(task.scheduled_date) : ""} and
            added to the new date. Rescheduling doesn&apos;t count as completion.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          {task?.scheduled_date !== tomorrow ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => submit(tomorrow)}>
              Tomorrow
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={pending} onClick={() => submit(addDays(today, 7))}>
            Next week
          </Button>
          <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" aria-label="New date" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !date} onClick={() => submit(date)}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTaskDialog({ task, onClose }: { task: PlannedTask | null; onClose: () => void }) {
  const { pending, run } = useAction();
  const recurring = Boolean(task?.task.recurrence);
  const remove = (scope: "one" | "series") => task && run(() => deleteOccurrence(task.id, scope), { onSuccess: onClose });

  return (
    <AlertDialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task?</AlertDialogTitle>
          <AlertDialogDescription>
            {recurring
              ? "This is a recurring task. Delete just this occurrence, or end the series from this date on. Completed history is kept either way."
              : `"${task?.task.title}" will be permanently deleted.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {recurring ? (
            <>
              <Button variant="outline" disabled={pending} onClick={() => remove("one")}>
                This occurrence
              </Button>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault();
                  remove("series");
                }}
              >
                End series
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                remove("one");
              }}
            >
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

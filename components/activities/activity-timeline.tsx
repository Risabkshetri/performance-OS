"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PillarBadge } from "@/components/shared/indicators";
import { ActivityFormDialog } from "./activity-form-dialog";
import type { TaskOption } from "./activity-timer";
import { useAction } from "@/hooks/use-action";
import { useNow } from "@/hooks/use-now";
import { deleteActivity } from "@/lib/actions/activities";
import { formatClock, formatDuration } from "@/lib/format";
import type { Activity, ActivityCategory, ActivityKind } from "@/types/domain";
import { cn } from "@/lib/utils";

const KIND_DOT: Record<ActivityKind, string> = {
  deep: "bg-primary",
  external: "bg-warning",
  personal: "bg-success",
  other: "bg-subtle-foreground",
};

export function ActivityTimeline({
  activities,
  categories,
  allCategories,
  tasks,
  tz,
  dayStart,
  date,
  readOnly,
  emptyText = "No activity logged yet.",
}: {
  activities: Activity[];
  categories: ActivityCategory[];
  /** includes archived, for labelling old entries */
  allCategories?: ActivityCategory[];
  tasks: TaskOption[];
  tz: string;
  dayStart: number;
  date: string;
  readOnly?: boolean;
  emptyText?: string;
}) {
  const now = useNow();
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const { pending, run } = useAction();
  const catById = new Map((allCategories ?? categories).map((c) => [c.id, c]));

  return (
    <>
      {activities.length ? (
        <ol className="relative space-y-0.5">
          {activities.map((a) => {
            const cat = catById.get(a.category_id);
            const end = a.ended_at ? Date.parse(a.ended_at) : now;
            const minutes = end == null ? null : (end - Date.parse(a.started_at)) / 60000;
            return (
              <li key={a.id} className="group flex items-center gap-3 rounded-lg py-1.5 sm:px-2 sm:hover:bg-muted/60">
                <span className="w-16 shrink-0 text-xs text-muted-foreground tabular sm:w-20">{formatClock(a.started_at, tz)}</span>
                <span className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[cat?.kind ?? "other"])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-snug" title={a.title}>{a.title}</p>
                  {a.notes ? (
                    <p className="line-clamp-1 text-xs text-muted-foreground" title={a.notes}>
                      {a.notes}
                    </p>
                  ) : null}
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{cat?.name ?? "Uncategorised"}</span>
                    {a.pillar ? <PillarBadge pillar={a.pillar} /> : null}
                    {a.ended_at ? <span>until {formatClock(a.ended_at, tz)}</span> : <span className="text-primary">Running</span>}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular">{minutes == null ? "-" : formatDuration(minutes)}</span>
                {!readOnly ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="touch:size-9 text-subtle-foreground hover:text-foreground data-[state=open]:text-foreground"
                        aria-label={`Actions for ${a.title}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(a)}>
                        <Pencil /> Edit times
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(a)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>
      )}

      {!readOnly ? (
        <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={() => setCreating(true)}>
          <Plus /> Log past activity
        </Button>
      ) : null}

      <ActivityFormDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        editing={editing}
        categories={categories}
        tasks={tasks}
        tz={tz}
        dayStart={dayStart}
        defaultDate={date}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.title}&rdquo; will be removed from your activity log and analytics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={() => deleting && run(() => deleteActivity(deleting.id), { onSuccess: () => setDeleting(null) })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

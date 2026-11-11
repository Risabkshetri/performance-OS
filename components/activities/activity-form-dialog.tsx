"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SimpleSelect } from "@/components/shared/form-bits";
import { activitySchema } from "@/lib/validations";
import { createActivity, updateActivity } from "@/lib/actions/activities";
import { useAction } from "@/hooks/use-action";
import { minutesToTime, timeToMinutes } from "@/lib/date/productivity-day";
import { formatLongDate, PILLAR_LABEL, toTimeInput } from "@/lib/format";
import type { Activity, ActivityCategory, Pillar } from "@/types/domain";
import type { TaskOption } from "./activity-timer";

type Values = z.input<typeof activitySchema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: ActivityCategory[];
  tasks: TaskOption[];
  tz: string;
  dayStart: number;
  defaultDate: string;
  editing?: Activity | null;
}

export function ActivityFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open ? <ActivityForm key={props.editing?.id ?? "new"} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ActivityForm({ onOpenChange, categories, tasks, tz, dayStart, defaultDate, editing }: Props) {
  const running = Boolean(editing && !editing.ended_at);
  const { pending, run } = useAction();
  const form = useForm<Values, unknown, z.output<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: editing
      ? {
          title: editing.title,
          category_id: editing.category_id,
          pillar: editing.pillar ?? "",
          date: editing.productivity_date,
          start_time: toTimeInput(editing.started_at, tz),
          end_time: editing.ended_at ? toTimeInput(editing.ended_at, tz) : toTimeInput(editing.started_at, tz),
          notes: editing.notes ?? "",
          task_occurrence_id: editing.task_occurrence_id ?? "",
        }
      : {
          title: "",
          category_id: categories[0]?.id ?? "",
          pillar: "",
          date: defaultDate,
          start_time: "",
          end_time: "",
          notes: "",
          task_occurrence_id: "",
        },
  });
  const { register, control, formState } = form;
  const errors = formState.errors;
  const date = useWatch({ control, name: "date" });
  const start = useWatch({ control, name: "start_time" });
  const end = useWatch({ control, name: "end_time" });

  let durationHint: string | undefined;
  if (start && end && /^\d{2}:\d{2}/.test(start) && /^\d{2}:\d{2}/.test(end)) {
    const rel = (t: string) => (timeToMinutes(t) - dayStart + 1440) % 1440;
    let d = rel(end) - rel(start);
    if (d <= 0) d += 1440;
    durationHint = `${Math.floor(d / 60)}h ${d % 60}m`;
  }

  const onSubmit = form.handleSubmit(() => {
    const v = form.getValues();
    run(
      () =>
        editing
          ? updateActivity(editing.id, { ...v, end_time: running ? null : v.end_time })
          : createActivity(v),
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? (running ? "Edit running timer" : "Edit activity") : "Log activity"}</DialogTitle>
        <DialogDescription>
          Times are on your productivity day of {date ? formatLongDate(date) : "-"} (starts {minutesToTime(dayStart)}). An
          entry after midnight belongs to the same day.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        <Field label="Title" htmlFor="act-title" error={errors.title?.message}>
          <Input id="act-title" autoFocus placeholder="e.g. Product research" {...register("title")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" error={errors.category_id?.message}>
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <SimpleSelect
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Category"
                />
              )}
            />
          </Field>
          <Field label="Pillar (optional)">
            <Controller
              control={control}
              name="pillar"
              render={({ field }) => (
                <SimpleSelect
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  allowNone
                  noneLabel="No pillar"
                  options={(["health", "finance", "growth"] as Pillar[]).map((p) => ({ value: p, label: PILLAR_LABEL[p] }))}
                />
              )}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Productivity day" htmlFor="act-date" error={errors.date?.message} className="col-span-3 sm:col-span-1">
            <Input id="act-date" type="date" {...register("date")} />
          </Field>
          <Field label="Start" htmlFor="act-start" error={errors.start_time?.message}>
            <Input id="act-start" type="time" {...register("start_time")} />
          </Field>
          <Field
            label="End"
            htmlFor="act-end"
            error={errors.end_time?.message}
            hint={running ? "Still running" : durationHint}
          >
            <Input id="act-end" type="time" disabled={running} {...register("end_time")} />
          </Field>
        </div>
        {tasks.length ? (
          <Field label="Linked task (optional)">
            <Controller
              control={control}
              name="task_occurrence_id"
              render={({ field }) => (
                <SimpleSelect
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  allowNone
                  noneLabel="No linked task"
                  options={tasks.map((t) => ({ value: t.id, label: t.title }))}
                />
              )}
            />
          </Field>
        ) : null}
        <Field label="Notes" htmlFor="act-notes">
          <Textarea id="act-notes" rows={2} {...register("notes")} />
        </Field>
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {editing ? "Save" : "Log activity"}
        </Button>
      </DialogFooter>
    </form>
  );
}

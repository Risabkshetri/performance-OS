"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Chips, Field, Segmented, SimpleSelect, submitOnModEnter, WeekdayPicker } from "@/components/shared/form-bits";
import { PILLAR_META } from "@/components/shared/indicators";
import { taskSchema, type TaskInput } from "@/lib/validations";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { useAction } from "@/hooks/use-action";
import { addDays } from "@/lib/date/productivity-day";
import { HORIZON_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { GoalOption } from "@/lib/data/queries";
import type { PlannedTask, Pillar, Priority } from "@/types/domain";
import { cn } from "@/lib/utils";

type FormValues = z.input<typeof taskSchema>;

export interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: GoalOption[];
  today: string;
  defaultDate?: string;
  defaultPriority: Priority;
  editing?: PlannedTask | null;
}

function initialValues(p: TaskFormProps): FormValues {
  const e = p.editing;
  if (e) {
    const r = e.task.recurrence;
    return {
      title: e.task.title,
      description: e.task.description ?? "",
      pillar: e.task.pillar,
      priority: e.task.priority,
      scheduled_date: e.scheduled_date,
      planned_start: e.planned_start?.slice(0, 5) ?? "",
      planned_end: e.planned_end?.slice(0, 5) ?? "",
      estimated_minutes: e.task.estimated_minutes ?? null,
      goal_id: e.task.goal_id ?? null,
      repeat: {
        type: r ? r.type : "none",
        weekdays: r?.type === "weekly" ? r.weekdays : [],
        every: r?.type === "interval" ? r.every : 2,
        until: e.task.recurrence_end ?? "",
      },
    };
  }
  return {
    title: "",
    description: "",
    pillar: "growth",
    priority: p.defaultPriority,
    scheduled_date: p.defaultDate ?? p.today,
    planned_start: "",
    planned_end: "",
    estimated_minutes: null,
    goal_id: null,
    repeat: { type: "none", weekdays: [], every: 2, until: "" },
  };
}

export function TaskFormDialog(props: TaskFormProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open ? <TaskForm key={props.editing?.id ?? "new"} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm(props: TaskFormProps) {
  const { editing, today, goals, onOpenChange } = props;
  const isRecurringEdit = Boolean(editing?.task.recurrence);
  const defaults = initialValues(props);
  const hasDetails = Boolean(
    editing &&
      (defaults.planned_start || defaults.goal_id || isRecurringEdit),
  );
  const [showMore, setShowMore] = useState(hasDetails);
  const { pending, run } = useAction();

  const form = useForm<FormValues, unknown, z.output<typeof taskSchema>>({ resolver: zodResolver(taskSchema), defaultValues: defaults, mode: "onSubmit" });
  const { register, control, setValue, formState } = form;
  const errors = formState.errors;
  const date = useWatch({ control, name: "scheduled_date" });
  const repeatType = useWatch({ control, name: "repeat.type" });

  const onSubmit = form.handleSubmit(() => {
    const values = form.getValues() as TaskInput;
    run(() => (editing ? updateTask(editing.id, values) : createTask(values)), {
      onSuccess: () => onOpenChange(false),
    });
  });

  const quickDates = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
  ];

  const estimate = useWatch({ control, name: "estimated_minutes" });

  return (
    <form onSubmit={onSubmit} noValidate {...submitOnModEnter}>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
        {isRecurringEdit ? (
          <DialogDescription>Applies to this and future occurrences.</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">Plan a task</DialogDescription>
        )}
      </DialogHeader>

      <div className="mt-4 space-y-5">
        {/* Title + notes read as one writing surface */}
        <div className="rounded-xl border bg-background/60 px-3.5 py-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15">
          <input
            id="task-title"
            autoFocus
            placeholder="What do you want to get done?"
            aria-label="Title"
            aria-invalid={!!errors.title}
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-subtle-foreground"
            {...register("title")}
          />
          <textarea
            id="task-desc"
            placeholder="Add details…"
            aria-label="Details"
            rows={1}
            className="mt-1 max-h-48 min-h-6 w-full resize-none bg-transparent text-sm leading-relaxed text-muted-foreground outline-none field-sizing-content placeholder:text-subtle-foreground focus:text-foreground"
            {...register("description")}
          />
        </div>
        {errors.title?.message ? (
          <p role="alert" className="-mt-3 text-xs text-destructive">
            {errors.title.message}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pillar">
            <Controller
              control={control}
              name="pillar"
              render={({ field }) => (
                <Segmented<Pillar>
                  ariaLabel="Pillar"
                  value={field.value}
                  onChange={field.onChange}
                  options={(["health", "finance", "growth"] as Pillar[]).map((p) => ({
                    value: p,
                    label: PILLAR_LABEL[p],
                    className: PILLAR_META[p].text,
                  }))}
                />
              )}
            />
          </Field>
          <Field label="Priority">
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Segmented<Priority>
                  ariaLabel="Priority"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" },
                  ]}
                />
              )}
            />
          </Field>
        </div>

        <Field label={repeatType !== "none" ? "Starts" : "When"} htmlFor="task-date" error={errors.scheduled_date?.message}>
          <div className="flex flex-wrap items-center gap-1.5">
            {!isRecurringEdit &&
              quickDates.map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  size="sm"
                  variant={date === q.value ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => setValue("scheduled_date", q.value, { shouldDirty: true })}
                >
                  {q.label}
                </Button>
              ))}
            <Input id="task-date" type="date" className="h-8 w-auto" disabled={isRecurringEdit} {...register("scheduled_date")} />
          </div>
        </Field>

        <Field label="Estimate" error={errors.estimated_minutes?.message}>
          <Chips<number>
            ariaLabel="Estimate"
            value={Number.isFinite(estimate) ? (estimate as number) : null}
            onChange={(v) => setValue("estimated_minutes", v, { shouldDirty: true })}
            options={[15, 30, 45, 60, 90, 120].map((m) => ({ value: m, label: m < 60 ? `${m}m` : `${m / 60}h` }))}
          />
        </Field>

        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={showMore}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", showMore && "rotate-180")} />
          {showMore ? "Less" : "Time, repeat & goal"}
        </button>

        {showMore ? (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start" htmlFor="task-start" error={errors.planned_start?.message}>
                <Input id="task-start" type="time" {...register("planned_start")} />
              </Field>
              <Field label="End" htmlFor="task-end" error={errors.planned_end?.message}>
                <Input id="task-end" type="time" {...register("planned_end")} />
              </Field>
            </div>

            <Field label="Repeat" error={errors.repeat?.weekdays?.message ?? errors.repeat?.until?.message}>
              <Controller
                control={control}
                name="repeat.type"
                render={({ field }) => (
                  <Segmented
                    ariaLabel="Repeat"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "none", label: "Once" },
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekdays" },
                      { value: "interval", label: "Every N days" },
                    ]}
                  />
                )}
              />
              {repeatType === "weekly" ? (
                <div className="pt-2">
                  <Controller
                    control={control}
                    name="repeat.weekdays"
                    render={({ field }) => <WeekdayPicker value={field.value ?? []} onChange={field.onChange} />}
                  />
                </div>
              ) : null}
              {repeatType === "interval" ? (
                <div className="flex items-center gap-2 pt-2 text-sm">
                  Every
                  <Input type="number" min={1} max={365} className="w-20" {...register("repeat.every", { valueAsNumber: true })} />
                  days
                </div>
              ) : null}
              {repeatType !== "none" ? (
                <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                  Until
                  <Input type="date" className="w-auto" aria-label="Repeat until (optional)" {...register("repeat.until")} />
                </div>
              ) : null}
            </Field>

            <Field label="Goal">
              <Controller
                control={control}
                name="goal_id"
                render={({ field }) => (
                  <SimpleSelect
                    value={field.value ?? null}
                    onChange={field.onChange}
                    allowNone
                    noneLabel="No goal"
                    options={goals.map((g) => ({ value: g.id, label: `${g.title} · ${HORIZON_LABEL[g.horizon]}` }))}
                  />
                )}
              />
            </Field>
          </div>
        ) : null}
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {editing ? "Save" : "Add task"}
          <kbd className="ml-1 hidden text-[10px] opacity-60 sm:inline">⌘↵</kbd>
        </Button>
      </DialogFooter>
    </form>
  );
}

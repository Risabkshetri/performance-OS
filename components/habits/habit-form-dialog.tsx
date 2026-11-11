"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Segmented, submitOnModEnter, WeekdayPicker } from "@/components/shared/form-bits";
import { PILLAR_META } from "@/components/shared/indicators";
import { habitSchema } from "@/lib/validations";
import { createHabit, updateHabit } from "@/lib/actions/habits";
import { useAction } from "@/hooks/use-action";
import { PILLAR_LABEL } from "@/lib/format";
import type { Habit, Pillar } from "@/types/domain";

type Values = z.input<typeof habitSchema>;

export function HabitFormDialog({
  open,
  onOpenChange,
  editing,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Habit | null;
  today: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <HabitForm key={editing?.id ?? "new"} editing={editing} today={today} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function HabitForm({ editing, today, onDone }: { editing?: Habit | null; today: string; onDone: () => void }) {
  const { pending, run } = useAction();
  const form = useForm<Values, unknown, z.output<typeof habitSchema>>({
    resolver: zodResolver(habitSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          description: editing.description ?? "",
          kind: editing.kind,
          pillar: editing.pillar,
          tracking: editing.tracking,
          unit: editing.unit ?? "",
          target_value: editing.target_value,
          target_direction: editing.target_direction,
          frequency_type: editing.frequency.type,
          weekdays: editing.frequency.type === "weekly" ? editing.frequency.weekdays : [],
          start_date: editing.start_date,
        }
      : {
          name: "",
          description: "",
          kind: "good",
          pillar: "health",
          tracking: "binary",
          unit: "",
          target_value: null,
          target_direction: "min",
          frequency_type: "daily",
          weekdays: [1, 2, 3, 4, 5],
          start_date: today,
        },
  });
  const { control, register, setValue, formState } = form;
  const errors = formState.errors;
  const kind = useWatch({ control, name: "kind" });
  const tracking = useWatch({ control, name: "tracking" });
  const freq = useWatch({ control, name: "frequency_type" });

  return (
    <form
      noValidate
      {...submitOnModEnter}
      onSubmit={form.handleSubmit(() => {
        const v = form.getValues();
        run(() => (editing ? updateHabit(editing.id, v) : createHabit(v)), { onSuccess: onDone });
      })}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Edit habit" : "New habit"}</DialogTitle>
        <DialogDescription className={editing ? undefined : "sr-only"}>
          {editing ? "Past check-ins keep their original target." : "New habit"}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border bg-background/60 px-3.5 py-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15">
          <input
            id="habit-name"
            autoFocus
            aria-label="Habit"
            aria-invalid={!!errors.name}
            placeholder={kind === "good" ? "Gym, Reading, Meditation…" : "Screen time, Late-night scrolling…"}
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-subtle-foreground"
            {...register("name")}
          />
          <textarea
            id="habit-desc"
            rows={1}
            aria-label="Why it matters"
            placeholder="Why it matters…"
            className="mt-1 max-h-40 min-h-6 w-full resize-none bg-transparent text-sm leading-relaxed text-muted-foreground outline-none field-sizing-content placeholder:text-subtle-foreground focus:text-foreground"
            {...register("description")}
          />
        </div>
        {errors.name?.message ? (
          <p role="alert" className="-mt-2 text-xs text-destructive">
            {errors.name.message}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Segmented
                  ariaLabel="Habit type"
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    setValue("target_direction", v === "bad" ? "max" : "min");
                  }}
                  options={[
                    { value: "good", label: "Build (good)" },
                    { value: "bad", label: "Reduce (bad)" },
                  ]}
                />
              )}
            />
          </Field>
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
        </div>

        <Field label="Tracking">
          <Controller
            control={control}
            name="tracking"
            render={({ field }) => (
              <Segmented
                ariaLabel="Tracking"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "binary", label: kind === "good" ? "Done / not done" : "Avoided / slipped" },
                  { value: "numeric", label: "Measured value" },
                ]}
              />
            )}
          />
        </Field>

        {tracking === "numeric" ? (
          <div className="grid grid-cols-2 items-start gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-[auto_1fr_1fr]">
            <Field label="Target" error={errors.target_direction?.message} className="col-span-2 sm:col-span-1">
              <Controller
                control={control}
                name="target_direction"
                render={({ field }) => (
                  <Segmented
                    ariaLabel="Target direction"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    options={[
                      { value: "min", label: "At least" },
                      { value: "max", label: "At most" },
                    ]}
                  />
                )}
              />
            </Field>
            <Field label="Value" htmlFor="habit-target" error={errors.target_value?.message}>
              <Input id="habit-target" type="number" min={0} step="any" {...register("target_value", { valueAsNumber: true })} />
            </Field>
            <Field label="Unit" htmlFor="habit-unit">
              <Input id="habit-unit" placeholder="min" {...register("unit")} />
            </Field>
          </div>
        ) : null}

        <Field label="Frequency" error={errors.weekdays?.message}>
          <Controller
            control={control}
            name="frequency_type"
            render={({ field }) => (
              <Segmented
                ariaLabel="Frequency"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "daily", label: "Every day" },
                  { value: "weekly", label: "Specific days" },
                ]}
              />
            )}
          />
          {freq === "weekly" ? (
            <div className="pt-2">
              <Controller
                control={control}
                name="weekdays"
                render={({ field }) => <WeekdayPicker value={field.value ?? []} onChange={field.onChange} />}
              />
            </div>
          ) : null}
        </Field>

        <Field label="Starts" htmlFor="habit-start" error={errors.start_date?.message}>
          <Input id="habit-start" type="date" className="w-auto" {...register("start_date")} />
        </Field>
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {editing ? "Save" : "Create habit"}
        </Button>
      </DialogFooter>
    </form>
  );
}

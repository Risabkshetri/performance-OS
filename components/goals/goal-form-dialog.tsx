"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Segmented, SimpleSelect, submitOnModEnter } from "@/components/shared/form-bits";
import { PILLAR_META } from "@/components/shared/indicators";
import { goalSchema } from "@/lib/validations";
import { createGoal, updateGoal } from "@/lib/actions/goals";
import { useAction } from "@/hooks/use-action";
import { addDays } from "@/lib/date/productivity-day";
import { HORIZON_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { Goal, GoalHorizon, Pillar } from "@/types/domain";

type Values = z.input<typeof goalSchema>;

const HORIZON_DAYS: Record<GoalHorizon, number> = { daily: 0, monthly: 30, six_month: 182, yearly: 365 };

export function GoalFormDialog({
  open,
  onOpenChange,
  editing,
  today,
  defaultHorizon = "monthly",
  defaultPillar = "growth",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Goal | null;
  today: string;
  defaultHorizon?: GoalHorizon;
  defaultPillar?: Pillar;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <GoalForm
            key={editing?.id ?? "new"}
            editing={editing}
            today={today}
            defaultHorizon={defaultHorizon}
            defaultPillar={defaultPillar}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({
  editing,
  today,
  defaultHorizon,
  defaultPillar,
  onDone,
}: {
  editing?: Goal | null;
  today: string;
  defaultHorizon: GoalHorizon;
  defaultPillar: Pillar;
  onDone: () => void;
}) {
  const { pending, run } = useAction();
  const [numeric, setNumeric] = useState(Boolean(editing?.target_value));
  const form = useForm<Values, unknown, z.output<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: editing
      ? {
          title: editing.title,
          description: editing.description ?? "",
          pillar: editing.pillar,
          horizon: editing.horizon,
          start_date: editing.start_date,
          deadline: editing.deadline ?? "",
          target_value: editing.target_value,
          current_value: editing.current_value,
          unit: editing.unit ?? "",
          manual_progress: editing.manual_progress,
          status: editing.status,
          notes: editing.notes ?? "",
        }
      : {
          title: "",
          description: "",
          pillar: defaultPillar,
          horizon: defaultHorizon,
          start_date: today,
          deadline: addDays(today, HORIZON_DAYS[defaultHorizon]),
          target_value: null,
          current_value: null,
          unit: "",
          manual_progress: 0,
          status: "active",
          notes: "",
        },
  });
  const { control, register, setValue, formState } = form;
  const errors = formState.errors;

  return (
    <form
      noValidate
      {...submitOnModEnter}
      onSubmit={form.handleSubmit(() => {
        const v = form.getValues();
        const payload = numeric ? v : { ...v, target_value: null, current_value: null, unit: "" };
        run(() => (editing ? updateGoal(editing.id, payload) : createGoal(payload)), { onSuccess: onDone });
      })}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Edit goal" : "New goal"}</DialogTitle>
        <DialogDescription className="sr-only">Goal details</DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border bg-background/60 px-3.5 py-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15">
          <input
            id="goal-title"
            autoFocus
            aria-label="Goal"
            aria-invalid={!!errors.title}
            placeholder="What do you want to achieve?"
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-subtle-foreground"
            {...register("title")}
          />
          <textarea
            id="goal-desc"
            rows={1}
            aria-label="Description"
            placeholder="Why it matters, what success looks like…"
            className="mt-1 max-h-40 min-h-6 w-full resize-none bg-transparent text-sm leading-relaxed text-muted-foreground outline-none field-sizing-content placeholder:text-subtle-foreground focus:text-foreground"
            {...register("description")}
          />
        </div>
        {errors.title?.message ? (
          <p role="alert" className="-mt-2 text-xs text-destructive">
            {errors.title.message}
          </p>
        ) : null}
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
        <Field label="Horizon">
          <Controller
            control={control}
            name="horizon"
            render={({ field }) => (
              <Segmented<GoalHorizon>
                ariaLabel="Horizon"
                value={field.value}
                onChange={(h) => {
                  field.onChange(h);
                  if (!editing) setValue("deadline", addDays(form.getValues("start_date"), HORIZON_DAYS[h]));
                }}
                options={(Object.keys(HORIZON_LABEL) as GoalHorizon[]).map((h) => ({ value: h, label: HORIZON_LABEL[h] }))}
              />
            )}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" htmlFor="goal-start" error={errors.start_date?.message}>
            <Input id="goal-start" type="date" {...register("start_date")} />
          </Field>
          <Field label="Deadline" htmlFor="goal-deadline" error={errors.deadline?.message}>
            <Input id="goal-deadline" type="date" {...register("deadline")} />
          </Field>
        </div>

        <Field label="Track by">
          <Segmented
            ariaLabel="Measurement"
            value={numeric ? "numeric" : "qualitative"}
            onChange={(v) => setNumeric(v === "numeric")}
            options={[
              { value: "qualitative", label: "Milestones" },
              { value: "numeric", label: "Number" },
            ]}
          />
        </Field>
        {numeric ? (
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-dashed p-3">
            <Field label="Current" htmlFor="goal-current">
              <Input id="goal-current" type="number" step="any" {...register("current_value", { valueAsNumber: true })} />
            </Field>
            <Field label="Target" htmlFor="goal-target" error={errors.target_value?.message}>
              <Input id="goal-target" type="number" step="any" {...register("target_value", { valueAsNumber: true })} />
            </Field>
            <Field label="Unit" htmlFor="goal-unit">
              <Input id="goal-unit" placeholder="kg, ₹, clients" {...register("unit")} />
            </Field>
          </div>
        ) : null}

        {editing ? (
          <Field label="Status">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <SimpleSelect
                  value={field.value ?? "active"}
                  onChange={(v) => field.onChange(v ?? "active")}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "completed", label: "Completed" },
                    { value: "abandoned", label: "Abandoned" },
                  ]}
                />
              )}
            />
          </Field>
        ) : null}

        <Field label="Notes" htmlFor="goal-notes">
          <Textarea id="goal-notes" rows={1} placeholder="Anything to remember…" className="min-h-9 field-sizing-content" {...register("notes")} />
        </Field>
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {editing ? "Save" : "Create goal"}
        </Button>
      </DialogFooter>
    </form>
  );
}

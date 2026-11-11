"use client";

import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useTheme } from "next-themes";
import { Loader2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Segmented } from "@/components/shared/form-bits";
import { useAction } from "@/hooks/use-action";
import { saveSettings } from "@/lib/actions/misc";
import { settingsSchema } from "@/lib/validations";
import { DEFAULT_WEIGHTS } from "@/lib/calculations/score";
import type { Profile, ThemePreference } from "@/types/domain";

type Values = z.input<typeof settingsSchema>;

const WEIGHT_FIELDS = [
  { key: "tasks", label: "Task completion" },
  { key: "goodHabits", label: "Good habit consistency" },
  { key: "badHabits", label: "Reduction target compliance" },
  { key: "review", label: "Daily review completed" },
] as const;

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b py-6 first:pt-0 last:border-0 md:grid-cols-3 md:gap-8">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4 md:col-span-2">{children}</div>
    </section>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export function SettingsForm({ profile, email }: { profile: Profile; email: string | null }) {
  const { setTheme } = useTheme();
  const { pending, run } = useAction();
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [profile.timezone ?? "UTC"];
    }
  }, [profile.timezone]);

  const form = useForm<Values, unknown, z.output<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      display_name: profile.display_name ?? "",
      timezone: profile.timezone ?? "UTC",
      day_start: `${pad(Math.floor(profile.day_start_minutes / 60))}:${pad(profile.day_start_minutes % 60)}`,
      week_starts_on: profile.week_starts_on,
      theme: profile.theme,
      default_task_priority: profile.default_task_priority,
      score_weights: profile.score_weights,
    },
  });
  const { register, control, setValue, formState } = form;
  const errors = formState.errors;
  const weights = useWatch({ control, name: "score_weights" });
  const total = WEIGHT_FIELDS.reduce((s, f) => s + (Number(weights?.[f.key]) || 0), 0);
  const tz = useWatch({ control, name: "timezone" });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(() => {
        const v = form.getValues();
        run(() => saveSettings(v), { onSuccess: () => setTheme(v.theme) });
      })}
    >
      <Section title="Profile" description="How you're greeted. Your email is used only to sign in.">
        <Field label="Display name" htmlFor="name" error={errors.display_name?.message}>
          <Input id="name" {...register("display_name")} className="max-w-sm" />
        </Field>
        {email ? <p className="text-xs text-muted-foreground">Signed in as {email}</p> : null}
      </Section>

      <Section
        title="Productivity day"
        description="Your day runs from this time until the same time tomorrow. Work at 1 AM counts toward the previous day. No working hours are enforced."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Timezone"
            htmlFor="tz"
            error={errors.timezone?.message}
            hint={!profile.timezone ? "Detected from your browser" : undefined}
          >
            <div className="flex gap-2">
              <select
                id="tz"
                {...register("timezone")}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {!zones.includes(tz) ? <option value={tz}>{tz}</option> : null}
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Use browser timezone"
                title="Use browser timezone"
                onClick={() => setValue("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone, { shouldDirty: true })}
              >
                <LocateFixed />
              </Button>
            </div>
          </Field>
          <Field
            label="Day starts at"
            htmlFor="day-start"
            error={errors.day_start?.message}
            hint="Changing this affects new entries; existing records keep the day they were logged on."
          >
            <div className="flex items-center gap-2">
              <Input id="day-start" type="time" className="w-32" {...register("day_start")} />
              {["04:00", "05:00", "06:00"].map((t) => (
                <Button key={t} type="button" variant="ghost" size="sm" onClick={() => setValue("day_start", t, { shouldDirty: true })}>
                  {t.replace(/^0/, "")}
                </Button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Week starts on" hint="Used for the weekly planner and weekly habit consistency.">
          <Controller
            control={control}
            name="week_starts_on"
            render={({ field }) => (
              <Segmented<0 | 1>
                ariaLabel="Week starts on"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 1, label: "Monday" },
                  { value: 0, label: "Sunday" },
                ]}
              />
            )}
          />
        </Field>
      </Section>

      <Section title="Appearance" description="Saved to your account and applied on every device.">
        <Controller
          control={control}
          name="theme"
          render={({ field }) => (
            <Segmented<ThemePreference>
              ariaLabel="Theme"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          )}
        />
      </Section>

      <Section title="Tasks" description="Defaults for new tasks.">
        <Field label="Default priority">
          <Controller
            control={control}
            name="default_task_priority"
            render={({ field }) => (
              <Segmented
                ariaLabel="Default priority"
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
      </Section>

      <Section
        title="Execution score"
        description="Relative weights of each component. Components with nothing scheduled on a day are excluded and the rest are rescaled, so quiet days aren't penalised."
      >
        <div className="space-y-2">
          {WEIGHT_FIELDS.map((f) => {
            const w = Number(weights?.[f.key]) || 0;
            return (
              <div key={f.key} className="flex items-center gap-3">
                <label htmlFor={`w-${f.key}`} className="flex-1 text-sm">
                  {f.label}
                </label>
                <Input
                  id={`w-${f.key}`}
                  type="number"
                  min={0}
                  max={100}
                  className="w-20 text-right tabular"
                  {...register(`score_weights.${f.key}`, { valueAsNumber: true })}
                />
                <span className="w-12 text-right text-xs text-muted-foreground tabular">
                  {total ? `${Math.round((w / total) * 100)}%` : "-"}
                </span>
              </div>
            );
          })}
        </div>
        {errors.score_weights ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.score_weights.tasks?.message ?? "Weights must be whole numbers from 0 to 100."}
          </p>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={() => setValue("score_weights", DEFAULT_WEIGHTS, { shouldDirty: true })}>
          Reset to 50 / 25 / 15 / 10
        </Button>
      </Section>

      <div className="sticky bottom-16 flex justify-end border-t bg-background/90 py-3 backdrop-blur lg:bottom-0">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save settings
        </Button>
      </div>
    </form>
  );
}

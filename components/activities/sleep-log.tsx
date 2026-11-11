"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, Moon, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Segmented } from "@/components/shared/form-bits";
import { EmptyState } from "@/components/shared/layout-bits";
import { useAction } from "@/hooks/use-action";
import { deleteSleep, logSleep, updateSleep } from "@/lib/actions/activities";
import { sleepSchema } from "@/lib/validations";
import { formatClock, formatDuration, formatShortDate, toTimeInput } from "@/lib/format";
import type { SleepLog } from "@/types/domain";

type Values = z.input<typeof sleepSchema>;
const QUALITY = ["Poor", "Fair", "OK", "Good", "Great"];

export function SleepLogPanel({ logs, tz, today }: { logs: SleepLog[]; tz: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SleepLog | null>(null);
  const { run, pending } = useAction();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Recovery, not productivity. Sleep never adds to your score.</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Log sleep
        </Button>
      </div>
      {logs.length ? (
        <ul className="divide-y">
          {logs.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{formatShortDate(s.wake_date)}</span>
                <span className="block tabular">
                  {formatClock(s.slept_at, tz)} → {formatClock(s.woke_at, tz)}
                </span>
              </span>
              {s.quality ? <span className="hidden text-xs text-muted-foreground sm:inline">{QUALITY[s.quality - 1]}</span> : null}
              <span className="w-16 shrink-0 text-right font-medium tabular">
                {formatDuration((Date.parse(s.woke_at) - Date.parse(s.slept_at)) / 60000)}
              </span>
              <span className="flex shrink-0 text-subtle-foreground">
                <Button variant="ghost" size="icon-xs" className="touch:size-9" aria-label="Edit sleep entry" onClick={() => setEditing(s)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs" className="touch:size-9"
                  aria-label="Delete sleep entry"
                  disabled={pending}
                  onClick={() => run(() => deleteSleep(s.id))}
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={Moon} title="No sleep logged" description="Log when you slept and woke up to track recovery." />
      )}

      <Dialog
        open={open || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {open || editing ? (
            <SleepForm
              key={editing?.id ?? "new"}
              editing={editing}
              tz={tz}
              today={today}
              onDone={() => {
                setOpen(false);
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SleepForm({ editing, tz, today, onDone }: { editing: SleepLog | null; tz: string; today: string; onDone: () => void }) {
  const { pending, run } = useAction();
  const form = useForm<Values, unknown, z.output<typeof sleepSchema>>({
    resolver: zodResolver(sleepSchema),
    defaultValues: editing
      ? {
          wake_date: editing.wake_date,
          sleep_time: toTimeInput(editing.slept_at, tz),
          wake_time: toTimeInput(editing.woke_at, tz),
          quality: editing.quality,
          notes: editing.notes ?? "",
        }
      : { wake_date: today, sleep_time: "23:00", wake_time: "07:00", quality: null, notes: "" },
  });
  const errors = form.formState.errors;
  const quality = useWatch({ control: form.control, name: "quality" });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(() => {
        const v = form.getValues();
        run(() => (editing ? updateSleep(editing.id, v) : logSleep(v)), { onSuccess: onDone });
      })}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Edit sleep" : "Log sleep"}</DialogTitle>
        <DialogDescription>A bedtime later than the wake time is read as the night before.</DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        <Field label="Woke up on" htmlFor="wake-date" error={errors.wake_date?.message}>
          <Input id="wake-date" type="date" max={today} {...form.register("wake_date")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fell asleep" htmlFor="sleep-time" error={errors.sleep_time?.message}>
            <Input id="sleep-time" type="time" {...form.register("sleep_time")} />
          </Field>
          <Field label="Woke up" htmlFor="wake-time" error={errors.wake_time?.message}>
            <Input id="wake-time" type="time" {...form.register("wake_time")} />
          </Field>
        </div>
        <Field label="Quality (optional)">
          <Segmented<number>
            ariaLabel="Sleep quality"
            size="sm"
            value={quality ?? null}
            onChange={(v) => form.setValue("quality", v === quality ? null : v)}
            options={QUALITY.map((q, i) => ({ value: i + 1, label: q }))}
          />
        </Field>
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onDone}>
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

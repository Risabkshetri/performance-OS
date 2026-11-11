"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { checkInHabit, clearCheckIn } from "@/lib/actions/habits";
import { evaluateCheckIn } from "@/lib/calculations/habits";
import type { Habit, HabitLog } from "@/types/domain";
import { cn } from "@/lib/utils";

/**
 * One-click check-in.
 *  good + binary → "Done" toggle
 *  bad  + binary → "Avoided" / "Slipped"
 *  numeric       → value input, judged against the target
 */
export function HabitCheckIn({
  habit,
  log,
  date,
  size = "default",
}: {
  habit: Habit;
  log: HabitLog | undefined;
  date: string;
  size?: "default" | "sm";
}) {
  const { pending, run } = useAction();
  const save = (payload: { done?: boolean; value?: number | null }) =>
    run(() => checkInHabit({ habit_id: habit.id, date, ...payload }), { quiet: true });
  const clear = () => run(() => clearCheckIn(habit.id, date), { quiet: true });
  const btn = size === "sm" ? "sm" : "default";

  if (habit.tracking === "numeric") return <NumericCheckIn habit={habit} log={log} date={date} size={size} />;

  if (habit.kind === "good") {
    const done = log?.met === true;
    return (
      <Button
        size={btn}
        variant={done ? "secondary" : "outline"}
        disabled={pending}
        aria-pressed={done}
        onClick={() => (done ? clear() : save({ done: true }))}
        className={cn(done && "text-success")}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        {done ? "Done" : "Mark done"}
      </Button>
    );
  }

  const state = log ? (log.met ? "avoided" : "slipped") : null;
  const seg = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-md font-medium transition-colors disabled:opacity-50 [&_svg]:size-3.5",
      size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm",
      on ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-muted p-0.5" role="group" aria-label={`${habit.name} outcome`}>
      <button
        type="button"
        aria-pressed={state === "avoided"}
        disabled={pending}
        className={cn(seg(state === "avoided"), state === "avoided" && "text-success")}
        onClick={() => (state === "avoided" ? clear() : save({ done: true }))}
      >
        <Check aria-hidden /> Avoided
      </button>
      <button
        type="button"
        aria-pressed={state === "slipped"}
        disabled={pending}
        className={cn(seg(state === "slipped"), state === "slipped" && "text-destructive")}
        onClick={() => (state === "slipped" ? clear() : save({ done: false }))}
      >
        <X aria-hidden /> Slipped
      </button>
    </div>
  );
}

function NumericCheckIn({ habit, log, date, size }: { habit: Habit; log: HabitLog | undefined; date: string; size: "default" | "sm" }) {
  const { pending, run } = useAction();
  const [value, setValue] = useState(log?.value != null ? String(log.value) : "");
  const num = value === "" ? null : Number(value);
  const changed = (log?.value ?? null) !== num;
  const preview =
    num != null && Number.isFinite(num)
      ? evaluateCheckIn("numeric", { value: num }, { value: habit.target_value, direction: habit.target_direction })
      : null;
  const shown = changed ? preview : (log?.met ?? null);

  return (
    <form
      className="inline-flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (num == null || !Number.isFinite(num) || num < 0) return;
        run(() => checkInHabit({ habit_id: habit.id, date, value: num }), { quiet: true });
      }}
    >
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn("text-right tabular", size === "sm" ? "h-7 w-20" : "w-24")}
        aria-label={`${habit.name} value${habit.unit ? ` in ${habit.unit}` : ""}`}
        placeholder="0"
      />
      {habit.unit ? <span className="text-xs text-muted-foreground">{habit.unit}</span> : null}
      {changed ? (
        <Button type="submit" size={size === "sm" ? "sm" : "default"} disabled={pending || num == null}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      ) : shown != null ? (
        <span className={cn("inline-flex items-center gap-0.5 text-xs", shown ? "text-success" : "text-destructive")}>
          {shown ? <Check className="size-3.5" /> : <X className="size-3.5" />}
          {shown ? "On target" : habit.target_direction === "max" ? "Over limit" : "Below target"}
        </span>
      ) : null}
    </form>
  );
}

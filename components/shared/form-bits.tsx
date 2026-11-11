"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Compact single-choice control for small enums (one click, keyboard accessible). */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = "default",
}: {
  value: T | null | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; className?: string }[];
  ariaLabel: string;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex flex-wrap gap-1 rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              size === "sm" ? "h-6 text-xs" : "h-7 text-xs",
              selected ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              o.className && selected ? o.className : null,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** One-click quick picks; clicking the selected chip clears it. */
export function Chips<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  options: { value: T; label: React.ReactNode }[];
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : o.value)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium transition-all active:scale-95",
              on
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Submit the closest form on Ctrl/⌘+Enter. Spread onto a <form>. */
export const submitOnModEnter = {
  onKeyDown: (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  },
};

export const NONE = "__none__";

export function SimpleSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  allowNone,
  noneLabel = "None",
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: { value: string; label: React.ReactNode }[];
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  className?: string;
}) {
  return (
    <Select value={value ?? (allowNone ? NONE : undefined)} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const days = [
    { v: 1, l: "M", n: "Monday" },
    { v: 2, l: "T", n: "Tuesday" },
    { v: 3, l: "W", n: "Wednesday" },
    { v: 4, l: "T", n: "Thursday" },
    { v: 5, l: "F", n: "Friday" },
    { v: 6, l: "S", n: "Saturday" },
    { v: 0, l: "S", n: "Sunday" },
  ];
  return (
    <div className="flex gap-1" role="group" aria-label="Weekdays">
      {days.map((d) => {
        const on = value.includes(d.v);
        return (
          <button
            key={d.v}
            type="button"
            aria-pressed={on}
            aria-label={d.n}
            onClick={() => onChange(on ? value.filter((x) => x !== d.v) : [...value, d.v])}
            className={cn(
              "grid size-8 place-items-center rounded-md border text-xs font-medium transition-colors",
              on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {d.l}
          </button>
        );
      })}
    </div>
  );
}

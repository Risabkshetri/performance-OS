"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitOnModEnter } from "@/components/shared/form-bits";
import { useAction } from "@/hooks/use-action";
import { saveReview } from "@/lib/actions/misc";
import type { DailyReview } from "@/types/domain";
import { cn } from "@/lib/utils";

const PROMPTS = [
  { key: "accomplishments", question: "What went well today?" },
  { key: "incomplete", question: "What didn't get done, and why?" },
  { key: "learnings", question: "What did I learn?" },
  { key: "improvements", question: "What will I do differently tomorrow?" },
] as const;

type Key = (typeof PROMPTS)[number]["key"];

/** Journal paper: a soft tint with ruled lines that scroll with the text. */
export const journalPaper = {
  background: "color-mix(in oklab, var(--primary) 5%, var(--card))",
} as React.CSSProperties;

const LINE = 28; // px, must match leading below
const ruled: React.CSSProperties = {
  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px, color-mix(in oklab, var(--primary) 16%, transparent) ${LINE - 1}px, color-mix(in oklab, var(--primary) 16%, transparent) ${LINE}px)`,
  backgroundAttachment: "local",
  lineHeight: `${LINE}px`,
};

export function ReviewForm({
  date,
  review,
  onSaved,
}: {
  date: string;
  review: DailyReview | null;
  onSaved?: () => void;
}) {
  const initial = Object.fromEntries(PROMPTS.map((p) => [p.key, review?.[p.key] ?? ""])) as Record<Key, string>;
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const { pending, run } = useAction();
  const dirty = PROMPTS.some((p) => values[p.key] !== saved[p.key]);
  const filled = PROMPTS.filter((p) => values[p.key].trim()).length;

  return (
    <form
      {...submitOnModEnter}
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty) return onSaved?.();
        run(() => saveReview({ review_date: date, ...values }), {
          onSuccess: () => {
            setSaved(values);
            onSaved?.();
          },
        });
      }}
    >
      <ol className="space-y-7">
        {PROMPTS.map((p, i) => {
          const done = Boolean(values[p.key].trim());
          return (
            <li key={p.key}>
              <label htmlFor={`rv-${p.key}`} className="flex items-baseline gap-3">
                <span
                  className={cn(
                    "font-display text-sm tabular transition-colors",
                    done ? "text-primary" : "text-subtle-foreground",
                  )}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-lg font-medium leading-snug text-foreground">{p.question}</span>
              </label>
              <textarea
                id={`rv-${p.key}`}
                autoFocus={i === 0 && !review}
                rows={2}
                value={values[p.key]}
                onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
                maxLength={4000}
                style={ruled}
                className="mt-1 block max-h-56 min-h-14 w-full resize-none bg-transparent pl-8 text-[15px] text-foreground outline-none field-sizing-content placeholder:text-subtle-foreground"
                placeholder="Write here…"
              />
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-label={`${filled} of 4 answered`}>
          {PROMPTS.map((p) => (
            <span
              key={p.key}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors duration-300",
                values[p.key].trim() ? "bg-primary" : "bg-[color-mix(in_oklab,var(--primary)_15%,transparent)]",
              )}
            />
          ))}
        </div>
        <Button type="submit" disabled={pending || (!dirty && !onSaved)}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {dirty || !review ? "Save review" : "Close"}
          <kbd className="ml-1 hidden text-[10px] opacity-60 sm:inline">⌘↵</kbd>
        </Button>
      </div>
    </form>
  );
}

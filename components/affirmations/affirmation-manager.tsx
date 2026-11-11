"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Pencil, Plus, Quote, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/layout-bits";
import { Field, Segmented, SimpleSelect } from "@/components/shared/form-bits";
import { PILLAR_META } from "@/components/shared/indicators";
import { cn } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import { featureAffirmation, saveAffirmation, setAffirmationArchived } from "@/lib/actions/misc";
import { HORIZON_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { GoalOption } from "@/lib/data/queries";
import type { Affirmation, GoalHorizon, Pillar } from "@/types/domain";

// Slight, varied tilt so the wall feels hand-placed; never enough to hurt reading.
const TILT = ["-rotate-[1.2deg]", "rotate-[0.8deg]", "-rotate-[0.5deg]", "rotate-[1.4deg]", "rotate-[0.3deg]", "-rotate-[1deg]"];

const paper = (pillar: Pillar) =>
  ({
    "--note": `var(--pillar-${pillar})`,
    "--note-ink": "color-mix(in oklab, var(--note) 55%, var(--foreground))",
    background: "color-mix(in oklab, var(--note) 13%, var(--card))",
  }) as React.CSSProperties;

export function AffirmationManager({
  affirmations,
  archived,
  goals,
}: {
  affirmations: Affirmation[];
  archived: Affirmation[];
  goals: GoalOption[];
}) {
  const [editing, setEditing] = useState<Affirmation | null>(null);
  const [creating, setCreating] = useState(false);
  const [reading, setReading] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { run, pending } = useAction();
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  // Featured note first
  const notes = [...affirmations].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));

  return (
    <>
      {!notes.length ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Quote}
            title="No affirmations yet"
            description="Short, present-tense statements of who you're becoming."
            action={<Button onClick={() => setCreating(true)}>Write one</Button>}
          />
        </div>
      ) : (
        <ul className="grid gap-6 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((a, i) => (
            <li
              key={a.id}
              style={paper(a.pillar)}
              className={cn(
                "group relative flex min-h-52 flex-col rounded-[4px] px-6 pb-5 pt-8 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_24px_-12px_rgb(0_0_0/0.25)] transition-[transform,box-shadow] duration-300 ease-out",
                "hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_2px_4px_rgb(0_0_0/0.06),0_18px_36px_-14px_rgb(0_0_0/0.3)] focus-within:rotate-0 motion-reduce:transition-none",
                TILT[i % TILT.length],
              )}
            >
              {/* tape */}
              <span
                aria-hidden
                className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-[-2deg] rounded-[2px] bg-[color-mix(in_oklab,var(--card)_70%,transparent)] shadow-[0_1px_2px_rgb(0_0_0/0.08)] backdrop-blur-[1px]"
              />
              {/* whole note opens the reader */}
              <button
                type="button"
                onClick={() => setReading(i)}
                className="absolute inset-0 z-0 rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                aria-label={`Read: ${a.text}`}
              />
              <p className="pointer-events-none relative font-display text-xl font-medium leading-snug text-foreground text-pretty">
                {a.text}
              </p>
              <div className="pointer-events-none relative mt-auto flex items-center gap-2 pt-5 text-xs">
                <span className="font-medium" style={{ color: "var(--note-ink)" }}>
                  {PILLAR_LABEL[a.pillar]}
                </span>
                {a.horizon ? <span className="text-muted-foreground">· {HORIZON_LABEL[a.horizon]}</span> : null}
                {a.is_featured ? <Star className="ml-auto size-3.5 fill-current text-primary" aria-label="On your overview" /> : null}
              </div>
              <div className="absolute right-1.5 top-1.5 z-10 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
                <NoteMenu
                  a={a}
                  pending={pending}
                  onEdit={() => setEditing(a)}
                  onFeature={() => run(() => featureAffirmation(a.id, !a.is_featured))}
                  onArchive={() => run(() => setAffirmationArchived(a.id, true))}
                />
              </div>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-full min-h-52 w-full flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="size-5" aria-hidden />
              New affirmation
            </button>
          </li>
        </ul>
      )}

      {archived.length ? (
        <div className="mt-10">
          <button
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowArchived((s) => !s)}
            aria-expanded={showArchived}
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived ? (
            <ul className="mt-2 divide-y rounded-xl border bg-card">
              {archived.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="truncate text-muted-foreground">{a.text}</span>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setAffirmationArchived(a.id, false))}>
                    <ArchiveRestore /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Reader
        notes={notes}
        index={reading}
        onIndex={setReading}
        goalTitle={goalTitle}
        onEdit={(a) => {
          setReading(null);
          setEditing(a);
        }}
      />

      <Dialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {creating || editing ? (
            <AffirmationForm
              key={editing?.id ?? "new"}
              editing={editing}
              goals={goals}
              onDone={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function NoteMenu({
  a,
  pending,
  onEdit,
  onFeature,
  onArchive,
}: {
  a: Affirmation;
  pending: boolean;
  onEdit: () => void;
  onFeature: () => void;
  onArchive: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Affirmation actions" disabled={pending} className="touch:size-9 hover:bg-black/5 dark:hover:bg-white/10">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onFeature}>
          {a.is_featured ? <StarOff /> : <Star />}
          {a.is_featured ? "Use daily rotation" : "Show on overview"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onArchive}>
          <Archive /> Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Opens a note as a full page to read; ← / → flip between notes. */
function Reader({
  notes,
  index,
  onIndex,
  goalTitle,
  onEdit,
}: {
  notes: Affirmation[];
  index: number | null;
  onIndex: (i: number | null) => void;
  goalTitle: Map<string, string>;
  onEdit: (a: Affirmation) => void;
}) {
  const a = index == null ? null : notes[index];
  const go = (d: number) => index != null && onIndex((index + d + notes.length) % notes.length);

  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent
        className="border-0 p-0 sm:max-w-2xl"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {a ? (
          <div key={a.id} style={paper(a.pillar)} className="flex min-h-[24rem] flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 sm:px-14 sm:pt-14">
            <DialogHeader className="sr-only">
              <DialogTitle>Affirmation</DialogTitle>
              <DialogDescription>{PILLAR_LABEL[a.pillar]}</DialogDescription>
            </DialogHeader>
            <Quote className="size-7 opacity-60" style={{ color: "var(--note)" }} aria-hidden />
            <p className="my-auto py-6 font-display text-3xl font-medium leading-[1.25] tracking-[-0.01em] text-foreground text-balance sm:text-4xl">
              {a.text}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[color-mix(in_oklab,var(--note)_25%,transparent)] pt-4 text-sm">
              <span className="font-medium" style={{ color: "var(--note-ink)" }}>
                {PILLAR_LABEL[a.pillar]}
              </span>
              {a.horizon ? <span className="text-muted-foreground">{HORIZON_LABEL[a.horizon]}</span> : null}
              {a.goal_id && goalTitle.get(a.goal_id) ? <span className="truncate text-muted-foreground">→ {goalTitle.get(a.goal_id)}</span> : null}
              <span className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(a)}>
                  <Pencil /> Edit
                </Button>
                {notes.length > 1 ? (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={() => go(-1)}>
                      <ChevronLeft />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular">
                      {(index ?? 0) + 1}/{notes.length}
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={() => go(1)}>
                      <ChevronRight />
                    </Button>
                  </>
                ) : null}
              </span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AffirmationForm({ editing, goals, onDone }: { editing: Affirmation | null; goals: GoalOption[]; onDone: () => void }) {
  const { run, pending } = useAction();
  const [text, setText] = useState(editing?.text ?? "");
  const [pillar, setPillar] = useState<Pillar>(editing?.pillar ?? "growth");
  const [horizon, setHorizon] = useState<GoalHorizon | null>(editing?.horizon ?? null);
  const [goalId, setGoalId] = useState<string | null>(editing?.goal_id ?? null);
  const pillarGoals = goals.filter((g) => g.pillar === pillar);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveAffirmation(editing?.id ?? null, { text, pillar, horizon, goal_id: goalId }), { onSuccess: onDone });
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Edit affirmation" : "New affirmation"}</DialogTitle>
        <DialogDescription>Present tense, personal, specific.</DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        <div style={paper(pillar)} className="rounded-[4px] px-5 py-4 shadow-[0_8px_20px_-12px_rgb(0_0_0/0.25)] transition-colors">
          <textarea
            id="aff-text"
            rows={3}
            autoFocus
            aria-label="Affirmation"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="I protect my mornings for the work that matters most."
            maxLength={500}
            className="min-h-24 w-full resize-none bg-transparent font-display text-xl font-medium leading-snug text-foreground outline-none field-sizing-content placeholder:text-foreground/35"
          />
        </div>
        <Field label="Pillar">
          <Segmented<Pillar>
            ariaLabel="Pillar"
            value={pillar}
            onChange={(p) => {
              setPillar(p);
              setGoalId(null);
            }}
            options={(["health", "finance", "growth"] as Pillar[]).map((p) => ({
              value: p,
              label: PILLAR_LABEL[p],
              className: PILLAR_META[p].text,
            }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horizon (optional)">
            <SimpleSelect
              value={horizon}
              onChange={(v) => setHorizon(v as GoalHorizon | null)}
              allowNone
              noneLabel="Any"
              options={(Object.keys(HORIZON_LABEL) as GoalHorizon[]).map((h) => ({ value: h, label: HORIZON_LABEL[h] }))}
            />
          </Field>
          <Field label="Goal (optional)">
            <SimpleSelect
              value={goalId}
              onChange={setGoalId}
              allowNone
              noneLabel="None"
              options={pillarGoals.map((g) => ({ value: g.id, label: g.title }))}
            />
          </Field>
        </div>
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

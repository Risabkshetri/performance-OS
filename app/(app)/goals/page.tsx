import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/layout-bits";
import { PILLAR_META } from "@/components/shared/indicators";
import { GoalBoard, type GoalLinkStats } from "@/components/goals/goal-board";
import { getContext } from "@/lib/data/context";
import { getGoals } from "@/lib/data/queries";
import { HORIZON_LABEL, PILLAR_LABEL } from "@/lib/format";
import type { GoalHorizon, OccurrenceStatus, Pillar } from "@/types/domain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goals" };

const HORIZONS = Object.keys(HORIZON_LABEL) as GoalHorizon[];
const PILLARS: Pillar[] = ["health", "finance", "growth"];

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ horizon?: string; pillar?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const horizon = HORIZONS.includes(sp.horizon as GoalHorizon) ? (sp.horizon as GoalHorizon) : null;
  const pillar = PILLARS.includes(sp.pillar as Pillar) ? (sp.pillar as Pillar) : null;

  const [all, linkRes] = await Promise.all([
    getGoals(ctx, true),
    ctx.supabase
      .from("task_occurrences")
      .select("status, task:tasks!inner(goal_id)")
      .not("task.goal_id", "is", null)
      .overrideTypes<{ status: OccurrenceStatus; task: { goal_id: string } }[], { merge: false }>(),
  ]);

  const links: Record<string, GoalLinkStats> = {};
  for (const o of linkRes.data ?? []) {
    if (o.status === "rescheduled") continue;
    const l = (links[o.task.goal_id] ??= { done: 0, total: 0 });
    l.total++;
    if (o.status === "completed") l.done++;
  }

  const visible = all.filter((g) => !g.archived_at && (!horizon || g.horizon === horizon));
  const archived = all.filter((g) => g.archived_at);

  const href = (patch: { horizon?: GoalHorizon | null; pillar?: Pillar | null }) => {
    const h = patch.horizon !== undefined ? patch.horizon : horizon;
    const p = patch.pillar !== undefined ? patch.pillar : pillar;
    const q = new URLSearchParams();
    if (h) q.set("horizon", h);
    if (p) q.set("pillar", p);
    return `/goals${q.size ? `?${q}` : ""}`;
  };

  const tab = (active: boolean) =>
    cn(
      "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium touch:py-1.5",
      active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <PageHeader title="Goals" />
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Horizon" className="no-scrollbar inline-flex w-fit max-w-full overflow-x-auto rounded-lg bg-muted p-0.5">
          <Link href={href({ horizon: null })} className={tab(!horizon)} aria-current={!horizon ? "page" : undefined}>
            All
          </Link>
          {HORIZONS.map((h) => (
            <Link key={h} href={href({ horizon: h })} className={tab(horizon === h)} aria-current={horizon === h ? "page" : undefined}>
              {HORIZON_LABEL[h]}
            </Link>
          ))}
        </nav>
        <nav aria-label="Pillar" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 text-xs sm:mx-0 sm:px-0">
          <Link
            href={href({ pillar: null })}
            className={cn("shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 touch:py-1.5", !pillar ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
          >
            All pillars
          </Link>
          {PILLARS.map((p) => (
            <Link
              key={p}
              href={href({ pillar: p })}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 touch:py-1.5",
                pillar === p ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className={cn("size-1.5 rounded-full", PILLAR_META[p].dot)} aria-hidden />
              {PILLAR_LABEL[p]}
            </Link>
          ))}
        </nav>
      </div>
      <GoalBoard goals={visible} archived={archived} links={links} today={ctx.today} horizon={horizon} pillar={pillar} />
    </>
  );
}

import { ProgressBar } from "@/components/shared/indicators";
import type { ScoreComponent } from "@/lib/calculations/score";

/** Transparent view of how the Daily Execution Score was computed. */
export function ScoreBreakdown({ score, components }: { score: number | null; components: ScoreComponent[] }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular">{score ?? "-"}</span>
        <span className="text-sm text-muted-foreground">{score == null ? "No scheduled tasks or habits" : "/ 100"}</span>
      </div>
      <ul className="mt-4 space-y-3">
        {components.map((c) => (
          <li key={c.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted-foreground tabular">
                {c.applicable ? (
                  <>
                    {c.detail} · {Math.round((c.rate ?? 0) * 100)}% × {Math.round(c.effectiveWeight * 100)}% weight
                  </>
                ) : (
                  "Not applicable today"
                )}
              </span>
            </div>
            <ProgressBar value={c.applicable ? (c.rate ?? 0) * 100 : 0} tone={c.applicable ? "primary" : "muted"} label={c.label} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-subtle-foreground">
        Items with nothing scheduled are left out and their weight is shared among the rest. Hours worked, deep work and sleep
        never add points.
      </p>
    </div>
  );
}

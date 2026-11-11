"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Segmented } from "@/components/shared/form-bits";
import type { Granularity, ProgressPoint } from "@/lib/calculations/progress-series";

const axis = { stroke: "var(--subtle-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = { stroke: "var(--border)", vertical: false } as const;

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Axis tick label for a bucket start, by granularity. */
function tickLabel(iso: string, g: Granularity) {
  return g === "month" ? fmtDate(iso, { month: "short", year: "2-digit" }) : fmtDate(iso, { month: "short", day: "numeric" });
}

/** Full tooltip heading for a bucket. */
function bucketLabel(iso: string, g: Granularity) {
  if (g === "day") return fmtDate(iso, { weekday: "short", month: "short", day: "numeric" });
  if (g === "week") return `Week of ${fmtDate(iso, { month: "short", day: "numeric" })}`;
  return fmtDate(iso, { month: "long", year: "numeric" });
}

const GRAN_NOTE: Record<Granularity, string> = { day: "Daily", week: "Weekly average", month: "Monthly average" };

// ---------------------------------------------------------------- progress

const METRICS = {
  score: { label: "Score", name: "Execution score", unit: "" },
  tasks: { label: "Tasks", name: "Tasks completed", unit: "%" },
  habits: { label: "Habits", name: "Good habits kept", unit: "%" },
  reduce: { label: "Limits", name: "Reduction targets met", unit: "%" },
} as const;
type Metric = keyof typeof METRICS;

export function ProgressChart({ points, granularity }: { points: ProgressPoint[]; granularity: Granularity }) {
  const [metric, setMetric] = useState<Metric>("score");
  const gradient = useId().replace(/:/g, "");
  const m = METRICS[metric];
  const values = points.map((p) => p[metric]).filter((v): v is number => v != null);
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const latest = values.length ? values[values.length - 1] : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-4xl font-medium tabular">
            {latest == null ? "-" : `${latest}${m.unit}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {m.name} · {GRAN_NOTE[granularity].toLowerCase()}
            {avg != null ? ` · avg ${avg}${m.unit}` : ""}
          </p>
        </div>
        <Segmented<Metric>
          ariaLabel="Metric"
          value={metric}
          onChange={setMetric}
          options={(Object.keys(METRICS) as Metric[]).map((k) => ({ value: k, label: METRICS[k].label }))}
        />
      </div>

      {values.length === 0 ? (
        <div className="grid h-64 place-items-center rounded-lg bg-muted/40 text-sm text-muted-foreground">
          No {m.name.toLowerCase()} data in this range
        </div>
      ) : (
        <div role="img" aria-label={`${m.name}, ${GRAN_NOTE[granularity].toLowerCase()}`} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...grid} />
              <XAxis
                dataKey="start"
                {...axis}
                minTickGap={28}
                tickFormatter={(v: string) => tickLabel(v, granularity)}
              />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis} />
              {avg != null ? <ReferenceLine y={avg} stroke="var(--subtle-foreground)" strokeDasharray="3 4" /> : null}
              <Tooltip
                cursor={{ stroke: "var(--subtle-foreground)", strokeWidth: 1 }}
                content={(p) => (
                  <Tip
                    active={p.active}
                    payload={p.payload}
                    granularity={granularity}
                    rows={(pt) => [{ label: m.name, value: pt[metric] == null ? "-" : `${pt[metric]}${m.unit}`, color: "var(--primary)" }]}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey={metric}
                name={m.name}
                stroke="var(--primary)"
                strokeWidth={2}
                fill={`url(#${gradient})`}
                connectNulls
                dot={false}
                activeDot={{ r: 4.5, stroke: "var(--card)", strokeWidth: 2, fill: "var(--primary)" }}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- time

const TIME_SERIES = [
  { key: "deep", name: "Deep work", color: "var(--viz-deep)" },
  { key: "external", name: "External", color: "var(--viz-external)" },
  { key: "personal", name: "Personal", color: "var(--viz-personal)" },
] as const;

export function TimeChart({ points, granularity }: { points: ProgressPoint[]; granularity: Granularity }) {
  const hours = (v: number) => (v < 1 ? `${Math.round(v * 60)}m` : `${v.toFixed(1)}h`);
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {TIME_SERIES.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name}
          </li>
        ))}
        <li className="ml-auto text-subtle-foreground">hours / day</li>
      </ul>
      <div role="img" aria-label="Average hours per day by type" className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="start" {...axis} minTickGap={28} tickFormatter={(v: string) => tickLabel(v, granularity)} />
            <YAxis {...axis} allowDecimals={false} tickFormatter={(v: number) => `${v}h`} />
            <Tooltip
              cursor={{ stroke: "var(--subtle-foreground)", strokeWidth: 1 }}
              content={(p) => (
                <Tip
                  active={p.active}
                  payload={p.payload}
                  granularity={granularity}
                  rows={(pt) => [
                    ...TIME_SERIES.map((s) => ({ label: s.name, value: hours(pt[s.key]), color: s.color })),
                    { label: "Total", value: hours(pt.deep + pt.external + pt.personal) },
                  ]}
                />
              )}
            />
            {TIME_SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId="t"
                stroke={s.color}
                strokeWidth={1.5}
                fill={s.color}
                fillOpacity={0.22}
                activeDot={{ r: 3.5, stroke: "var(--card)", strokeWidth: 2, fill: s.color }}
                animationDuration={500}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tooltip

function Tip({
  active,
  payload,
  granularity,
  rows,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  granularity: Granularity;
  rows: (p: ProgressPoint) => { label: string; value: string; color?: string }[];
}) {
  const pt = payload?.[0]?.payload as ProgressPoint | undefined;
  if (!active || !pt) return null;
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium">{bucketLabel(pt.start, granularity)}</p>
      {rows(pt).map((r) => (
        <p key={r.label} className="flex items-center gap-2 py-0.5">
          {r.color ? <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden /> : <span className="size-2" />}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto pl-4 font-medium tabular">{r.value}</span>
        </p>
      ))}
      {granularity !== "day" ? <p className="mt-1 text-[11px] text-subtle-foreground">{pt.days} days</p> : null}
    </div>
  );
}

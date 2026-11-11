import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleSlash,
  CornerUpRight,
  Equal,
  HeartPulse,
  Sprout,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PILLAR_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { OccurrenceStatus, Pillar, Priority } from "@/types/domain";

export const PILLAR_META: Record<Pillar, { icon: LucideIcon; text: string; bg: string; dot: string; fill: string }> = {
  health: {
    icon: HeartPulse,
    text: "text-pillar-health",
    bg: "bg-pillar-health/10",
    dot: "bg-pillar-health",
    fill: "var(--pillar-health)",
  },
  finance: {
    icon: Wallet,
    text: "text-pillar-finance",
    bg: "bg-pillar-finance/10",
    dot: "bg-pillar-finance",
    fill: "var(--pillar-finance)",
  },
  growth: {
    icon: Sprout,
    text: "text-pillar-growth",
    bg: "bg-pillar-growth/10",
    dot: "bg-pillar-growth",
    fill: "var(--pillar-growth)",
  },
};

export function PillarBadge({ pillar, className, iconOnly }: { pillar: Pillar; className?: string; iconOnly?: boolean }) {
  const meta = PILLAR_META[pillar];
  const Icon = meta.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.text, className)}
      title={PILLAR_LABEL[pillar]}
    >
      <Icon className="size-3.5" aria-hidden />
      {iconOnly ? <span className="sr-only">{PILLAR_LABEL[pillar]}</span> : PILLAR_LABEL[pillar]}
    </span>
  );
}

const PRIORITY_META: Record<Priority, { icon: LucideIcon; className: string }> = {
  high: { icon: ArrowUp, className: "text-destructive" },
  medium: { icon: Equal, className: "text-muted-foreground" },
  low: { icon: ArrowDown, className: "text-subtle-foreground" },
};

export function PriorityBadge({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", meta.className)} title={`${PRIORITY_LABEL[priority]} priority`}>
      <Icon className="size-3.5" aria-hidden />
      {compact ? <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span> : PRIORITY_LABEL[priority]}
    </span>
  );
}

const STATUS_META: Record<OccurrenceStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: CircleDashed, className: "text-muted-foreground" },
  in_progress: { icon: CircleDot, className: "text-primary" },
  completed: { icon: CircleCheck, className: "text-success" },
  missed: { icon: CircleSlash, className: "text-destructive" },
  rescheduled: { icon: CornerUpRight, className: "text-warning" },
};

export function StatusBadge({ status }: { status: OccurrenceStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", meta.className)}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProgressBar({
  value,
  pillar,
  tone,
  className,
  label,
}: {
  value: number | null;
  pillar?: Pillar;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const color = pillar
    ? PILLAR_META[pillar].dot
    : tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "danger"
          ? "bg-destructive"
          : tone === "muted"
            ? "bg-subtle-foreground"
            : "bg-primary";
  return (
    <div
      role="progressbar"
      aria-valuenow={value ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Up/down change indicator with text, never color alone. */
export function Trend({ delta, suffix = " pts" }: { delta: number | null; suffix?: string }) {
  if (delta == null) return <span className="text-xs text-subtle-foreground">No prior data</span>;
  const rounded = Math.round(delta);
  if (rounded === 0) return <span className="text-xs text-muted-foreground">No change</span>;
  const up = rounded > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", up ? "text-success" : "text-destructive")}>
      <Icon className="size-3" aria-hidden />
      {up ? "+" : "−"}
      {Math.abs(rounded)}
      {suffix}
      <span className="sr-only">{up ? " increase" : " decrease"}</span>
    </span>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/layout-bits";
import { journalPaper, ReviewForm } from "@/components/dashboard/review-form";
import { getContext } from "@/lib/data/context";
import { getReview, getReviews } from "@/lib/data/queries";
import { addDays } from "@/lib/date/productivity-day";
import { formatLongDate, relativeDayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

const FIELDS = [
  ["accomplishments", "Accomplishments"],
  ["incomplete", "Didn't get done"],
  ["learnings", "Learned"],
  ["improvements", "Improve"],
] as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= ctx.today ? sp.date : ctx.today;
  const [current, history] = await Promise.all([getReview(ctx, date), getReviews(ctx, 90)]);

  return (
    <>
      <PageHeader title="Reviews" />
      <div className="grid gap-6 lg:grid-cols-5">
        <section style={journalPaper} className="rounded-xl px-6 pb-6 pt-8 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_12px_28px_-16px_rgb(0_0_0/0.25)] lg:col-span-2 lg:self-start sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{relativeDayLabel(date, ctx.today, addDays)}</p>
          <h2 className="mb-7 mt-1 font-display text-2xl font-medium leading-tight">{formatLongDate(date)}</h2>
          <ReviewForm key={date} date={date} review={current} />
        </section>
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-medium">History</h2>
          {history.length ? (
            <ol className="space-y-3">
              {history.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reviews?date=${r.review_date}`}
                    className={cn("block rounded-xl border bg-card px-5 py-4 transition-colors hover:border-primary/40", r.review_date === date && "border-primary/50")}
                  >
                    <p className="text-xs font-medium text-muted-foreground">{formatLongDate(r.review_date)}</p>
                    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      {FIELDS.filter(([k]) => r[k]).map(([k, label]) => (
                        <div key={k}>
                          <dt className="text-xs text-subtle-foreground">{label}</dt>
                          <dd className="line-clamp-3 whitespace-pre-line">{r[k]}</dd>
                        </div>
                      ))}
                    </dl>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-xl border bg-card">
              <EmptyState icon={NotebookPen} title="No reviews yet" description="Your saved reflections will appear here." />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

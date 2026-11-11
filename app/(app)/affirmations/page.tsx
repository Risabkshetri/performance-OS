import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/layout-bits";
import { AffirmationManager } from "@/components/affirmations/affirmation-manager";
import { getContext } from "@/lib/data/context";
import { getAffirmations, getGoalOptions } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Affirmations" };

export default async function AffirmationsPage() {
  const ctx = await getContext();
  const [all, goals] = await Promise.all([getAffirmations(ctx, true), getGoalOptions(ctx)]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="Affirmations" />
      <AffirmationManager
        affirmations={all.filter((a) => !a.archived_at)}
        archived={all.filter((a) => a.archived_at)}
        goals={goals}
      />
    </div>
  );
}

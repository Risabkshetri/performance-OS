import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/layout-bits";
import { SettingsForm } from "@/components/settings/settings-form";
import { getContext } from "@/lib/data/context";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getContext();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" />
      <SettingsForm profile={ctx.profile} email={ctx.email} />
    </div>
  );
}

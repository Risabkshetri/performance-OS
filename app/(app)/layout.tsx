import { AppShell } from "@/components/layout/app-shell";
import { getContext } from "@/lib/data/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  return (
    <AppShell
      user={{
        name: ctx.profile.display_name || ctx.email?.split("@")[0] || "You",
        email: ctx.email,
        timezone: ctx.profile.timezone,
        theme: ctx.profile.theme,
      }}
    >
      {children}
    </AppShell>
  );
}

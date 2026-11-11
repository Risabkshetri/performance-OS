"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ITEMS, isActive } from "./nav-config";
import { ThemeSync, ThemeToggle } from "./theme-toggle";
import { initTimezone } from "@/lib/actions/misc";
import type { ThemePreference } from "@/types/domain";

interface ShellProps {
  children: React.ReactNode;
  user: { name: string; email: string | null; timezone: string | null; theme: ThemePreference };
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2 font-semibold tracking-tight">
      <span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
        P
      </span>
      <span className="text-sm">Performance OS</span>
    </Link>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors touch:py-2.5",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileBlock({ user }: Pick<ShellProps, "user">) {
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">{initial}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        {user.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
      </div>
      <ThemeToggle />
    </div>
  );
}

export function AppShell({ children, user }: ShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // First run: adopt the browser's timezone (user can change it in Settings).
  useEffect(() => {
    if (user.timezone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void initTimezone(tz);
  }, [user.timezone]);

  return (
    <div className="min-h-dvh">
      <ThemeSync preference={user.theme} />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-sidebar px-3 py-4 lg:flex">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <div className="border-t pt-3">
          <ProfileBlock user={user} />
        </div>
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-[calc(3rem+env(safe-area-inset-top))] items-center pt-[env(safe-area-inset-top)] justify-between border-b bg-background/90 px-3 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 max-w-[85vw] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <SheetHeader className="px-1">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
              <div className="mt-auto border-t pt-3">
                <ProfileBlock user={user} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:ml-56 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom bar: the four daily-use sections */}
      <nav
        aria-label="Quick"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV_ITEMS.filter((i) => i.primary).map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors active:scale-95",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label.replace("Daily ", "").replace(" Log", "")}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

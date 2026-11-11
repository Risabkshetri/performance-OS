import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unlock } from "@/lib/gate/actions";
import { gatePasscode } from "@/lib/gate/token";

export const metadata: Metadata = { title: "Locked" };

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const configured = Boolean(gatePasscode());
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-5" aria-hidden />
        </div>
        <h1 className="mt-4 text-center text-3xl">Performance OS</h1>
        {configured ? (
          <form action={unlock} className="mt-8 space-y-3">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <label htmlFor="passcode" className="sr-only">
              Passcode
            </label>
            <input
              id="passcode"
              name="passcode"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              placeholder="Passcode"
              aria-invalid={Boolean(error)}
              className="h-11 w-full rounded-lg border bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                Wrong passcode.
              </p>
            ) : null}
            <Button type="submit" className="h-11 w-full">
              Unlock
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Locked. Set <code className="rounded bg-muted px-1">APP_PASSCODE</code> in the server environment to enable access.
          </p>
        )}
      </div>
    </main>
  );
}

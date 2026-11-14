import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setOwnerPassword } from "@/lib/setup/actions";

export const metadata: Metadata = { title: "Reset password" };

const ERRORS: Record<string, string> = {
  short: "Use at least 8 characters.",
  mismatch: "The two passwords don't match.",
  no_session: "This reset link has expired or was opened in another browser. Send a new one from the setup page.",
  missing_code: "The reset link is incomplete. Send a new one from the setup page.",
  otp_expired: "This reset link has expired. Send a new one from the setup page.",
  same_password: "That's the current password. Choose a different one.",
  weak_password: "Supabase rejected that password as too weak. Choose a longer one.",
};

const inputClass =
  "h-11 w-full rounded-lg border bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
  const { error, done } = await searchParams;

  if (done) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-3xl">Password updated</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Put the new password in <code className="rounded bg-muted px-1">OWNER_PASSWORD</code> in your env file (and in your
            production host&apos;s environment), then restart the server.
          </p>
          <Button asChild className="mt-6 h-11 w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  const message = error ? (ERRORS[error] ?? `Supabase returned: ${error}`) : null;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">This sets the owner account&apos;s password in Supabase.</p>
        <form action={setOwnerPassword} className="mt-6 space-y-3">
          <label htmlFor="password" className="sr-only">
            New password
          </label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="New password" aria-invalid={Boolean(message)} className={inputClass} />
          <label htmlFor="confirm" className="sr-only">
            Confirm new password
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} placeholder="Confirm new password" aria-invalid={Boolean(message)} className={inputClass} />
          {message ? (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full">
            Set password
          </Button>
        </form>
        <p className="mt-4 text-xs text-subtle-foreground">
          <Link href="/setup" className="underline">
            Back to setup
          </Link>
        </p>
      </div>
    </main>
  );
}

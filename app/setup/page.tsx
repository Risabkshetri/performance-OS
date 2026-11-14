import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { sendOwnerReset } from "@/lib/setup/actions";

export const metadata: Metadata = { title: "Setup" };

const HINTS: Record<string, string> = {
  invalid_credentials:
    "Supabase says the email or password is wrong. Check OWNER_PASSWORD, or set a new password for this user in Supabase (Authentication → Users → … → Send password recovery / or delete and re-add the user).",
  email_not_confirmed:
    "The account exists but its email was never confirmed. In Supabase → Authentication → Users, open the user and confirm it, or delete it and re-add with “Auto confirm” ticked.",
  user_not_found: "No user with this email exists in this Supabase project. Add it under Authentication → Users.",
  user_banned: "This user is banned in Supabase. Unban it under Authentication → Users.",
  over_request_rate_limit: "Too many sign-in attempts. Wait a minute and reload.",
};

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string; code?: string; reset?: string; resetCode?: string }> }) {
  const { reason, code, reset, resetCode } = await searchParams;
  const back = `/setup${reason ? `?reason=${encodeURIComponent(reason)}${code ? `&code=${encodeURIComponent(code)}` : ""}` : ""}`;
  const canReset = Boolean(process.env.OWNER_EMAIL);
  const signinFailed = reason === "signin";
  const hint = code ? (HINTS[code] ?? `Supabase returned: ${code}`) : null;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-3xl">Almost there</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {signinFailed
            ? (hint ?? "The owner account couldn't sign in. Check the email and password in your env file.")
            : "Add your owner account to the env file, then restart the server."}
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border bg-card p-4 text-xs leading-relaxed">
          {`OWNER_EMAIL=you@example.com\nOWNER_PASSWORD=your-password`}
        </pre>
        <p className="mt-4 text-xs text-subtle-foreground">
          The account must exist in Supabase (Authentication → Users) and be confirmed. These values stay on the server.
        </p>
        {canReset && (
          <div className="mt-8 border-t pt-6">
            <h2 className="text-base font-medium">Forgot the password?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ll email a reset link to the address in <code className="rounded bg-muted px-1">OWNER_EMAIL</code>. Open it in this
              browser to choose a new password.
            </p>
            {reset === "sent" ? (
              <p role="status" className="mt-3 text-sm text-primary">
                Reset link sent. Check that inbox (and spam).
              </p>
            ) : reset === "failed" ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {resetCode === "over_email_send_rate_limit"
                  ? "Supabase's email limit was hit. Wait a while and try again."
                  : `Couldn't send the reset email. Supabase returned: ${resetCode ?? "unknown"}`}
              </p>
            ) : null}
            <form action={sendOwnerReset} className="mt-4">
              <input type="hidden" name="back" value={back} />
              <Button type="submit" variant="outline" className="h-11 w-full">
                Email me a reset link
              </Button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

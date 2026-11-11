import type { Metadata } from "next";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const signinFailed = reason === "signin";
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-3xl">Almost there</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {signinFailed
            ? "The owner account couldn't sign in. Check the email and password in your env file."
            : "Add your owner account to the env file, then restart the server."}
        </p>
        <pre className="mt-5 overflow-x-auto rounded-xl border bg-card p-4 text-xs leading-relaxed">
          {`OWNER_EMAIL=you@example.com\nOWNER_PASSWORD=your-password`}
        </pre>
        <p className="mt-4 text-xs text-subtle-foreground">
          The account must exist in Supabase (Authentication → Users) and be confirmed. These values stay on the server.
        </p>
      </div>
    </main>
  );
}

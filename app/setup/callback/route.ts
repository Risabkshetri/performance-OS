import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for the password-recovery email: trade the one-time code for a session, then show the new-password form.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = new URL("/setup/reset", request.url);
  if (!code) {
    to.searchParams.set("error", request.nextUrl.searchParams.get("error_code") ?? "missing_code");
    return NextResponse.redirect(to);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[setup] recovery link failed", { name: error.name, status: error.status, code: error.code, message: error.message });
    to.searchParams.set("error", error.code ?? "link_failed");
  }
  return NextResponse.redirect(to);
}

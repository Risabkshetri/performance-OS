"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Owner password recovery. Only reachable behind the passcode gate.
 * The reset email always goes to OWNER_EMAIL from the server env; the browser never chooses the address.
 */
export async function sendOwnerReset(formData: FormData) {
  const email = process.env.OWNER_EMAIL;
  const back = String(formData.get("back") ?? "/setup");
  const backTo = back.startsWith("/setup") ? back : "/setup";
  const sep = backTo.includes("?") ? "&" : "?";
  if (!email) redirect(`${backTo}${sep}reset=no_email`);

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/setup/callback` });
  if (error) {
    console.error("[setup] reset email failed", { name: error.name, status: error.status, code: error.code, message: error.message });
    redirect(`${backTo}${sep}reset=failed&resetCode=${encodeURIComponent(error.code ?? error.message)}`);
  }
  redirect(`${backTo}${sep}reset=sent`);
}

export async function setOwnerPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) redirect("/setup/reset?error=short");
  if (password !== confirm) redirect("/setup/reset?error=mismatch");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const owner = process.env.OWNER_EMAIL?.toLowerCase();
  if (!data.user || !owner || data.user.email?.toLowerCase() !== owner) redirect("/setup/reset?error=no_session");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[setup] password update failed", { name: error.name, status: error.status, code: error.code, message: error.message });
    redirect(`/setup/reset?error=${encodeURIComponent(error.code ?? "update_failed")}`);
  }
  redirect("/setup/reset?done=1");
}

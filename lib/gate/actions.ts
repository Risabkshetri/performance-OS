"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, GATE_MAX_AGE, gatePasscode, gateToken, safeEqual } from "./token";

export async function unlock(formData: FormData) {
  const expected = gatePasscode();
  const given = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!expected || !given || !safeEqual(await gateToken(given), await gateToken(expected))) {
    await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
    redirect(`/unlock?error=1${target !== "/dashboard" ? `&next=${encodeURIComponent(target)}` : ""}`);
  }
  (await cookies()).set(GATE_COOKIE, await gateToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  redirect(target);
}

export async function lock() {
  const jar = await cookies();
  jar.delete(GATE_COOKIE);
  // also drop the Supabase session cookies
  for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);
  redirect("/unlock");
}

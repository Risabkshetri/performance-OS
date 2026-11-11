import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";
import { GATE_COOKIE, gatePasscode, gateToken, safeEqual } from "@/lib/gate/token";

/**
 * Single-owner app. Every request must first pass the passcode gate
 * (APP_PASSCODE). After that, when no valid session cookie
 * exists, the server signs in as the owner using OWNER_EMAIL / OWNER_PASSWORD
 * (server-only env vars, never sent to the browser). The database still sees
 * an authenticated user, so RLS and auth.uid()-based functions work unchanged.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Passcode gate: nothing (pages, data, server actions) is reachable without it.
  //    With no APP_PASSCODE configured the app stays locked: it fails closed.
  const passcode = gatePasscode();
  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  const unlocked = Boolean(passcode && cookie && safeEqual(cookie, await gateToken(passcode)));
  if (path === "/unlock") return unlocked ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next({ request });
  if (!unlocked) {
    if (request.method !== "GET") return new NextResponse("Locked", { status: 401 });
    const to = new URL("/unlock", request.url);
    if (path !== "/" && path !== "/dashboard") to.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(to);
  }
  if (path === "/setup") return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims() validates the JWT; do not run code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) return response;

  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const { error } =
    email && password ? await supabase.auth.signInWithPassword({ email, password }) : { error: new Error("missing") };
  if (error) {
    const setup = request.nextUrl.clone();
    setup.pathname = "/setup";
    const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
    setup.search = email && password ? `?reason=signin&code=${encodeURIComponent(code)}` : "?reason=env";
    return NextResponse.rewrite(setup);
  }
  return response;
}

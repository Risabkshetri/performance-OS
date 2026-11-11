import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

/**
 * Single-owner app: there is no login screen. When no valid session cookie
 * exists, the server signs in as the owner using OWNER_EMAIL / OWNER_PASSWORD
 * (server-only env vars, never sent to the browser). The database still sees
 * an authenticated user, so RLS and auth.uid()-based functions work unchanged.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
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
    setup.search = email && password ? "?reason=signin" : "?reason=env";
    return NextResponse.rewrite(setup);
  }
  return response;
}

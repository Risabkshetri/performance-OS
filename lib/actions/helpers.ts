import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionContext, type AppContext } from "@/lib/data/context";
import type { ActionResult } from "@/types/domain";

export function invalid(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  const first = error.issues[0];
  return {
    ok: false,
    error: first?.message ?? "Please check the form",
    fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
  };
}

interface PgError {
  code?: string;
  message: string;
}

/** Turns database errors into messages a person can act on. */
export function dbFail(error: PgError, fallback = "Something went wrong. Please try again."): ActionResult<never> {
  switch (error.code) {
    case "23P01":
      return { ok: false, error: "This overlaps an existing entry." };
    case "23505":
      return { ok: false, error: "That already exists." };
    case "23514":
      return { ok: false, error: "Some values are out of range. Check times and limits." };
    case "23503":
      return { ok: false, error: "A linked item no longer exists. Refresh and try again." };
    case "P0001":
      return { ok: false, error: error.message };
  }
  console.error("[db]", error);
  return { ok: false, error: fallback };
}

/** Runs an action with an authenticated context, then revalidates the app. */
export async function withAuth<T>(fn: (ctx: AppContext) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const ctx = await getActionContext();
  if (!ctx) return { ok: false, error: "Your session has expired. Sign in again." };
  try {
    const result = await fn(ctx);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (e) {
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

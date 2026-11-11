"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/types/domain";

/**
 * Runs a server action inside a transition and reports the outcome with a
 * toast. Server actions revalidate the layout, so the UI refreshes itself.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    <T,>(
      action: () => Promise<ActionResult<T>>,
      opts: { onSuccess?: (data: T | undefined) => void; onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void; quiet?: boolean } = {},
    ) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (result.ok) {
            if (result.message && !opts.quiet) toast.success(result.message);
            opts.onSuccess?.(result.data);
          } else {
            toast.error(result.error);
            opts.onError?.(result);
          }
        } catch {
          toast.error("Couldn't reach the server. Check your connection and try again.");
        }
      });
    },
    [],
  );
  return { pending, run };
}

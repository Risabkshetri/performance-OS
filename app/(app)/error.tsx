"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-3 rounded-full bg-destructive/10 p-2.5 text-destructive">
        <TriangleAlert className="size-5" aria-hidden />
      </div>
      <h1 className="text-base font-medium">This page couldn&apos;t load</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your data is safe. This is usually a temporary connection problem.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

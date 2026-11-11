"use client";

import { useState } from "react";
import { CheckCircle2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { journalPaper, ReviewForm } from "./review-form";
import { formatLongDate } from "@/lib/format";
import type { DailyReview } from "@/types/domain";

export function ReviewDialogButton({ date, review }: { date: string; review: DailyReview | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {review ? <CheckCircle2 className="text-success" /> : <NotebookPen />}
        {review ? "Reviewed" : "Daily review"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={journalPaper} className="max-h-[92dvh] overflow-y-auto border-0 p-0 sm:max-w-xl">
          <div className="px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-8 sm:px-12 sm:pb-7 sm:pt-12">
            <DialogHeader className="mb-8 text-left">
              <DialogDescription className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Daily review
              </DialogDescription>
              <DialogTitle className="font-display text-3xl font-medium leading-tight tracking-[-0.01em] sm:text-4xl">
                {formatLongDate(date)}
              </DialogTitle>
            </DialogHeader>
            {open ? <ReviewForm date={date} review={review} onSaved={() => setOpen(false)} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

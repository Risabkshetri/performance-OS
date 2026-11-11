"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "./task-form-dialog";
import type { GoalOption } from "@/lib/data/queries";
import type { Priority } from "@/types/domain";

export function QuickAddTask({
  goals,
  today,
  defaultPriority,
  defaultDate,
  label = "Add task",
  variant = "default",
}: {
  goals: GoalOption[];
  today: string;
  defaultPriority: Priority;
  defaultDate?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        goals={goals}
        today={today}
        defaultPriority={defaultPriority}
        defaultDate={defaultDate}
      />
    </>
  );
}

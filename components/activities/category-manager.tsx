"use client";

import { useState } from "react";
import { Archive, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/shared/form-bits";
import { useAction } from "@/hooks/use-action";
import { archiveCategory, createCategory } from "@/lib/actions/activities";
import type { ActivityCategory, ActivityKind } from "@/types/domain";

const KIND_LABEL: Record<ActivityKind, string> = {
  deep: "Deep work",
  external: "External work",
  personal: "Personal",
  other: "Other",
};

export function CategoryManager({ categories }: { categories: ActivityCategory[] }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ActivityKind>("deep");
  const { pending, run } = useAction();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2 /> Categories
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activity categories</DialogTitle>
          <DialogDescription>
            Each category rolls up into Deep work, External work, Personal or Other in analytics.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {c.name} <span className="text-xs text-muted-foreground">· {KIND_LABEL[c.kind]}</span>
              </span>
              {c.is_default ? (
                <span className="text-xs text-subtle-foreground">Default</span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs" className="touch:size-9"
                  aria-label={`Archive ${c.name}`}
                  disabled={pending}
                  onClick={() => run(() => archiveCategory(c.id))}
                >
                  <Archive />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createCategory({ name, kind }), { onSuccess: () => setName("") });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Networking" aria-label="Category name" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented<ActivityKind>
              ariaLabel="Counts as"
              size="sm"
              value={kind}
              onChange={setKind}
              options={(Object.keys(KIND_LABEL) as ActivityKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            />
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

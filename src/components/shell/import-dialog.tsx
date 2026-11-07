"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDateKey } from "@/lib/dates";
import { createLocalRepository } from "@/lib/data/local-repository";
import { useLifeState, useLifeStore } from "@/lib/data/provider";
import { planImport } from "@/lib/data/store";

/**
 * Copies demo data saved in this browser into the signed-in account.
 * Shows exactly what will be added first. Never deletes or overwrites anything:
 * browser data stays where it is, and existing journal dates are skipped.
 */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <ImportBody onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function ImportBody({ onDone }: { onDone: () => void }) {
  const store = useLifeStore();
  const state = useLifeState();
  const [includeExamples, setIncludeExamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const [local] = useState(() => createLocalRepository().loadSync());

  const header = (
    <DialogHeader>
      <DialogTitle>Import from this browser</DialogTitle>
      <DialogDescription>Copies demo tasks and journal entries saved in this browser into your account.</DialogDescription>
    </DialogHeader>
  );

  if (local.kind !== "ok" || state.status !== "ready") {
    const message =
      local.kind === "empty"
        ? "This browser has no demo data to import."
        : local.kind === "invalid"
          ? `This browser's demo data couldn't be read (${local.error}). Nothing will be imported.`
          : local.kind === "unavailable"
            ? local.error
            : "Your account data is still loading.";
    return (
      <>
        {header}
        <p className="text-muted-foreground text-sm">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
        </DialogFooter>
      </>
    );
  }

  const plan = planImport(local.data, state.data, { includeExamples });
  const nothing = plan.tasks.length === 0 && plan.journalEntries.length === 0;

  return (
    <>
      {header}
      <div className="grid gap-3 text-sm">
        <ul className="bg-muted/60 grid gap-1 rounded-md px-4 py-3">
          <li>
            <strong>{plan.tasks.length}</strong> task{plan.tasks.length === 1 ? "" : "s"}
            {plan.noteCount > 0 && ` (with ${plan.noteCount} progress note${plan.noteCount === 1 ? "" : "s"})`}
          </li>
          <li>
            <strong>{plan.journalEntries.length}</strong> journal entr{plan.journalEntries.length === 1 ? "y" : "ies"}
          </li>
        </ul>
        {plan.skippedExamples > 0 && !includeExamples && (
          <p className="text-muted-foreground">{plan.skippedExamples} example task(s) will be left out.</p>
        )}
        {plan.alreadyImported > 0 && <p className="text-muted-foreground">{plan.alreadyImported} task(s) are already in your account and will be skipped.</p>}
        {plan.skippedDates.length > 0 && (
          <p className="text-muted-foreground">
            Your account already has entries for {plan.skippedDates.map((d) => formatDateKey(d, { month: "short", day: "numeric" })).join(", ")}.
            Those dates will be skipped, so nothing is overwritten.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Checkbox id="include-examples" checked={includeExamples} onCheckedChange={(v) => setIncludeExamples(v === true)} />
          <Label htmlFor="include-examples" className="font-normal">
            Also import example tasks
          </Label>
        </div>
        <p className="text-muted-foreground text-xs">The demo data in this browser is not changed or deleted.</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={nothing || busy}
          onClick={async () => {
            setBusy(true);
            const result = await store.importData(local.data, { includeExamples });
            setBusy(false);
            if (!result.ok) return toast.error(result.error);
            toast.success(`Imported ${result.value.tasks.length} task(s) and ${result.value.journalEntries.length} journal entr(ies).`);
            onDone();
          }}
        >
          {nothing ? "Nothing new to import" : "Import"}
        </Button>
      </DialogFooter>
    </>
  );
}

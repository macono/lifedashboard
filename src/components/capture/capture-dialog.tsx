"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ListTodo, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJournalDraft } from "@/components/journal/journal-draft-provider";
import { formatDateKey, isValidDateKey, type DateKey } from "@/lib/dates";
import { splitTaskText } from "@/lib/data/capture";
import { sectionLabel } from "@/lib/data/journal";
import { useLifeState, useLifeStore } from "@/lib/data/provider";
import { TITLE_MAX } from "@/lib/data/tasks";
import { JOURNAL_SECTIONS, type JournalSectionId } from "@/lib/data/types";
import { CAPTURE_PLANNED_NOTE } from "@/lib/modules";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

type Destination = "task" | "journal";

export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <CaptureForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CaptureForm({ onDone }: { onDone: () => void }) {
  const store = useLifeStore();
  const state = useLifeState();
  const today = useToday();
  const router = useRouter();
  const { applyAppend } = useJournalDraft();

  const [text, setText] = useState("");
  const [destination, setDestination] = useState<Destination>("task");
  const [date, setDate] = useState<DateKey>(today ?? "");
  const [section, setSection] = useState<JournalSectionId>("random_thoughts");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = state.status === "ready";
  const task = splitTaskText(text);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (destination === "task") {
      if (!task.title) return setError("Enter a task title on the first line.");
      setBusy(true);
      const result = await store.createTask({ title: task.title, description: task.description });
      setBusy(false);
      if (!result.ok) return setError(result.error);
      toast.success(`Task created: “${result.value.title}”`, {
        action: { label: "View", onClick: () => router.push(`/tasks?task=${result.value.id}`) },
      });
    } else {
      if (!text.trim()) return setError("Enter some text to add to the journal.");
      if (!isValidDateKey(date)) return setError("Choose a valid date.");
      setBusy(true);
      const result = await store.appendToJournal(date, section, text);
      setBusy(false);
      if (!result.ok) return setError(result.error);
      applyAppend(date, section, text);
      toast.success(`Added to “${sectionLabel(section)}” · ${formatDateKey(date, { month: "short", day: "numeric" })}`, {
        action: { label: "View", onClick: () => router.push(`/journal?date=${date}`) },
      });
    }
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Capture</DialogTitle>
        <DialogDescription>Write it down now, file it in the right place.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="capture-text">What&apos;s on your mind?</Label>
          <Textarea
            id="capture-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            rows={4}
            autoFocus
            aria-invalid={!!error || undefined}
            aria-describedby="capture-help"
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Save as</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            <DestinationOption checked={destination === "task"} onSelect={() => setDestination("task")} icon={ListTodo} label="Create task" />
            <DestinationOption
              checked={destination === "journal"}
              onSelect={() => setDestination("journal")}
              icon={NotebookPen}
              label="Add to journal"
            />
          </div>
        </fieldset>

        {destination === "task" ? (
          <p id="capture-help" className="text-muted-foreground text-sm">
            {task.title ? (
              <>
                Title: <span className="text-foreground font-medium break-words">{task.title.slice(0, TITLE_MAX)}</span>
                {task.description && " · the remaining lines become the description."}
                <br />
              </>
            ) : (
              "The first line becomes the task title. "
            )}
            Saved as To do, Medium priority, no due date — edit it any time.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2" id="capture-help">
            <div className="grid gap-2">
              <Label htmlFor="capture-date">Journal date</Label>
              <Input id="capture-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capture-section">Section</Label>
              <Select value={section} onValueChange={(v) => setSection(v as JournalSectionId)}>
                <SelectTrigger id="capture-section" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOURNAL_SECTIONS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground text-sm sm:col-span-2">Added to the end of the section. Existing text is kept.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {!ready && <p className="text-muted-foreground text-sm">Data isn&apos;t available yet, so Capture is disabled.</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <p className="text-muted-foreground text-xs sm:mr-auto">{CAPTURE_PLANNED_NOTE}</p>
          <Button type="submit" disabled={busy || !ready}>
            {destination === "task" ? "Create task" : "Add to journal"}
          </Button>
        </div>
      </form>
    </>
  );
}

function DestinationOption({
  checked,
  onSelect,
  icon: Icon,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: typeof ListTodo;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
        checked ? "border-primary bg-primary/10 text-primary ring-primary/30 ring-2" : "hover:bg-accent",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

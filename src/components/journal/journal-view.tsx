"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { ChevronLeft, ChevronRight, NotebookPen, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useJournalDraft } from "@/components/journal/journal-draft-provider";
import { useReady } from "@/components/shell/data-gate";
import { addDays, formatDateKey, formatTimestamp, isValidDateKey, relativeDayLabel, type DateKey } from "@/lib/dates";
import { emptySections, entryPreview, filledSectionCount, findEntry, sortEntriesDesc } from "@/lib/data/journal";
import { useLifeStore } from "@/lib/data/provider";
import { JOURNAL_SECTIONS } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function JournalView() {
  const { data, today } = useReady();
  const store = useLifeStore();
  const router = useRouter();
  const params = useSearchParams();
  const { draft, setSection, discard } = useJournalDraft();
  const [pendingDate, setPendingDate] = useState<DateKey | null>(null);
  const [saving, setSaving] = useState(false);

  const dateParam = params.get("date");
  const date: DateKey = isValidDateKey(dateParam) ? dateParam : today;
  const entry = findEntry(data.journalEntries, date);
  const saved = entry?.sections ?? emptySections();
  const draftHere = draft?.date === date ? draft : null;
  const otherDraft = draft && draft.date !== date ? draft : null;

  const navigate = (d: DateKey) => router.push(d === today ? "/journal" : `/journal?date=${d}`, { scroll: false });

  function goToDate(d: DateKey) {
    if (d === date || !isValidDateKey(d)) return;
    if (draftHere) setPendingDate(d);
    else navigate(d);
  }

  async function save(): Promise<boolean> {
    if (!draftHere) return true;
    setSaving(true);
    const result = await store.saveJournalEntry(date, draftHere.sections);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    discard();
    toast.success(`Journal saved for ${formatDateKey(date, { month: "short", day: "numeric" })}`);
    return true;
  }

  // ⌘S / Ctrl+S saves from anywhere on the page. The listener is removed while
  // the Journal is hidden (Next.js keeps visited pages mounted but hidden).
  const onSaveShortcut = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void save();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onSaveShortcut(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const entries = sortEntriesDesc(data.journalEntries);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Journal</h1>
          <p className="text-muted-foreground text-sm">One entry per day, in eight sections.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goToDate(addDays(date, -1))} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <label className="sr-only" htmlFor="journal-date">
            Journal date
          </label>
          <Input
            id="journal-date"
            type="date"
            className="w-auto"
            value={date}
            onChange={(e) => e.target.value && goToDate(e.target.value)}
          />
          <Button variant="outline" size="icon" onClick={() => goToDate(addDays(date, 1))} aria-label="Next day">
            <ChevronRight />
          </Button>
          <Button variant="outline" onClick={() => goToDate(today)} disabled={date === today}>
            Today
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="entry-heading" className="min-w-0">
          <div className="bg-card sticky top-[57px] z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-sm lg:top-4">
            <div className="min-w-0 flex-1">
              <h2 id="entry-heading" className="font-semibold">
                {formatDateKey(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h2>
              <SaveStatus dirty={!!draftHere} savedAt={entry?.updatedAt} />
            </div>
            <Button onClick={() => void save()} disabled={!draftHere || saving || !!otherDraft}>
              <Save /> Save
            </Button>
          </div>

          {otherDraft && (
            <div role="alert" className="mb-4 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
              <p className="font-medium">
                You have unsaved changes for {formatDateKey(otherDraft.date, { weekday: "short", month: "short", day: "numeric" })}.
              </p>
              <p className="mt-1 text-sky-800">Save or discard them before editing this date.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(otherDraft.date)}>
                  Go to {formatDateKey(otherDraft.date, { month: "short", day: "numeric" })}
                </Button>
                <Button size="sm" variant="outline" onClick={discard}>
                  Discard those changes
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4">
            {JOURNAL_SECTIONS.map((section, i) => {
              const value = draftHere?.sections[section.id] ?? saved[section.id];
              const changed = draftHere?.sections[section.id] !== undefined;
              return (
                <div key={section.id} className="bg-card rounded-xl border p-4 shadow-sm">
                  <label htmlFor={`journal-${section.id}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span className="bg-primary/10 text-primary grid size-6 place-items-center rounded-full text-xs">{i + 1}</span>
                    {section.label}
                    {changed && <span className="text-xs font-normal text-amber-700">· edited</span>}
                  </label>
                  <Textarea
                    id={`journal-${section.id}`}
                    value={value}
                    readOnly={!!otherDraft}
                    onChange={(e) => setSection(date, section.id, e.target.value)}
                    className="min-h-20 bg-transparent leading-relaxed"
                    placeholder={otherDraft ? "" : PLACEHOLDERS[section.id]}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Tip: press ⌘S / Ctrl+S to save. &ldquo;New Action Items&rdquo; is journal text for now — it does not create tasks.
          </p>
        </section>

        <aside aria-labelledby="history-heading">
          <div className="bg-card rounded-xl border shadow-sm lg:sticky lg:top-4">
            <h2 id="history-heading" className="border-b px-4 py-3 text-sm font-semibold">
              Previous entries <span className="text-muted-foreground font-normal">({entries.length})</span>
            </h2>
            {entries.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-sm">
                <NotebookPen className="size-6" aria-hidden />
                No saved entries yet. Write in any section and press Save.
              </div>
            ) : (
              <ul className="max-h-[60vh] divide-y overflow-y-auto">
                {entries.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => goToDate(e.date)}
                      aria-current={e.date === date ? "date" : undefined}
                      className={cn("hover:bg-accent w-full cursor-pointer px-4 py-3 text-left", e.date === date && "bg-accent")}
                    >
                      <div className="flex items-center justify-between gap-2 text-sm font-medium">
                        <span>{formatDateKey(e.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className="text-muted-foreground text-xs font-normal">{filledSectionCount(e)}/8</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {relativeDayLabel(e.date, today)}
                        {draft?.date === e.date && <span className="text-amber-700"> · unsaved changes</span>}
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{entryPreview(e)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Phone: keep Save reachable while scrolling through sections */}
      {draftHere && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-amber-50/95 px-4 py-2 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-amber-900">Unsaved changes</span>
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              <Save /> Save
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={pendingDate !== null} onOpenChange={(o) => !o && setPendingDate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved journal changes</AlertDialogTitle>
            <AlertDialogDescription>
              You changed the entry for {formatDateKey(date, { weekday: "short", month: "short", day: "numeric" })}. Save before
              switching dates?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                const d = pendingDate!;
                discard();
                setPendingDate(null);
                navigate(d);
              }}
            >
              Discard changes
            </Button>
            <Button
              onClick={async () => {
                const d = pendingDate!;
                if (await save()) {
                  setPendingDate(null);
                  navigate(d);
                }
              }}
            >
              Save and switch
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SaveStatus({ dirty, savedAt }: { dirty: boolean; savedAt?: string }) {
  if (dirty)
    return (
      <p className="flex items-center gap-1.5 text-sm text-amber-700" role="status">
        <span className="size-2 rounded-full bg-amber-500" aria-hidden /> Unsaved changes
      </p>
    );
  if (savedAt)
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-700" role="status">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden /> Saved · {formatTimestamp(savedAt)}
      </p>
    );
  return (
    <p className="text-muted-foreground text-sm" role="status">
      No entry for this date yet
    </p>
  );
}

const PLACEHOLDERS: Record<(typeof JOURNAL_SECTIONS)[number]["id"], string> = {
  completed: "What did you get done?",
  where_i_went: "Places you went today",
  what_i_learned: "Something new you learned",
  what_i_ate: "Meals and snacks",
  exercises: "Walks, workouts, stretching…",
  new_action_items: "Things to follow up on (journal text only for now)",
  flock_plan: "Notes for your Flock Plan",
  random_thoughts: "Anything else on your mind",
};

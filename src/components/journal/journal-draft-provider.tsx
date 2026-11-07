"use client";

/**
 * Holds unsaved journal edits in memory (one date at a time).
 *
 * Because the draft lives here rather than inside the Journal page, moving
 * between Overview / Tasks / Journal never loses it. Refreshing or closing the
 * tab would, so we ask the browser to warn first.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DateKey } from "@/lib/dates";
import { appendText, emptySections, findEntry, SECTION_IDS } from "@/lib/data/journal";
import { useLifeState } from "@/lib/data/provider";
import type { JournalSectionId, JournalSections } from "@/lib/data/types";

export interface JournalDraft {
  date: DateKey;
  sections: Partial<JournalSections>;
}

interface DraftContextValue {
  draft: JournalDraft | null;
  /** True when the draft differs from what is saved. */
  isDirty: boolean;
  setSection(date: DateKey, section: JournalSectionId, value: string): void;
  discard(): void;
  /** Keeps an open draft in step when Capture appends to the same section. */
  applyAppend(date: DateKey, section: JournalSectionId, text: string): void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function JournalDraftProvider({ children }: { children: ReactNode }) {
  const state = useLifeState();
  const [draft, setDraft] = useState<JournalDraft | null>(null);

  const savedSections = useCallback(
    (date: DateKey): JournalSections =>
      (state.status === "ready" && findEntry(state.data.journalEntries, date)?.sections) || emptySections(),
    [state],
  );

  // Only sections that really differ from saved data count as unsaved.
  const effectiveDraft = useMemo((): JournalDraft | null => {
    if (!draft) return null;
    const saved = savedSections(draft.date);
    const changed = Object.fromEntries(
      SECTION_IDS.filter((id) => draft.sections[id] !== undefined && draft.sections[id] !== saved[id]).map((id) => [id, draft.sections[id]]),
    ) as Partial<JournalSections>;
    return Object.keys(changed).length ? { date: draft.date, sections: changed } : null;
  }, [draft, savedSections]);
  const isDirty = effectiveDraft !== null;

  const setSection = useCallback(
    (date: DateKey, section: JournalSectionId, value: string) => {
      const saved = savedSections(date)[section];
      // Start from the sections that still differ, so stale copies never linger,
      // and only keep this section if it differs from what is saved.
      const sections = { ...(effectiveDraft && effectiveDraft.date === date ? effectiveDraft.sections : {}) };
      if (value === saved) delete sections[section];
      else sections[section] = value;
      setDraft(Object.keys(sections).length ? { date, sections } : null);
    },
    [savedSections, effectiveDraft],
  );

  const discard = useCallback(() => setDraft(null), []);

  const applyAppend = useCallback((date: DateKey, section: JournalSectionId, text: string) => {
    setDraft((prev) => {
      if (!prev || prev.date !== date || prev.sections[section] === undefined) return prev;
      return { ...prev, sections: { ...prev.sections, [section]: appendText(prev.sections[section]!, text) } };
    });
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // required by some browsers to show the prompt
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const value = useMemo(
    () => ({ draft: effectiveDraft, isDirty, setSection, discard, applyAppend }),
    [effectiveDraft, isDirty, setSection, discard, applyAppend],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useJournalDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useJournalDraft must be used inside <JournalDraftProvider>");
  return ctx;
}

/** Pure journal logic. One entry per local calendar date. */
import { isValidDateKey, type DateKey } from "@/lib/dates";
import { newId } from "./ids";
import { JOURNAL_SECTIONS, type JournalEntry, type JournalSectionId, type JournalSections, type Result } from "./types";

export const SECTION_IDS: JournalSectionId[] = JOURNAL_SECTIONS.map((s) => s.id);

export function isSectionId(value: unknown): value is JournalSectionId {
  return typeof value === "string" && (SECTION_IDS as string[]).includes(value);
}

export function sectionLabel(id: JournalSectionId): string {
  return JOURNAL_SECTIONS.find((s) => s.id === id)?.label ?? id;
}

export function emptySections(): JournalSections {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, ""])) as JournalSections;
}

export function findEntry(entries: JournalEntry[], date: DateKey): JournalEntry | undefined {
  return entries.find((e) => e.date === date);
}

/** Creates or replaces the entry for `date` with the given section text (text is kept exactly as typed). */
export function saveEntry(
  entries: JournalEntry[],
  date: DateKey,
  sections: Partial<JournalSections>,
  now: string,
): Result<{ entries: JournalEntry[]; entry: JournalEntry }> {
  if (!isValidDateKey(date)) return { ok: false, error: "Choose a valid journal date." };
  const existing = findEntry(entries, date);
  const merged: JournalSections = { ...emptySections(), ...existing?.sections };
  for (const id of SECTION_IDS) {
    const value = sections[id];
    if (typeof value === "string") merged[id] = value;
  }
  const entry: JournalEntry = existing
    ? { ...existing, sections: merged, updatedAt: now }
    : { id: newId(), date, sections: merged, createdAt: now, updatedAt: now };
  const next = existing ? entries.map((e) => (e.id === existing.id ? entry : e)) : [...entries, entry];
  return { ok: true, value: { entries: next, entry } };
}

/** Appends text to the end of a section. Existing text is never replaced. */
export function appendText(existing: string, addition: string): string {
  const text = addition.replace(/^\s*\n|\s+$/g, ""); // drop leading blank lines and trailing whitespace only
  if (!text.trim()) return existing;
  if (!existing) return text;
  return existing.endsWith("\n") ? existing + text : `${existing}\n${text}`;
}

export function appendToSection(
  entries: JournalEntry[],
  date: DateKey,
  section: JournalSectionId,
  addition: string,
  now: string,
): Result<{ entries: JournalEntry[]; entry: JournalEntry }> {
  if (!isSectionId(section)) return { ok: false, error: "Choose a journal section." };
  if (!addition.trim()) return { ok: false, error: "Enter some text to add." };
  const current = findEntry(entries, date)?.sections[section] ?? "";
  return saveEntry(entries, date, { [section]: appendText(current, addition) }, now);
}

export function filledSectionCount(entry: JournalEntry | undefined): number {
  if (!entry) return 0;
  return SECTION_IDS.filter((id) => entry.sections[id].trim() !== "").length;
}

/** Newest first. */
export function sortEntriesDesc(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function entryPreview(entry: JournalEntry, max = 90): string {
  for (const id of SECTION_IDS) {
    const text = entry.sections[id].trim();
    if (text) {
      const flat = text.replace(/\s+/g, " ");
      return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
    }
  }
  return "Empty entry";
}

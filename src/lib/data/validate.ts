/**
 * Validates data read from storage. If anything is malformed we report it and
 * leave the stored data untouched — the app never "repairs" by deleting.
 */
import { isValidDateKey } from "@/lib/dates";
import { SECTION_IDS } from "./journal";
import { TASK_PRIORITIES, TASK_STATUSES, type AppData, type Result } from "./types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isIso = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v));

function taskProblem(t: unknown): string | null {
  if (!isObj(t)) return "not an object";
  if (!isStr(t.id) || !t.id) return "missing id";
  if (!isStr(t.title) || !t.title.trim()) return "missing title";
  if (!isStr(t.description)) return "invalid description";
  if (t.dueDate !== null && !isValidDateKey(t.dueDate)) return "invalid due date";
  if (!TASK_PRIORITIES.includes(t.priority as never)) return "invalid priority";
  if (!TASK_STATUSES.includes(t.status as never)) return "invalid status";
  if (!isStr(t.waitingOn)) return "invalid waiting-on";
  if (typeof t.isExample !== "boolean") return "invalid example flag";
  if (!isIso(t.createdAt) || !isIso(t.updatedAt)) return "invalid timestamps";
  if (t.completedAt !== null && !isIso(t.completedAt)) return "invalid completedAt";
  if (!Array.isArray(t.notes)) return "invalid notes";
  for (const n of t.notes) {
    if (!isObj(n) || !isStr(n.id) || !isStr(n.text) || !isIso(n.createdAt)) return "invalid progress note";
  }
  return null;
}

function entryProblem(e: unknown): string | null {
  if (!isObj(e)) return "not an object";
  if (!isStr(e.id) || !e.id) return "missing id";
  if (!isValidDateKey(e.date)) return "invalid date";
  if (!isIso(e.createdAt) || !isIso(e.updatedAt)) return "invalid timestamps";
  if (!isObj(e.sections)) return "missing sections";
  for (const id of SECTION_IDS) if (!isStr(e.sections[id])) return `invalid section "${id}"`;
  return null;
}

export function parseAppData(raw: string): Result<AppData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Stored data is not valid JSON." };
  }
  if (!isObj(parsed)) return { ok: false, error: "Stored data has an unexpected shape." };
  if (parsed.schemaVersion !== 1) return { ok: false, error: `Unsupported data version: ${String(parsed.schemaVersion)}.` };
  if (!isIso(parsed.seededAt)) return { ok: false, error: "Stored data is missing its creation time." };
  if (!Array.isArray(parsed.tasks)) return { ok: false, error: "Stored tasks are missing or not a list." };
  if (!Array.isArray(parsed.journalEntries)) return { ok: false, error: "Stored journal entries are missing or not a list." };

  const taskIds = new Set<string>();
  for (const [i, t] of parsed.tasks.entries()) {
    const problem = taskProblem(t);
    if (problem) return { ok: false, error: `Task #${i + 1} is malformed (${problem}).` };
    const id = (t as Obj).id as string;
    if (taskIds.has(id)) return { ok: false, error: `Two tasks share the id ${id}.` };
    taskIds.add(id);
  }
  const dates = new Set<string>();
  for (const [i, e] of parsed.journalEntries.entries()) {
    const problem = entryProblem(e);
    if (problem) return { ok: false, error: `Journal entry #${i + 1} is malformed (${problem}).` };
    const date = (e as Obj).date as string;
    if (dates.has(date)) return { ok: false, error: `Two journal entries exist for ${date}.` };
    dates.add(date);
  }
  return { ok: true, value: parsed as unknown as AppData };
}

/**
 * Converts between database rows (snake_case, one table per kind) and the app's
 * model (camelCase, notes nested in tasks). Pure functions; unit tested.
 */
import { SECTION_IDS } from "./journal";
import type { AppData, JournalEntry, ProgressNote, Task } from "./types";

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: string;
  status: string;
  waiting_on: string;
  is_example: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface NoteRow {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export type JournalRow = {
  id: string;
  user_id: string;
  entry_date: string;
  created_at: string;
  updated_at: string;
} & Record<(typeof SECTION_IDS)[number], string>;

/** Postgres returns timestamps like "2026-11-07 14:00:00+00"; normalize to ISO 8601 UTC. */
export function toIso(value: string): string {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

export function taskToRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description,
    due_date: task.dueDate,
    priority: task.priority,
    status: task.status,
    waiting_on: task.waitingOn,
    is_example: task.isExample,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt,
  };
}

export function noteToRow(note: ProgressNote, taskId: string, userId: string): NoteRow {
  return { id: note.id, task_id: taskId, user_id: userId, body: note.text, created_at: note.createdAt };
}

export function entryToRow(entry: JournalEntry, userId: string): JournalRow {
  return {
    id: entry.id,
    user_id: userId,
    entry_date: entry.date,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    ...entry.sections,
  };
}

/** Builds app data from rows. The result is checked by validate.ts before use. */
export function rowsToAppData(tasks: TaskRow[], notes: NoteRow[], entries: JournalRow[], now: string): AppData {
  const notesByTask = new Map<string, ProgressNote[]>();
  for (const n of [...notes].sort((a, b) => toIso(a.created_at).localeCompare(toIso(b.created_at)))) {
    const list = notesByTask.get(n.task_id) ?? [];
    list.push({ id: n.id, text: n.body, createdAt: toIso(n.created_at) });
    notesByTask.set(n.task_id, list);
  }
  return {
    schemaVersion: 1,
    seededAt: now,
    tasks: tasks.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      dueDate: r.due_date,
      priority: r.priority as Task["priority"],
      status: r.status as Task["status"],
      waitingOn: r.waiting_on ?? "",
      notes: notesByTask.get(r.id) ?? [],
      isExample: r.is_example,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
      completedAt: r.completed_at ? toIso(r.completed_at) : null,
    })),
    journalEntries: entries.map((r) => ({
      id: r.id,
      date: r.entry_date,
      sections: Object.fromEntries(SECTION_IDS.map((id) => [id, r[id] ?? ""])) as JournalEntry["sections"],
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    })),
  };
}

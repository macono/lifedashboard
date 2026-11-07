/**
 * The boundary between the app and where data lives.
 *
 * LifeStore computes the new state with pure functions, then hands the repository
 * both a small description of the change and the full next state:
 *  - the local (browser) repository simply saves the full next state;
 *  - the Supabase repository performs just the described change.
 */
import type { AppData, JournalEntry, ProgressNote, Task } from "./types";

export type Change =
  | { type: "task.insert"; task: Task }
  | { type: "task.update"; task: Task }
  | { type: "task.delete"; id: string }
  | { type: "note.insert"; taskId: string; note: ProgressNote }
  | { type: "note.delete"; taskId: string; noteId: string }
  | { type: "journal.upsert"; entry: JournalEntry }
  | { type: "import"; tasks: Task[]; journalEntries: JournalEntry[] }
  | { type: "replace-all" };

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; data: AppData }
  | { kind: "invalid"; raw: string; error: string }
  | { kind: "unavailable"; error: string };

export interface Repository {
  /** "local" = this browser only (demo); "cloud" = signed-in Supabase account. */
  readonly kind: "local" | "cloud";
  load(): Promise<LoadResult>;
  /** Persists a change. Throws an Error with a readable message on failure. */
  commit(change: Change, next: AppData): Promise<void>;
  /** Local only: copy current raw data to a backup key. */
  backupRaw?(now: string): string | null;
  /** Calls back when data may have changed elsewhere (another tab or device). */
  subscribeExternal?(callback: () => void): () => void;
}

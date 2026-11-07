/**
 * LifeStore: the single source of truth for app data in the browser.
 *
 * UI → hooks (useLifeState / useLifeStore) → LifeStore → Repository
 * (browser localStorage in demo mode, Supabase when signed in).
 *
 * Every change is computed with pure functions, persisted, and only then shown,
 * so the screen never claims something was saved when it wasn't. Changes run
 * one at a time, in order.
 */
import { nowIso, todayKey, type DateKey } from "@/lib/dates";
import { appendToSection, findEntry, saveEntry } from "./journal";
import type { Change, Repository } from "./repository";
import { createSeedData } from "./seed";
import * as T from "./tasks";
import type { AppData, JournalEntry, JournalSectionId, JournalSections, Result, Task } from "./types";

export type StoreState =
  | { status: "loading" }
  | { status: "ready"; data: AppData }
  | { status: "invalid"; raw: string; error: string }
  | { status: "unavailable"; error: string };

export const LOADING_STATE: StoreState = { status: "loading" };

export interface Clock {
  now(): string;
  today(): DateKey;
}

const systemClock: Clock = { now: nowIso, today: () => todayKey() };

type Computed<V> = Result<{ next: AppData; change: Change; value: V }>;

export interface ImportOptions {
  includeExamples: boolean;
}

export interface ImportPlan {
  tasks: Task[];
  noteCount: number;
  journalEntries: JournalEntry[];
  skippedExamples: number;
  /** Dates that already have an entry in the destination; those entries are left alone. */
  skippedDates: DateKey[];
  /** Tasks already present in the destination (same id), e.g. from an earlier import. */
  alreadyImported: number;
}

const emptyData = (now: string): AppData => ({ schemaVersion: 1, seededAt: now, tasks: [], journalEntries: [] });

/** Works out what importing `source` into `target` would add. Pure; used for the preview and the import. */
export function planImport(source: AppData, target: AppData, options: ImportOptions): ImportPlan {
  const existingIds = new Set(target.tasks.map((t) => t.id));
  const candidates = source.tasks.filter((t) => options.includeExamples || !t.isExample);
  const tasks = candidates.filter((t) => !existingIds.has(t.id));
  const skippedDates: DateKey[] = [];
  const journalEntries = source.journalEntries.filter((e) => {
    if (findEntry(target.journalEntries, e.date)) {
      skippedDates.push(e.date);
      return false;
    }
    return true;
  });
  return {
    tasks,
    noteCount: tasks.reduce((n, t) => n + t.notes.length, 0),
    journalEntries,
    skippedExamples: source.tasks.length - candidates.length,
    skippedDates: skippedDates.sort(),
    alreadyImported: candidates.length - tasks.length,
  };
}

export class LifeStore {
  private state: StoreState = LOADING_STATE;
  private listeners = new Set<() => void>();
  private initialized = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private repo: Repository,
    private clock: Clock = systemClock,
  ) {}

  get mode(): Repository["kind"] {
    return this.repo.kind;
  }

  getState = (): StoreState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(state: StoreState) {
    this.state = state;
    this.listeners.forEach((l) => l());
  }

  /** Runs operations one at a time so each starts from the latest saved state. */
  private enqueue<V>(op: () => Promise<V>): Promise<V> {
    const run = this.queue.then(op, op);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Loads data. In demo mode, example data is created only when nothing has ever been stored. */
  init(): Promise<void> {
    if (this.initialized) return this.queue.then(() => undefined);
    this.initialized = true;
    return this.reload({ seedIfEmpty: this.repo.kind === "local" });
  }

  /** Reloads when data may have changed elsewhere. Returns an unsubscribe function. */
  watchExternalChanges(): () => void {
    return this.repo.subscribeExternal?.(() => void this.reload()) ?? (() => {});
  }

  reload({ seedIfEmpty = false } = {}): Promise<void> {
    return this.enqueue(async () => {
      const result = await this.repo.load().catch(
        (e: unknown) => ({ kind: "unavailable", error: e instanceof Error ? e.message : String(e) }) as const,
      );
      switch (result.kind) {
        case "ok":
          return this.setState({ status: "ready", data: result.data });
        case "invalid":
          return this.setState({ status: "invalid", raw: result.raw, error: result.error });
        case "unavailable":
          // Keep showing already-loaded data if a background refresh fails.
          if (this.state.status === "ready") return;
          return this.setState({ status: "unavailable", error: result.error });
        case "empty": {
          if (!seedIfEmpty) return this.setState({ status: "ready", data: emptyData(this.clock.now()) });
          const seed = createSeedData(this.clock.today(), this.clock.now());
          try {
            await this.repo.commit({ type: "replace-all" }, seed);
          } catch {
            return this.setState({ status: "unavailable", error: "This browser would not let the app save data." });
          }
          return this.setState({ status: "ready", data: seed });
        }
      }
    });
  }

  /** Computes a change from the current data, persists it, then updates the screen. */
  private run<V>(compute: (data: AppData, now: string) => Computed<V>): Promise<Result<V>> {
    return this.enqueue(async () => {
      if (this.state.status !== "ready") return { ok: false, error: "Data isn't available right now, so nothing was changed." };
      const computed = compute(this.state.data, this.clock.now());
      if (!computed.ok) return computed;
      try {
        await this.repo.commit(computed.value.change, computed.value.next);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Couldn't save. Your change was not kept." };
      }
      this.setState({ status: "ready", data: computed.value.next });
      return { ok: true, value: computed.value.value };
    });
  }

  private changeTask(
    id: string,
    change: (task: Task, now: string) => Result<Task>,
    describe: (before: Task, after: Task) => Change = (_b, task) => ({ type: "task.update", task }),
  ): Promise<Result<Task>> {
    return this.run((data, now) => {
      const task = data.tasks.find((t) => t.id === id);
      if (!task) return { ok: false, error: "That task no longer exists." };
      const changed = change(task, now);
      if (!changed.ok) return changed;
      const next = { ...data, tasks: data.tasks.map((t) => (t.id === id ? changed.value : t)) };
      return { ok: true, value: { next, change: describe(task, changed.value), value: changed.value } };
    });
  }

  // ---------- Tasks ----------

  createTask(input: T.TaskInput): Promise<Result<Task>> {
    return this.run((data, now) => {
      const created = T.createTask(input, now);
      if (!created.ok) return created;
      const task = created.value;
      return { ok: true, value: { next: { ...data, tasks: [...data.tasks, task] }, change: { type: "task.insert", task }, value: task } };
    });
  }

  updateTask(id: string, input: T.TaskInput) {
    return this.changeTask(id, (task, now) => T.updateTask(task, input, now));
  }

  completeTask(id: string) {
    return this.changeTask(id, (task, now) => ({ ok: true, value: T.completeTask(task, now) }));
  }

  reopenTask(id: string) {
    return this.changeTask(id, (task, now) => ({ ok: true, value: T.reopenTask(task, now) }));
  }

  addProgressNote(id: string, text: string) {
    return this.changeTask(
      id,
      (task, now) => T.addProgressNote(task, text, now),
      (_before, after) => ({ type: "note.insert", taskId: id, note: after.notes[after.notes.length - 1] }),
    );
  }

  deleteProgressNote(id: string, noteId: string) {
    return this.changeTask(
      id,
      (task, now) => ({ ok: true, value: T.deleteProgressNote(task, noteId, now) }),
      () => ({ type: "note.delete", taskId: id, noteId }),
    );
  }

  deleteTask(id: string): Promise<Result<null>> {
    return this.run((data) => {
      if (!data.tasks.some((t) => t.id === id)) return { ok: false, error: "That task no longer exists." };
      return { ok: true, value: { next: { ...data, tasks: data.tasks.filter((t) => t.id !== id) }, change: { type: "task.delete", id }, value: null } };
    });
  }

  // ---------- Journal ----------

  saveJournalEntry(date: DateKey, sections: Partial<JournalSections>): Promise<Result<JournalEntry>> {
    return this.run((data, now) => {
      const result = saveEntry(data.journalEntries, date, sections, now);
      if (!result.ok) return result;
      const { entries, entry } = result.value;
      return { ok: true, value: { next: { ...data, journalEntries: entries }, change: { type: "journal.upsert", entry }, value: entry } };
    });
  }

  appendToJournal(date: DateKey, section: JournalSectionId, text: string): Promise<Result<JournalEntry>> {
    return this.run((data, now) => {
      const result = appendToSection(data.journalEntries, date, section, text, now);
      if (!result.ok) return result;
      const { entries, entry } = result.value;
      return { ok: true, value: { next: { ...data, journalEntries: entries }, change: { type: "journal.upsert", entry }, value: entry } };
    });
  }

  // ---------- Import (browser demo data → signed-in account) ----------

  /** Adds tasks and journal entries from another data set. Never overwrites existing entries. */
  importData(source: AppData, options: ImportOptions): Promise<Result<ImportPlan>> {
    return this.run((data) => {
      const plan = planImport(source, data, options);
      if (plan.tasks.length === 0 && plan.journalEntries.length === 0) return { ok: false, error: "There's nothing new to import." };
      const next = { ...data, tasks: [...data.tasks, ...plan.tasks], journalEntries: [...data.journalEntries, ...plan.journalEntries] };
      return { ok: true, value: { next, change: { type: "import", tasks: plan.tasks, journalEntries: plan.journalEntries }, value: plan } };
    });
  }

  // ---------- Demo data management (browser mode only) ----------

  /**
   * Replaces everything with fresh example data. The previous raw data is first
   * copied to a backup key in the same browser, so a reset is recoverable.
   */
  resetDemoData(): Promise<Result<{ backupKey: string | null }>> {
    return this.enqueue(async () => {
      if (this.repo.kind !== "local" || !this.repo.backupRaw) return { ok: false, error: "Reset is only available for browser demo data." };
      const now = this.clock.now();
      let backupKey: string | null;
      try {
        backupKey = this.repo.backupRaw(now);
      } catch {
        return { ok: false, error: "Couldn't make a backup copy first, so nothing was reset." };
      }
      const seed = createSeedData(this.clock.today(), now);
      try {
        await this.repo.commit({ type: "replace-all" }, seed);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Couldn't reset." };
      }
      this.setState({ status: "ready", data: seed });
      return { ok: true, value: { backupKey } };
    });
  }

  /** JSON text of the current data (or the unreadable raw text) for download. */
  exportJson(): string | null {
    if (this.state.status === "ready") return JSON.stringify(this.state.data, null, 2);
    if (this.state.status === "invalid") return this.state.raw;
    return null;
  }
}

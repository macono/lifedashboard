/**
 * LifeStore: the single source of truth for app data in the browser.
 *
 * UI → hooks (useLifeData) → LifeStore → repository (localStorage today, Supabase later).
 * Actions are async so the UI already awaits them; swapping in a network-backed
 * repository won't change component code.
 */
import { nowIso, todayKey, type DateKey } from "@/lib/dates";
import { appendToSection, saveEntry } from "./journal";
import type { LocalRepository } from "./local-repository";
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

export class LifeStore {
  private state: StoreState = LOADING_STATE;
  private listeners = new Set<() => void>();
  private initialized = false;

  constructor(
    private repo: LocalRepository,
    private clock: Clock = systemClock,
  ) {}

  getState = (): StoreState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(state: StoreState) {
    this.state = state;
    this.listeners.forEach((l) => l());
  }

  /** Loads stored data. Seeds example data only when nothing has ever been stored. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.reload({ seedIfEmpty: true });
  }

  reload({ seedIfEmpty = false } = {}): void {
    const result = this.repo.load();
    switch (result.kind) {
      case "ok":
        return this.setState({ status: "ready", data: result.data });
      case "invalid":
        return this.setState({ status: "invalid", raw: result.raw, error: result.error });
      case "unavailable":
        return this.setState({ status: "unavailable", error: result.error });
      case "empty": {
        if (!seedIfEmpty) {
          // Another tab cleared storage; show an empty data set rather than re-seeding.
          return this.setState({ status: "ready", data: { schemaVersion: 1, seededAt: this.clock.now(), tasks: [], journalEntries: [] } });
        }
        const seed = createSeedData(this.clock.today(), this.clock.now());
        try {
          this.repo.save(seed);
        } catch {
          return this.setState({ status: "unavailable", error: "This browser would not let the app save data." });
        }
        return this.setState({ status: "ready", data: seed });
      }
    }
  }

  private requireData(): Result<AppData> {
    return this.state.status === "ready"
      ? { ok: true, value: this.state.data }
      : { ok: false, error: "Data isn't available right now, so nothing was changed." };
  }

  private commit(next: AppData): Result<AppData> {
    try {
      this.repo.save(next);
    } catch {
      return { ok: false, error: "Couldn't save — browser storage may be full or blocked. Your change was not kept." };
    }
    this.setState({ status: "ready", data: next });
    return { ok: true, value: next };
  }

  private async changeTask(id: string, change: (task: Task, now: string) => Result<Task>): Promise<Result<Task>> {
    const data = this.requireData();
    if (!data.ok) return data;
    const task = data.value.tasks.find((t) => t.id === id);
    if (!task) return { ok: false, error: "That task no longer exists." };
    const changed = change(task, this.clock.now());
    if (!changed.ok) return changed;
    const saved = this.commit({ ...data.value, tasks: data.value.tasks.map((t) => (t.id === id ? changed.value : t)) });
    return saved.ok ? changed : saved;
  }

  // ---------- Tasks ----------

  async createTask(input: T.TaskInput): Promise<Result<Task>> {
    const data = this.requireData();
    if (!data.ok) return data;
    const created = T.createTask(input, this.clock.now());
    if (!created.ok) return created;
    const saved = this.commit({ ...data.value, tasks: [...data.value.tasks, created.value] });
    return saved.ok ? created : saved;
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
    return this.changeTask(id, (task, now) => T.addProgressNote(task, text, now));
  }

  deleteProgressNote(id: string, noteId: string) {
    return this.changeTask(id, (task, now) => ({ ok: true, value: T.deleteProgressNote(task, noteId, now) }));
  }

  async deleteTask(id: string): Promise<Result<null>> {
    const data = this.requireData();
    if (!data.ok) return data;
    if (!data.value.tasks.some((t) => t.id === id)) return { ok: false, error: "That task no longer exists." };
    const saved = this.commit({ ...data.value, tasks: data.value.tasks.filter((t) => t.id !== id) });
    return saved.ok ? { ok: true, value: null } : saved;
  }

  // ---------- Journal ----------

  async saveJournalEntry(date: DateKey, sections: Partial<JournalSections>): Promise<Result<JournalEntry>> {
    const data = this.requireData();
    if (!data.ok) return data;
    const result = saveEntry(data.value.journalEntries, date, sections, this.clock.now());
    if (!result.ok) return result;
    const saved = this.commit({ ...data.value, journalEntries: result.value.entries });
    return saved.ok ? { ok: true, value: result.value.entry } : saved;
  }

  async appendToJournal(date: DateKey, section: JournalSectionId, text: string): Promise<Result<JournalEntry>> {
    const data = this.requireData();
    if (!data.ok) return data;
    const result = appendToSection(data.value.journalEntries, date, section, text, this.clock.now());
    if (!result.ok) return result;
    const saved = this.commit({ ...data.value, journalEntries: result.value.entries });
    return saved.ok ? { ok: true, value: result.value.entry } : saved;
  }

  // ---------- Demo data management ----------

  /**
   * Replaces everything with fresh example data. The previous raw data is first
   * copied to a backup key in the same browser, so a reset is recoverable.
   */
  async resetDemoData(): Promise<Result<{ backupKey: string | null }>> {
    const now = this.clock.now();
    let backupKey: string | null;
    try {
      backupKey = this.repo.backupRaw(now);
    } catch {
      return { ok: false, error: "Couldn't make a backup copy first, so nothing was reset." };
    }
    const saved = this.commit(createSeedData(this.clock.today(), now));
    return saved.ok ? { ok: true, value: { backupKey } } : saved;
  }

  /** JSON text of the current data (or the unreadable raw text) for download. */
  exportJson(): string | null {
    if (this.state.status === "ready") return JSON.stringify(this.state.data, null, 2);
    if (this.state.status === "invalid") return this.state.raw;
    return null;
  }
}

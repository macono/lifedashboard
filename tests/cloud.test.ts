import { describe, expect, it } from "vitest";
import type { Change, LoadResult, Repository } from "@/lib/data/repository";
import { LifeStore, planImport, type Clock } from "@/lib/data/store";
import { entryToRow, noteToRow, rowsToAppData, taskToRow, toIso } from "@/lib/data/supabase-mapping";
import { createTask, addProgressNote } from "@/lib/data/tasks";
import { saveEntry } from "@/lib/data/journal";
import type { AppData } from "@/lib/data/types";
import { parseAppData } from "@/lib/data/validate";

const NOW = "2026-11-07T14:00:00.000Z";
const clock: Clock = { now: () => NOW, today: () => "2026-11-07" };
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Stands in for Supabase: records every change, can be told to fail, starts empty. */
class FakeCloud implements Repository {
  readonly kind = "cloud" as const;
  changes: Change[] = [];
  failNext: string | null = null;
  delayMs = 0;
  constructor(private initial: AppData = { schemaVersion: 1, seededAt: NOW, tasks: [], journalEntries: [] }) {}
  async load(): Promise<LoadResult> {
    return { kind: "ok", data: this.initial };
  }
  async commit(change: Change) {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.failNext) {
      const message = this.failNext;
      this.failNext = null;
      throw new Error(message);
    }
    this.changes.push(change);
  }
}

async function cloudStore(repo = new FakeCloud()) {
  const store = new LifeStore(repo, clock);
  await store.init();
  return { store, repo };
}

const ready = (store: LifeStore) => {
  const s = store.getState();
  if (s.status !== "ready") throw new Error(s.status);
  return s.data;
};

describe("signed-in (cloud) store", () => {
  it("does not create example data in a real account", async () => {
    const { store, repo } = await cloudStore();
    expect(ready(store).tasks).toEqual([]);
    expect(repo.changes).toEqual([]);
  });

  it("sends small, specific changes to the database", async () => {
    const { store, repo } = await cloudStore();
    const created = await store.createTask({ title: "Pay water bill" });
    if (!created.ok) throw new Error(created.error);
    const id = created.value.id;
    await store.addProgressNote(id, "Called the utility");
    await store.completeTask(id);
    await store.saveJournalEntry("2026-11-07", { exercises: "Walk" });
    await store.deleteTask(id);

    expect(repo.changes.map((c) => c.type)).toEqual(["task.insert", "note.insert", "task.update", "journal.upsert", "task.delete"]);
    const note = repo.changes[1];
    expect(note.type === "note.insert" && note.note.text).toBe("Called the utility");
    const done = repo.changes[2];
    expect(done.type === "task.update" && done.task.status).toBe("done");
  });

  it("keeps the screen unchanged and reports the error when saving fails", async () => {
    const { store, repo } = await cloudStore();
    const message = "Couldn't save the task: no connection to Supabase. Your change was not kept.";
    repo.failNext = message;
    const result = await store.createTask({ title: "Offline task" });
    expect(result).toEqual({ ok: false, error: message });
    expect(ready(store).tasks).toEqual([]);
  });

  it("applies rapid changes in order without losing any", async () => {
    const { store, repo } = await cloudStore();
    repo.delayMs = 5;
    await Promise.all([store.createTask({ title: "One" }), store.createTask({ title: "Two" }), store.createTask({ title: "Three" })]);
    expect(ready(store).tasks.map((t) => t.title)).toEqual(["One", "Two", "Three"]);
    expect(repo.changes).toHaveLength(3);
  });

  it("refuses demo reset for an account", async () => {
    const { store } = await cloudStore();
    expect((await store.resetDemoData()).ok).toBe(false);
  });
});

describe("import from browser demo data", () => {
  function demoData(): AppData {
    const example = createTask({ title: "Example: sample" }, NOW, { isExample: true });
    const real = createTask({ title: "Real task" }, NOW);
    if (!example.ok || !real.ok) throw new Error("setup");
    const withNote = addProgressNote(real.value, "note", NOW);
    if (!withNote.ok) throw new Error("setup");
    const e1 = saveEntry([], "2026-11-05", { completed: "old" }, NOW);
    const e2 = e1.ok && saveEntry(e1.value.entries, "2026-11-06", { completed: "browser text" }, NOW);
    if (!e2 || !e2.ok) throw new Error("setup");
    return { schemaVersion: 1, seededAt: NOW, tasks: [example.value, withNote.value], journalEntries: e2.value.entries };
  }

  it("leaves out examples by default and never overwrites existing journal dates", () => {
    const source = demoData();
    const existing = saveEntry([], "2026-11-06", { completed: "account text" }, NOW);
    if (!existing.ok) throw new Error("setup");
    const target: AppData = { schemaVersion: 1, seededAt: NOW, tasks: [], journalEntries: existing.value.entries };

    const plan = planImport(source, target, { includeExamples: false });
    expect(plan.tasks.map((t) => t.title)).toEqual(["Real task"]);
    expect(plan.noteCount).toBe(1);
    expect(plan.skippedExamples).toBe(1);
    expect(plan.journalEntries.map((e) => e.date)).toEqual(["2026-11-05"]);
    expect(plan.skippedDates).toEqual(["2026-11-06"]);
    expect(planImport(source, target, { includeExamples: true }).tasks).toHaveLength(2);
  });

  it("imports once; running it again finds nothing new", async () => {
    const source = demoData();
    const { store, repo } = await cloudStore();
    const first = await store.importData(source, { includeExamples: false });
    expect(first.ok).toBe(true);
    expect(repo.changes[0].type).toBe("import");
    expect(ready(store).journalEntries).toHaveLength(2);
    const again = await store.importData(source, { includeExamples: false });
    expect(again).toEqual({ ok: false, error: "There's nothing new to import." });
  });
});

describe("Supabase row mapping", () => {
  it("normalizes Postgres timestamps to ISO 8601", () => {
    expect(toIso("2026-11-07 14:00:00+00")).toBe("2026-11-07T14:00:00.000Z");
    expect(toIso("2026-11-07T09:00:00-05:00")).toBe("2026-11-07T14:00:00.000Z");
  });

  it("round-trips tasks, notes, and journal entries", () => {
    const t = createTask({ title: "Renew passport", dueDate: "2026-12-01", priority: "high", waitingOn: "Photos" }, NOW);
    if (!t.ok) throw new Error("setup");
    const n = addProgressNote(t.value, "Line 1\nLine 2", "2026-11-07T15:00:00.000Z");
    if (!n.ok) throw new Error("setup");
    const task = n.value;
    const e = saveEntry([], "2026-11-07", { completed: "A\n\nB", flock_plan: "Plan" }, NOW);
    if (!e.ok) throw new Error("setup");
    const entry = e.value.entry;

    const taskRow = taskToRow(task, USER);
    expect(taskRow).toMatchObject({ user_id: USER, due_date: "2026-12-01", waiting_on: "Photos", is_example: false });
    const noteRows = task.notes.map((note) => noteToRow(note, task.id, USER));
    const entryRow = entryToRow(entry, USER);
    expect(entryRow).toMatchObject({ entry_date: "2026-11-07", completed: "A\n\nB", flock_plan: "Plan", random_thoughts: "" });

    const data = rowsToAppData([taskRow], noteRows, [entryRow], NOW);
    expect(data.tasks[0]).toEqual(task);
    expect(data.journalEntries[0]).toEqual(entry);
    expect(parseAppData(JSON.stringify(data)).ok).toBe(true);
  });

  it("attaches notes to the right task in time order", () => {
    const a = createTask({ title: "A" }, NOW);
    const b = createTask({ title: "B" }, NOW);
    if (!a.ok || !b.ok) throw new Error("setup");
    const notes = [
      { id: "n2", task_id: a.value.id, user_id: USER, body: "second", created_at: "2026-11-07 16:00:00+00" },
      { id: "n1", task_id: a.value.id, user_id: USER, body: "first", created_at: "2026-11-07 15:00:00+00" },
      { id: "n3", task_id: b.value.id, user_id: USER, body: "other", created_at: "2026-11-07 15:30:00+00" },
    ];
    const data = rowsToAppData([taskToRow(a.value, USER), taskToRow(b.value, USER)], notes, [], NOW);
    expect(data.tasks[0].notes.map((n) => n.text)).toEqual(["first", "second"]);
    expect(data.tasks[1].notes.map((n) => n.text)).toEqual(["other"]);
  });
});

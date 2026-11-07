import { describe, expect, it } from "vitest";
import { BACKUP_KEY_PREFIX, createLocalRepository, STORAGE_KEY } from "@/lib/data/local-repository";
import { LifeStore, type Clock } from "@/lib/data/store";
import { MemoryStorage } from "./memory-storage";

const clock: Clock = { now: () => "2026-11-06T14:00:00.000Z", today: () => "2026-11-06" };

/** A new LifeStore over the same storage behaves like a page refresh. */
async function open(storage: Storage) {
  const store = new LifeStore(createLocalRepository(() => storage), clock);
  await store.init();
  return store;
}

function data(store: LifeStore) {
  const s = store.getState();
  if (s.status !== "ready") throw new Error(`store not ready: ${s.status}`);
  return s.data;
}

describe("first run and persistence", () => {
  it("seeds clearly-marked example tasks on first run", async () => {
    const store = await open(new MemoryStorage());
    const { tasks, journalEntries } = data(store);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.isExample && t.title.startsWith("Example:"))).toBe(true);
    expect(journalEntries).toEqual([]);
  });

  it("does not recreate deleted examples after a refresh", async () => {
    const storage = new MemoryStorage();
    const first = await open(storage);
    for (const t of data(first).tasks) await first.deleteTask(t.id);
    expect(data(await open(storage)).tasks).toEqual([]);
  });

  it("keeps task changes across a refresh", async () => {
    const storage = new MemoryStorage();
    const store = await open(storage);
    const created = await store.createTask({ title: "Renew passport", dueDate: "2026-12-01", priority: "high" });
    if (!created.ok) throw new Error(created.error);
    await store.completeTask(created.value.id);
    await store.addProgressNote(created.value.id, "Mailed the form");

    const reloaded = data(await open(storage)).tasks.find((t) => t.id === created.value.id);
    expect(reloaded).toMatchObject({ title: "Renew passport", dueDate: "2026-12-01", status: "done", priority: "high" });
    expect(reloaded?.notes.map((n) => n.text)).toEqual(["Mailed the form"]);

    await (await open(storage)).reopenTask(created.value.id);
    expect(data(await open(storage)).tasks.find((t) => t.id === created.value.id)?.status).toBe("todo");
  });

  it("saves a journal entry and reopens it after a refresh", async () => {
    const storage = new MemoryStorage();
    const store = await open(storage);
    await store.saveJournalEntry("2026-11-06", { completed: "Finished report\nCalled Mom", flock_plan: "Step 1" });

    const entry = data(await open(storage)).journalEntries.find((e) => e.date === "2026-11-06");
    expect(entry?.sections.completed).toBe("Finished report\nCalled Mom");
    expect(entry?.sections.flock_plan).toBe("Step 1");
  });

  it("capture appends to a saved journal section without losing text", async () => {
    const storage = new MemoryStorage();
    const store = await open(storage);
    await store.saveJournalEntry("2026-11-06", { random_thoughts: "Original" });
    await store.appendToJournal("2026-11-06", "random_thoughts", "Captured later");
    expect(data(await open(storage)).journalEntries[0].sections.random_thoughts).toBe("Original\nCaptured later");
  });

  it("notifies subscribers so every view updates immediately", async () => {
    const store = await open(new MemoryStorage());
    let calls = 0;
    store.subscribe(() => calls++);
    await store.createTask({ title: "x" });
    expect(calls).toBe(1);
  });

  it("returns a validation error and saves nothing for a bad task", async () => {
    const storage = new MemoryStorage();
    const store = await open(storage);
    const before = storage.getItem(STORAGE_KEY);
    expect(await store.createTask({ title: "" })).toEqual({ ok: false, error: "Title is required." });
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });
});

describe("malformed stored data", () => {
  it("reports the problem and never overwrites the data", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const store = await open(storage);
    expect(store.getState()).toMatchObject({ status: "invalid", raw: "{not json" });

    const result = await store.createTask({ title: "x" });
    expect(result.ok).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe("{not json");
  });

  it("detects a malformed record inside otherwise valid data", async () => {
    const storage = new MemoryStorage();
    await open(storage);
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!);
    raw.tasks[0].status = "someday";
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));
    expect((await open(storage)).getState()).toMatchObject({ status: "invalid" });
  });

  it("backs up the unreadable data before a confirmed reset", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const store = await open(storage);
    const result = await store.resetDemoData();
    expect(result.ok).toBe(true);
    expect(storage.getItem(`${BACKUP_KEY_PREFIX}${clock.now()}`)).toBe("{not json");
    expect(store.getState().status).toBe("ready");
  });
});

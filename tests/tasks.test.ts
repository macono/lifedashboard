import { describe, expect, it } from "vitest";
import {
  addProgressNote,
  completeTask,
  createTask,
  derivePriorities,
  filterTasks,
  reopenTask,
  summarizeTasks,
  updateTask,
} from "@/lib/data/tasks";
import type { Task } from "@/lib/data/types";

const T0 = "2026-11-06T14:00:00.000Z";
const T1 = "2026-11-06T15:00:00.000Z";
const T2 = "2026-11-06T16:00:00.000Z";
const TODAY = "2026-11-06";

function make(input: Parameters<typeof createTask>[0]): Task {
  const r = createTask(input, T0);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("task create", () => {
  it("requires a title", () => {
    expect(createTask({ title: "   " }, T0)).toEqual({ ok: false, error: "Title is required." });
  });

  it("applies sensible defaults and trims the title", () => {
    const t = make({ title: "  Call the bank  " });
    expect(t).toMatchObject({
      title: "Call the bank",
      description: "",
      dueDate: null,
      priority: "medium",
      status: "todo",
      waitingOn: "",
      notes: [],
      isExample: false,
      createdAt: T0,
      updatedAt: T0,
      completedAt: null,
    });
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("gives every task a unique id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => make({ title: "x" }).id));
    expect(ids.size).toBe(50);
  });

  it("rejects an invalid due date", () => {
    expect(createTask({ title: "x", dueDate: "2026-02-30" }, T0).ok).toBe(false);
  });
});

describe("task edit", () => {
  it("updates fields and the updatedAt timestamp", () => {
    const t = make({ title: "Draft plan" });
    const r = updateTask(t, { title: "Draft weekly plan", dueDate: "2026-11-10", priority: "high", waitingOn: "Sam" }, T1);
    expect(r.ok && r.value).toMatchObject({
      title: "Draft weekly plan",
      dueDate: "2026-11-10",
      priority: "high",
      waitingOn: "Sam",
      createdAt: T0,
      updatedAt: T1,
    });
  });

  it("can clear the due date", () => {
    const t = make({ title: "x", dueDate: "2026-11-10" });
    const r = updateTask(t, { title: "x", dueDate: "" }, T1);
    expect(r.ok && r.value.dueDate).toBeNull();
  });

  it("does not save an empty title", () => {
    const t = make({ title: "x" });
    expect(updateTask(t, { title: "" }, T1).ok).toBe(false);
  });

  it("keeps completedAt consistent when the status is edited", () => {
    const t = make({ title: "x" });
    const done = updateTask(t, { title: "x", status: "done" }, T1);
    expect(done.ok && done.value.completedAt).toBe(T1);
    // Editing other fields of a done task keeps the original completion time.
    const edited = done.ok && updateTask(done.value, { title: "y" }, T2);
    expect(edited && edited.ok && edited.value.completedAt).toBe(T1);
    const reopened = done.ok && updateTask(done.value, { title: "x", status: "todo" }, T2);
    expect(reopened && reopened.ok && reopened.value.completedAt).toBeNull();
  });
});

describe("complete and reopen", () => {
  it("completes a task with a timestamp", () => {
    const t = completeTask(make({ title: "x", status: "in_progress" }), T1);
    expect(t.status).toBe("done");
    expect(t.completedAt).toBe(T1);
    expect(t.updatedAt).toBe(T1);
  });

  it("reopens a completed task to To do", () => {
    const t = reopenTask(completeTask(make({ title: "x" }), T1), T2);
    expect(t.status).toBe("todo");
    expect(t.completedAt).toBeNull();
    expect(t.updatedAt).toBe(T2);
  });
});

describe("progress notes", () => {
  it("adds timestamped notes in order", () => {
    const t = make({ title: "x" });
    const a = addProgressNote(t, "First", T1);
    const b = a.ok && addProgressNote(a.value, "Second\nwith a line break", T2);
    expect(b && b.ok && b.value.notes.map((n) => [n.text, n.createdAt])).toEqual([
      ["First", T1],
      ["Second\nwith a line break", T2],
    ]);
  });

  it("rejects an empty note", () => {
    expect(addProgressNote(make({ title: "x" }), "  ", T1).ok).toBe(false);
  });
});

describe("counts, filters, and priorities", () => {
  const tasks = [
    make({ title: "overdue", dueDate: "2026-11-04" }),
    make({ title: "today", dueDate: TODAY, priority: "low" }),
    make({ title: "in 3 days", dueDate: "2026-11-09", status: "waiting" }),
    make({ title: "in 7 days", dueDate: "2026-11-13" }),
    make({ title: "in 8 days high", dueDate: "2026-11-14", priority: "high" }),
    make({ title: "no date" }),
    make({ title: "done overdue", dueDate: "2026-11-01", status: "done" }),
  ];

  it("counts only open tasks as overdue / due today / upcoming", () => {
    expect(summarizeTasks(tasks, TODAY)).toEqual({ open: 6, overdue: 1, dueToday: 1, upcoming: 2, waiting: 1, done: 1 });
  });

  it("filters views", () => {
    const titles = (view: Parameters<typeof filterTasks>[1]) => filterTasks(tasks, view, TODAY).map((t) => t.title);
    expect(titles("overdue")).toEqual(["overdue"]);
    expect(titles("today")).toEqual(["today"]);
    expect(titles("waiting")).toEqual(["in 3 days"]);
    expect(titles("done")).toEqual(["done overdue"]);
    expect(titles("all")).toHaveLength(7);
  });

  it("ranks priorities: overdue, due today, high priority, then soon", () => {
    expect(derivePriorities(tasks, TODAY).map((p) => [p.task.title, p.reason])).toEqual([
      ["overdue", "Overdue by 2 days"],
      ["today", "Due today"],
      ["in 8 days high", "High priority · due in 8 days"],
    ]);
  });

  it("updates counts when a task is completed", () => {
    const next = tasks.map((t) => (t.title === "overdue" ? completeTask(t, T1) : t));
    expect(summarizeTasks(next, TODAY).overdue).toBe(0);
    expect(summarizeTasks(next, TODAY).done).toBe(2);
  });
});

/**
 * Pure task logic. No React, no storage — just data in, data out.
 * This is what the tests exercise and what a Supabase-backed store will reuse.
 */
import { addDays, daysBetween, isValidDateKey, type DateKey } from "@/lib/dates";
import { newId } from "./ids";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProgressNote,
  type Result,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "./types";

export const TITLE_MAX = 200;

export interface TaskInput {
  title: string;
  description?: string;
  dueDate?: DateKey | null | "";
  priority?: TaskPriority;
  status?: TaskStatus;
  waitingOn?: string;
}

interface NormalizedTaskInput {
  title: string;
  description: string;
  dueDate: DateKey | null;
  priority: TaskPriority;
  status: TaskStatus;
  waitingOn: string;
}

export function validateTaskInput(input: TaskInput): Result<NormalizedTaskInput> {
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > TITLE_MAX) return { ok: false, error: `Title must be ${TITLE_MAX} characters or fewer.` };

  const dueDate = input.dueDate ? input.dueDate : null;
  if (dueDate !== null && !isValidDateKey(dueDate)) return { ok: false, error: "Due date is not a valid date." };

  const priority = input.priority ?? "medium";
  if (!TASK_PRIORITIES.includes(priority)) return { ok: false, error: "Choose a valid priority." };

  const status = input.status ?? "todo";
  if (!TASK_STATUSES.includes(status)) return { ok: false, error: "Choose a valid status." };

  return {
    ok: true,
    value: {
      title,
      description: input.description ?? "",
      dueDate,
      priority,
      status,
      waitingOn: (input.waitingOn ?? "").trim(),
    },
  };
}

export function createTask(input: TaskInput, now: string, options: { isExample?: boolean } = {}): Result<Task> {
  const valid = validateTaskInput(input);
  if (!valid.ok) return valid;
  const v = valid.value;
  return {
    ok: true,
    value: {
      id: newId(),
      ...v,
      notes: [],
      isExample: options.isExample ?? false,
      createdAt: now,
      updatedAt: now,
      completedAt: v.status === "done" ? now : null,
    },
  };
}

/** Applies an edit. Keeps completedAt consistent with the status. */
export function updateTask(task: Task, input: TaskInput, now: string): Result<Task> {
  const valid = validateTaskInput({
    title: input.title,
    description: input.description ?? task.description,
    dueDate: input.dueDate === undefined ? task.dueDate : input.dueDate,
    priority: input.priority ?? task.priority,
    status: input.status ?? task.status,
    waitingOn: input.waitingOn ?? task.waitingOn,
  });
  if (!valid.ok) return valid;
  const v = valid.value;
  return { ok: true, value: { ...task, ...v, updatedAt: now, completedAt: completedAtFor(task, v.status, now) } };
}

function completedAtFor(task: Task, nextStatus: TaskStatus, now: string): string | null {
  if (nextStatus !== "done") return null;
  return task.status === "done" ? task.completedAt ?? now : now;
}

export function completeTask(task: Task, now: string): Task {
  if (task.status === "done") return task;
  return { ...task, status: "done", completedAt: now, updatedAt: now };
}

/** Reopening returns a task to "To do". */
export function reopenTask(task: Task, now: string): Task {
  if (task.status !== "done") return task;
  return { ...task, status: "todo", completedAt: null, updatedAt: now };
}

export function addProgressNote(task: Task, text: string, now: string): Result<Task> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Note can't be empty." };
  const note: ProgressNote = { id: newId(), text: trimmed, createdAt: now };
  return { ok: true, value: { ...task, notes: [...task.notes, note], updatedAt: now } };
}

export function deleteProgressNote(task: Task, noteId: string, now: string): Task {
  return { ...task, notes: task.notes.filter((n) => n.id !== noteId), updatedAt: now };
}

// ---------- Due-date classification & views ----------

export type DueState = "overdue" | "today" | "upcoming" | "later" | "none";

/** "upcoming" = due within the next 7 days (after today). */
export const UPCOMING_WINDOW_DAYS = 7;

export function dueState(task: Task, today: DateKey): DueState {
  if (!task.dueDate) return "none";
  const diff = daysBetween(today, task.dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= UPCOMING_WINDOW_DAYS) return "upcoming";
  return "later";
}

export const isOpen = (task: Task) => task.status !== "done";

export interface TaskSummary {
  open: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  waiting: number;
  done: number;
}

export function summarizeTasks(tasks: Task[], today: DateKey): TaskSummary {
  const summary: TaskSummary = { open: 0, overdue: 0, dueToday: 0, upcoming: 0, waiting: 0, done: 0 };
  for (const task of tasks) {
    if (!isOpen(task)) {
      summary.done++;
      continue;
    }
    summary.open++;
    if (task.status === "waiting") summary.waiting++;
    const state = dueState(task, today);
    if (state === "overdue") summary.overdue++;
    else if (state === "today") summary.dueToday++;
    else if (state === "upcoming") summary.upcoming++;
  }
  return summary;
}

export const TASK_VIEWS = ["open", "overdue", "today", "upcoming", "todo", "in_progress", "waiting", "done", "all"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export function isTaskView(value: unknown): value is TaskView {
  return typeof value === "string" && (TASK_VIEWS as readonly string[]).includes(value);
}

export function filterTasks(tasks: Task[], view: TaskView, today: DateKey): Task[] {
  switch (view) {
    case "all":
      return tasks;
    case "open":
      return tasks.filter(isOpen);
    case "overdue":
      return tasks.filter((t) => isOpen(t) && dueState(t, today) === "overdue");
    case "today":
      return tasks.filter((t) => isOpen(t) && dueState(t, today) === "today");
    case "upcoming":
      return tasks.filter((t) => isOpen(t) && dueState(t, today) === "upcoming");
    default:
      return tasks.filter((t) => t.status === view);
  }
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Open tasks first; then by due date (none last), then priority, then oldest first. Done tasks: most recently completed first. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === "done" ? 1 : 0;
    const bDone = b.status === "done" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (aDone) return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export interface PriorityItem {
  task: Task;
  reason: string;
}

/**
 * Derives a short priority list from real tasks:
 * overdue first, then due today, then High priority, then anything due in the next 7 days.
 */
export function derivePriorities(tasks: Task[], today: DateKey, limit = 3): PriorityItem[] {
  const score = (t: Task) => {
    const s = dueState(t, today);
    if (s === "overdue") return 0;
    if (s === "today") return 1;
    if (t.priority === "high") return 2;
    if (s === "upcoming") return 3;
    return 9;
  };
  const reason = (t: Task) => {
    const s = dueState(t, today);
    const days = t.dueDate ? daysBetween(t.dueDate, today) : 0;
    if (s === "overdue") return days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`;
    if (s === "today") return "Due today";
    if (t.priority === "high") return t.dueDate ? `High priority · due ${t.dueDate === addDays(today, 1) ? "tomorrow" : `in ${-days} days`}` : "High priority";
    return -days === 1 ? "Due tomorrow" : `Due in ${-days} days`;
  };
  return sortTasks(tasks.filter((t) => isOpen(t) && score(t) < 9))
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit)
    .map((task) => ({ task, reason: reason(task) }));
}

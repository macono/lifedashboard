import type { DateKey } from "@/lib/dates";

export const TASK_STATUSES = ["todo", "in_progress", "waiting", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  done: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export interface ProgressNote {
  id: string;
  text: string;
  createdAt: string; // ISO timestamp
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: DateKey | null; // local calendar date
  priority: TaskPriority;
  status: TaskStatus;
  waitingOn: string;
  notes: ProgressNote[];
  isExample: boolean; // fictional sample data seeded on first run
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const JOURNAL_SECTIONS = [
  { id: "completed", label: "Completed" },
  { id: "where_i_went", label: "Where I went" },
  { id: "what_i_learned", label: "What I learned" },
  { id: "what_i_ate", label: "What I ate" },
  { id: "exercises", label: "Exercises" },
  { id: "new_action_items", label: "New Action Items" },
  { id: "flock_plan", label: "Flock Plan" },
  { id: "random_thoughts", label: "Random Thoughts & Ideas" },
] as const;

export type JournalSectionId = (typeof JOURNAL_SECTIONS)[number]["id"];
export type JournalSections = Record<JournalSectionId, string>;

export interface JournalEntry {
  id: string;
  date: DateKey; // one entry per local calendar date
  sections: JournalSections;
  createdAt: string;
  updatedAt: string;
}

/** Everything the app stores. One document per browser in this increment. */
export interface AppData {
  schemaVersion: 1;
  seededAt: string;
  tasks: Task[];
  journalEntries: JournalEntry[];
}

/** Result type for operations that can fail validation. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

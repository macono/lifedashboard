/**
 * Fictional example data, created once on first run and marked isExample.
 * Due dates are relative to the day of first run so the overview has something to show.
 */
import { addDays, type DateKey } from "@/lib/dates";
import { createTask, addProgressNote, type TaskInput } from "./tasks";
import type { AppData, Task } from "./types";

export function createSeedData(today: DateKey, now: string): AppData {
  const examples: (TaskInput & { note?: string })[] = [
    {
      title: "Example: Renew library card",
      description: "Sample task to show an overdue item. Edit or delete it.",
      dueDate: addDays(today, -2),
      priority: "medium",
      status: "todo",
    },
    {
      title: "Example: Draft weekly plan",
      description: "Sample task due today.",
      dueDate: today,
      priority: "high",
      status: "in_progress",
      note: "Example progress note: outlined the first three items.",
    },
    {
      title: "Example: Get quote for gutter cleaning",
      description: "Sample task showing the Waiting status.",
      dueDate: addDays(today, 3),
      priority: "low",
      status: "waiting",
      waitingOn: "Example Co. to send a quote",
    },
    {
      title: "Example: Read chapter 2 of a course book",
      dueDate: addDays(today, 5),
      priority: "medium",
      status: "todo",
    },
    {
      title: "Example: Back up phone photos",
      description: "Sample completed task.",
      priority: "low",
      status: "done",
    },
  ];

  const tasks: Task[] = examples.map(({ note, ...input }) => {
    const created = createTask(input, now, { isExample: true });
    if (!created.ok) throw new Error(created.error);
    if (!note) return created.value;
    const withNote = addProgressNote(created.value, note, now);
    if (!withNote.ok) throw new Error(withNote.error);
    return withNote.value;
  });

  return { schemaVersion: 1, seededAt: now, tasks, journalEntries: [] };
}

import { AlertTriangle, CalendarClock, Hourglass } from "lucide-react";
import { relativeDayLabel, type DateKey } from "@/lib/dates";
import { dueState } from "@/lib/data/tasks";
import { PRIORITY_LABELS, STATUS_LABELS, type Task, type TaskPriority, type TaskStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const chip = "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200",
  medium: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-400/30 dark:bg-slate-400/10 dark:text-slate-200",
  low: "border-slate-200 bg-transparent text-slate-500 dark:border-slate-500/30 dark:text-slate-300",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "border-slate-300 text-slate-700 dark:border-slate-400/30 dark:text-slate-200",
  in_progress: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-200",
  waiting: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
  done: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
};

export function PriorityChip({ priority }: { priority: TaskPriority }) {
  return <span className={cn(chip, PRIORITY_STYLES[priority])}>{PRIORITY_LABELS[priority]}</span>;
}

export function StatusChip({ status }: { status: TaskStatus }) {
  return <span className={cn(chip, STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>;
}

export function ExampleChip() {
  return (
    <span className={cn(chip, "border-dashed border-slate-300 text-slate-500 dark:border-slate-500/50 dark:text-slate-400")} title="Fictional sample data">
      Example
    </span>
  );
}

export function DueChip({ task, today }: { task: Task; today: DateKey }) {
  if (!task.dueDate) return null;
  const state = task.status === "done" ? "done" : dueState(task, today);
  // "Due in 3 days", "Due tomorrow", "Due Nov 20" — lowercase the relative words mid-sentence.
  const label = relativeDayLabel(task.dueDate, today).replace(/^(In|Tomorrow|Yesterday|Today)\b/, (w) => w.toLowerCase());
  if (state === "overdue")
    return (
      <span className={cn(chip, "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-200")}>
        <AlertTriangle className="size-3" aria-hidden /> Overdue · {label}
      </span>
    );
  if (state === "today")
    return (
      <span className={cn(chip, "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-200")}>
        <CalendarClock className="size-3" aria-hidden /> Due today
      </span>
    );
  return (
    <span className={cn(chip, "border-slate-200 text-slate-600 dark:border-slate-500/30 dark:text-slate-300")}>
      <CalendarClock className="size-3" aria-hidden /> {state === "done" ? "Was due" : "Due"} {label}
    </span>
  );
}

export function WaitingOn({ text }: { text: string }) {
  if (!text) return null;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <Hourglass className="size-3" aria-hidden /> Waiting on: {text}
    </span>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListTodo, Plus } from "lucide-react";
import { useReady } from "@/components/shell/data-gate";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { Button } from "@/components/ui/button";
import { filterTasks, isTaskView, sortTasks, type TaskView } from "@/lib/data/tasks";
import { cn } from "@/lib/utils";

const VIEWS: { id: TaskView; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Due today" },
  { id: "upcoming", label: "Next 7 days" },
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

const EMPTY: Record<TaskView, string> = {
  open: "No open tasks. Nice work — or add something new.",
  overdue: "Nothing overdue.",
  today: "Nothing due today.",
  upcoming: "Nothing due in the next 7 days.",
  todo: "No tasks in To do.",
  in_progress: "No tasks in progress.",
  waiting: "Nothing waiting on someone else.",
  done: "No completed tasks yet.",
  all: "No tasks yet. Create your first one.",
};

export function TasksView() {
  const { data, today } = useReady();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const viewParam = params.get("view");
  const view: TaskView = isTaskView(viewParam) ? viewParam : "open";
  const taskParam = params.get("task");

  const setParams = (next: { view?: TaskView; task?: string | null }) => {
    const sp = new URLSearchParams(params.toString());
    if (next.view) {
      if (next.view === "open") sp.delete("view");
      else sp.set("view", next.view);
    }
    if (next.task === null) sp.delete("task");
    else if (next.task) sp.set("task", next.task);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const tasks = sortTasks(filterTasks(data.tasks, view, today));
  const openTask = taskParam && taskParam !== "new" ? data.tasks.find((t) => t.id === taskParam) : undefined;
  const dialogOpen = taskParam === "new" || !!openTask;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">Track what needs doing, what&apos;s waiting, and progress along the way.</p>
        </div>
        <Button onClick={() => setParams({ task: "new" })}>
          <Plus /> New task
        </Button>
      </div>

      <div role="tablist" aria-label="Filter tasks" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {VIEWS.map((v) => {
          const count = filterTasks(data.tasks, v.id, today).length;
          const active = v.id === view;
          const alert = (v.id === "overdue" && count > 0) || false;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ view: v.id })}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {v.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-white/20" : alert ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <ListTodo className="text-muted-foreground size-8" aria-hidden />
            <p className="text-muted-foreground text-sm">{EMPTY[view]}</p>
            <div className="flex gap-2">
              {view !== "open" && view !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setParams({ view: "open" })}>
                  Show open tasks
                </Button>
              )}
              <Button size="sm" onClick={() => setParams({ task: "new" })}>
                <Plus /> New task
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} today={today} onOpen={(id) => setParams({ task: id })} />
            ))}
          </ul>
        )}
      </div>
      {taskParam && taskParam !== "new" && !openTask && (
        <p className="text-muted-foreground mt-3 text-sm" role="status">
          That task no longer exists.
        </p>
      )}

      <TaskDialog open={dialogOpen} task={openTask} onClose={() => setParams({ task: null })} />
    </div>
  );
}

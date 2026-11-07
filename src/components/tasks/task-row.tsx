"use client";

import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { DueChip, ExampleChip, PriorityChip, StatusChip, WaitingOn } from "@/components/tasks/task-meta";
import type { DateKey } from "@/lib/dates";
import { useLifeStore } from "@/lib/data/provider";
import type { Task } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/** One task line with a working completion checkbox. Clicking the title opens details. */
export function TaskRow({ task, today, onOpen, compact = false }: { task: Task; today: DateKey; onOpen: (id: string) => void; compact?: boolean }) {
  const store = useLifeStore();
  const done = task.status === "done";

  async function toggle() {
    const result = done ? await store.reopenTask(task.id) : await store.completeTask(task.id);
    if (!result.ok) return toast.error(result.error);
    toast.success(done ? `Reopened “${task.title}”` : `Completed “${task.title}”`, {
      action: { label: "Undo", onClick: () => void (done ? store.completeTask(task.id) : store.reopenTask(task.id)) },
    });
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        checked={done}
        onCheckedChange={() => void toggle()}
        className="mt-0.5 size-5"
        aria-label={done ? `Reopen “${task.title}”` : `Mark “${task.title}” done`}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className={cn(
            "hover:text-primary block cursor-pointer text-left text-sm font-medium break-words underline-offset-2 hover:underline",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <DueChip task={task} today={today} />
          {!compact && <StatusChip status={task.status} />}
          <PriorityChip priority={task.priority} />
          {task.isExample && <ExampleChip />}
          {!compact && task.notes.length > 0 && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <MessageSquareText className="size-3" aria-hidden /> {task.notes.length}
            </span>
          )}
        </div>
        {task.waitingOn && !done && (
          <div className="mt-1">
            <WaitingOn text={task.waitingOn} />
          </div>
        )}
      </div>
    </li>
  );
}

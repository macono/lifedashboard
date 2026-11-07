"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExampleChip } from "@/components/tasks/task-meta";
import { formatTimestamp } from "@/lib/dates";
import { useLifeState, useLifeStore } from "@/lib/data/provider";
import { TITLE_MAX, type TaskInput } from "@/lib/data/tasks";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskPriority, type TaskStatus } from "@/lib/data/types";

interface Props {
  open: boolean;
  /** undefined → create a new task */
  task?: Task;
  onClose: () => void;
}

/** Create, view, and edit a task in one dialog. Re-mounts per task so the form starts fresh. */
export function TaskDialog({ open, task, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {open && <TaskForm key={task?.id ?? "new"} task={task} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function toForm(task?: Task): Required<TaskInput> {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    dueDate: task?.dueDate ?? "",
    priority: task?.priority ?? "medium",
    status: task?.status ?? "todo",
    waitingOn: task?.waitingOn ?? "",
  };
}

function TaskForm({ task, onClose }: { task?: Task; onClose: () => void }) {
  const store = useLifeStore();
  const [form, setForm] = useState(() => toForm(task));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !task;

  const set = <K extends keyof TaskInput>(key: K, value: Required<TaskInput>[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = isNew ? await store.createTask(form) : await store.updateTask(task.id, form);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    toast.success(isNew ? "Task created" : "Task saved");
    onClose();
  }

  async function toggleDone() {
    if (!task) return;
    // Saves any edits in the form together with the status change.
    const result = await store.updateTask(task.id, { ...form, status: task.status === "done" ? "todo" : "done" });
    if (!result.ok) return setError(result.error);
    toast.success(task.status === "done" ? "Task reopened" : "Task completed");
    onClose();
  }

  async function remove() {
    if (!task) return;
    const result = await store.deleteTask(task.id);
    if (!result.ok) return toast.error(result.error);
    toast.success("Task deleted");
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isNew ? "New task" : "Task details"} {task?.isExample && <ExampleChip />}
        </DialogTitle>
        <DialogDescription>
          {isNew ? "Only the title is required." : `Created ${formatTimestamp(task.createdAt)} · Updated ${formatTimestamp(task.updatedAt)}`}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={form.title}
            maxLength={TITLE_MAX}
            onChange={(e) => set("title", e.target.value)}
            aria-invalid={error?.startsWith("Title") || undefined}
            aria-describedby={error ? "task-error" : undefined}
            autoFocus={isNew}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="task-description">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea id="task-description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="task-due">
              Due date <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="task-due" type="date" value={form.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-priority">Priority</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v as TaskPriority)}>
              <SelectTrigger id="task-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-status">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as TaskStatus)}>
              <SelectTrigger id="task-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="task-waiting">
            Waiting on <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="task-waiting"
            value={form.waitingOn}
            onChange={(e) => set("waitingOn", e.target.value)}
            placeholder="Who or what is this waiting on?"
          />
        </div>

        {error && (
          <p id="task-error" role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
          {!isNew && (
            <div className="flex gap-2 sm:mr-auto">
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
              <Button type="button" variant="outline" onClick={toggleDone}>
                {task.status === "done" ? (
                  <>
                    <RotateCcw /> Reopen
                  </>
                ) : (
                  <>
                    <CircleCheck /> Mark done
                  </>
                )}
              </Button>
            </div>
          )}
          <Button type="button" variant="outline" onClick={onClose} className={isNew ? "sm:ml-auto" : undefined}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {isNew ? "Create task" : "Save changes"}
          </Button>
        </div>
      </form>

      {task && <ProgressNotes task={task} />}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{task?.title}&rdquo; and its progress notes will be permanently removed from this browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep task</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={remove}>
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Notes save immediately (independent of the form's Save button). */
function ProgressNotes({ task }: { task: Task }) {
  const store = useLifeStore();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    const result = await store.addProgressNote(task.id, text);
    if (!result.ok) return setError(result.error);
    setText("");
    setError(null);
  }

  // Show the live version of the task so new notes appear immediately.
  const live = useLiveTask(task);

  return (
    <section className="grid gap-3 border-t pt-4" aria-labelledby="notes-heading">
      <h3 id="notes-heading" className="text-sm font-semibold">
        Progress notes
      </h3>
      {live.notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No notes yet. Add one to record progress or follow-ups.</p>
      ) : (
        <ol className="grid gap-2">
          {[...live.notes].reverse().map((note) => (
            <li key={note.id} className="bg-muted/60 group rounded-md px-3 py-2 text-sm">
              <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                <time dateTime={note.createdAt}>{formatTimestamp(note.createdAt)}</time>
                <button
                  type="button"
                  className="hover:text-destructive cursor-pointer rounded p-0.5"
                  aria-label="Delete note"
                  onClick={() => void store.deleteProgressNote(task.id, note.id)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="whitespace-pre-wrap">{note.text}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Label htmlFor="new-note" className="sr-only">
          New progress note
        </Label>
        <Textarea
          id="new-note"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="Add a progress note…"
          rows={1}
          className="min-h-9"
        />
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          Add note
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </section>
  );
}

function useLiveTask(task: Task): Task {
  const state = useLifeState();
  if (state.status !== "ready") return task;
  return state.data.tasks.find((t) => t.id === task.id) ?? task;
}

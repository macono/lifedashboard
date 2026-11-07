"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarClock, CalendarRange, CircleCheck, Flag, NotebookPen, Plug } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useReady } from "@/components/shell/data-gate";
import { useJournalDraft } from "@/components/journal/journal-draft-provider";
import { TaskRow } from "@/components/tasks/task-row";
import { Button } from "@/components/ui/button";
import { formatDateKey, formatTimestamp } from "@/lib/dates";
import { filledSectionCount, findEntry } from "@/lib/data/journal";
import { derivePriorities, dueState, isOpen, sortTasks, summarizeTasks, type TaskView } from "@/lib/data/tasks";
import { PLANNED_MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function OverviewView() {
  const { data, today } = useReady();
  const router = useRouter();
  const { draft } = useJournalDraft();
  const { auth } = useAuth();
  const ownSource = auth.mode === "cloud" ? "Your account" : "Demo · this browser";
  const summary = summarizeTasks(data.tasks, today);
  const priorities = derivePriorities(data.tasks, today);
  const focus = sortTasks(data.tasks.filter((t) => isOpen(t) && ["overdue", "today", "upcoming"].includes(dueState(t, today)))).slice(0, 6);
  const todayEntry = findEntry(data.journalEntries, today);
  const filled = filledSectionCount(todayEntry);
  const openTask = (id: string) => router.push(`/tasks?task=${id}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{formatDateKey(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting(new Date().getHours())}, Orlander
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {summary.open} open task{summary.open === 1 ? "" : "s"}
          {summary.waiting > 0 && ` · ${summary.waiting} waiting`}
        </p>
      </header>

      {/* Task summary */}
      <section aria-label="Task summary" className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatTile view="overdue" label="Overdue" value={summary.overdue} icon={AlertTriangle} tone={summary.overdue > 0 ? "alert" : "calm"} />
        <StatTile view="today" label="Due today" value={summary.dueToday} icon={CalendarClock} tone={summary.dueToday > 0 ? "warn" : "calm"} />
        <StatTile view="upcoming" label="Next 7 days" value={summary.upcoming} icon={CalendarRange} tone="calm" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Focus list */}
        <section aria-labelledby="focus-heading" className="bg-card min-w-0 rounded-xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 id="focus-heading" className="font-semibold">
              Coming up
            </h2>
            <Link href="/tasks" className="text-primary inline-flex items-center gap-1 text-sm hover:underline">
              All tasks <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {focus.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <CircleCheck className="size-8 text-emerald-400" aria-hidden />
              <p className="text-muted-foreground text-sm">Nothing overdue or due in the next 7 days.</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/tasks?task=new">Add a task</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {focus.map((task) => (
                <TaskRow key={task.id} task={task} today={today} onOpen={openTask} compact />
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-6">
          {/* Journal status */}
          <section aria-labelledby="journal-heading" className="bg-card rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <NotebookPen className="text-primary size-4" aria-hidden />
              <h2 id="journal-heading" className="font-semibold">
                Today&apos;s journal
              </h2>
            </div>
            {todayEntry ? (
              <>
                <p className="text-sm">
                  {filled} of 8 sections filled
                  <span className="text-muted-foreground"> · saved {formatTimestamp(todayEntry.updatedAt)}</span>
                </p>
                <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <div className="bg-primary h-full rounded-full" style={{ width: `${(filled / 8) * 100}%` }} />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Not started yet.</p>
            )}
            {draft?.date === today && <p className="mt-2 text-sm text-amber-300">You have unsaved changes.</p>}
            <Button className="mt-4 w-full" asChild>
              <Link href="/journal">{todayEntry ? "Open today's entry" : "Start today's entry"}</Link>
            </Button>
          </section>

          {/* Priorities */}
          <section aria-labelledby="priorities-heading" className="bg-card rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Flag className="text-primary size-4" aria-hidden />
              <h2 id="priorities-heading" className="font-semibold">
                Priorities
              </h2>
            </div>
            {priorities.length === 0 ? (
              <p className="text-muted-foreground text-sm">No urgent or high-priority tasks right now.</p>
            ) : (
              <ol className="grid gap-2">
                {priorities.map(({ task, reason }, i) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="hover:bg-accent flex w-full cursor-pointer items-start gap-3 rounded-md p-2 text-left"
                    >
                      <span className="bg-primary/15 text-primary grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium break-words">{task.title}</span>
                        <span className="text-muted-foreground text-xs">{reason}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-muted-foreground mt-3 text-xs">Based on overdue, due-today, and High-priority tasks.</p>
          </section>

          {/* Sources */}
          <section aria-labelledby="sources-heading" className="bg-card rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Plug className="text-primary size-4" aria-hidden />
              <h2 id="sources-heading" className="font-semibold">
                Sources
              </h2>
            </div>
            <dl className="grid gap-1.5 text-sm">
              {[
                ["Tasks", ownSource],
                ["Daily Journal", ownSource],
                ["Calendar", "Not connected"],
                ["Finances", "Not connected"],
                ["Health", "Not connected"],
                ["Home security", "Not connected"],
              ].map(([name, status]) => (
                <div key={name} className="flex justify-between gap-3">
                  <dt>{name}</dt>
                  <dd
                    className={cn(
                      "text-xs",
                      status === ownSource ? (auth.mode === "cloud" ? "text-emerald-300" : "text-amber-300") : "text-muted-foreground",
                    )}
                  >
                    {status}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      {/* Planned modules */}
      <section aria-labelledby="planned-heading" className="mt-8">
        <h2 id="planned-heading" className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
          Planned modules
        </h2>
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {PLANNED_MODULES.map((m) => (
            <li key={m.name} className="flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2" title={m.note}>
              <m.icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <span className="text-muted-foreground min-w-0 flex-1 text-xs leading-snug sm:text-sm">{m.name}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          Planned — not built yet. Integrations such as LifeLock and Vivint will only be added through legitimate, supported connections.
        </p>
      </section>
    </div>
  );
}

const TONES = {
  alert: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  warn: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  calm: "bg-card",
};

function StatTile({
  view,
  label,
  value,
  icon: Icon,
  tone,
}: {
  view: TaskView;
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  tone: keyof typeof TONES;
}) {
  return (
    <Link
      href={`/tasks?view=${view}`}
      className={cn("hover:border-primary/60 group rounded-xl border p-3 transition-colors sm:p-4", TONES[tone])}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
        <Icon className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</div>
      <div className="text-muted-foreground group-hover:text-primary mt-1 hidden text-xs sm:block">View tasks →</div>
    </Link>
  );
}

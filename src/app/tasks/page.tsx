import type { Metadata } from "next";
import { Suspense } from "react";
import { TasksView } from "@/components/tasks/tasks-view";

export const metadata: Metadata = { title: "Tasks · Life Dashboard" };

export default function TasksPage() {
  // TasksView reads the URL (?view=, ?task=), so it renders in the browser inside Suspense.
  return (
    <Suspense>
      <TasksView />
    </Suspense>
  );
}

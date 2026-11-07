import type { Metadata } from "next";
import { Suspense } from "react";
import { JournalView } from "@/components/journal/journal-view";

export const metadata: Metadata = { title: "Daily Journal · Life Dashboard" };

export default function JournalPage() {
  return (
    <Suspense>
      <JournalView />
    </Suspense>
  );
}

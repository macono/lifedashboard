"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { HardDrive, NotebookPen, Plus } from "lucide-react";
import { CaptureDialog } from "@/components/capture/capture-dialog";
import { useJournalDraft } from "@/components/journal/journal-draft-provider";
import { DataGate } from "@/components/shell/data-gate";
import { isActive, NAV_ITEMS } from "@/components/shell/nav";
import { StorageDialog } from "@/components/shell/storage-dialog";
import { Button } from "@/components/ui/button";
import { formatDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const isOverview = pathname === "/";

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="dark bg-background text-foreground fixed inset-y-0 left-0 hidden w-64 flex-col border-r lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-5">
          <BrandMark />
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Orlander&apos;s</span>
            <span className="text-muted-foreground block text-sm">Life Dashboard</span>
          </span>
        </Link>
        <div className="px-4">
          <Button className="w-full" onClick={() => setCaptureOpen(true)}>
            <Plus /> Capture
          </Button>
        </div>
        <nav aria-label="Main" className="mt-6 flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <UnsavedJournalNotice className="mx-3 mt-4" />
        <div className="mt-auto p-4">
          <DemoBadge onClick={() => setStorageOpen(true)} className="w-full" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="dark bg-background text-foreground sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3 lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <BrandMark />
          <span className="truncate text-sm font-semibold">Orlander&apos;s Life Dashboard</span>
        </Link>
        <Button size="sm" className="ml-auto" onClick={() => setCaptureOpen(true)}>
          <Plus /> Capture
        </Button>
      </header>

      <main
        className={cn(
          "min-h-dvh pb-24 lg:pb-10",
          isOverview ? "dark bg-background text-foreground" : "bg-background text-foreground",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 lg:hidden">
          <DemoBadge onClick={() => setStorageOpen(true)} />
          <UnsavedJournalNotice />
        </div>
        <DataGate>{children}</DataGate>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="dark bg-background text-foreground fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <StorageDialog open={storageOpen} onOpenChange={setStorageOpen} />
    </div>
  );
}

function BrandMark() {
  return (
    <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold" aria-hidden>
      O
    </span>
  );
}

function DemoBadge({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-200",
        className,
      )}
      title="About demo storage"
    >
      <HardDrive className="size-3.5" aria-hidden />
      Demo — saved in this browser
    </button>
  );
}

/** Reminds you about unsaved journal text when you're on another page. */
function UnsavedJournalNotice({ className }: { className?: string }) {
  const { draft } = useJournalDraft();
  const pathname = usePathname();
  if (!draft || pathname === "/journal") return null;
  return (
    <Link
      href={`/journal?date=${draft.date}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-500/20 dark:text-sky-200",
        className,
      )}
    >
      <NotebookPen className="size-3.5" aria-hidden />
      Unsaved journal changes ({formatDateKey(draft.date, { month: "short", day: "numeric" })})
    </Link>
  );
}

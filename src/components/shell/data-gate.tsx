"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DatabaseZap, Download, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmResetDialog } from "@/components/shell/storage-dialog";
import type { DateKey } from "@/lib/dates";
import { useLifeState, useLifeStore } from "@/lib/data/provider";
import type { AppData } from "@/lib/data/types";
import { downloadText } from "@/lib/download";
import { useToday } from "@/lib/use-today";

interface Ready {
  data: AppData;
  today: DateKey;
}

const ReadyContext = createContext<Ready | null>(null);

/** Data + today's date. Only available inside <DataGate>, which waits until both are known. */
export function useReady(): Ready {
  const ready = useContext(ReadyContext);
  if (!ready) throw new Error("useReady must be used inside <DataGate>");
  return ready;
}

export function DataGate({ children }: { children: ReactNode }) {
  const state = useLifeState();
  const today = useToday();

  if (state.status === "loading" || today === null) {
    return (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center gap-2 text-sm" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading your dashboard…
      </div>
    );
  }
  if (state.status === "unavailable") {
    return (
      <ProblemPanel title="Browser storage isn't available">
        <p>{state.error}</p>
        <p>
          This demo keeps data in your browser. Try a normal (non-private) window, or allow site data for this address,
          then reload.
        </p>
      </ProblemPanel>
    );
  }
  if (state.status === "invalid") return <InvalidData error={state.error} />;

  return <ReadyContext.Provider value={{ data: state.data, today }}>{children}</ReadyContext.Provider>;
}

function ProblemPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <DatabaseZap className="text-destructive size-5" aria-hidden />
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        <div className="text-muted-foreground space-y-3 text-sm">{children}</div>
      </div>
    </div>
  );
}

function InvalidData({ error }: { error: string }) {
  const store = useLifeStore();
  const [confirming, setConfirming] = useState(false);

  return (
    <ProblemPanel title="Saved data couldn't be read">
      <p>
        <span className="text-foreground font-medium">Nothing has been deleted.</span> The app found data in this
        browser that it doesn&apos;t understand, so it stopped instead of overwriting it.
      </p>
      <p className="bg-muted rounded-md px-3 py-2 font-mono text-xs">{error}</p>
      <p>
        Download a copy first. Resetting saves a backup of the unreadable data in this browser, then starts over with
        example data.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          onClick={() => {
            const json = store.exportJson();
            if (json) downloadText(`life-dashboard-unreadable-${Date.now()}.json`, json);
          }}
        >
          <Download /> Download raw data
        </Button>
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          <RotateCcw /> Reset to example data…
        </Button>
      </div>
      <ConfirmResetDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={async () => {
          const result = await store.resetDemoData();
          if (result.ok) toast.success("Demo data reset. The unreadable data was backed up in this browser.");
          else toast.error(result.error);
        }}
      />
    </ProblemPanel>
  );
}

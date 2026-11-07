"use client";

import { Download, HardDrive, RotateCcw } from "lucide-react";
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
import { useState } from "react";
import { useLifeStore } from "@/lib/data/provider";
import { downloadText } from "@/lib/download";

export function StorageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useLifeStore();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="size-5" aria-hidden /> Demo — saved in this browser
            </DialogTitle>
            <DialogDescription>How your data is stored in this first version.</DialogDescription>
          </DialogHeader>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
            <li>Tasks and journal entries are saved in this browser&apos;s local storage on this device only.</li>
            <li>They don&apos;t sync to other browsers, devices, or Google Drive, and there is no account or login.</li>
            <li>Local storage is not encrypted or backed up. Clearing site data or browsing history can erase it.</li>
            <li>Your existing ChatGPT and Google Drive records are not read or changed by this app.</li>
            <li>Tasks labeled &ldquo;Example&rdquo; are fictional samples. Edit or delete them freely.</li>
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                const json = store.exportJson();
                if (json) downloadText(`life-dashboard-${new Date().toISOString().slice(0, 10)}.json`, json);
              }}
            >
              <Download /> Download a copy (JSON)
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
              <RotateCcw /> Reset demo data…
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmResetDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={async () => {
          const result = await store.resetDemoData();
          if (result.ok) {
            toast.success("Demo data reset. Your previous data was backed up in this browser.");
            onOpenChange(false);
          } else toast.error(result.error);
        }}
      />
    </>
  );
}

export function ConfirmResetDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            All tasks and journal entries in this browser will be replaced with fresh example data. A backup copy of the
            current data is kept in this browser&apos;s storage, but it isn&apos;t visible in the app yet — download a
            copy first if you want to keep it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => void onConfirm()}>
            Reset demo data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

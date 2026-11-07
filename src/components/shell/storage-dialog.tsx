"use client";

import { useState } from "react";
import { CloudUpload, Download, HardDrive, LogOut, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useJournalDraft } from "@/components/journal/journal-draft-provider";
import { ImportDialog } from "@/components/shell/import-dialog";
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
import { useLifeStore } from "@/lib/data/provider";
import { downloadText } from "@/lib/download";

export function StorageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useLifeStore();
  const { auth, signOut } = useAuth();
  const { isDirty } = useJournalDraft();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [importing, setImporting] = useState(false);
  const cloud = auth.mode === "cloud" && auth.status === "signed-in";

  const download = () => {
    const json = store.exportJson();
    if (json) downloadText(`life-dashboard-${cloud ? "account" : "browser"}-${new Date().toISOString().slice(0, 10)}.json`, json);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          {cloud ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5" aria-hidden /> Saved to your account
                </DialogTitle>
                <DialogDescription>Signed in as {auth.email}</DialogDescription>
              </DialogHeader>
              <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
                <li>Tasks and journal entries are stored in your Supabase database and appear on any device where you sign in.</li>
                <li>Database rules allow only your account to read or change your records.</li>
                <li>Data is encrypted in transit and at rest by Supabase, but it isn&apos;t end-to-end encrypted.</li>
                <li>Backups depend on your Supabase plan. Use &ldquo;Download a copy&rdquo; for your own backup.</li>
                <li>Other devices pick up changes when you return to the app or refresh.</li>
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="outline" onClick={download}>
                  <Download /> Download a copy (JSON)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    setImporting(true);
                  }}
                >
                  <CloudUpload /> Import from this browser…
                </Button>
              </div>
              <div className="border-t pt-4">
                {isDirty && <p className="mb-2 text-sm text-amber-700">You have unsaved journal changes. Signing out discards them.</p>}
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const error = await signOut();
                    if (error) toast.error(error);
                    else onOpenChange(false);
                  }}
                >
                  <LogOut /> Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <HardDrive className="size-5" aria-hidden /> Demo — saved in this browser
                </DialogTitle>
                <DialogDescription>Supabase isn&apos;t configured, so the app is running in browser demo mode.</DialogDescription>
              </DialogHeader>
              <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
                <li>Tasks and journal entries are saved in this browser&apos;s local storage on this device only.</li>
                <li>They don&apos;t sync to other browsers, devices, or Google Drive, and there is no account or login.</li>
                <li>Local storage is not encrypted or backed up. Clearing site data or browsing history can erase it.</li>
                <li>Your existing ChatGPT and Google Drive records are not read or changed by this app.</li>
                <li>Tasks labeled &ldquo;Example&rdquo; are fictional samples. Edit or delete them freely.</li>
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={download}>
                  <Download /> Download a copy (JSON)
                </Button>
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmingReset(true)}>
                  <RotateCcw /> Reset demo data…
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmResetDialog
        open={confirmingReset}
        onOpenChange={setConfirmingReset}
        onConfirm={async () => {
          const result = await store.resetDemoData();
          if (result.ok) {
            toast.success("Demo data reset. Your previous data was backed up in this browser.");
            onOpenChange(false);
          } else toast.error(result.error);
        }}
      />
      {cloud && <ImportDialog open={importing} onOpenChange={setImporting} />}
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

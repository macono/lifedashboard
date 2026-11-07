"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  }

  return (
    <div className="dark bg-background text-foreground flex min-h-dvh items-center justify-center px-4">
      <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-lg font-bold" aria-hidden>
            O
          </span>
          <div>
            <h1 className="font-semibold">Orlander&apos;s Life Dashboard</h1>
            <p className="text-muted-foreground text-sm">Sign in to continue</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />} Sign in
          </Button>
        </form>
        <p className="text-muted-foreground mt-4 text-xs">
          Accounts are created by the owner in the Supabase dashboard. Public sign-up is turned off.
        </p>
      </div>
    </div>
  );
}

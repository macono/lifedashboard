"use client";

/**
 * Decides which mode the app runs in:
 *  - "demo":  no Supabase settings → data stays in this browser (increment 1 behavior);
 *  - "cloud": Supabase configured → you must sign in; data lives in your Supabase project.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type AuthState =
  | { mode: "demo" }
  | { mode: "cloud"; status: "checking" }
  | { mode: "cloud"; status: "signed-out" }
  | { mode: "cloud"; status: "signed-in"; userId: string; email: string };

interface AuthContextValue {
  auth: AuthState;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function fromSession(session: Session | null): AuthState {
  if (!session?.user) return { mode: "cloud", status: "signed-out" };
  return { mode: "cloud", status: "signed-in", userId: session.user.id, email: session.user.email ?? "" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => (getSupabaseConfig() ? { mode: "cloud", status: "checking" } : { mode: "demo" }));

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (!cancelled) setAuth(fromSession(data.session));
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      // Only react to a different user (or sign-out), not to routine token refreshes.
      setAuth((prev) => {
        const next = fromSession(session);
        if (prev.mode === "cloud" && prev.status === "signed-in" && next.mode === "cloud" && next.status === "signed-in" && prev.userId === next.userId)
          return prev;
        return next;
      });
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      async signIn(email, password) {
        const client = getSupabaseClient();
        if (!client) return "Supabase isn't configured.";
        try {
          const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
          if (!error) return null;
          if (/invalid login credentials/i.test(error.message)) return "Email or password is incorrect.";
          if (error.name === "AuthRetryableFetchError" || /fetch|network/i.test(error.message))
            return "Couldn't reach Supabase. Check your connection and try again.";
          if (/email not confirmed/i.test(error.message)) return "This email address hasn't been confirmed yet.";
          return error.message;
        } catch {
          return "Couldn't reach Supabase. Check your connection and try again.";
        }
      },
      async signOut() {
        const client = getSupabaseClient();
        if (!client) return null;
        const { error } = await client.auth.signOut();
        return error ? error.message : null;
      },
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

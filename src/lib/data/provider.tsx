"use client";

import { createContext, Fragment, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { getSupabaseClient } from "@/lib/supabase/client";
import { createLocalRepository } from "./local-repository";
import type { Repository } from "./repository";
import { LifeStore, LOADING_STATE, type StoreState } from "./store";
import { createSupabaseRepository } from "./supabase-repository";

const StoreContext = createContext<LifeStore | null>(null);

const getServerState = (): StoreState => LOADING_STATE;

/**
 * Picks where data lives (browser demo or the signed-in Supabase account) and
 * provides it to every view. Everything below is re-created when the user
 * changes, so one user's data or unsaved drafts never carry over to another.
 */
export function LifeDataProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();

  if (auth.mode === "cloud" && auth.status === "checking") {
    return (
      <div className="text-muted-foreground flex min-h-dvh items-center justify-center gap-2 text-sm" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Checking sign-in…
      </div>
    );
  }
  if (auth.mode === "cloud" && auth.status === "signed-out") return <SignInScreen />;

  const key = auth.mode === "demo" ? "local" : `user:${auth.userId}`;
  return (
    <Fragment key={key}>
      <StoreScope userId={auth.mode === "cloud" ? auth.userId : null}>{children}</StoreScope>
    </Fragment>
  );
}

function StoreScope({ userId, children }: { userId: string | null; children: ReactNode }) {
  const store = useMemo(() => {
    const client = userId ? getSupabaseClient() : null;
    const repo: Repository = client && userId ? createSupabaseRepository(client, userId) : createLocalRepository();
    return new LifeStore(repo);
  }, [userId]);

  useEffect(() => {
    void store.init();
  }, [store]);

  useEffect(() => {
    // Demo: another tab saved. Cloud: you came back to this tab (maybe after using another device).
    return store.watchExternalChanges();
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useLifeStore(): LifeStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useLifeStore must be used inside <LifeDataProvider>");
  return store;
}

export function useLifeState(): StoreState {
  const store = useLifeStore();
  return useSyncExternalStore(store.subscribe, store.getState, getServerState);
}

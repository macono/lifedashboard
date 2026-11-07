"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createLocalRepository } from "./local-repository";
import { LifeStore, LOADING_STATE, type StoreState } from "./store";

const StoreContext = createContext<LifeStore | null>(null);

const getServerState = (): StoreState => LOADING_STATE;

/**
 * Provides app data to every view. Data is loaded after hydration, so the server
 * render and the first browser render match (no hydration errors); views show a
 * brief loading state until browser storage has been read.
 */
export function LifeDataProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new LifeStore(createLocalRepository()));

  useEffect(() => {
    store.init();
    // Keep multiple tabs in step: reload when another tab saves.
    // (subscribeExternal reads window, so it runs only in the browser.)
    return createLocalRepository().subscribeExternal(() => store.reload());
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

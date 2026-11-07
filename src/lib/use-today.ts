"use client";

import { useSyncExternalStore } from "react";
import { todayKey, type DateKey } from "@/lib/dates";

/** Re-checks the date every 30s so the app rolls over at local midnight. */
function subscribe(callback: () => void) {
  const id = window.setInterval(callback, 30_000);
  window.addEventListener("focus", callback);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("focus", callback);
  };
}

/** Today's local calendar date, or null during server render / hydration. */
export function useToday(): DateKey | null {
  return useSyncExternalStore(subscribe, () => todayKey(), () => null);
}

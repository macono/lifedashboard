/**
 * Browser storage for the demo increment.
 *
 * This is the only file that touches localStorage. The Supabase increment will
 * add a repository with the same responsibilities (load / save) backed by the
 * database, and the UI will not need to change.
 */
import { parseAppData } from "./validate";
import type { AppData } from "./types";

export const STORAGE_KEY = "life-dashboard:v1";
export const BACKUP_KEY_PREFIX = "life-dashboard:backup:";

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; data: AppData }
  | { kind: "invalid"; raw: string; error: string }
  | { kind: "unavailable"; error: string };

export interface LocalRepository {
  load(): LoadResult;
  save(data: AppData): void;
  /** Copies the current raw value to a timestamped backup key. Returns the key used. */
  backupRaw(now: string): string | null;
  clear(): void;
  /** Calls back when another tab changes our key. */
  subscribeExternal(callback: () => void): () => void;
}

export function createLocalRepository(getStorage: () => Storage = () => window.localStorage, key = STORAGE_KEY): LocalRepository {
  return {
    load() {
      let raw: string | null;
      try {
        raw = getStorage().getItem(key);
      } catch {
        return { kind: "unavailable", error: "This browser is blocking local storage (private mode or site-data settings)." };
      }
      if (raw === null) return { kind: "empty" };
      const parsed = parseAppData(raw);
      return parsed.ok ? { kind: "ok", data: parsed.value } : { kind: "invalid", raw, error: parsed.error };
    },
    save(data) {
      getStorage().setItem(key, JSON.stringify(data));
    },
    backupRaw(now) {
      const raw = getStorage().getItem(key);
      if (raw === null) return null;
      const backupKey = `${BACKUP_KEY_PREFIX}${now}`;
      getStorage().setItem(backupKey, raw);
      return backupKey;
    },
    clear() {
      getStorage().removeItem(key);
    },
    subscribeExternal(callback) {
      const handler = (event: StorageEvent) => {
        if (event.key === key || event.key === null) callback();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}

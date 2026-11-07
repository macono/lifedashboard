/**
 * Browser storage (demo mode). The only code that touches localStorage for app data.
 */
import { parseAppData } from "./validate";
import type { LoadResult, Repository } from "./repository";
import type { AppData } from "./types";

export const STORAGE_KEY = "life-dashboard:v1";
export const BACKUP_KEY_PREFIX = "life-dashboard:backup:";

export interface LocalRepository extends Repository {
  readonly kind: "local";
  loadSync(): LoadResult;
  save(data: AppData): void;
  backupRaw(now: string): string | null;
}

export function createLocalRepository(getStorage: () => Storage = () => window.localStorage, key = STORAGE_KEY): LocalRepository {
  const repo: LocalRepository = {
    kind: "local",
    loadSync() {
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
    async load() {
      return repo.loadSync();
    },
    save(data) {
      getStorage().setItem(key, JSON.stringify(data));
    },
    async commit(_change, next) {
      try {
        repo.save(next);
      } catch {
        throw new Error("Couldn't save — browser storage may be full or blocked. Your change was not kept.");
      }
    },
    backupRaw(now) {
      const raw = getStorage().getItem(key);
      if (raw === null) return null;
      const backupKey = `${BACKUP_KEY_PREFIX}${now}`;
      getStorage().setItem(backupKey, raw);
      return backupKey;
    },
    subscribeExternal(callback) {
      const handler = (event: StorageEvent) => {
        if (event.key === key || event.key === null) callback();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
  return repo;
}

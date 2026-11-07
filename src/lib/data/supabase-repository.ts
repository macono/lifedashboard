/**
 * Supabase (PostgreSQL) storage for a signed-in user.
 * Row Level Security on the server guarantees each user only reaches their own rows;
 * user_id is also sent explicitly so every row is clearly owned.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { nowIso } from "@/lib/dates";
import type { Change, LoadResult, Repository } from "./repository";
import { entryToRow, noteToRow, rowsToAppData, taskToRow, type JournalRow, type NoteRow, type TaskRow } from "./supabase-mapping";
import { parseAppData } from "./validate";

function friendly(error: PostgrestError | Error | null, action: string): Error {
  const detail = error?.message ?? "unknown error";
  const notKept = action.startsWith("load") ? "" : " Your change was not kept.";
  if (/fetch|network/i.test(detail)) return new Error(`Couldn't ${action}: no connection to Supabase.${notKept}`);
  if ("code" in (error ?? {}) && (error as PostgrestError).code === "42501")
    return new Error(`Couldn't ${action}: permission denied. Try signing out and back in.`);
  return new Error(`Couldn't ${action}: ${detail}`);
}

async function must<T>(promise: PromiseLike<{ data: T; error: PostgrestError | null }>, action: string): Promise<T> {
  let result: { data: T; error: PostgrestError | null };
  try {
    result = await promise;
  } catch (e) {
    throw friendly(e instanceof Error ? e : new Error(String(e)), action);
  }
  if (result.error) throw friendly(result.error, action);
  return result.data;
}

export function createSupabaseRepository(client: SupabaseClient, userId: string): Repository {
  return {
    kind: "cloud",

    async load(): Promise<LoadResult> {
      try {
        const [tasks, notes, entries] = await Promise.all([
          must(client.from("tasks").select("*").order("created_at"), "load tasks"),
          must(client.from("task_notes").select("*").order("created_at"), "load notes"),
          must(client.from("journal_entries").select("*").order("entry_date"), "load journal"),
        ]);
        const data = rowsToAppData(tasks as TaskRow[], notes as NoteRow[], entries as JournalRow[], nowIso());
        const raw = JSON.stringify(data);
        const checked = parseAppData(raw);
        return checked.ok ? { kind: "ok", data: checked.value } : { kind: "invalid", raw, error: checked.error };
      } catch (e) {
        return { kind: "unavailable", error: e instanceof Error ? e.message : String(e) };
      }
    },

    async commit(change: Change): Promise<void> {
      switch (change.type) {
        case "task.insert":
          await must(client.from("tasks").insert(taskToRow(change.task, userId)), "save the task");
          return;
        case "task.update": {
          const { id, ...fields } = taskToRow(change.task, userId);
          const rows = await must(client.from("tasks").update(fields).eq("id", id).select("id"), "save the task");
          if (!rows || rows.length === 0) throw new Error("Couldn't save the task: it no longer exists. Refresh to see the latest.");
          return;
        }
        case "task.delete":
          await must(client.from("tasks").delete().eq("id", change.id), "delete the task");
          return;
        case "note.insert":
          await must(client.from("task_notes").insert(noteToRow(change.note, change.taskId, userId)), "save the note");
          return;
        case "note.delete":
          await must(client.from("task_notes").delete().eq("id", change.noteId), "delete the note");
          return;
        case "journal.upsert":
          await must(
            client.from("journal_entries").upsert(entryToRow(change.entry, userId), { onConflict: "user_id,entry_date" }),
            "save the journal entry",
          );
          return;
        case "import": {
          if (change.tasks.length)
            await must(
              client.from("tasks").upsert(change.tasks.map((t) => taskToRow(t, userId)), { onConflict: "id", ignoreDuplicates: true }),
              "import tasks",
            );
          const notes = change.tasks.flatMap((t) => t.notes.map((n) => noteToRow(n, t.id, userId)));
          if (notes.length)
            await must(client.from("task_notes").upsert(notes, { onConflict: "id", ignoreDuplicates: true }), "import notes");
          if (change.journalEntries.length)
            await must(
              client
                .from("journal_entries")
                .upsert(change.journalEntries.map((e) => entryToRow(e, userId)), { onConflict: "user_id,entry_date", ignoreDuplicates: true }),
              "import journal entries",
            );
          return;
        }
        case "replace-all":
          throw new Error("Replacing all data isn't supported for your account.");
      }
    },

    subscribeExternal(callback) {
      // Pick up changes made on another device when you come back to this tab.
      let last = Date.now();
      const onFocus = () => {
        if (document.visibilityState !== "visible" || Date.now() - last < 15_000) return;
        last = Date.now();
        callback();
      };
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onFocus);
      return () => {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onFocus);
      };
    },
  };
}

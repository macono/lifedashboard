/**
 * Calendar-date helpers.
 *
 * Due dates and journal dates are stored as local calendar dates in the form
 * "YYYY-MM-DD" (a DateKey). They are never converted through UTC, so a task due
 * on Nov 6 stays due on Nov 6 regardless of time zone.
 *
 * Moments in time (createdAt, updatedAt, note timestamps) are stored as ISO
 * 8601 UTC strings and shown in local time.
 */

export type DateKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** Converts a JS Date to its *local* calendar date key. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function isValidDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string") return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Parses a DateKey as local midnight. Throws on invalid input. */
export function parseDateKey(key: DateKey): Date {
  if (!isValidDateKey(key)) throw new Error(`Invalid date: ${key}`);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: DateKey, to: DateKey): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  // Use UTC of the calendar parts so daylight-saving shifts don't produce 23/25h days.
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

export function formatDateKey(
  key: DateKey,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" },
): string {
  return parseDateKey(key).toLocaleDateString(undefined, options);
}

/** Human label relative to today: "Today", "Tomorrow", "Yesterday", "In 3 days", "2 days ago", or a date. */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  if (diff < -1 && diff >= -6) return `${-diff} days ago`;
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return formatDateKey(key, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, daysBetween, isValidDateKey, parseDateKey, relativeDayLabel, toDateKey } from "@/lib/dates";

// Run these in a US time zone with DST so UTC conversion bugs would show up.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/New_York";
});
afterAll(() => {
  process.env.TZ = originalTz;
});

describe("calendar dates", () => {
  it("uses the local date, not the UTC date, late in the evening", () => {
    const lateEvening = new Date(2026, 10, 6, 23, 30); // Nov 6, 11:30 PM local
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-11-07"); // UTC has already rolled over
    expect(toDateKey(lateEvening)).toBe("2026-11-06");
  });

  it("round-trips a date key without shifting", () => {
    for (const key of ["2026-01-01", "2026-03-08", "2026-11-01", "2026-12-31"]) {
      expect(toDateKey(parseDateKey(key))).toBe(key);
    }
  });

  it("validates real calendar dates only", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("11/06/2026")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });

  it("adds days across month, year, and daylight-saving boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09"); // DST starts
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02"); // DST ends
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days across DST changes", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-11-02", "2026-10-31")).toBe(-2);
  });

  it("labels days relative to today", () => {
    expect(relativeDayLabel("2026-11-06", "2026-11-06")).toBe("Today");
    expect(relativeDayLabel("2026-11-07", "2026-11-06")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-11-05", "2026-11-06")).toBe("Yesterday");
    expect(relativeDayLabel("2026-11-09", "2026-11-06")).toBe("In 3 days");
  });
});

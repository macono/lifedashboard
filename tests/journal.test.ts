import { describe, expect, it } from "vitest";
import { splitTaskText } from "@/lib/data/capture";
import { appendText, appendToSection, emptySections, findEntry, saveEntry } from "@/lib/data/journal";
import { JOURNAL_SECTIONS } from "@/lib/data/types";

const T0 = "2026-11-06T14:00:00.000Z";
const T1 = "2026-11-06T15:00:00.000Z";

describe("journal sections", () => {
  it("uses exactly the eight agreed sections, in order", () => {
    expect(JOURNAL_SECTIONS.map((s) => s.label)).toEqual([
      "Completed",
      "Where I went",
      "What I learned",
      "What I ate",
      "Exercises",
      "New Action Items",
      "Flock Plan",
      "Random Thoughts & Ideas",
    ]);
  });
});

describe("save entry", () => {
  it("creates one entry per date and preserves text exactly", () => {
    const text = "  Line one\n\nLine three  \n";
    const r = saveEntry([], "2026-11-06", { completed: text }, T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.entries).toHaveLength(1);
    expect(r.value.entry.sections.completed).toBe(text);
    expect(r.value.entry.sections.flock_plan).toBe("");

    // Saving again for the same date updates, not duplicates.
    const r2 = saveEntry(r.value.entries, "2026-11-06", { flock_plan: "Plan" }, T1);
    expect(r2.ok && r2.value.entries).toHaveLength(1);
    expect(r2.ok && r2.value.entry).toMatchObject({
      id: r.value.entry.id,
      createdAt: T0,
      updatedAt: T1,
      sections: { ...emptySections(), completed: text, flock_plan: "Plan" },
    });
  });

  it("keeps different dates separate", () => {
    const a = saveEntry([], "2026-11-05", { exercises: "Walk" }, T0);
    const b = a.ok && saveEntry(a.value.entries, "2026-11-06", { exercises: "Swim" }, T1);
    if (!b || !b.ok) throw new Error("save failed");
    expect(findEntry(b.value.entries, "2026-11-05")?.sections.exercises).toBe("Walk");
    expect(findEntry(b.value.entries, "2026-11-06")?.sections.exercises).toBe("Swim");
  });

  it("rejects an invalid date", () => {
    expect(saveEntry([], "2026-02-30", {}, T0).ok).toBe(false);
  });
});

describe("capture append", () => {
  it("appends on a new line without replacing existing text", () => {
    expect(appendText("Existing", "New idea")).toBe("Existing\nNew idea");
    expect(appendText("Existing\n", "New idea")).toBe("Existing\nNew idea");
    expect(appendText("", "New idea")).toBe("New idea");
    expect(appendText("Existing", "   ")).toBe("Existing");
  });

  it("keeps line breaks inside captured text", () => {
    expect(appendText("A", "B1\nB2\n\n")).toBe("A\nB1\nB2");
  });

  it("appends to one section of a saved entry and leaves the others alone", () => {
    const saved = saveEntry([], "2026-11-06", { random_thoughts: "First thought", what_i_ate: "Oatmeal" }, T0);
    if (!saved.ok) throw new Error(saved.error);
    const r = appendToSection(saved.value.entries, "2026-11-06", "random_thoughts", "Second thought", T1);
    expect(r.ok && r.value.entry.sections.random_thoughts).toBe("First thought\nSecond thought");
    expect(r.ok && r.value.entry.sections.what_i_ate).toBe("Oatmeal");
    expect(r.ok && r.value.entries).toHaveLength(1);
  });

  it("creates the entry when appending to a date with none", () => {
    const r = appendToSection([], "2026-11-01", "flock_plan", "Idea", T0);
    expect(r.ok && r.value.entry).toMatchObject({ date: "2026-11-01", sections: { flock_plan: "Idea" } });
  });

  it("refuses empty captures", () => {
    expect(appendToSection([], "2026-11-01", "flock_plan", " \n ", T0).ok).toBe(false);
  });
});

describe("capture to task", () => {
  it("uses the first line as the title and the rest as the description", () => {
    expect(splitTaskText("Call plumber\nAsk about the leak\nunder the sink")).toEqual({
      title: "Call plumber",
      description: "Ask about the leak\nunder the sink",
    });
    expect(splitTaskText("\n  Just a title  ")).toEqual({ title: "Just a title", description: "" });
    expect(splitTaskText("   ")).toEqual({ title: "", description: "" });
  });
});

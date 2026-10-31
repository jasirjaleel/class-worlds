import { describe, expect, it } from "vitest";
import { HATCH_POINTS, SPECIES, classCollection, dinoStage, eggFor } from "./dinos";
import type { PointEvent, Student } from "./types";

const DUBAI = "Asia/Dubai";
const student = (id: string): Student => ({ id, name: id.toUpperCase(), color: "#fff" });
const events = (studentId: string, iso: string, n: number, amount = 1): PointEvent[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${studentId}${iso}${i}`, studentId, amount, at: Date.parse(iso) }));

describe("eggFor", () => {
  it("gives the same egg for the same student and week", () => {
    expect(eggFor("aisha", "2026-10-26")).toEqual(eggFor("aisha", "2026-10-26"));
  });

  it("uses every species across many students, with some gold but not most", () => {
    const eggs = Array.from({ length: 600 }, (_, i) => eggFor(`student-${i}`, "2026-10-26"));
    expect(new Set(eggs.map((e) => e.species.id)).size).toBe(SPECIES.length);
    const gold = eggs.filter((e) => e.gold).length;
    expect(gold).toBeGreaterThan(0);
    expect(gold).toBeLessThan(150);
  });
});

describe("dinoStage", () => {
  it("cracks, hatches at the hatch points, then grows", () => {
    expect([0, 1, 4].map(dinoStage)).toEqual([0, 1, 4]);
    expect(dinoStage(HATCH_POINTS)).toBe(5);
    expect(dinoStage(8)).toBe(5);
    expect(dinoStage(9)).toBe(6);
    expect(dinoStage(14)).toBe(7);
    expect(dinoStage(50)).toBe(7);
  });
});

describe("classCollection", () => {
  const students = [student("aisha"), student("omar")];

  it("keeps a hatch from each week the student reached the hatch points", () => {
    const all = [
      ...events("aisha", "2026-10-20T08:00:00Z", 5), // last week
      ...events("aisha", "2026-10-28T08:00:00Z", 6), // this week
      ...events("omar", "2026-10-28T08:00:00Z", 4), // still in the egg
    ];
    const entries = classCollection(all, students, DUBAI);
    expect(entries.map((e) => [e.studentName, e.weekKey])).toEqual([
      ["AISHA", "2026-10-19"],
      ["AISHA", "2026-10-26"],
    ]);
  });

  it("splits weeks by the class's local time, not UTC", () => {
    // Sunday 20:30 UTC is already Monday in Dubai, so these fall in different local weeks
    const all = [...events("omar", "2026-10-25T19:00:00Z", 3), ...events("omar", "2026-10-25T20:30:00Z", 3)];
    expect(classCollection(all, students, DUBAI)).toEqual([]);
  });

  it("counts undo, and ignores students who were removed", () => {
    const undone = [...events("omar", "2026-10-28T08:00:00Z", 5), ...events("omar", "2026-10-28T09:00:00Z", 1, -1)];
    expect(classCollection(undone, students, DUBAI)).toEqual([]);
    expect(classCollection(events("gone", "2026-10-28T08:00:00Z", 5), students, DUBAI)).toEqual([]);
  });
});

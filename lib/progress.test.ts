import { describe, expect, it } from "vitest";
import { classProgress } from "./progress";
import type { PointEvent } from "./types";

const DUBAI = "Asia/Dubai";
const at = (iso: string) => new Date(iso).getTime();
const now = at("2026-11-04T08:00:00Z"); // a Wednesday

let n = 0;
const ev = (studentId: string, iso: string, reason: string | null = "homework", amount = 1): PointEvent => ({
  id: `e${n++}`,
  studentId,
  amount,
  at: at(iso),
  reason,
});

const students = [
  { id: "omar", name: "Omar", color: "#111" },
  { id: "aisha", name: "Aisha", color: "#222" },
];

const progress = (events: PointEvent[]) => classProgress({ students, events, timeZone: DUBAI }, now);

describe("classProgress", () => {
  it("splits this week, last week and the total", () => {
    const [omar] = progress([
      ev("omar", "2026-11-03T08:00:00Z"),
      ev("omar", "2026-11-02T08:00:00Z"),
      ev("omar", "2026-10-27T08:00:00Z"),
      ev("omar", "2026-10-13T08:00:00Z"),
    ]);
    expect(omar).toMatchObject({ thisWeek: 2, lastWeek: 1, total: 4 });
  });

  it("starts the week on Monday in the class's time zone", () => {
    // 21:00 UTC on Sunday is already Monday 01:00 in Dubai
    const [omar] = progress([ev("omar", "2026-11-01T21:00:00Z")]);
    expect(omar).toMatchObject({ thisWeek: 1, lastWeek: 0 });
  });

  it("keeps class order instead of ranking students", () => {
    const rows = progress([ev("aisha", "2026-11-03T08:00:00Z")]);
    expect(rows.map((r) => r.id)).toEqual(["omar", "aisha"]);
    expect(rows[0].thisWeek).toBe(0);
  });

  it("lists this week's reasons, biggest first, and skips old or unknown ones", () => {
    const [omar] = progress([
      ev("omar", "2026-11-03T08:00:00Z", "kindness"),
      ev("omar", "2026-11-03T09:00:00Z", "homework"),
      ev("omar", "2026-11-03T10:00:00Z", "homework"),
      ev("omar", "2026-11-03T11:00:00Z", null),
      ev("omar", "2026-10-27T08:00:00Z", "reading"),
    ]);
    expect(omar.reasons).toEqual([
      { reason: "homework", points: 2 },
      { reason: "kindness", points: 1 },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { CLASS_STEPS, classGoal, classSteps, classTotal, goalReached, localDateKey, localWeekKey, totalsByStudent } from "./points";
import type { PointEvent } from "./types";

const DUBAI = "Asia/Dubai"; // UTC+4, no DST
const at = (iso: string) => Date.parse(iso);
const ev = (studentId: string, iso: string, amount = 1): PointEvent => ({
  id: `${studentId}-${iso}`,
  studentId,
  amount,
  at: at(iso),
});

describe("localDateKey", () => {
  it("uses the class time zone, not UTC", () => {
    // 21:30 UTC on the 28th is already 01:30 on the 29th in Dubai
    expect(localDateKey(at("2026-10-28T21:30:00Z"), DUBAI)).toBe("2026-10-29");
    expect(localDateKey(at("2026-10-28T21:30:00Z"), "UTC")).toBe("2026-10-28");
  });
});

describe("localWeekKey", () => {
  it("starts weeks on Monday", () => {
    expect(localWeekKey(at("2026-10-29T08:00:00Z"), DUBAI)).toBe("2026-10-26"); // Thu
    expect(localWeekKey(at("2026-10-26T08:00:00Z"), DUBAI)).toBe("2026-10-26"); // Mon
    expect(localWeekKey(at("2026-11-01T08:00:00Z"), DUBAI)).toBe("2026-10-26"); // Sun
    expect(localWeekKey(at("2026-11-02T08:00:00Z"), DUBAI)).toBe("2026-11-02"); // next Mon
  });
});

describe("classSteps", () => {
  it("counts finished steps and the points to the next one", () => {
    expect(classSteps(0, 240)).toEqual({ done: 0, toNext: 60 });
    expect(classSteps(59, 240)).toEqual({ done: 0, toNext: 1 });
    expect(classSteps(60, 240)).toEqual({ done: 1, toNext: 60 });
    expect(classSteps(239, 240)).toEqual({ done: 3, toNext: 1 });
  });

  it("stops at the last step, even past the goal", () => {
    expect(classSteps(240, 240)).toEqual({ done: CLASS_STEPS, toNext: 0 });
    expect(classSteps(999, 240)).toEqual({ done: CLASS_STEPS, toNext: 0 });
  });

  it("works when the goal doesn't divide evenly", () => {
    expect(classSteps(2, 5)).toEqual({ done: 1, toNext: 1 });
    expect(classSteps(3, 5)).toEqual({ done: 2, toNext: 1 });
  });
});

describe("goalReached", () => {
  it("needs the full goal, not a rounded-up one", () => {
    expect(classGoal(24, 10)).toBe(240);
    expect(goalReached({ a: 239 }, 24, 10)).toBe(false);
    expect(goalReached({ a: 200, b: 40 }, 24, 10)).toBe(true);
  });

  it("is never reached by an empty class", () => {
    expect(goalReached({}, 0, 10)).toBe(false);
  });
});

describe("totalsByStudent", () => {
  const now = at("2026-10-29T10:00:00Z");
  const events = [
    ev("aisha", "2026-10-29T06:00:00Z"),
    ev("aisha", "2026-10-29T07:00:00Z"),
    ev("omar", "2026-10-28T19:59:00Z"), // 23:59 on the 28th in Dubai
    ev("omar", "2026-10-28T20:01:00Z"), // 00:01 on the 29th in Dubai
    ev("aisha", "2026-10-20T06:00:00Z"), // last week
  ];

  it("counts only today for daily reset", () => {
    expect(totalsByStudent(events, { period: "day", timeZone: DUBAI, now })).toEqual({
      aisha: 2,
      omar: 1,
    });
  });

  it("counts the whole week for weekly reset", () => {
    expect(totalsByStudent(events, { period: "week", timeZone: DUBAI, now })).toEqual({
      aisha: 2,
      omar: 2,
    });
  });

  it("counts everything since term start", () => {
    const totals = totalsByStudent(events, {
      period: "term",
      timeZone: DUBAI,
      now,
      termStart: at("2026-09-01T00:00:00Z"),
    });
    expect(totals).toEqual({ aisha: 3, omar: 2 });
    expect(classTotal(totals)).toBe(5);
  });

  it("never shows negative totals after undo", () => {
    const withUndo = [ev("leo", "2026-10-29T06:00:00Z", -1)];
    expect(totalsByStudent(withUndo, { period: "day", timeZone: DUBAI, now })).toEqual({ leo: 0 });
  });
});

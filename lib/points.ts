import type { PointEvent, ResetPeriod } from "./types";

// Points are the source of truth. Worlds only read these totals, so switching
// worlds never loses progress.

/** Local calendar date (YYYY-MM-DD) of a timestamp in the class time zone. */
export function localDateKey(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}

/** Monday (YYYY-MM-DD) of the local week a timestamp falls in. */
export function localWeekKey(at: number, timeZone: string): string {
  const [y, m, d] = localDateKey(at, timeZone).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export interface PeriodOptions {
  period: ResetPeriod;
  timeZone: string;
  now: number;
  termStart?: number;
}

export function isInPeriod(at: number, opts: PeriodOptions): boolean {
  switch (opts.period) {
    case "day":
      return localDateKey(at, opts.timeZone) === localDateKey(opts.now, opts.timeZone);
    case "week":
      return localWeekKey(at, opts.timeZone) === localWeekKey(opts.now, opts.timeZone);
    case "term":
      return at >= (opts.termStart ?? 0) && at <= opts.now;
  }
}

/** Points per student in the current period. Never goes below zero. */
export function totalsByStudent(
  events: PointEvent[],
  opts: PeriodOptions,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of events) {
    if (!isInPeriod(e.at, opts)) continue;
    totals[e.studentId] = (totals[e.studentId] ?? 0) + e.amount;
  }
  for (const id of Object.keys(totals)) totals[id] = Math.max(0, totals[id]);
  return totals;
}

export function classTotal(totals: Record<string, number>): number {
  return Object.values(totals).reduce((sum, n) => sum + n, 0);
}

/** Points the whole class needs together. Never 0, so an empty class hasn't "reached" it. */
export function classGoal(studentCount: number, goalPerStudent: number): number {
  return Math.max(1, studentCount * goalPerStudent);
}

export function goalReached(totals: Record<string, number>, studentCount: number, goalPerStudent: number): boolean {
  return classTotal(totals) >= classGoal(studentCount, goalPerStudent);
}

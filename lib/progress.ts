import { localWeekKey } from "./points";
import { isReason, type ReasonId } from "./reasons";
import type { Classroom } from "./types";

// What the teacher sees on the Progress page. It reads all saved points, so neither the
// Monday reset nor Start fresh changes it.

export interface StudentProgress {
  id: string;
  name: string;
  color: string;
  thisWeek: number;
  lastWeek: number;
  total: number;
  /** This week's points by reason, biggest first. */
  reasons: { reason: ReasonId; points: number }[];
}

/** Monday of the week before, from a Monday in YYYY-MM-DD. */
function weekBefore(weekKey: string): string {
  const date = new Date(`${weekKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** One row per student, in class order: this page isn't a ranking. */
export function classProgress(c: Pick<Classroom, "students" | "events" | "timeZone">, now = Date.now()): StudentProgress[] {
  const thisKey = localWeekKey(now, c.timeZone);
  const lastKey = weekBefore(thisKey);

  return c.students.map((s) => {
    let thisWeek = 0;
    let lastWeek = 0;
    let total = 0;
    const byReason = new Map<ReasonId, number>();
    for (const e of c.events) {
      if (e.studentId !== s.id) continue;
      total += e.amount;
      const key = localWeekKey(e.at, c.timeZone);
      if (key === lastKey) lastWeek += e.amount;
      if (key !== thisKey) continue;
      thisWeek += e.amount;
      if (isReason(e.reason)) byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + e.amount);
    }
    const reasons = [...byReason].map(([reason, points]) => ({ reason, points })).filter((r) => r.points > 0).sort((a, b) => b.points - a.points);
    return { id: s.id, name: s.name, color: s.color, thisWeek: Math.max(0, thisWeek), lastWeek: Math.max(0, lastWeek), total: Math.max(0, total), reasons };
  });
}

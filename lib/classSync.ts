import type { PointEvent } from "./types";

/** The private live channel for one class. */
export const classTopic = (classId: string) => `class:${classId}`;

/**
 * Points that haven't been seen on this screen yet. `seen` is null on first load,
 * when the existing points are history and must not play as rewards.
 */
export function unseenEvents(seen: ReadonlySet<string> | null, events: PointEvent[]): PointEvent[] {
  if (!seen) return [];
  return events.filter((e) => !seen.has(e.id));
}

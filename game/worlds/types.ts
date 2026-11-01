import type { Student } from "@/lib/types";
import type { Stage } from "../engine/stage";

export interface WorldContext {
  stage: Stage;
  students: Student[];
  lowGraphics: boolean;
  timeZone: string;
  /** Show points on name tags. Off by default: no public scores. */
  showScores: boolean;
}

/** What every world module returns. The play screen only talks to worlds through this. */
export interface WorldInstance {
  /** Current period totals per student id. Called on load and after every change. */
  setTotals(totals: Record<string, number>): void;
  /** Play the reward moment for one student (called after setTotals). */
  reward(studentId: string): void;
  tick(dt: number, time: number): void;
  dispose(): void;
}

export type CreateWorld = (ctx: WorldContext) => WorldInstance;

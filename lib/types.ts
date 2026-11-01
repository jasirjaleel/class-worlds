export type WorldId =
  | "space-fleet"
  | "hot-air-balloons"
  | "dino-eggs"
  | "garden"
  | "build-the-city"
  | "ship-voyage";

export type ResetPeriod = "day" | "week" | "term";

export interface Student {
  id: string;
  name: string; // first name or nickname only
  color: string;
}

export interface PointEvent {
  id: string;
  studentId: string;
  amount: number;
  at: number; // epoch ms
  reason?: string | null;
}

export interface Classroom {
  id: string;
  name: string;
  timeZone: string;
  termStart: number; // epoch ms
  worldId: WorldId;
  lowGraphics: boolean;
  /** Show each student's points on the class screen. Off by default: no public scores. */
  showScores: boolean;
  students: Student[];
  events: PointEvent[];
}

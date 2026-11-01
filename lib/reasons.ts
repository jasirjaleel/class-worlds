// Why a point was given. The class screen names the effort, not just "+1",
// because specific praise for effort is what the research favours over bare rewards.

export const REASONS = {
  homework: { button: "Homework", message: "Homework done" },
  reading: { button: "Reading", message: "Great reading" },
  effort: { button: "Hard work", message: "Hard work" },
  kindness: { button: "Kindness", message: "Kind act" },
  helping: { button: "Helping", message: "Helping others" },
} as const;

export type ReasonId = keyof typeof REASONS;

export const DEFAULT_REASON: ReasonId = "homework";

export function isReason(value: unknown): value is ReasonId {
  return typeof value === "string" && Object.hasOwn(REASONS, value);
}

/** What the class screen says, for any saved reason. Old points have none. */
export function reasonMessage(reason: string | null | undefined): string {
  return isReason(reason) ? REASONS[reason].message : "Well done";
}

"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { worldMeta } from "@/game/worlds/registry";
import { totalsByStudent } from "./points";
import { getCached, subscribe, type StoreMessage } from "./store";
import type { Classroom } from "./types";

/** Points per student for the period of the class's current world (e.g. this week). */
export function currentTotals(c: Classroom, now = Date.now()) {
  return totalsByStudent(c.events, {
    period: worldMeta(c.worldId).reset,
    timeZone: c.timeZone,
    now,
    termStart: c.termStart,
  });
}

/** Live classroom from the server. `onReward` fires as soon as any device awards points. */
export function useClassroom(
  classId: string,
  onReward?: (msg: Extract<StoreMessage, { type: "reward" }>) => void,
): Classroom | null {
  const onRewardRef = useRef(onReward);
  useEffect(() => {
    onRewardRef.current = onReward;
  });

  const subscribeStore = useCallback(
    (notify: () => void) =>
      subscribe(classId, (msg) => {
        if (msg.type === "reward") onRewardRef.current?.(msg);
        notify();
      }),
    [classId],
  );

  return useSyncExternalStore(subscribeStore, () => getCached(classId), () => null);
}

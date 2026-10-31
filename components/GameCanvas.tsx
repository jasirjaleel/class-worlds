"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Stage } from "@/game/engine/stage";
import { loadWorld } from "@/game/worlds/load";
import type { WorldInstance } from "@/game/worlds/types";
import { getCached } from "@/lib/store";
import { currentTotals } from "@/lib/useClassroom";
import type { Classroom } from "@/lib/types";

interface Props {
  classroom: Classroom;
  roam?: boolean;
  /** Filled with the running world so the page can play rewards. */
  worldRef: RefObject<WorldInstance | null>;
  onFps?: (fps: number) => void;
}

/** Mounts the 3D stage and the class's world. Rebuilds when the world, students or graphics mode change. */
export default function GameCanvas({ classroom, roam = false, worldRef, onFps }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const onFpsRef = useRef(onFps);
  useEffect(() => {
    onFpsRef.current = onFps;
  });

  const { id, worldId, lowGraphics } = classroom;
  const studentsKey = classroom.students.map((s) => s.id + s.name + s.color).join("|");

  useEffect(() => {
    if (!el.current) return;
    let disposed = false;
    let world: WorldInstance | null = null;
    const stage = new Stage(el.current, { lowGraphics, roam, background: "#0b1026" });

    loadWorld(worldId).then((create) => {
      if (disposed) return;
      const c = getCached(id);
      if (!c) return;
      world = create({ stage, students: c.students, lowGraphics, timeZone: c.timeZone });
      world.setTotals(currentTotals(c));
      worldRef.current = world;
      stage.start((dt, t) => world?.tick(dt, t));
    });

    const fpsTimer = setInterval(() => onFpsRef.current?.(stage.fps), 1000);
    return () => {
      disposed = true;
      clearInterval(fpsTimer);
      worldRef.current = null;
      world?.dispose();
      stage.dispose();
    };
  }, [id, worldId, lowGraphics, roam, studentsKey, worldRef]);

  // Keep totals in sync after undo, resets or edits made elsewhere
  useEffect(() => {
    worldRef.current?.setTotals(currentTotals(classroom));
  }, [classroom, worldRef]);

  return <div ref={el} className="absolute inset-0" />;
}

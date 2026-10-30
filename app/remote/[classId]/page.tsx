"use client";

import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { worldMeta } from "@/game/worlds/registry";
import { awardPoints, undoLast } from "@/lib/store";
import { currentTotals, useClassroom } from "@/lib/useClassroom";

/** Teacher's phone: tap a student to reward them. The class screen updates live. */
export default function RemotePage() {
  return (
    <Suspense>
      <Remote />
    </Suspense>
  );
}

function Remote() {
  const { classId } = useParams<{ classId: string }>();
  const classroom = useClassroom(classId);
  const [flash, setFlash] = useState<string | null>(null);

  if (!classroom) return <main className="min-h-dvh bg-bg" />;
  const world = worldMeta(classroom.worldId);
  const totals = currentTotals(classroom);
  const lastEvent = classroom.events.at(-1);
  const lastName = classroom.students.find((s) => s.id === lastEvent?.studentId)?.name;

  const reward = (id: string) => {
    awardPoints(classId, id, 1);
    navigator.vibrate?.(30);
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 400);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-24 pt-4">
      <header className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Remote · {classroom.name}</p>
        <h1 className="font-display text-2xl text-gold">
          {world.emoji} {world.name}
        </h1>
        <p className="text-sm text-muted">Tap a student to give a point.</p>
      </header>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {classroom.students.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => reward(s.id)}
              aria-label={`Give ${s.name} a point (${totals[s.id] ?? 0} now)`}
              className={`flex w-full items-center gap-2 rounded-xl border border-line bg-panel p-3 text-left transition active:scale-95 ${
                flash === s.id ? "ring-4 ring-gold" : ""
              }`}
            >
              <span className="h-8 w-8 shrink-0 rounded-md" style={{ background: s.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{s.name}</span>
                <span className="text-xs text-muted">{totals[s.id] ?? 0} pts</span>
              </span>
              <span className="text-xl">⭐</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            disabled={!lastEvent}
            onClick={() => undoLast(classId)}
            className="flex-1 rounded-xl border border-line bg-panel py-3 font-bold disabled:opacity-40"
          >
            ↩ Undo{lastName ? ` (${lastName})` : ""}
          </button>
        </div>
      </div>
    </main>
  );
}

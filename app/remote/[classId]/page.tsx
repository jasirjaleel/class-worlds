"use client";

import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Star, Undo } from "@/components/Icons";
import { worldMeta } from "@/game/worlds/registry";
import { DEFAULT_REASON, REASONS, type ReasonId } from "@/lib/reasons";
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
  const [reason, setReason] = useState<ReasonId>(DEFAULT_REASON);
  const [failed, setFailed] = useState(false);

  if (!classroom) return <main className="min-h-dvh bg-bg" />;
  const world = worldMeta(classroom.worldId);
  const totals = currentTotals(classroom);
  const lastEvent = classroom.events.filter((e) => e.at >= classroom.termStart).at(-1);
  const lastName = classroom.students.find((s) => s.id === lastEvent?.studentId)?.name;

  const reward = (id: string) => {
    setFailed(false);
    awardPoints(classId, id, reason).catch(() => setFailed(true));
    navigator.vibrate?.(30);
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 400);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-6">
      {failed ? (
        <p role="alert" className="mb-3 rounded-xl border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          That didn&apos;t save. Check your connection and tap again.
        </p>
      ) : null}
      <header className="mb-5">
        <p className="cw-eyebrow">Remote · {classroom.name}</p>
        <h1 className="cw-title mt-2 text-3xl text-white">{world.name}</h1>
        <p className="mt-1.5 text-sm text-muted">Choose why, then tap a student.</p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-bg/90 px-4 py-2 backdrop-blur-xl">
        <div role="radiogroup" aria-label="Reason for the point" className="flex flex-wrap gap-1.5">
          {(Object.keys(REASONS) as ReasonId[]).map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={reason === id}
              onClick={() => setReason(id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                reason === id ? "border-transparent bg-gold text-[#1b1405]" : "border-line bg-surface text-text/85"
              }`}
            >
              {REASONS[id].button}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {classroom.students.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => reward(s.id)}
              aria-label={`Give ${s.name} a point for ${REASONS[reason].button.toLowerCase()} (${totals[s.id] ?? 0} now)`}
              className={`flex w-full items-center gap-2.5 rounded-2xl border bg-surface p-2.5 text-left transition duration-200 active:scale-[0.97] ${
                flash === s.id ? "border-gold" : "border-line"
              }`}
            >
              <span
                className="cw-heading flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base text-white"
                style={{ background: s.color }}
                aria-hidden="true"
              >
                {s.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.95rem] font-semibold">{s.name}</span>
                <span className="text-xs text-muted">{totals[s.id] ?? 0} pts</span>
              </span>
              <span className={flash === s.id ? "text-gold" : "text-muted"}>
                <Star size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/90 p-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <button
            disabled={!lastEvent}
            onClick={() => {
              setFailed(false);
              undoLast(classId).catch(() => setFailed(true));
            }}
            className="cw-menu-btn !justify-center font-semibold disabled:opacity-40"
          >
            <Undo size={17} />
            Undo{lastName ? ` (${lastName})` : ""}
          </button>
        </div>
      </div>
    </main>
  );
}

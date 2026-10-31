"use client";

import { SPECIES, classCollection } from "@/lib/dinos";
import type { Classroom } from "@/lib/types";

/** The class's collection: every dinosaur hatched so far, all weeks included. */
export default function DinoBook({ classroom, onClose }: { classroom: Classroom; onClose: () => void }) {
  const entries = classCollection(classroom.events, classroom.students, classroom.timeZone);
  const found = new Set(entries.map((e) => e.speciesId)).size;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-3">
      <div role="dialog" aria-label="Dino Book" className="cw-panel max-h-full w-full max-w-3xl overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-gold">Dino Book</h2>
            <p className="text-sm text-muted">
              {found} of {SPECIES.length} kinds found · {entries.length} hatched in all
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold">
            Close
          </button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SPECIES.map((s) => {
            const hatched = entries.filter((e) => e.speciesId === s.id);
            const golds = hatched.filter((e) => e.gold).length;
            const names = [...new Set(hatched.map((e) => e.studentName))];
            return (
              <li key={s.id} className={`rounded-xl border border-line p-3 ${hatched.length ? "bg-white/5" : "opacity-60"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-base">{hatched.length ? s.name : "???"}</h3>
                  {hatched.length > 0 && (
                    <span className="text-xs font-bold text-gold">
                      ×{hatched.length}
                      {golds > 0 && ` · ${golds} gold`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{hatched.length ? s.fact : "Not hatched yet. Keep earning points!"}</p>
                {names.length > 0 && <p className="mt-1 text-xs text-text/80">Hatched by {names.join(", ")}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

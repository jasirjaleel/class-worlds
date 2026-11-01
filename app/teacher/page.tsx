"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Close, SoundOn } from "@/components/Icons";
import { SOUNDS, previewSound, type SoundName } from "@/game/engine/sound";
import { addStudents, removeStudent, resetClass, updateSettings } from "@/lib/store";
import { useClassroom } from "@/lib/useClassroom";

const CLASS_ID = "demo";

export default function Teacher() {
  const classroom = useClassroom(CLASS_ID);
  const [names, setNames] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  if (!classroom) return <main className="min-h-dvh bg-bg" />;

  // Accepts one name, or a column pasted from Excel / a comma list
  const submitNames = () => {
    const list = names.split(/[\n,\t]+/).map((n) => n.trim()).filter(Boolean);
    if (!list.length) return;
    addStudents(CLASS_ID, list);
    setNames("");
  };

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8 sm:py-12">
      <header className="cw-rise mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="cw-eyebrow">Teacher</p>
          <h1 className="cw-title mt-2 text-4xl text-white sm:text-5xl">Your class</h1>
        </div>
        <Link href="/" className="cw-menu-btn !w-auto shrink-0 !py-2 text-sm">
          <ArrowLeft size={16} />
          Menu
        </Link>
      </header>

      <section className="cw-panel mb-4 p-5">
        <label className="cw-heading text-base text-white" htmlFor="class-name">
          Class name
        </label>
        <input
          id="class-name"
          value={nameDraft ?? classroom.name}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft !== null && nameDraft.trim()) updateSettings(CLASS_ID, { name: nameDraft.trim() });
            setNameDraft(null);
          }}
          className="cw-input mt-2"
        />
      </section>

      <section className="cw-panel mb-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="cw-heading text-base text-white">Students</h2>
          <span className="text-sm text-muted">{classroom.students.length}</span>
        </div>
        <label htmlFor="new-students" className="mb-3 mt-1 block text-sm text-muted">
          First names or nicknames only. You can paste a column from Excel.
        </label>
        <div className="mb-4 flex items-start gap-2">
          <textarea
            id="new-students"
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={2}
            placeholder="e.g. Aisha, Omar"
            className="cw-input flex-1"
          />
          <button onClick={submitNames} className="cw-menu-btn cw-menu-btn-primary !w-auto !py-2.5 text-sm">
            Add
          </button>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {classroom.students.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-full border border-line bg-bg/60 py-1 pl-2.5 pr-1.5 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
              <button
                aria-label={`Remove ${s.name}`}
                onClick={() => removeStudent(CLASS_ID, s.id)}
                className="rounded-full p-0.5 text-muted transition hover:text-red-300"
              >
                <Close size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="cw-panel mb-4 flex items-start justify-between gap-4 p-5">
        <div>
          <label htmlFor="show-scores" className="cw-heading text-base text-white">
            Show points on the class screen
          </label>
          <p className="mt-1 text-sm text-muted">
            Off keeps each student&apos;s score private, so nobody is shown at the bottom in front of the class. You can always see points on the remote.
          </p>
        </div>
        <input
          id="show-scores"
          type="checkbox"
          checked={classroom.showScores}
          onChange={(e) => updateSettings(CLASS_ID, { showScores: e.target.checked })}
          className="mt-1 h-5 w-5 shrink-0 accent-[#f4c452]"
        />
      </section>

      <section className="cw-panel mb-4 p-5">
        <h2 className="cw-heading text-base text-white">Preview sounds</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Sound effects only, with no music. Turn them on or off with the sound button on the class screen.
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {(Object.entries(SOUNDS) as [SoundName, string][]).map(([name, label]) => (
            <li key={name}>
              <button onClick={() => previewSound(name)} className="cw-menu-btn !py-2 text-sm">
                <span>{label}</span>
                <SoundOn size={15} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line p-5">
        <h2 className="cw-heading text-base text-white">Demo data</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Puts the demo class back to its starting students and points.</p>
        <button
          onClick={() => confirm("Reset the demo class and all its points?") && resetClass(CLASS_ID)}
          className="rounded-xl border border-red-300/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/10"
        >
          Reset demo class
        </button>
      </section>
    </main>
  );
}

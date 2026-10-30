"use client";

import Link from "next/link";
import { useState } from "react";
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
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-gold">Teacher</h1>
        <Link href="/" className="cw-menu-btn !w-auto !py-2 text-sm">
          ← Menu
        </Link>
      </div>

      <section className="cw-panel mb-4 p-4">
        <label className="text-sm font-bold" htmlFor="class-name">
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
          className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2"
        />
      </section>

      <section className="cw-panel mb-4 p-4">
        <h2 className="mb-1 font-bold">Students ({classroom.students.length})</h2>
        <p className="mb-3 text-xs text-muted">First names or nicknames only. You can paste a column from Excel.</p>
        <div className="mb-3 flex gap-2">
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={2}
            placeholder="e.g. Aisha, Omar"
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2"
          />
          <button onClick={submitNames} className="rounded-lg bg-gold px-4 font-bold text-black">
            Add
          </button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {classroom.students.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-full border border-line bg-bg py-1 pl-1 pr-2 text-sm">
              <span className="h-5 w-5 rounded-full" style={{ background: s.color }} />
              {s.name}
              <button
                aria-label={`Remove ${s.name}`}
                onClick={() => removeStudent(CLASS_ID, s.id)}
                className="text-muted hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="cw-panel p-4">
        <h2 className="mb-2 font-bold">Demo data</h2>
        <button
          onClick={() => confirm("Reset the demo class and all its points?") && resetClass(CLASS_ID)}
          className="rounded-lg border border-red-400/50 px-4 py-2 text-sm font-bold text-red-300"
        >
          Reset demo class
        </button>
      </section>
    </main>
  );
}

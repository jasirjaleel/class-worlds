"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { WORLDS, type WorldCategory } from "@/game/worlds/registry";
import { setWorld } from "@/lib/store";
import { useClassroom } from "@/lib/useClassroom";

const CLASS_ID = "demo";

const SECTIONS: { id: WorldCategory; title: string; blurb: string }[] = [
  { id: "me", title: "Me worlds", blurb: "Every student grows their own." },
  { id: "us", title: "Us worlds", blurb: "The whole class builds one thing together." },
];

const RESET_LABEL = { day: "Resets daily", week: "Resets weekly", term: "Lasts all term" };

export default function WorldSelect() {
  const router = useRouter();
  const classroom = useClassroom(CLASS_ID);

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-gold sm:text-4xl">World select</h1>
        <Link href="/" className="cw-menu-btn !w-auto !py-2 text-sm">
          ← Menu
        </Link>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.id} className="mb-8">
          <h2 className="font-display text-xl">{section.title}</h2>
          <p className="mb-3 text-sm text-muted">{section.blurb}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORLDS.filter((w) => w.category === section.id).map((w) => {
              const active = classroom?.worldId === w.id;
              return (
                <button
                  key={w.id}
                  disabled={!w.ready}
                  onClick={() => {
                    setWorld(CLASS_ID, w.id);
                    router.push(`/play/${CLASS_ID}`);
                  }}
                  className="cw-panel group relative overflow-hidden p-4 text-left transition enabled:hover:-translate-y-1 disabled:opacity-50"
                  style={{ borderColor: active ? w.accent : undefined }}
                >
                  <div className="text-4xl">{w.emoji}</div>
                  <div className="mt-2 font-display text-lg" style={{ color: w.accent }}>
                    {w.name}
                  </div>
                  <p className="mt-1 text-sm text-muted">{w.tagline}</p>
                  <div className="mt-3 flex gap-2 text-xs font-bold">
                    <span className="rounded-full bg-white/10 px-2 py-0.5">{RESET_LABEL[w.reset]}</span>
                    {active && <span className="rounded-full bg-gold px-2 py-0.5 text-black">Playing</span>}
                    {!w.ready && <span className="rounded-full bg-white/10 px-2 py-0.5">Coming soon</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="cw-panel border-dashed p-4 opacity-70">
        <h2 className="font-display text-lg">School worlds · next version</h2>
        <p className="text-sm text-muted">House Battle, Space Race and Garden Plots: classes and houses competing on the school lobby screen.</p>
      </section>
    </main>
  );
}

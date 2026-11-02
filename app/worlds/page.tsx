"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@/components/Icons";
import WorldCard from "@/components/WorldCard";
import { WORLDS, type WorldCategory } from "@/game/worlds/registry";
import { setWorld } from "@/lib/store";
import { useClassroom } from "@/lib/useClassroom";
import { useCurrentClass } from "@/lib/useCurrentClass";

const SECTIONS: { id: WorldCategory; title: string; blurb: string }[] = [
  { id: "me", title: "Me worlds", blurb: "Every student grows their own." },
  { id: "us", title: "Us worlds", blurb: "The whole class builds one thing together." },
];

const RESET_LABEL = { day: "Resets daily", week: "Resets weekly", term: "Lasts all term" };

export default function WorldSelect() {
  const router = useRouter();
  const { classId } = useCurrentClass();
  const classroom = useClassroom(classId);

  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="cw-rise mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="cw-eyebrow">Worlds</p>
          <h1 className="cw-title mt-2 text-4xl text-white sm:text-5xl">Choose a world</h1>
          <p className="mt-3 text-muted">Points carry over, so you can switch worlds whenever you like.</p>
        </div>
        <Link href="/" className="cw-menu-btn !w-auto shrink-0 !py-2 text-sm">
          <ArrowLeft size={16} />
          Menu
        </Link>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.id} className="mb-10">
          <h2 className="cw-heading text-2xl text-white">{section.title}</h2>
          <p className="mb-4 mt-1 text-sm text-muted">{section.blurb}</p>
          <div className={`grid gap-x-4 gap-y-6 sm:grid-cols-2 ${section.id === "me" ? "lg:grid-cols-4" : ""}`}>
            {WORLDS.filter((w) => w.category === section.id).map((w) => (
              <div key={w.id}>
                <WorldCard
                  world={w}
                  active={classroom?.worldId === w.id}
                  sizes={section.id === "me" ? "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" : "(min-width: 640px) 50vw, 100vw"}
                  onSelect={() => {
                    if (!classId) return router.push("/teacher");
                    setWorld(classId, w.id);
                    router.push(`/play/${classId}`);
                  }}
                />
                <p className="mt-2.5 text-sm leading-snug text-text/85">{w.tagline}</p>
                <p className="mt-1 text-xs text-muted">{RESET_LABEL[w.reset]}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="border-t border-line pt-6">
        <h2 className="cw-heading text-lg text-white">School worlds</h2>
        <p className="mt-1 text-sm text-muted">
          Next version: House Battle, Space Race and Garden Plots, with classes and houses competing on the school lobby screen.
        </p>
      </section>
    </main>
  );
}

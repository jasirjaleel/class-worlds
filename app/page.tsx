"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { startMenuBackdrop } from "@/game/scenes/menuBackdrop";
import { WORLDS, worldMeta } from "@/game/worlds/registry";
import { setWorld } from "@/lib/store";
import { useClassroom } from "@/lib/useClassroom";

const CLASS_ID = "demo";

const READY_COUNT = WORLDS.filter((w) => w.ready).length;

export default function MainMenu() {
  const router = useRouter();
  const backdrop = useRef<HTMLDivElement>(null);
  const classroom = useClassroom(CLASS_ID);
  const lowGraphics = classroom?.lowGraphics ?? false;

  useEffect(() => {
    if (!backdrop.current) return;
    return startMenuBackdrop(backdrop.current, lowGraphics);
  }, [lowGraphics]);

  const world = classroom ? worldMeta(classroom.worldId) : null;

  const items: { label: string; href?: string; hint: string }[] = [
    { label: "World select", href: "/worlds", hint: `${READY_COUNT} ready · ${WORLDS.length - READY_COUNT} soon` },
    { label: "Term journey", hint: "Soon" },
    { label: "Free roam", href: `/play/${CLASS_ID}?roam=1`, hint: "Fly around" },
    { label: "Teacher", href: "/teacher", hint: "Class & students" },
  ];

  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden lg:h-dvh lg:overflow-hidden">
      <div ref={backdrop} className="absolute inset-x-0 top-0 h-60 lg:bottom-36 lg:left-[32%] lg:h-auto" />
      <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-[#0b1026] via-[#0b1026]/30 to-transparent lg:block" />

      <div className="relative z-10 flex flex-col gap-5 px-4 pb-6 pt-56 lg:h-full lg:max-w-md lg:justify-center lg:px-10 lg:py-6">
        <div>
          <h1 className="font-display text-5xl leading-[0.95] text-gold drop-shadow-[0_4px_0_#92400e] xl:text-7xl">
            Class
            <br />
            Worlds
          </h1>
          <p className="mt-4 text-lg font-semibold leading-snug text-text">
            Reward your class from your phone. Watch their world grow on the big screen.
          </p>
          {classroom && (
            <p className="mt-2 text-sm text-muted">
              {classroom.name} · {classroom.students.length} students
            </p>
          )}
        </div>

        <nav className="flex flex-col gap-2.5" aria-label="Main menu">
          <Link href={`/play/${CLASS_ID}`} className="cw-menu-btn cw-menu-btn-primary">
            <span>Play class world</span>
            {world && (
              <span className="font-sans text-xs font-extrabold tracking-normal">
                {world.emoji} {world.name}
              </span>
            )}
          </Link>
          {items.map((item) =>
            item.href ? (
              <Link key={item.label} href={item.href} className="cw-menu-btn">
                <span>{item.label}</span>
                <span className="font-sans text-xs font-bold tracking-normal text-muted">{item.hint}</span>
              </Link>
            ) : (
              <span key={item.label} className="cw-menu-btn" aria-disabled="true">
                <span>{item.label}</span>
                <span className="font-sans text-xs font-bold tracking-normal text-muted">{item.hint}</span>
              </span>
            ),
          )}
        </nav>

        <p className="text-xs text-muted">First names only · No student accounts · No ads</p>
      </div>

      <section
        aria-labelledby="choose-world"
        className="relative z-10 px-4 pb-8 lg:absolute lg:bottom-5 lg:left-[32%] lg:right-5 lg:p-0"
      >
        <h2 id="choose-world" className="mb-2 font-display text-sm tracking-wider text-text">
          Choose a world
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {WORLDS.map((w) => {
            const active = classroom?.worldId === w.id;
            return (
              <button
                key={w.id}
                disabled={!w.ready}
                aria-current={active ? "true" : undefined}
                onClick={() => {
                  setWorld(CLASS_ID, w.id);
                  router.push(`/play/${CLASS_ID}`);
                }}
                className="cw-panel flex min-h-20 flex-col justify-between gap-1 p-2.5 text-left transition enabled:hover:-translate-y-1 disabled:cursor-not-allowed"
                style={{ borderColor: active ? w.accent : undefined }}
              >
                <span className="flex items-start justify-between gap-1">
                  <span className={`text-2xl ${w.ready ? "" : "opacity-60"}`} aria-hidden="true">
                    {w.emoji}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                      active ? "bg-gold text-black" : "bg-white/10 text-muted"
                    }`}
                  >
                    {active ? "Playing" : w.ready ? "Ready" : "Soon"}
                  </span>
                </span>
                <span className={`font-display text-xs leading-tight ${w.ready ? "text-text" : "text-muted"}`}>
                  {w.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

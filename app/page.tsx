"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { startMenuBackdrop } from "@/game/scenes/menuBackdrop";
import { worldMeta } from "@/game/worlds/registry";
import { useClassroom } from "@/lib/useClassroom";

const CLASS_ID = "demo";

export default function MainMenu() {
  const backdrop = useRef<HTMLDivElement>(null);
  const classroom = useClassroom(CLASS_ID);
  const lowGraphics = classroom?.lowGraphics ?? false;

  useEffect(() => {
    if (!backdrop.current) return;
    return startMenuBackdrop(backdrop.current, lowGraphics);
  }, [lowGraphics]);

  const world = classroom ? worldMeta(classroom.worldId) : null;

  const items: { label: string; href?: string; hint: string }[] = [
    { label: "Play class world", href: `/play/${CLASS_ID}`, hint: world ? `${world.emoji} ${world.name}` : "" },
    { label: "World select", href: "/worlds", hint: "6 worlds" },
    { label: "Term journey", hint: "Soon" },
    { label: "Free roam", href: `/play/${CLASS_ID}?roam=1`, hint: "Fly around" },
    { label: "Teacher", href: "/teacher", hint: "Class & students" },
  ];

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div ref={backdrop} className="absolute inset-0 md:left-[30%]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b1026] via-[#0b1026]/80 to-transparent md:via-[#0b1026]/40" />

      <div className="relative z-10 flex h-full max-w-md flex-col justify-center gap-6 px-4 sm:px-10">
        <div>
          <h1 className="font-display text-5xl leading-[0.95] text-gold drop-shadow-[0_4px_0_#92400e] sm:text-6xl">
            Class
            <br />
            Worlds
          </h1>
          <p className="mt-3 text-muted">
            Every good deed builds the world. Pick a world, reward your class from your phone and watch it grow.
          </p>
          {classroom && (
            <p className="mt-2 text-sm text-text/80">
              Class: <b>{classroom.name}</b> · {classroom.students.length} students
            </p>
          )}
        </div>

        <nav className="flex flex-col gap-2.5">
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

        <p className="text-xs text-muted">
          First names only · No student accounts · No ads
        </p>
      </div>
    </main>
  );
}

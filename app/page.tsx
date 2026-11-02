"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowRight } from "@/components/Icons";
import WorldCard from "@/components/WorldCard";
import { startMenuBackdrop } from "@/game/scenes/menuBackdrop";
import { WORLDS, worldMeta } from "@/game/worlds/registry";
import { setWorld } from "@/lib/store";
import { useClassroom } from "@/lib/useClassroom";
import { useCurrentClass } from "@/lib/useCurrentClass";

const READY_COUNT = WORLDS.filter((w) => w.ready).length;

export default function MainMenu() {
  const router = useRouter();
  const backdrop = useRef<HTMLDivElement>(null);
  const { loading, signedIn, classId } = useCurrentClass();
  const classroom = useClassroom(classId);
  const lowGraphics = classroom?.lowGraphics ?? false;

  useEffect(() => {
    if (!backdrop.current) return;
    return startMenuBackdrop(backdrop.current, lowGraphics);
  }, [lowGraphics]);

  const world = classroom ? worldMeta(classroom.worldId) : null;

  const items: { label: string; href: string; hint: string }[] = [
    { label: "World select", href: "/worlds", hint: READY_COUNT === WORLDS.length ? `${WORLDS.length} worlds` : `${READY_COUNT} ready · ${WORLDS.length - READY_COUNT} soon` },
    { label: "Free roam", href: `/play/${classId}?roam=1`, hint: "Fly around" },
    { label: "Teacher", href: "/teacher", hint: "Class & students" },
  ];

  // Without a class to play, the worlds lead to wherever the teacher can get one
  const startHref = !signedIn ? "/sign-in" : "/teacher";

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-x-hidden">
      <div ref={backdrop} className="absolute inset-x-0 top-0 h-64 lg:bottom-0 lg:left-[30%] lg:h-auto" />
      <div className="pointer-events-none absolute inset-x-0 top-40 h-24 bg-gradient-to-b from-transparent to-bg lg:hidden" />
      {/* blends the left edge of the 3D scene into the page */}
      <div className="pointer-events-none absolute inset-y-0 left-[30%] hidden w-[28%] bg-gradient-to-r from-bg to-transparent lg:block" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-72 bg-gradient-to-t from-bg via-bg/85 to-transparent lg:block" />

      <div className="relative z-10 flex flex-1 flex-col justify-center gap-6 px-4 pb-6 pt-56 sm:px-8 lg:max-w-[30rem] lg:px-12 lg:py-6">
        <div className="cw-rise">
          <p className="cw-eyebrow">For the classroom screen</p>
          <h1 className="cw-title cw-hero-title mt-3 text-6xl text-white xl:text-7xl">
            Class
            <br />
            Worlds
          </h1>
          <p className="mt-4 max-w-sm text-lg leading-snug text-text/90">
            Reward your class from your phone. Watch their world grow on the big screen.
          </p>
        </div>

        <nav className="cw-rise flex flex-col gap-2" style={{ animationDelay: "90ms" }} aria-label="Main menu">
          {loading ? null : classId ? (
            <>
              <Link href={`/play/${classId}`} className="cw-menu-btn cw-menu-btn-primary">
                <span>Play class world</span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {world?.name}
                  <ArrowRight size={18} />
                </span>
              </Link>
              {items.map((item) => (
                <Link key={item.label} href={item.href} className="cw-menu-btn !py-2.5 text-[0.95rem]">
                  <span>{item.label}</span>
                  <span className="text-xs font-medium text-muted">{item.hint}</span>
                </Link>
              ))}
            </>
          ) : (
            <Link href={startHref} className="cw-menu-btn cw-menu-btn-primary">
              <span>{signedIn ? "Create your first class" : "Teacher sign in"}</span>
              <ArrowRight size={18} />
            </Link>
          )}
        </nav>
      </div>

      <section aria-labelledby="choose-world" className="cw-rise cw-world-strip relative z-10 px-4 pb-6 sm:px-8 lg:px-12 lg:pb-7" style={{ animationDelay: "180ms" }}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="choose-world" className="cw-heading text-lg text-white">
            Choose a world
          </h2>
          <p className="text-xs text-muted">
            {classroom ? `${classroom.name} · ${classroom.students.length} students · ` : ""}First names only · No student accounts · No ads ·{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-white">
              Privacy
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {WORLDS.map((w) => (
            <WorldCard
              key={w.id}
              world={w}
              active={classroom?.worldId === w.id}
              sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
              onSelect={() => {
                if (!classId) return router.push(startHref);
                setWorld(classId, w.id);
                router.push(`/play/${classId}`);
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

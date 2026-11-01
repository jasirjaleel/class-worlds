"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import DinoBook from "@/components/DinoBook";
import { ArrowLeft, Book, Phone, Sliders, SoundOff, SoundOn, Star, Undo } from "@/components/Icons";
import GameCanvas from "@/components/GameCanvas";
import {
  getServerSoundState,
  getSoundState,
  playSound,
  setSoundEnabled,
  setSoundVolume,
  subscribeSound,
} from "@/game/engine/sound";
import { worldMeta } from "@/game/worlds/registry";
import type { WorldInstance } from "@/game/worlds/types";
import { CLASS_STEPS, classGoal, classSteps, classTotal, goalReached } from "@/lib/points";
import { reasonMessage } from "@/lib/reasons";
import { getCached, updateSettings } from "@/lib/store";
import { currentTotals, useClassroom } from "@/lib/useClassroom";

const PERIOD_LABEL = { day: "Today", week: "This week", term: "This term" };

interface Toast {
  key: number;
  name: string;
  color: string;
  amount: number;
  message: string;
}

interface StepMoment {
  key: number;
  step: number;
}

function PlayScreen() {
  const { classId } = useParams<{ classId: string }>();
  const roam = useSearchParams().get("roam") === "1";
  const worldRef = useRef<WorldInstance | null>(null);
  const [fps, setFps] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [stepMoment, setStepMoment] = useState<StepMoment | null>(null);
  const [showRemote, setShowRemote] = useState(false);
  const [qr, setQr] = useState("");
  const [hasPlanetPhotos, setHasPlanetPhotos] = useState(false);
  const [showBook, setShowBook] = useState(false);

  const onReward = useCallback(
    (msg: { studentId: string; amount: number; reason: string | null }) => {
      const c = getCached(classId);
      if (!c) return;
      worldRef.current?.setTotals(currentTotals(c));
      if (msg.amount > 0) worldRef.current?.reward(msg.studentId);
      const s = c.students.find((x) => x.id === msg.studentId);
      if (!s) return;
      const toast = { key: Date.now() + Math.random(), name: s.name, color: s.color, amount: msg.amount, message: reasonMessage(msg.reason) };
      setToasts((t) => [...t.slice(-3), toast]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.key !== toast.key)), 2500);

      // this point finished a class step: the whole class gets a moment
      const goalNow = classGoal(c.students.length, worldMeta(c.worldId).goalPerStudent);
      const after = classTotal(currentTotals(c));
      const stepAfter = classSteps(after, goalNow).done;
      if (msg.amount > 0 && stepAfter > classSteps(after - msg.amount, goalNow).done) {
        const moment = { key: Date.now(), step: stepAfter };
        setStepMoment(moment);
        playSound("step", 0.25);
        setTimeout(() => setStepMoment((m) => (m?.key === moment.key ? null : m)), 3200);
      }
    },
    [classId],
  );

  const classroom = useClassroom(classId, onReward);
  const sound = useSyncExternalStore(subscribeSound, getSoundState, getServerSoundState);

  // a point taken back gets its own quiet sound
  const eventCount = classroom?.events.length;
  const lastEventCount = useRef(eventCount);
  useEffect(() => {
    if (eventCount !== undefined && lastEventCount.current !== undefined && eventCount < lastEventCount.current) {
      playSound("undo");
    }
    lastEventCount.current = eventCount;
  }, [eventCount]);

  useEffect(() => {
    fetch("/api/textures")
      .then((r) => r.json())
      .then(({ files }: { files: string[] }) => setHasPlanetPhotos(files.length > 0))
      .catch(() => {});
  }, []);

  const [remoteUrl, setRemoteUrl] = useState("");
  useEffect(() => {
    if (!showRemote) return;
    // Phones can't open "localhost", so point the QR code at this computer's Wi-Fi address
    fetch("/api/lan")
      .then((r) => r.json())
      .then(({ ip }: { ip: string | null }) => {
        const { protocol, hostname, port } = window.location;
        const host = hostname === "localhost" || hostname === "127.0.0.1" ? (ip ?? hostname) : hostname;
        const url = `${protocol}//${host}${port ? `:${port}` : ""}/remote/${classId}`;
        setRemoteUrl(url);
        return QRCode.toDataURL(url, { margin: 1, width: 220 });
      })
      .then(setQr);
  }, [showRemote, classId]);

  if (!classroom) return <main className="h-dvh bg-bg" />;

  const world = worldMeta(classroom.worldId);
  const totals = currentTotals(classroom);
  const total = classTotal(totals);
  const goal = classGoal(classroom.students.length, world.goalPerStudent);
  const reached = goalReached(totals, classroom.students.length, world.goalPerStudent);
  const pct = Math.min(100, Math.floor((total / goal) * 100));
  const steps = classSteps(total, goal);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <GameCanvas classroom={classroom} roam={roam} worldRef={worldRef} onFps={setFps} />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/" className="cw-control h-11">
            <ArrowLeft size={16} />
            Menu
          </Link>
          <div className="cw-control h-11 flex-col !items-start !gap-0 hover:!border-line hover:!bg-panel">
            <span className="cw-heading text-sm leading-tight text-white">{world.name}</span>
            <span className="text-[0.6875rem] font-medium leading-tight text-muted">
              {classroom.name} · {PERIOD_LABEL[world.reset]}
              {roam && " · Drag to look around"}
            </span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="hidden font-mono text-[0.6875rem] text-white/70 [text-shadow:0_1px_3px_#000] sm:inline" data-testid="fps">
            {fps} fps
          </span>
          {sound.enabled && sound.running && (
            <label className="cw-control hidden sm:inline-flex">
              <span className="sr-only">Sound volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sound.volume}
                onChange={(e) => setSoundVolume(Number(e.target.value))}
                className="w-20 accent-[#f4c452]"
              />
            </label>
          )}
          <button
            className={`cw-control ${sound.enabled ? "" : "cw-control-gold"}`}
            aria-pressed={sound.enabled && sound.running}
            onClick={() => setSoundEnabled(!(sound.enabled && sound.running))}
          >
            {sound.enabled && sound.running ? <SoundOn size={15} /> : <SoundOff size={15} />}
            {sound.enabled && sound.running ? "Sound on" : "Turn on sound"}
          </button>
          <button className="cw-control" onClick={() => updateSettings(classId, { lowGraphics: !classroom.lowGraphics })}>
            <Sliders size={15} />
            {classroom.lowGraphics ? "Low graphics" : "High graphics"}
          </button>
          {classroom.worldId === "dino-eggs" && (
            <button className="cw-control" onClick={() => setShowBook(true)}>
              <Book size={15} />
              Dino Book
            </button>
          )}
          <button className="cw-control cw-control-gold" aria-expanded={showRemote} onClick={() => setShowRemote((v) => !v)}>
            <Phone size={15} />
            Remote
          </button>
        </div>
      </div>

      {showRemote && (
        <div className="cw-panel absolute right-3 top-16 z-20 w-64 p-4 text-sm sm:right-4">
          <p className="cw-heading mb-3 text-base text-white">Scan with your phone</p>
          {qr && <img src={qr} alt="QR code for the remote" className="mb-3 w-full rounded-xl bg-white p-2" />}
          {remoteUrl && <p className="mb-2 break-all font-mono text-[0.6875rem] text-gold">{remoteUrl}</p>}
          <p className="text-xs leading-snug text-muted">Your phone must be on the same Wi-Fi as this computer.</p>
        </div>
      )}

      {showBook && <DinoBook classroom={classroom} onClose={() => setShowBook(false)} />}

      {/* Licence credit, only when real planet photos are in use */}
      {classroom.worldId === "space-fleet" && hasPlanetPhotos && (
        <p className="pointer-events-none absolute bottom-1 left-2 text-[10px] text-muted/70">
          Planet textures: Solar System Scope, CC BY 4.0
        </p>
      )}

      {/* Class goal */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4">
        <div className="cw-panel w-full max-w-xl px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-xs sm:text-sm">
            <span className="font-medium text-text/90">
              <span className="font-semibold text-white">Class goal</span> {reached ? world.goalDone : `· ${world.goalText}`}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-gold">
              {total} / {goal}
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-gold transition-all duration-700" style={{ width: `${pct}%` }} />
            {/* a mark at each class step */}
            {Array.from({ length: CLASS_STEPS - 1 }, (_, i) => (
              <span key={i} className="absolute inset-y-0 w-0.5 bg-bg" style={{ left: `${((i + 1) / CLASS_STEPS) * 100}%` }} />
            ))}
          </div>
          {!reached && (
            <p className="mt-1.5 text-[0.6875rem] font-medium text-muted">
              Step {steps.done + 1} of {CLASS_STEPS} · {steps.toNext} more {steps.toNext === 1 ? "point" : "points"} to go
            </p>
          )}
        </div>
      </div>

      {/* The whole class finished a step */}
      {stepMoment && stepMoment.step < CLASS_STEPS && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-4">
          <div key={stepMoment.key} className="cw-toast rounded-2xl bg-gold px-7 py-4 text-center text-[#1b1405] shadow-2xl">
            <p className="cw-title text-3xl">Well done, class!</p>
            <p className="mt-1 text-sm font-semibold">
              Step {stepMoment.step} of {CLASS_STEPS} finished together
            </p>
          </div>
        </div>
      )}

      {/* Reward toasts */}
      <div className="pointer-events-none absolute inset-x-0 bottom-28 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.key} className="cw-toast flex items-center gap-2.5 rounded-2xl bg-white py-2 pl-3 pr-4 text-gray-900 shadow-2xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: t.color }}>
              {t.amount > 0 ? <Star size={15} /> : <Undo size={15} />}
            </span>
            <span className="cw-heading text-base">{t.name}</span>
            <span className="text-sm font-medium text-gray-600">{t.amount > 0 ? t.message : "Point taken back"}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayScreen />
    </Suspense>
  );
}

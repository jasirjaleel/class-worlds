"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import DinoBook from "@/components/DinoBook";
import GameCanvas from "@/components/GameCanvas";
import { worldMeta } from "@/game/worlds/registry";
import type { WorldInstance } from "@/game/worlds/types";
import { classGoal, classTotal, goalReached } from "@/lib/points";
import { getCached, updateSettings } from "@/lib/store";
import { currentTotals, useClassroom } from "@/lib/useClassroom";

const PERIOD_LABEL = { day: "Today", week: "This week", term: "This term" };

interface Toast {
  key: number;
  name: string;
  color: string;
  amount: number;
}

function PlayScreen() {
  const { classId } = useParams<{ classId: string }>();
  const roam = useSearchParams().get("roam") === "1";
  const worldRef = useRef<WorldInstance | null>(null);
  const [fps, setFps] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showRemote, setShowRemote] = useState(false);
  const [qr, setQr] = useState("");
  const [hasPlanetPhotos, setHasPlanetPhotos] = useState(false);
  const [showBook, setShowBook] = useState(false);

  const onReward = useCallback(
    (msg: { studentId: string; amount: number }) => {
      const c = getCached(classId);
      if (!c) return;
      worldRef.current?.setTotals(currentTotals(c));
      if (msg.amount > 0) worldRef.current?.reward(msg.studentId);
      const s = c.students.find((x) => x.id === msg.studentId);
      if (!s) return;
      const toast = { key: Date.now() + Math.random(), name: s.name, color: s.color, amount: msg.amount };
      setToasts((t) => [...t.slice(-3), toast]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.key !== toast.key)), 2500);
    },
    [classId],
  );

  const classroom = useClassroom(classId, onReward);

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

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <GameCanvas classroom={classroom} roam={roam} worldRef={worldRef} onFps={setFps} />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/" className="cw-menu-btn !w-auto !py-2 text-sm">
            ☰ Menu
          </Link>
          <div className="cw-panel px-3 py-1.5">
            <div className="font-display text-sm text-gold sm:text-base">
              {world.emoji} {world.name}
            </div>
            <div className="text-xs text-muted">
              {classroom.name} · {PERIOD_LABEL[world.reset]}
              {roam && " · Free roam: drag to look around"}
            </div>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="cw-panel hidden px-2 py-1 font-mono text-xs text-muted sm:inline" data-testid="fps">
            {fps} fps
          </span>
          <button
            className="cw-panel px-3 py-1.5 text-xs font-bold"
            onClick={() => updateSettings(classId, { lowGraphics: !classroom.lowGraphics })}
          >
            {classroom.lowGraphics ? "Low graphics" : "High graphics"}
          </button>
          {classroom.worldId === "dino-eggs" && (
            <button className="cw-panel px-3 py-1.5 text-xs font-bold text-gold" onClick={() => setShowBook(true)}>
              📖 Dino Book
            </button>
          )}
          <button className="cw-panel px-3 py-1.5 text-xs font-bold text-gold" onClick={() => setShowRemote((v) => !v)}>
            📱 Remote
          </button>
        </div>
      </div>

      {showRemote && (
        <div className="cw-panel absolute right-3 top-16 z-20 w-64 p-4 text-sm sm:right-4">
          <p className="mb-2 font-bold">Scan with your phone</p>
          {qr && <img src={qr} alt="QR code for the remote" className="mb-2 w-full rounded-lg bg-white" />}
          {remoteUrl && <p className="mb-2 break-all font-mono text-xs text-gold">{remoteUrl}</p>}
          <p className="text-xs text-muted">Your phone must be on the same Wi-Fi as this computer.</p>
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
        <div className="cw-panel w-full max-w-xl px-4 py-2.5">
          <div className="mb-1.5 flex justify-between text-xs font-bold sm:text-sm">
            <span>Class goal {reached ? world.goalDone : `· ${world.goalText}`}</span>
            <span className="text-gold">
              {total} / {goal} ⭐
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Reward toasts */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.key} className="cw-toast rounded-full bg-white px-5 py-2 font-display text-lg text-gray-900 shadow-xl" style={{ borderLeft: `8px solid ${t.color}` }}>
            {t.amount > 0 ? `⭐ ${t.name} +${t.amount}` : `↩ ${t.name} ${t.amount}`}
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

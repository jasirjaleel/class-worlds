import { classTopic, unseenEvents } from "./classSync";
import type { ReasonId } from "./reasons";
import { supabaseBrowser } from "./supabase/browser";
import type { Classroom, WorldId } from "./types";

// Client side of the classroom data. A private live channel says "something changed",
// then the screen fetches the class from our API and compares it with what it has, so
// a point plays its reward once however it arrived. School networks may block the live
// channel, so screens also fetch on a timer: every 10 seconds without it, every minute with it.

const TICK_MS = 10_000;
const TICKS_WHEN_LIVE = 6;

export type StoreMessage =
  | { type: "reward"; studentId: string; amount: number; reason: string | null }
  | { type: "changed" };

const cache = new Map<string, Classroom>();
const cacheJson = new Map<string, string>();
const seen = new Map<string, Set<string>>();
const listeners = new Map<string, Set<(msg: StoreMessage) => void>>();
const syncs = new Map<string, () => void>();
const requests = new Map<string, { started: number; applied: number }>();

export const getCached = (classId: string) => cache.get(classId) ?? null;

/** Stores a class from the server and tells listeners what's new. */
function apply(classId: string, classroom: Classroom) {
  const known = seen.get(classId) ?? null;
  const fresh = unseenEvents(known, classroom.events);
  seen.set(classId, new Set([...(known ?? []), ...classroom.events.map((e) => e.id)]));

  const json = JSON.stringify(classroom);
  if (json === cacheJson.get(classId)) return; // nothing changed: don't redraw the world
  cacheJson.set(classId, json);
  cache.set(classId, classroom);

  const set = listeners.get(classId);
  if (!fresh.length) set?.forEach((fn) => fn({ type: "changed" }));
  for (const e of fresh) {
    set?.forEach((fn) => fn({ type: "reward", studentId: e.studentId, amount: e.amount, reason: e.reason ?? null }));
  }
}

/** Runs a request for the class, ignoring a reply that arrives after a newer one. */
async function request(classId: string, send: () => Promise<Response>): Promise<Response> {
  const order = requests.get(classId) ?? { started: 0, applied: 0 };
  requests.set(classId, order);
  const n = ++order.started;
  const res = await send();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- not in a component: this leaves the screen entirely
  if (res.status === 401) window.location.href =`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`;
  if (res.status === 404) window.location.replace("/teacher"); // deleted, or not this teacher's
  if (res.ok && n > order.applied) {
    order.applied = n;
    apply(classId, (await res.clone().json()) as Classroom);
  }
  return res;
}

const refresh = (classId: string) => request(classId, () => fetch(`/api/classes/${classId}`)).catch(() => {});

function startSync(classId: string): () => void {
  let live = false;
  let ticks = 0;
  refresh(classId);
  const timer = setInterval(() => {
    ticks++;
    if (!live || ticks % TICKS_WHEN_LIVE === 0) refresh(classId);
  }, TICK_MS);

  let stopChannel = () => {};
  let stopped = false;
  try {
    const supabase = supabaseBrowser();
    // private channels need the teacher's login on the connection before joining
    supabase.realtime
      .setAuth()
      .catch(() => {})
      .then(() => {
        if (stopped) return;
        const channel = supabase
          .channel(classTopic(classId), { config: { private: true } })
          .on("broadcast", { event: "changed" }, () => refresh(classId))
          .subscribe((status: string) => {
            live = status === "SUBSCRIBED";
            if (live) refresh(classId); // catch up on anything missed while joining
          });
        stopChannel = () => supabase.removeChannel(channel);
      })
      .catch(() => {}); // no live channel: the timer keeps the screen up to date
  } catch {
    // no live channel: the timer keeps the screen up to date
  }

  return () => {
    stopped = true;
    clearInterval(timer);
    stopChannel();
    seen.delete(classId); // points given while away are history when this screen comes back
  };
}

/** Listen for rewards and changes from every device. Returns an unsubscribe fn. */
export function subscribe(classId: string, onMessage: (msg: StoreMessage) => void): () => void {
  const set = listeners.get(classId) ?? new Set();
  set.add(onMessage);
  listeners.set(classId, set);
  if (!syncs.has(classId)) syncs.set(classId, startSync(classId));

  return () => {
    set.delete(onMessage);
    if (set.size === 0) {
      syncs.get(classId)?.();
      syncs.delete(classId);
    }
  };
}

async function post(classId: string, body: Record<string, unknown>): Promise<Classroom> {
  const res = await request(classId, () =>
    fetch(`/api/classes/${classId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
  return (await res.json()) as Classroom;
}

export const awardPoints = (classId: string, studentId: string, reason: ReasonId, amount = 1) =>
  post(classId, { action: "award", studentId, amount, reason });

export const undoLast = (classId: string) => post(classId, { action: "undo" });

export const setWorld = (classId: string, worldId: WorldId) => post(classId, { action: "settings", worldId });

export const updateSettings = (classId: string, patch: { name?: string; lowGraphics?: boolean; showScores?: boolean }) =>
  post(classId, { action: "settings", ...patch });

export const addStudents = (classId: string, names: string[]) => post(classId, { action: "addStudents", names });

export const removeStudent = (classId: string, studentId: string) =>
  post(classId, { action: "removeStudent", studentId });

export async function createClass(name: string): Promise<Classroom> {
  const res = await fetch("/api/classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
  return (await res.json()) as Classroom;
}

export async function deleteClass(classId: string): Promise<void> {
  const res = await fetch(`/api/classes/${classId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete" }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

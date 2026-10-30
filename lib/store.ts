import type { Classroom, WorldId } from "./types";

// Client side of the classroom data. Reads arrive live from the server's SQLite
// database over one Server-Sent Events stream per class; changes are POSTed to
// the API. Any phone or screen on the same network sees every change.

export type StoreMessage =
  | { type: "reward"; studentId: string; amount: number }
  | { type: "changed" };

type ServerEvent =
  | { type: "reward"; studentId: string; amount: number; classroom: Classroom }
  | { type: "changed"; classroom: Classroom };

const cache = new Map<string, Classroom>();
const listeners = new Map<string, Set<(msg: StoreMessage) => void>>();
const streams = new Map<string, EventSource>();

export const getCached = (classId: string) => cache.get(classId) ?? null;

function deliver(classId: string, classroom: Classroom, msg: StoreMessage) {
  cache.set(classId, classroom);
  listeners.get(classId)?.forEach((fn) => fn(msg));
}

/** Listen for rewards and changes from every device. Returns an unsubscribe fn. */
export function subscribe(classId: string, onMessage: (msg: StoreMessage) => void): () => void {
  const set = listeners.get(classId) ?? new Set();
  set.add(onMessage);
  listeners.set(classId, set);

  if (!streams.has(classId)) {
    // EventSource reconnects by itself; the server re-sends the full class on connect
    const es = new EventSource(`/api/classes/${classId}/events`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data) as ServerEvent;
      deliver(
        classId,
        ev.classroom,
        ev.type === "reward" ? { type: "reward", studentId: ev.studentId, amount: ev.amount } : { type: "changed" },
      );
    };
    streams.set(classId, es);
  }

  return () => {
    set.delete(onMessage);
    if (set.size === 0) {
      streams.get(classId)?.close();
      streams.delete(classId);
    }
  };
}

async function post(classId: string, body: Record<string, unknown>): Promise<Classroom> {
  const res = await fetch(`/api/classes/${classId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
  const classroom = (await res.json()) as Classroom;
  deliver(classId, classroom, { type: "changed" });
  return classroom;
}

export const awardPoints = (classId: string, studentId: string, amount = 1) =>
  post(classId, { action: "award", studentId, amount });

export const undoLast = (classId: string) => post(classId, { action: "undo" });

export const setWorld = (classId: string, worldId: WorldId) => post(classId, { action: "settings", worldId });

export const updateSettings = (classId: string, patch: { name?: string; lowGraphics?: boolean }) =>
  post(classId, { action: "settings", ...patch });

export const addStudents = (classId: string, names: string[]) => post(classId, { action: "addStudents", names });

export const removeStudent = (classId: string, studentId: string) =>
  post(classId, { action: "removeStudent", studentId });

export const resetClass = (classId: string) => post(classId, { action: "reset" });

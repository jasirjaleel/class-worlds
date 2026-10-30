import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { DEMO_NAMES, STUDENT_COLORS, newId } from "@/lib/demo";
import type { Classroom, PointEvent, Student, WorldId } from "@/lib/types";

// Local SQLite database (data/class-worlds.db) plus an in-process event bus that
// pushes every change to open screens. Kept on globalThis so all route bundles
// and dev hot-reloads share one connection and one bus.

export type ClassEvent =
  | { type: "reward"; studentId: string; amount: number; classroom: Classroom }
  | { type: "changed"; classroom: Classroom };

const g = globalThis as unknown as { cwDb?: DatabaseSync; cwBus?: EventEmitter };

function open(): DatabaseSync {
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "class-worlds.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      time_zone TEXT NOT NULL,
      term_start INTEGER NOT NULL,
      world_id TEXT NOT NULL,
      low_graphics INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS point_events (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS point_events_class_at ON point_events(class_id, at);
  `);
  return db;
}

export const db = (g.cwDb ??= open());
export const bus = (g.cwBus ??= new EventEmitter().setMaxListeners(500));

function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function insertStudents(classId: string, names: string[]) {
  const start = (db.prepare("SELECT COUNT(*) n FROM students WHERE class_id = ?").get(classId) as { n: number }).n;
  const ins = db.prepare("INSERT INTO students (id, class_id, name, color, position) VALUES (?, ?, ?, ?, ?)");
  names.forEach((name, i) => {
    const pos = start + i;
    ins.run(newId(), classId, name.trim(), STUDENT_COLORS[pos % STUDENT_COLORS.length], pos);
  });
}

function createClass(id: string) {
  const now = Date.now();
  const demo = id === "demo";
  tx(() => {
    db.prepare(
      "INSERT INTO classrooms (id, name, time_zone, term_start, world_id, low_graphics) VALUES (?, ?, 'Asia/Dubai', ?, 'space-fleet', 0)",
    ).run(id, demo ? "Grade 3 Falcons" : "My Class", demo ? now - 60 * 86_400_000 : now);
    if (!demo) return;
    insertStudents(id, DEMO_NAMES);
    // A few points from earlier today so the world isn't empty
    const students = db.prepare("SELECT id FROM students WHERE class_id = ? ORDER BY position").all(id) as { id: string }[];
    const ins = db.prepare("INSERT INTO point_events (id, class_id, student_id, amount, at) VALUES (?, ?, ?, 1, ?)");
    students.forEach((s, i) => {
      for (let k = 0; k < (i * 7) % 13; k++) ins.run(newId(), id, s.id, now - (k + 1) * 60_000);
    });
  });
}

export function getClassroom(id: string): Classroom {
  let row = db.prepare("SELECT * FROM classrooms WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) {
    createClass(id);
    row = db.prepare("SELECT * FROM classrooms WHERE id = ?").get(id) as Record<string, unknown>;
  }
  const students = db
    .prepare("SELECT id, name, color FROM students WHERE class_id = ? ORDER BY position")
    .all(id) as unknown as Student[];
  const events = db
    .prepare('SELECT id, student_id AS "studentId", amount, at FROM point_events WHERE class_id = ? ORDER BY at, rowid')
    .all(id) as unknown as PointEvent[];
  return {
    id,
    name: row.name as string,
    timeZone: row.time_zone as string,
    termStart: row.term_start as number,
    worldId: row.world_id as WorldId,
    lowGraphics: row.low_graphics === 1,
    students: students.map((s) => ({ ...s })),
    events: events.map((e) => ({ ...e })),
  };
}

function changed(id: string): Classroom {
  const classroom = getClassroom(id);
  bus.emit(id, { type: "changed", classroom } satisfies ClassEvent);
  return classroom;
}

export function awardPoints(id: string, studentId: string, amount: number): Classroom {
  getClassroom(id);
  db.prepare("INSERT INTO point_events (id, class_id, student_id, amount, at) VALUES (?, ?, ?, ?, ?)").run(
    newId(), id, studentId, amount, Date.now(),
  );
  const classroom = getClassroom(id);
  bus.emit(id, { type: "reward", studentId, amount, classroom } satisfies ClassEvent);
  return classroom;
}

export function undoLast(id: string): Classroom {
  db.prepare(
    "DELETE FROM point_events WHERE rowid = (SELECT rowid FROM point_events WHERE class_id = ? ORDER BY at DESC, rowid DESC LIMIT 1)",
  ).run(id);
  return changed(id);
}

export function updateSettings(
  id: string,
  patch: { name?: string; worldId?: WorldId; lowGraphics?: boolean },
): Classroom {
  getClassroom(id);
  if (patch.name !== undefined) db.prepare("UPDATE classrooms SET name = ? WHERE id = ?").run(patch.name, id);
  if (patch.worldId !== undefined) db.prepare("UPDATE classrooms SET world_id = ? WHERE id = ?").run(patch.worldId, id);
  if (patch.lowGraphics !== undefined)
    db.prepare("UPDATE classrooms SET low_graphics = ? WHERE id = ?").run(patch.lowGraphics ? 1 : 0, id);
  return changed(id);
}

export function addStudents(id: string, names: string[]): Classroom {
  getClassroom(id);
  tx(() => insertStudents(id, names));
  return changed(id);
}

export function removeStudent(id: string, studentId: string): Classroom {
  db.prepare("DELETE FROM students WHERE id = ? AND class_id = ?").run(studentId, id);
  return changed(id);
}

export function resetClass(id: string): Classroom {
  db.prepare("DELETE FROM classrooms WHERE id = ?").run(id);
  return changed(id); // recreated (and re-seeded for the demo) on read
}

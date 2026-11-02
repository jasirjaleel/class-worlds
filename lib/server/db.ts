import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms, pointEvents, students } from "@/db/schema";
import { insertStudents } from "@/db/seed";
import type { Classroom, WorldId } from "@/lib/types";
import { broadcastChange } from "./realtime";

// Classes, students and points in Postgres. Who may touch which class is decided
// in lib/server/access.ts before any of these run.

export async function isOwner(ownerId: string, id: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(and(eq(classrooms.id, id), eq(classrooms.ownerId, ownerId)));
  return !!row;
}

export function listClasses(ownerId: string): Promise<{ id: string; name: string }[]> {
  return getDb()
    .select({ id: classrooms.id, name: classrooms.name })
    .from(classrooms)
    .where(eq(classrooms.ownerId, ownerId))
    .orderBy(asc(classrooms.name), asc(classrooms.id));
}

export async function createClass(ownerId: string, name: string): Promise<Classroom> {
  const [row] = await getDb().insert(classrooms).values({ ownerId, name, termStart: Date.now() }).returning({ id: classrooms.id });
  return (await getClassroom(row.id)) as Classroom;
}

export async function getClassroom(id: string): Promise<Classroom | null> {
  const db = getDb();
  const [row] = await db.select().from(classrooms).where(eq(classrooms.id, id));
  if (!row) return null;
  const studentRows = await db
    .select({ id: students.id, name: students.name, color: students.color })
    .from(students)
    .where(eq(students.classId, id))
    .orderBy(asc(students.position));
  const events = await db
    .select({ id: pointEvents.id, studentId: pointEvents.studentId, amount: pointEvents.amount, at: pointEvents.at, reason: pointEvents.reason })
    .from(pointEvents)
    .where(eq(pointEvents.classId, id))
    .orderBy(asc(pointEvents.at), asc(pointEvents.seq));
  return {
    id,
    name: row.name,
    timeZone: row.timeZone,
    termStart: row.termStart,
    worldId: row.worldId as WorldId,
    lowGraphics: row.lowGraphics,
    showScores: row.showScores,
    students: studentRows,
    events,
  };
}

async function changed(id: string): Promise<Classroom> {
  await broadcastChange(id);
  return (await getClassroom(id)) as Classroom;
}

export async function awardPoints(id: string, studentId: string, amount: number, reason: string | null): Promise<Classroom> {
  await getDb().insert(pointEvents).values({ classId: id, studentId, amount, at: Date.now(), reason });
  return changed(id);
}

export async function undoLast(id: string): Promise<Classroom> {
  const db = getDb();
  const [last] = await db
    .select({ id: pointEvents.id })
    .from(pointEvents)
    // points from before Start fresh are history, so Undo stops there
    .where(and(eq(pointEvents.classId, id), gte(pointEvents.at, sql`(select ${classrooms.termStart} from ${classrooms} where ${classrooms.id} = ${id})`)))
    .orderBy(desc(pointEvents.at), desc(pointEvents.seq))
    .limit(1);
  if (last) await db.delete(pointEvents).where(eq(pointEvents.id, last.id));
  return changed(id);
}

/** Every world counts from zero again. The points stay saved for the Progress page. */
export async function startFresh(id: string): Promise<Classroom> {
  await getDb().update(classrooms).set({ termStart: Date.now() }).where(eq(classrooms.id, id));
  return changed(id);
}

export async function updateSettings(
  id: string,
  patch: { name?: string; worldId?: WorldId; lowGraphics?: boolean; showScores?: boolean },
): Promise<Classroom> {
  if (Object.keys(patch).length) await getDb().update(classrooms).set(patch).where(eq(classrooms.id, id));
  return changed(id);
}

export async function addStudents(id: string, names: string[]): Promise<Classroom> {
  await getDb().transaction((tx) => insertStudents(tx, id, names));
  return changed(id);
}

export async function removeStudent(id: string, studentId: string): Promise<Classroom> {
  await getDb().delete(students).where(and(eq(students.id, studentId), eq(students.classId, id)));
  return changed(id);
}

/** Removes the class with its students and points. Open screens find out and leave. */
export async function deleteClass(id: string): Promise<void> {
  await getDb().delete(classrooms).where(eq(classrooms.id, id));
  await broadcastChange(id);
}

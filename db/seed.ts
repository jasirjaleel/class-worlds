import { asc, count, eq } from "drizzle-orm";
import { DEMO_NAMES, STUDENT_COLORS } from "@/lib/demo";
import { classrooms, pointEvents, students } from "./schema";
import type { Database } from "./types";

// No "server-only" here: the seed script runs outside Next.js.

export async function insertStudents(db: Database, classId: string, names: string[]) {
  const [{ n }] = await db.select({ n: count() }).from(students).where(eq(students.classId, classId));
  await db.insert(students).values(
    names.map((name, i) => ({
      classId,
      name: name.trim(),
      color: STUDENT_COLORS[(n + i) % STUDENT_COLORS.length],
      position: n + i,
    })),
  );
}

/** A class of sample students with a few points, for showing the game to someone. */
export async function seedDemoClass(db: Database, ownerId: string): Promise<string> {
  const now = Date.now();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(classrooms)
      .values({ ownerId, name: "Grade 3 Falcons", termStart: now - 60 * 86_400_000 })
      .returning({ id: classrooms.id });
    await insertStudents(tx, row.id, DEMO_NAMES);
    const rows = await tx.select({ id: students.id }).from(students).where(eq(students.classId, row.id)).orderBy(asc(students.position));
    const points = rows.flatMap((s, i) =>
      Array.from({ length: (i * 7) % 13 }, (_, k) => ({ classId: row.id, studentId: s.id, amount: 1, at: now - (k + 1) * 60_000 })),
    );
    if (points.length) await tx.insert(pointEvents).values(points);
    return row.id;
  });
}

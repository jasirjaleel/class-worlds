import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pointEvents, students } from "@/db/schema";
import { seedDemoClass } from "@/db/seed";
import type { Database } from "@/db/types";
import type { Classroom } from "@/lib/types";
import { createTestDb } from "./helpers/db";

let db: Database;
let signedIn: string | null;

vi.mock("@/db", () => ({ getDb: () => db }));
vi.mock("@/lib/auth", () => ({ getTeacherId: async () => signedIn }));
vi.mock("@/lib/server/realtime", () => ({ broadcastChange: vi.fn(async () => {}) }));

const { GET, POST } = await import("@/app/api/classes/[id]/route");
const list = await import("@/app/api/classes/route");
const { broadcastChange } = await import("@/lib/server/realtime");

const TEACHER_A = randomUUID();
const TEACHER_B = randomUUID();

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const read = (id: string) => GET(new NextRequest(`http://test/api/classes/${id}`), ctx(id));
const act = (id: string, body: Record<string, unknown>) =>
  POST(new NextRequest(`http://test/api/classes/${id}`, { method: "POST", body: JSON.stringify(body) }), ctx(id));

async function newClass(name = "Falcons"): Promise<Classroom> {
  const res = await list.POST(new NextRequest("http://test/api/classes", { method: "POST", body: JSON.stringify({ name }) }));
  return res.json();
}

async function withStudents(names = ["Aisha", "Omar"]): Promise<Classroom> {
  const { id } = await newClass();
  return (await act(id, { action: "addStudents", names })).json();
}

beforeEach(async () => {
  db = await createTestDb();
  signedIn = TEACHER_A;
  vi.mocked(broadcastChange).mockClear();
});

describe("who can use a class", () => {
  it("refuses a signed-out visitor", async () => {
    const { id } = await newClass();
    signedIn = null;
    expect((await read(id)).status).toBe(401);
    expect((await act(id, { action: "undo" })).status).toBe(401);
    expect((await list.POST(new NextRequest("http://test/api/classes", { method: "POST", body: "{}" }))).status).toBe(401);
    expect(await (await list.GET()).json()).toEqual({ signedIn: false, classes: [] });
  });

  it("hides one teacher's class from another, for reading and for every change", async () => {
    const c = await withStudents();
    signedIn = TEACHER_B;
    expect((await read(c.id)).status).toBe(404);
    for (const body of [
      { action: "award", studentId: c.students[0].id },
      { action: "undo" },
      { action: "settings", name: "Mine now" },
      { action: "addStudents", names: ["Zayd"] },
      { action: "removeStudent", studentId: c.students[0].id },
      { action: "delete" },
    ]) {
      expect((await act(c.id, body)).status).toBe(404);
    }
    expect((await (await list.GET()).json()).classes).toEqual([]);

    signedIn = TEACHER_A;
    const after: Classroom = await (await read(c.id)).json();
    expect(after.name).toBe("Falcons");
    expect(after.students).toHaveLength(2);
    expect(after.events).toHaveLength(0);
  });

  it("won't award a point to a student from another class", async () => {
    const mine = await withStudents();
    const other = await withStudents(["Hana"]);
    const res = await act(mine.id, { action: "award", studentId: other.students[0].id });
    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown class and doesn't create it", async () => {
    const unknown = randomUUID();
    expect((await read(unknown)).status).toBe(404);
    expect((await read("demo")).status).toBe(404);
    expect((await (await list.GET()).json()).classes).toEqual([]);
  });
});

describe("points", () => {
  it("undo removes only the latest point", async () => {
    const c = await withStudents();
    const [a, b] = c.students;
    await act(c.id, { action: "award", studentId: a.id, reason: "homework" });
    await act(c.id, { action: "award", studentId: b.id, reason: "homework" });
    const after: Classroom = await (await act(c.id, { action: "undo" })).json();
    expect(after.events.map((e) => e.studentId)).toEqual([a.id]);
  });

  it("undo on a class with no points changes nothing", async () => {
    const c = await withStudents();
    expect((await act(c.id, { action: "undo" })).status).toBe(200);
  });

  it("tells open screens about each change", async () => {
    const c = await withStudents();
    vi.mocked(broadcastChange).mockClear();
    await act(c.id, { action: "award", studentId: c.students[0].id });
    expect(broadcastChange).toHaveBeenCalledWith(c.id);
  });
});

describe("deleting", () => {
  it("removes the class with its students and points", async () => {
    const c = await withStudents();
    await act(c.id, { action: "award", studentId: c.students[0].id });
    expect((await act(c.id, { action: "delete" })).status).toBe(200);
    expect((await read(c.id)).status).toBe(404);
    expect((await db.select({ n: count() }).from(students))[0].n).toBe(0);
    expect((await db.select({ n: count() }).from(pointEvents))[0].n).toBe(0);
  });

  it("removing a student removes their points", async () => {
    const c = await withStudents();
    await act(c.id, { action: "award", studentId: c.students[0].id });
    const after: Classroom = await (await act(c.id, { action: "removeStudent", studentId: c.students[0].id })).json();
    expect(after.students).toHaveLength(1);
    expect(after.events).toHaveLength(0);
  });
});

describe("sample class", () => {
  it("belongs to the teacher it was added to, with students and points", async () => {
    const id = await seedDemoClass(db, TEACHER_A);
    const c: Classroom = await (await read(id)).json();
    expect(c.name).toBe("Grade 3 Falcons");
    expect(c.students).toHaveLength(24);
    expect(c.events.length).toBeGreaterThan(0);
    signedIn = TEACHER_B;
    expect((await read(id)).status).toBe(404);
  });
});

describe("start fresh", () => {
  const award = async (id: string, studentId: string) => (await act(id, { action: "award", studentId, reason: "homework" })).json() as Promise<Classroom>;

  it("moves the class's start date and keeps every point and student", async () => {
    const c = await withStudents();
    await award(c.id, c.students[0].id);
    await new Promise((r) => setTimeout(r, 5));
    const after: Classroom = await (await act(c.id, { action: "startFresh" })).json();
    expect(after.termStart).toBeGreaterThan(c.termStart);
    expect(after.events).toHaveLength(1);
    expect(after.students).toHaveLength(2);
    expect(broadcastChange).toHaveBeenCalled();
  });

  it("leaves points from before it alone when undoing", async () => {
    const c = await withStudents();
    await award(c.id, c.students[0].id);
    await new Promise((r) => setTimeout(r, 5));
    await act(c.id, { action: "startFresh" });
    await new Promise((r) => setTimeout(r, 5));
    await award(c.id, c.students[1].id);
    const once: Classroom = await (await act(c.id, { action: "undo" })).json();
    expect(once.events.map((e) => e.studentId)).toEqual([c.students[0].id]);
    const twice: Classroom = await (await act(c.id, { action: "undo" })).json();
    expect(twice.events).toHaveLength(1);
  });

  it("can't be used on another teacher's class", async () => {
    const c = await withStudents();
    signedIn = TEACHER_B;
    expect((await act(c.id, { action: "startFresh" })).status).toBe(404);
  });
});

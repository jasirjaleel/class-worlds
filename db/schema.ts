import { bigint, bigserial, boolean, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

// Times are epoch milliseconds, the same as the Classroom type the worlds read.

export const classrooms = pgTable(
  "classrooms",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(), // the teacher's Supabase user id
    name: text().notNull(),
    timeZone: text("time_zone").notNull().default("Asia/Dubai"),
    termStart: bigint("term_start", { mode: "number" }).notNull(),
    worldId: text("world_id").notNull().default("space-fleet"),
    lowGraphics: boolean("low_graphics").notNull().default(false),
    showScores: boolean("show_scores").notNull().default(false),
  },
  (t) => [index("classrooms_owner").on(t.ownerId)],
);

export const students = pgTable(
  "students",
  {
    id: uuid().primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull(),
    position: integer().notNull(),
  },
  (t) => [index("students_class").on(t.classId, t.position)],
);

export const pointEvents = pgTable(
  "point_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    seq: bigserial({ mode: "number" }).notNull(), // keeps points given in the same millisecond in order
    classId: uuid("class_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    amount: integer().notNull(),
    at: bigint({ mode: "number" }).notNull(),
    reason: text(),
  },
  (t) => [index("point_events_class_at").on(t.classId, t.at)],
);

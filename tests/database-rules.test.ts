import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

// The rules in the migrations, run against a small stand-in for Supabase's auth and realtime
// so they are checked before they ever reach the real project.

const SUPABASE_STANDIN = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  CREATE SCHEMA realtime;
  CREATE TABLE realtime.messages (topic text, extension text);
  ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
  CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE
    AS $$ SELECT current_setting('test.topic', true) $$;
  GRANT USAGE ON SCHEMA auth, realtime TO authenticated, anon;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth, realtime TO authenticated, anon;
  GRANT SELECT ON realtime.messages TO authenticated;
`;

const migration = (file: string) => readFileSync(`drizzle/${file}`, "utf8").replaceAll("--> statement-breakpoint", "");

async function database(withSupabase: boolean) {
  const pg = new PGlite();
  if (withSupabase) await pg.exec(SUPABASE_STANDIN);
  await pg.exec(migration("0000_classes.sql"));
  await pg.exec(migration("0001_lock_and_live.sql"));
  return pg;
}

describe("database rules", () => {
  it("locks every table to the app", async () => {
    const pg = await database(false);
    const { rows } = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('classrooms', 'students', 'point_events') ORDER BY relname",
    );
    expect(rows).toEqual([
      { relname: "classrooms", relrowsecurity: true },
      { relname: "point_events", relrowsecurity: true },
      { relname: "students", relrowsecurity: true },
    ]);
    const policies = await pg.query("SELECT 1 FROM pg_policies WHERE schemaname = 'public'");
    expect(policies.rows).toEqual([]);
  });

  it("lets only a class's owner join its live channel", async () => {
    const pg = await database(true);
    const [owner, other, classId] = [randomUUID(), randomUUID(), randomUUID()];
    await pg.query("INSERT INTO auth.users (id) VALUES ($1), ($2)", [owner, other]);
    await pg.query("INSERT INTO classrooms (id, owner_id, name, term_start) VALUES ($1, $2, 'Falcons', 0)", [classId, owner]);
    await pg.query("INSERT INTO realtime.messages (topic, extension) VALUES ($1, 'broadcast')", [`class:${classId}`]);

    const canListen = async (uid: string, topic = `class:${classId}`) => {
      await pg.exec(`SET test.uid = '${uid}'; SET test.topic = '${topic}'; SET ROLE authenticated;`);
      const { rows } = await pg.query("SELECT 1 FROM realtime.messages");
      await pg.exec("RESET ROLE;");
      return rows.length > 0;
    };

    expect(await canListen(owner)).toBe(true);
    expect(await canListen(other)).toBe(false);
    expect(await canListen(owner, "class:someone-else")).toBe(false);
  });

  it("keeps the class table closed to signed-in browsers", async () => {
    const pg = await database(true);
    await pg.exec("GRANT SELECT ON classrooms TO authenticated;"); // Supabase grants this by default
    const owner = randomUUID();
    await pg.query("INSERT INTO auth.users (id) VALUES ($1)", [owner]);
    await pg.query("INSERT INTO classrooms (owner_id, name, term_start) VALUES ($1, 'Falcons', 0)", [owner]);
    await pg.exec(`SET test.uid = '${owner}'; SET ROLE authenticated;`);
    const { rows } = await pg.query("SELECT 1 FROM classrooms");
    await pg.exec("RESET ROLE;");
    expect(rows).toEqual([]);
  });

  it("removes a teacher's classes when their account is removed", async () => {
    const pg = await database(true);
    const owner = randomUUID();
    await pg.query("INSERT INTO auth.users (id) VALUES ($1)", [owner]);
    await pg.query("INSERT INTO classrooms (owner_id, name, term_start) VALUES ($1, 'Falcons', 0)", [owner]);
    await pg.query("DELETE FROM auth.users WHERE id = $1", [owner]);
    expect((await pg.query("SELECT 1 FROM classrooms")).rows).toEqual([]);
  });
});

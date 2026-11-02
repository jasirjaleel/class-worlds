import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";

// One client across hot reloads, created on first use so a build needs no database.
const g = globalThis as unknown as { cwDb?: Database };

export function getDb(): Database {
  if (g.cwDb) return g.cwDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  // prepare: false is required by the Supabase pooler. On Vercel every instance has its own
  // pool and the pooler's total is small, so each one holds a single connection.
  const client = postgres(url, {
    prepare: false,
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  });
  g.cwDb = drizzle(client, { schema });
  return g.cwDb;
}

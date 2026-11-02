// Adds a class of sample students to a teacher's account, for showing the game to someone:
//   npm run seed-demo -- teacher@school.ae
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { seedDemoClass } from "../db/seed";

config({ path: ".env.local" });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, DATABASE_URL: dbUrl } = process.env;
  if (!email || !url || !key || !dbUrl) throw new Error("Usage: npm run seed-demo -- teacher@school.ae (needs .env.local)");

  const { auth } = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const teacher = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!teacher) throw new Error(`No teacher with the email ${email}. Add them first with npm run add-teacher.`);

  const client = postgres(dbUrl, { prepare: false, max: 1 });
  await seedDemoClass(drizzle(client, { schema }), teacher.id);
  await client.end();
  console.log(`Added the sample class Grade 3 Falcons to ${email}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

// Adds a teacher, or gives one a new temporary password:
//   npm run add-teacher -- teacher@school.ae
//   npm run add-teacher -- teacher@school.ae --reset
// Prints the temporary password here. Nothing is emailed.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run add-teacher -- teacher@school.ae [--reset]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local first.");
  process.exit(1);
}

const { auth } = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const password = randomBytes(9).toString("base64url");
const user_metadata = { must_change_password: true };

async function findUserId(address: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === address);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
}

async function main(address: string) {
  if (args.includes("--reset")) {
    const id = await findUserId(address);
    if (!id) throw new Error(`No teacher with the email ${address}`);
    const { error } = await auth.admin.updateUserById(id, { password, user_metadata });
    if (error) throw error;
  } else {
    const { error } = await auth.admin.createUser({ email: address, password, email_confirm: true, user_metadata });
    if (error) throw error;
  }
  console.log(`\n${address}\nTemporary password: ${password}\n\nThey choose their own password when they first sign in.`);
}

main(email).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

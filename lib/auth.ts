import "server-only";
import { createSupabaseServer } from "./supabase/server";

/** The signed-in teacher, verified with the auth server. Null until a temporary password is changed. */
export async function getTeacherId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.user_metadata?.must_change_password) return null;
  return data.user.id;
}

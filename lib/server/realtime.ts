import "server-only";
import { classTopic } from "@/lib/classSync";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Tells a class's open screens that something changed. The message carries no names:
 * each screen fetches the class itself, through the same login check as everything else.
 * A failure must not lose the teacher's point, and screens catch up on their next fetch.
 */
export async function broadcastChange(classId: string): Promise<void> {
  try {
    const channel = createSupabaseAdmin().channel(classTopic(classId), { config: { private: true } });
    await channel.httpSend("changed", {}, { timeout: 2000 });
  } catch (e) {
    console.error("Live update not sent", e);
  }
}

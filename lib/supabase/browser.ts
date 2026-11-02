import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** The browser's Supabase client, used only for the live channel. Data goes through our API. */
export function supabaseBrowser() {
  client ??= createBrowserClient(supabaseUrl(), supabaseKey());
  return client;
}

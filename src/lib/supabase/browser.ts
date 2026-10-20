import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}

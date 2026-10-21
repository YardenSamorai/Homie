import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Bypasses row security, for scheduled jobs that act for every house (the morning reminder, photo cleanup).
 * Null until SUPABASE_SERVICE_ROLE_KEY is set on the server; never reachable from a browser.
 */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  return createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

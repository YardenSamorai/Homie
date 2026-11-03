import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Provider } from "./normalize";
import { providerConfig } from "./providers";
import { randomToken, seal, sealingReady, unseal } from "./seal";

export const isProvider = (value: unknown): value is Provider => value === "google" || value === "microsoft";

/** What's missing on the server before anyone can connect, by name, for the setup screen and the docs. */
export function calendarSetup() {
  const missing: string[] = [];
  if (!supabaseConfigured()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!sealingReady()) missing.push("CALENDAR_TOKEN_KEY");
  const ready = missing.length === 0;
  return {
    ready,
    missing,
    google: ready && providerConfig("google") !== null,
    microsoft: ready && providerConfig("microsoft") !== null,
  };
}

export async function signedIn() {
  if (!supabaseConfigured()) return null;
  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user ? { db, user } : null;
}

export function adminOrNull() {
  return calendarSetup().ready ? createAdminSupabase() : null;
}

export const OAUTH_COOKIE = "homie-calendar-oauth";
const OAUTH_TTL_MS = 10 * 60_000;

/** What the callback needs to trust the redirect: the state it must echo, the PKCE verifier, and who asked. */
export type PendingConnect = { provider: Provider; state: string; verifier: string; userId: string; locale: string; exp: number };

export function newPending(provider: Provider, userId: string, locale: string): PendingConnect {
  return { provider, state: randomToken(24), verifier: randomToken(48), userId, locale, exp: Date.now() + OAUTH_TTL_MS };
}

export const sealPending = (pending: PendingConnect) => seal(JSON.stringify(pending), "oauth");

export function openPending(value: string | undefined): PendingConnect | null {
  if (!value) return null;
  const plain = unseal(value, "oauth");
  if (!plain) return null;
  try {
    const pending = JSON.parse(plain) as PendingConnect;
    return isProvider(pending.provider) && pending.exp > Date.now() ? pending : null;
  } catch {
    return null;
  }
}

/** Registered with each provider exactly as https://<site>/api/calendars/callback/<provider>. */
export function redirectUri(request: Request, provider: Provider) {
  const origin = process.env.CALENDAR_REDIRECT_ORIGIN?.trim() || new URL(request.url).origin;
  return `${origin.replace(/\/$/, "")}/api/calendars/callback/${provider}`;
}

export const cookieOptions = (request: Request) => ({
  httpOnly: true,
  secure: new URL(request.url).protocol === "https:",
  sameSite: "lax" as const,
  path: "/api/calendars",
  maxAge: OAUTH_TTL_MS / 1000,
});

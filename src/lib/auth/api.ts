import type { AuthSession, InvitePreview } from "./types";

type Fail = { error?: string; retryAfter?: number };

async function parse<T>(res: Promise<Response> | Response): Promise<T> {
  const resolved = await res;
  const body = (await resolved.json().catch(() => ({}))) as T & Fail;
  if (!resolved.ok) throw Object.assign(new Error(body.error ?? "generic"), { status: resolved.status, body });
  return body;
}

function post(input: string, body: unknown) {
  return fetch(input, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const authApi = {
  sendOtp: (email: string, locale: string) => parse<{ resendAt: number }>(post("/api/auth/otp", { email, locale })),

  verifyOtp: (email: string, code: string) => parse<AuthSession & { isNew: boolean }>(post("/api/auth/verify", { email, code })),

  currentSession: () => parse<{ account: AuthSession | null }>(fetch("/api/auth/session", { cache: "no-store" })),

  previewInvite: (token: string) => parse<InvitePreview>(fetch(`/api/invite/${encodeURIComponent(token)}`)),

  pendingInvite: () => parse<InvitePreview>(fetch("/api/invite")),

  clearInvite: () => fetch("/api/invite", { method: "DELETE" }),

  /** Hands back the link already out there; `fresh` revokes it and mints a new one. */
  createInvite: (input: {
    householdId?: string;
    householdName: string;
    inviterName: string;
    inviterUserId?: string;
    fresh?: boolean;
  }) =>
    parse<InvitePreview>(post("/api/invite", input)),

  acceptInvite: (userId: string) =>
    parse<{ householdId: string; householdName: string }>(post("/api/invite/accept", { userId })),

  createHousehold: (userId: string, name: string) =>
    parse<{ id: string; name: string }>(post("/api/household", { userId, name })),

  renameHousehold: (id: string, userId: string, name: string) =>
    parse<{ id: string; name: string }>(
      fetch("/api/household", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, userId, name }),
      }),
    ),

  household: (id: string) =>
    parse<{ id: string; name: string; members: { id: string; name: string; avatarPath?: string | null; role?: "admin" | "member" }[] }>(
      fetch(`/api/household?id=${encodeURIComponent(id)}`),
    ),

  saveName: (userId: string, displayName: string) =>
    parse<{ userId: string; email: string; displayName: string }>(post("/api/auth/profile", { userId, displayName })),
};

import type { InvitePreview } from "./types";

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
  sendOtp: (email: string) => parse<{ resendAt: number }>(post("/api/auth/otp", { email })),

  verifyOtp: (email: string, code: string) =>
    parse<{ userId: string; email: string; displayName: string | null; isNew: boolean }>(
      post("/api/auth/verify", { email, code }),
    ),

  previewInvite: (token: string) => parse<InvitePreview>(fetch(`/api/invite/${encodeURIComponent(token)}`)),

  pendingInvite: () => parse<InvitePreview>(fetch("/api/invite")),

  clearInvite: () => fetch("/api/invite", { method: "DELETE" }),

  createInvite: (input: { householdId?: string; householdName: string; inviterName: string }) =>
    parse<InvitePreview>(post("/api/invite", input)),

  acceptInvite: (userId: string) =>
    parse<{ householdId: string; householdName: string }>(post("/api/invite/accept", { userId })),

  createHousehold: (userId: string, name: string) =>
    parse<{ id: string; name: string }>(post("/api/household", { userId, name })),
};

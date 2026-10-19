import "server-only";
import {
  DEMO_OTP,
  INVITE_TTL_MS,
  OTP_LOCK_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_MS,
  OTP_TTL_MS,
  emailPattern,
} from "./constants";
import type { InvitePreview, InviteStatus } from "./types";

type Profile = { userId: string; email: string; displayName: string | null };
type Otp = { code: string; expiresAt: number; lastSentAt: number; attempts: number; lockedUntil: number };
type Household = { id: string; name: string; memberIds: string[] };
type Invite = {
  token: string;
  householdId: string;
  householdName: string;
  inviterName: string;
  expiresAt: number;
  acceptedBy: string | null;
  revokedAt: number | null;
};

const profiles = new Map<string, Profile>();
const otps = new Map<string, Otp>();
const households = new Map<string, Household>();
const invites = new Map<string, Invite>();

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmail(email: string) {
  return emailPattern.test(normalizeEmail(email));
}

export function sendOtp(rawEmail: string): { ok: true; resendAt: number } | { ok: false; error: "email" | "wait"; retryAfter?: number } {
  if (!isEmail(rawEmail)) return { ok: false, error: "email" };
  const email = normalizeEmail(rawEmail);
  const now = Date.now();
  const existing = otps.get(email);
  if (existing && now < existing.lastSentAt + OTP_RESEND_MS) {
    return { ok: false, error: "wait", retryAfter: Math.ceil((existing.lastSentAt + OTP_RESEND_MS - now) / 1000) };
  }
  otps.set(email, {
    code: DEMO_OTP,
    expiresAt: now + OTP_TTL_MS,
    lastSentAt: now,
    attempts: 0,
    lockedUntil: 0,
  });
  if (process.env.NODE_ENV !== "production") {
    console.info(`[homie] demo OTP for ${email}: ${DEMO_OTP}`);
  }
  return { ok: true, resendAt: now + OTP_RESEND_MS };
}

export function verifyOtp(
  rawEmail: string,
  code: string,
):
  | { ok: true; profile: Profile; isNew: boolean }
  | { ok: false; error: "email" | "invalid" | "expired" | "locked"; retryAfter?: number } {
  if (!isEmail(rawEmail)) return { ok: false, error: "email" };
  const email = normalizeEmail(rawEmail);
  const now = Date.now();
  const otp = otps.get(email);
  if (!otp) return { ok: false, error: "expired" };
  if (otp.lockedUntil > now) {
    return { ok: false, error: "locked", retryAfter: Math.ceil((otp.lockedUntil - now) / 1000) };
  }
  if (now > otp.expiresAt) return { ok: false, error: "expired" };
  if (code.trim() !== otp.code) {
    otp.attempts += 1;
    if (otp.attempts >= OTP_MAX_ATTEMPTS) otp.lockedUntil = now + OTP_LOCK_MS;
    const retryAfter = otp.lockedUntil > now ? Math.ceil((otp.lockedUntil - now) / 1000) : undefined;
    return { ok: false, error: otp.lockedUntil > now ? "locked" : "invalid", retryAfter };
  }
  otps.delete(email);
  const existing = profiles.get(email);
  if (existing) return { ok: true, profile: existing, isNew: false };
  const profile: Profile = { userId: crypto.randomUUID(), email, displayName: null };
  profiles.set(email, profile);
  return { ok: true, profile, isNew: true };
}

export function setDisplayName(email: string, name: string) {
  const profile = profiles.get(normalizeEmail(email));
  if (!profile) return null;
  profile.displayName = name.trim();
  return profile;
}

function inviteStatus(invite: Invite | undefined): InviteStatus {
  if (!invite) return "missing";
  if (invite.revokedAt) return "revoked";
  if (invite.acceptedBy) return "used";
  if (Date.now() > invite.expiresAt) return "expired";
  const house = households.get(invite.householdId);
  if (house && house.memberIds.length >= 2) return "full";
  return "ok";
}

function preview(invite: Invite | undefined, token: string): InvitePreview {
  const status = inviteStatus(invite);
  return {
    status,
    token,
    householdName: status === "ok" || status === "full" ? (invite?.householdName ?? null) : null,
    inviterName: status === "ok" ? (invite?.inviterName ?? null) : null,
    expiresAt: invite && status === "ok" ? new Date(invite.expiresAt).toISOString() : null,
  };
}

export function readInvite(token: string): InvitePreview {
  return preview(invites.get(token), token);
}

export function createInvite(input: { householdId?: string; householdName: string; inviterName: string }): InvitePreview {
  const householdId = input.householdId ?? crypto.randomUUID();
  const existing = [...invites.values()].find((row) => row.householdId === householdId && inviteStatus(row) === "ok");
  if (existing) {
    existing.revokedAt = Date.now();
  }
  if (!households.has(householdId)) {
    households.set(householdId, { id: householdId, name: input.householdName.trim(), memberIds: [] });
  } else {
    households.get(householdId)!.name = input.householdName.trim();
  }
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const invite: Invite = {
    token,
    householdId,
    householdName: input.householdName.trim(),
    inviterName: input.inviterName.trim(),
    expiresAt: Date.now() + INVITE_TTL_MS,
    acceptedBy: null,
    revokedAt: null,
  };
  invites.set(token, invite);
  return preview(invite, token);
}

export function acceptInvite(
  token: string,
  userId: string,
): { ok: true; householdId: string; householdName: string } | { ok: false; status: InviteStatus | "already" } {
  const invite = invites.get(token);
  const status = inviteStatus(invite);
  if (status !== "ok" || !invite) return { ok: false, status };
  const already = [...households.values()].find((house) => house.memberIds.includes(userId));
  if (already && already.id !== invite.householdId) return { ok: false, status: "already" };
  const house = households.get(invite.householdId);
  if (!house) return { ok: false, status: "missing" };
  if (house.memberIds.length >= 2) return { ok: false, status: "full" };
  if (!house.memberIds.includes(userId)) house.memberIds.push(userId);
  invite.acceptedBy = userId;
  return { ok: true, householdId: house.id, householdName: house.name };
}

export function createHousehold(userId: string, name: string) {
  const id = crypto.randomUUID();
  households.set(id, { id, name: name.trim(), memberIds: [userId] });
  return { id, name: name.trim() };
}

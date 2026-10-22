import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
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
type Household = { id: string; name: string; memberIds: string[]; names?: Record<string, string> };
type Invite = {
  token: string;
  householdId: string;
  householdName: string;
  inviterName: string;
  expiresAt: number;
  acceptedBy: string | null;
  revokedAt: number | null;
};

type DemoStore = {
  profiles: Map<string, Profile>;
  otps: Map<string, Otp>;
  households: Map<string, Household>;
  invites: Map<string, Invite>;
};

const DATA_FILE = path.join(process.cwd(), ".data", "homie-demo.json");

/** One store for every route bundle, restored from disk so a restart keeps homes and invites. */
function demoStore(): DemoStore {
  const g = globalThis as typeof globalThis & { __homieDemo?: DemoStore };
  if (g.__homieDemo) return g.__homieDemo;
  const next: DemoStore = {
    profiles: new Map(),
    otps: new Map(),
    households: new Map(),
    invites: new Map(),
  };
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as {
      profiles?: [string, Profile][];
      otps?: [string, Otp][];
      households?: [string, Household][];
      invites?: [string, Invite][];
    };
    for (const row of raw.profiles ?? []) next.profiles.set(row[0], row[1]);
    for (const row of raw.otps ?? []) next.otps.set(row[0], row[1]);
    for (const row of raw.households ?? []) next.households.set(row[0], row[1]);
    for (const row of raw.invites ?? []) next.invites.set(row[0], row[1]);
  } catch {
    // First run, or a host that cannot read the file yet.
  }
  g.__homieDemo = next;
  return next;
}

const { profiles, otps, households, invites } = demoStore();

function persist() {
  try {
    mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    writeFileSync(
      DATA_FILE,
      JSON.stringify({
        profiles: [...profiles],
        otps: [...otps],
        households: [...households],
        invites: [...invites],
      }),
    );
  } catch {
    // A read-only deploy keeps the in-process store only.
  }
}

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
  persist();
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
  if (existing) {
    persist();
    return { ok: true, profile: existing, isNew: false };
  }
  const profile: Profile = { userId: crypto.randomUUID(), email, displayName: null };
  profiles.set(email, profile);
  persist();
  return { ok: true, profile, isNew: true };
}

export function setDisplayName(email: string, name: string) {
  const profile = profiles.get(normalizeEmail(email));
  if (!profile) return null;
  profile.displayName = name.trim();
  persist();
  return profile;
}

export function saveDisplayName(userId: string, name: string) {
  const profile = [...profiles.values()].find((row) => row.userId === userId);
  if (!profile) return null;
  profile.displayName = name.trim();
  persist();
  return { userId: profile.userId, email: profile.email, displayName: profile.displayName };
}

export function readHousehold(id: string) {
  const house = households.get(id);
  if (!house) return null;
  const known = [...profiles.values()];
  return {
    id: house.id,
    name: house.name,
    members: house.memberIds.map((memberId, index) => {
      const profile = known.find((row) => row.userId === memberId);
      const fallback = profile?.email.split("@")[0] ?? "";
      const fromInvite =
        index === 0 ? [...invites.values()].find((row) => row.householdId === house.id)?.inviterName : "";
      return {
        id: memberId,
        name: profile?.displayName?.trim() || house.names?.[memberId] || fromInvite || fallback || "Homie",
      };
    }),
  };
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
    householdId: status === "ok" ? (invite?.householdId ?? null) : null,
    householdName: status === "ok" || status === "full" ? (invite?.householdName ?? null) : null,
    inviterName: status === "ok" ? (invite?.inviterName ?? null) : null,
    expiresAt: invite && status === "ok" ? new Date(invite.expiresAt).toISOString() : null,
  };
}

export function readInvite(token: string): InvitePreview {
  return preview(invites.get(token), token);
}

export function createInvite(input: {
  householdId?: string;
  householdName: string;
  inviterName: string;
  inviterUserId?: string;
  fresh?: boolean;
}): InvitePreview | "full" {
  const householdId = input.householdId ?? crypto.randomUUID();
  if ((households.get(householdId)?.memberIds.length ?? 0) >= 2) return "full";
  const existing = [...invites.values()].find((row) => row.householdId === householdId && inviteStatus(row) === "ok");
  if (existing && !input.fresh) return preview(existing, existing.token);
  if (existing) {
    existing.revokedAt = Date.now();
  }
  const inviterUserId = input.inviterUserId;
  if (!households.has(householdId)) {
    households.set(householdId, {
      id: householdId,
      name: input.householdName.trim(),
      memberIds: inviterUserId ? [inviterUserId] : [],
    });
  } else {
    const house = households.get(householdId)!;
    house.name = input.householdName.trim();
    if (inviterUserId && !house.memberIds.includes(inviterUserId) && house.memberIds.length < 2) {
      house.memberIds.push(inviterUserId);
    }
  }
  if (inviterUserId && input.inviterName.trim()) {
    const house = households.get(householdId)!;
    house.names = { ...house.names, [inviterUserId]: input.inviterName.trim() };
    const profile = [...profiles.values()].find((row) => row.userId === inviterUserId);
    if (profile) profile.displayName = input.inviterName.trim();
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
  persist();
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
  const joiner = [...profiles.values()].find((row) => row.userId === userId);
  if (joiner?.displayName?.trim()) house.names = { ...house.names, [userId]: joiner.displayName.trim() };
  invite.acceptedBy = userId;
  persist();
  return { ok: true, householdId: house.id, householdName: house.name };
}

export function householdFor(userId: string) {
  const house = [...households.values()].find((row) => row.memberIds.includes(userId));
  if (!house) return null;
  return {
    id: house.id,
    name: house.name,
    role: house.memberIds[0] === userId ? ("admin" as const) : ("member" as const),
  };
}

export function createHousehold(userId: string, name: string) {
  const id = crypto.randomUUID();
  households.set(id, { id, name: name.trim(), memberIds: [userId] });
  persist();
  return { id, name: name.trim() };
}

export function renameHousehold(id: string, name: string, userId: string) {
  const house = households.get(id);
  if (!house || !house.memberIds.includes(userId)) return null;
  house.name = name.trim();
  persist();
  return { id: house.id, name: house.name };
}

export type InviteStatus = "ok" | "expired" | "revoked" | "used" | "full" | "missing";

export type InvitePreview = {
  status: InviteStatus;
  token: string;
  householdId: string | null;
  householdName: string | null;
  inviterName: string | null;
  /** The inviter's profile photo, when they set one. */
  inviterPhoto?: string | null;
  expiresAt: string | null;
};

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string | null;
  householdId: string | null;
  householdName: string | null;
  role: "admin" | "member" | null;
};

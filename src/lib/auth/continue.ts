import type { AuthSession, InviteStatus } from "./types";

export function afterAuthPath(
  locale: string,
  session: AuthSession,
  pending: { status: InviteStatus } | null,
): string {
  if (!session.displayName) return `/${locale}/welcome`;
  if (pending?.status === "ok") return `/${locale}/join`;
  if (!session.householdId) return `/${locale}/setup`;
  return `/${locale}`;
}

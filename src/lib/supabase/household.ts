import type { InvitePreview, InviteStatus } from "@/lib/auth/types";
import { INVITE_TTL_MS } from "@/lib/auth/constants";
import { createServerSupabase } from "./server";

type PreviewRow = {
  status: InviteStatus;
  household_id: string | null;
  household_name: string | null;
  inviter_name: string | null;
  expires_at: string | null;
};

function asPreview(token: string, row: PreviewRow | null): InvitePreview {
  return {
    status: row?.status ?? "missing",
    token,
    householdId: row?.household_id ?? null,
    householdName: row?.household_name ?? null,
    inviterName: row?.inviter_name ?? null,
    expiresAt: row?.expires_at ?? null,
  };
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("preview_invite", { invite_token: token });
  if (error || !data) return asPreview(token, null);
  return asPreview(token, data as PreviewRow);
}

export async function createHouseholdForUser(name: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("create_household", { house_name: name });
  if (error || !data) return null;
  return { id: data as string, name };
}

export async function readHouseholdForUser(id: string) {
  const supabase = await createServerSupabase();
  const { data: house } = await supabase.from("households").select("id, name").eq("id", id).maybeSingle();
  if (!house) return null;
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, profiles(display_name)")
    .eq("household_id", id);
  return {
    id: house.id,
    name: house.name,
    members: (members ?? []).map((member) => {
      const profile = member.profiles as { display_name: string | null } | { display_name: string | null }[] | null;
      const row = Array.isArray(profile) ? profile[0] : profile;
      return { id: member.user_id as string, name: row?.display_name?.trim() || "Homie" };
    }),
  };
}

export async function renameHouseholdForUser(id: string, name: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("households").update({ name }).eq("id", id).select("id, name").maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function createInviteForUser(householdName: string) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;

  await supabase
    .from("household_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("household_id", membership.household_id)
    .is("accepted_by", null)
    .is("revoked_at", null);

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const { error } = await supabase.from("household_invites").insert({
    household_id: membership.household_id,
    token,
    expires_at: expiresAt,
    created_by: user.id,
  });
  if (error) return null;
  return previewInvite(token);
}

export async function acceptInviteForUser(token: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("accept_invite", { invite_token: token });
  if (error || !data) {
    const message = error?.message ?? "missing";
    const status = (["missing", "used", "expired", "full", "already", "revoked"].find((item) => message.includes(item)) ??
      "missing") as InviteStatus | "already";
    return { ok: false as const, status };
  }
  const householdId = data as string;
  const { data: house } = await supabase.from("households").select("name").eq("id", householdId).maybeSingle();
  return { ok: true as const, householdId, householdName: house?.name ?? "" };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountSnapshot = {
  userId: string;
  email: string;
  displayName: string | null;
  householdId: string | null;
  householdName: string | null;
  role: "admin" | "member" | null;
};

/** Everything the app needs to route a signed-in person: their name and the home they already belong to. */
export async function readAccount(supabase: SupabaseClient, user: { id: string; email?: string }): Promise<AccountSnapshot> {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("household_members").select("household_id, role").eq("user_id", user.id).maybeSingle(),
  ]);
  let householdName: string | null = null;
  if (membership?.household_id) {
    const { data: house } = await supabase
      .from("households")
      .select("name")
      .eq("id", membership.household_id)
      .maybeSingle();
    householdName = house?.name ?? null;
  }
  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? null,
    householdId: membership?.household_id ?? null,
    householdName,
    role: (membership?.role as "admin" | "member" | undefined) ?? null,
  };
}

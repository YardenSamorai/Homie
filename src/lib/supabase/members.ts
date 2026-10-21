"use client";

import { createBrowserSupabase } from "./browser";

/** The admin removes the other parent; their open tasks become the admin's (0006). */
export async function removeHouseholdMember(memberId: string) {
  const { error } = await createBrowserSupabase().rpc("remove_household_member", { member_id: memberId });
  if (error) throw error;
}

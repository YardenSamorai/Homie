"use client";

import { createBrowserSupabase } from "./browser";

async function call(fn: string, args?: Record<string, unknown>) {
  const { error } = await createBrowserSupabase().rpc(fn, args);
  if (error) throw error;
}

/** The admin removes the other parent; their open tasks become the admin's (0006). */
export const removeHouseholdMember = (memberId: string) => call("remove_household_member", { member_id: memberId });

/** The admin hands the home to the other parent and stays as a member (0009). */
export const transferAdmin = (memberId: string) => call("transfer_admin", { member_id: memberId });

/** This parent leaves; the other keeps the home with their open tasks, or the home closes if no one else is in it (0009). */
export const leaveHousehold = () => call("leave_household");

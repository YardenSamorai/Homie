"use client";

import { useEffect } from "react";
import { useHousehold } from "@/lib/household-store";
import { useClock } from "@/lib/use-clock";

export function HouseholdSeeder() {
  const today = useClock()?.today;
  const seed = useHousehold((s) => s.seed);
  useEffect(() => {
    if (today) seed(today);
  }, [today, seed]);
  return null;
}

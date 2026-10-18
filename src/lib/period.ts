export type Period = "morning" | "afternoon" | "evening" | "night";

/** SPEC §6.1 windows: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–21:59, night 22:00–04:59. */
export function periodFor(hour: number): Period {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

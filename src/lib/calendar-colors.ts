import type { AgendaEntry } from "./agenda";
import type { CalendarColors } from "./prefs";

/** Colors a calendar starts with when coloring by calendar, before the parent picks one. Each carries a white glyph. */
const palette = ["var(--teal)", "var(--indigo)", "var(--pink)", "var(--orange)", "var(--green)", "var(--purple)", "var(--brown)"];

export function startingColor(key: string) {
  let sum = 0;
  for (const char of key) sum = (sum * 31 + char.charCodeAt(0)) >>> 0;
  return palette[sum % palette.length];
}

/**
 * The color at the side of a line in the agenda, in this parent's view only. By person: the one person it's for.
 * By calendar: the calendar it came from, with Homie's own events as one more calendar. Never the only cue: the
 * names, faces and calendar name are always written beside it.
 */
export function railColor(entry: AgendaEntry, colors: CalendarColors, personColor: string | null) {
  if (entry.busy) return "var(--separator)";
  if (colors.by === "calendar") {
    const key = entry.kind === "calendar" ? (entry.item?.calendarKey ?? null) : "home";
    if (!key) return personColor ?? "var(--teal)";
    return colors.calendars[key] ?? (key === "home" ? "var(--teal)" : startingColor(key));
  }
  return entry.kind === "calendar" && personColor ? personColor : "var(--teal)";
}

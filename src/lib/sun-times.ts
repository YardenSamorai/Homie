import { skyAt } from "./sky";

/** The sun's upper edge on the horizon, with refraction: the moment people call sunrise or sunset. */
const HORIZON = -0.833;

export type SunEvent = { kind: "sunrise" | "sunset"; at: number };

/**
 * The next sunrise or sunset after `from`, found on the same sun the sky is painted with:
 * five-minute steps until the sun crosses the horizon, then minute by minute back to the crossing.
 */
export function nextSunEvent(from: number): SunEvent | null {
  const step = 5 * 60_000;
  let before = skyAt(from).elevation;
  for (let at = from + step; at <= from + 26 * 3600_000; at += step) {
    const after = skyAt(at).elevation;
    if ((before < HORIZON) !== (after < HORIZON)) {
      let minute = at - step;
      while (minute < at && (skyAt(minute).elevation < HORIZON) === before < HORIZON) minute += 60_000;
      return { kind: after > before ? "sunrise" : "sunset", at: minute };
    }
    before = after;
  }
  return null;
}

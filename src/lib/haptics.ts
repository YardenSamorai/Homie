/** A light tap for completion moments only. No-op where the Vibration API is missing (iOS Safari). */
export function completionHaptic() {
  navigator.vibrate?.(10);
}

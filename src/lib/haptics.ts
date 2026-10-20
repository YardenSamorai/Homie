import { isNativeApp } from "./native";

/** A light tap for completion moments only. The Taptic Engine in the iPhone app; the Vibration API elsewhere (a no-op in iOS Safari). */
export function completionHaptic() {
  if (isNativeApp()) {
    void import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
    return;
  }
  navigator.vibrate?.(10);
}

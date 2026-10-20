import { Capacitor } from "@capacitor/core";

/** Running inside the iPhone app (Capacitor) rather than a browser. */
export function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** Once per launch: mark the document for app-only styles and lift the splash screen off the first screen. */
export async function startNativeShell() {
  if (!isNativeApp()) return;
  document.documentElement.classList.add("native-app");
  // Safari shows :active (the press feedback) only on pages that listen for touches.
  document.addEventListener("touchstart", () => {}, { passive: true });
  const { SplashScreen } = await import("@capacitor/splash-screen");
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 250 }));
}

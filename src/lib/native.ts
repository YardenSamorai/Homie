import { Capacitor, registerPlugin } from "@capacitor/core";
import { followKeyboard } from "./keyboard";

/** Running inside the iPhone app (Capacitor) rather than a browser. */
export function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** The app's own plugin (SceneDelegate.swift): what shows behind the web view, e.g. at the keyboard's rounded corners. */
const Appearance = registerPlugin<{
  setBackground(options: { color: string }): Promise<void>;
  setBadge(options: { count: number }): Promise<void>;
}>("Appearance");

export function setNativeBackground(color: string) {
  if (!isNativeApp()) return;
  // Builds before the plugin keep their default; nothing to do.
  Appearance.setBackground({ color }).catch(() => {});
}

/** The number on the app icon: the iPhone app's own plugin, or the Badging API of a Home Screen web app. */
export function setAppBadge(count: number) {
  if (typeof window === "undefined") return;
  if (isNativeApp()) {
    Appearance.setBadge({ count }).catch(() => {});
    return;
  }
  const badging = navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  void (count > 0 ? badging.setAppBadge?.(count) : badging.clearAppBadge?.())?.catch(() => {});
}

const handledLaunch = "homie-launch-url";

/** Once per page load: mark the document for app-only styles, follow links that opened the app, lift the splash screen. */
export async function startNativeShell() {
  if (!isNativeApp()) return;
  document.documentElement.classList.add("native-app");
  // Safari shows :active (the press feedback) only on pages that listen for touches.
  document.addEventListener("touchstart", () => {}, { passive: true });
  await followAppLinks();
  // No Safari-style ⌃ ⌄ Done bar over the keyboard; a build without the plugin just keeps it.
  void import("@capacitor/keyboard").then(({ Keyboard }) => Keyboard.setAccessoryBarVisible({ isVisible: false })).catch(() => {});
  void followKeyboard().catch(() => {});
  const { SplashScreen } = await import("@capacitor/splash-screen");
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 250 }));
}

/** An invite or sign-in link tapped in Mail or WhatsApp opens the app (Universal Links); show the page it points to. */
async function followAppLinks() {
  const { App } = await import("@capacitor/app");
  // The launch URL keeps naming the last link opened on every page load after it, so each link is followed once.
  const follow = (href: string) => {
    sessionStorage.setItem(handledLaunch, href);
    openInApp(href);
  };
  void App.addListener("appUrlOpen", ({ url }) => follow(url));
  const launch = await App.getLaunchUrl();
  if (launch?.url && sessionStorage.getItem(handledLaunch) !== launch.url) follow(launch.url);
}

let opening: string | null = null;

function openInApp(href: string) {
  const url = new URL(href);
  if (url.origin !== location.origin) return;
  const target = url.pathname + url.search + url.hash;
  // A cold start reports the same link twice (the held appUrlOpen and the launch URL). A second navigation
  // would cancel the first, and the app shows its offline page for any navigation that fails.
  if (target === opening || target === location.pathname + location.search + location.hash) return;
  opening = target;
  location.assign(target);
}

import { Capacitor, registerPlugin } from "@capacitor/core";

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

/** While the keyboard is up, html carries data-keyboard: the tab bar and the + hide behind it, as in iPhone apps. */
async function trackKeyboard() {
  const { Keyboard } = await import("@capacitor/keyboard");
  const root = document.documentElement;
  await Keyboard.addListener("keyboardWillShow", () => root.setAttribute("data-keyboard", ""));
  await Keyboard.addListener("keyboardWillHide", () => root.removeAttribute("data-keyboard"));
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
  void trackKeyboard().catch(() => {});
  const { SplashScreen } = await import("@capacitor/splash-screen");
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 250 }));
}

/** An invite or sign-in link tapped in Mail or WhatsApp opens the app (Universal Links); show the page it points to. */
async function followAppLinks() {
  const { App } = await import("@capacitor/app");
  void App.addListener("appUrlOpen", ({ url }) => openInApp(url));
  // A cold start reports the link once per launch, but every page load asks again.
  const launch = await App.getLaunchUrl();
  if (launch?.url && sessionStorage.getItem(handledLaunch) !== launch.url) {
    sessionStorage.setItem(handledLaunch, launch.url);
    openInApp(launch.url);
  }
}

function openInApp(href: string) {
  const url = new URL(href);
  if (url.origin !== location.origin) return;
  const target = url.pathname + url.search + url.hash;
  if (target !== location.pathname + location.search + location.hash) location.assign(target);
}

import { Capacitor } from "@capacitor/core";

/** Running inside the iPhone app (Capacitor) rather than a browser. */
export function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

const handledLaunch = "homie-launch-url";

/** Once per page load: mark the document for app-only styles, follow links that opened the app, lift the splash screen. */
export async function startNativeShell() {
  if (!isNativeApp()) return;
  document.documentElement.classList.add("native-app");
  // Safari shows :active (the press feedback) only on pages that listen for touches.
  document.addEventListener("touchstart", () => {}, { passive: true });
  await followAppLinks();
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

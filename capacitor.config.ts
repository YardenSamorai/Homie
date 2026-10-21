import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/** The iPhone app: a native shell around the live site, so every deploy reaches it without a new build. */
const config: CapacitorConfig = {
  appId: "com.yardensamorai.homie",
  appName: "Homie",
  webDir: "native/www",
  backgroundColor: "#f8f7f2",
  server: {
    url: "https://homie-taupe.vercel.app",
    // Shown from the device when the site can't be reached.
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
    allowsLinkPreview: false,
    appendUserAgent: "HomieApp",
  },
  plugins: {
    // Hidden as soon as the first screen is ready; the duration only covers a page that never loads.
    SplashScreen: { launchShowDuration: 8000, launchAutoHide: true, backgroundColor: "#f8f7f2", showSpinner: false },
    // The web view keeps its size and the page moves with the keyboard itself (src/lib/keyboard.ts).
    Keyboard: { resize: KeyboardResize.None, resizeOnFullScreen: true },
    // Shown even while Homie is open, like Messages does.
    PushNotifications: { presentationOptions: ["alert", "sound"] },
  },
};

export default config;

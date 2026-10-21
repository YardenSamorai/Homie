"use client";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isNativeApp } from "@/lib/native";

/**
 * unsupported – not the iPhone app (the site gets no notifications).
 * prompt      – never asked, or asked and the answer is still open.
 * denied      – turned off in the iPhone's Settings; only Settings can turn it back on.
 * on          – this phone is registered and gets notifications.
 * outdated    – an app build from before notifications; TestFlight has a newer one.
 */
export type PushState = "unsupported" | "prompt" | "denied" | "on" | "outdated";

const tokenKey = "homie-push-token";

/**
 * The module, never the plugin itself: a Capacitor plugin answers any property, `then` included,
 * so a promise resolved with the plugin waits forever.
 */
const plugin = () => import("@capacitor/push-notifications");

const unimplemented = (error: unknown) => (error as { code?: string } | null)?.code === "UNIMPLEMENTED";

/** Never hangs: if the phone doesn't answer in a few seconds, offer the button anyway; tapping it reports what's wrong. */
export async function pushState(): Promise<PushState> {
  if (!isNativeApp()) return "unsupported";
  const late = new Promise<PushState>((resolve) => window.setTimeout(() => resolve("prompt"), 4000));
  const check = (async (): Promise<PushState> => {
    try {
      const { receive } = await (await plugin()).PushNotifications.checkPermissions();
      if (receive === "denied") return "denied";
      return receive === "granted" && localStorage.getItem(tokenKey) ? "on" : "prompt";
    } catch (error) {
      return unimplemented(error) ? "outdated" : "prompt";
    }
  })();
  return Promise.race([check, late]);
}

/** Registers with Apple and waits for this phone's token. */
async function appleToken(): Promise<string> {
  const { PushNotifications } = await plugin();
  return new Promise((resolve, reject) => {
    const handles: { remove: () => Promise<void> }[] = [];
    const done = (token: string | null, why = "") => {
      window.clearTimeout(timer);
      handles.forEach((handle) => void handle.remove());
      if (token) resolve(token);
      else reject(new Error(why));
    };
    const timer = window.setTimeout(() => done(null, "no answer from Apple"), 15_000);
    void (async () => {
      handles.push(await PushNotifications.addListener("registration", (token) => done(token.value.toLowerCase())));
      handles.push(await PushNotifications.addListener("registrationError", (error) => done(null, error.error)));
      await PushNotifications.register();
    })().catch((error: unknown) => done(null, error instanceof Error ? error.message : String(error)));
  });
}

async function register(locale: string) {
  const token = await appleToken();
  const { error } = await createBrowserSupabase().rpc("register_push_device", { device_token: token, device_locale: locale });
  if (error) throw error;
  localStorage.setItem(tokenKey, token);
}

/** Asks for permission (call it from a tap). */
export async function enablePush(locale: string): Promise<"on" | "denied" | "outdated"> {
  try {
    const { receive } = await (await plugin()).PushNotifications.requestPermissions();
    if (receive !== "granted") return "denied";
  } catch (error) {
    if (unimplemented(error)) return "outdated";
    throw error;
  }
  await register(locale);
  return "on";
}

/** On every launch with permission: Apple can hand out a new token, and the locale may have changed. */
export async function refreshPush(locale: string) {
  if (!isNativeApp()) return;
  try {
    const { receive } = await (await plugin()).PushNotifications.checkPermissions();
    if (receive === "granted") await register(locale);
  } catch {
    // An older build without notifications, or Apple didn't answer; the bell and Settings say so.
  }
}

/** Signing out: this phone stops hearing about a house it's no longer in. */
export async function forgetPush() {
  const token = localStorage.getItem(tokenKey);
  if (!token) return;
  localStorage.removeItem(tokenKey);
  await createBrowserSupabase().rpc("forget_push_device", { device_token: token });
}

/** Tapping a notification opens the screen it's about. */
export function followNotificationTaps() {
  if (!isNativeApp()) return () => {};
  let handle: { remove: () => Promise<void> } | null = null;
  let live = true;
  void plugin()
    .then(({ PushNotifications }) =>
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const url = (action.notification.data as { url?: unknown } | undefined)?.url;
        if (typeof url === "string" && url.startsWith("/") && url !== location.pathname) location.assign(url);
      }),
    )
    .then((added) => {
      if (live) handle = added;
      else void added.remove();
    });
  return () => {
    live = false;
    void handle?.remove();
  };
}

/** The iPhone's Settings page for this app; Capacitor hands non-web links to iOS. */
export function openAppSettings() {
  location.href = "app-settings:";
}

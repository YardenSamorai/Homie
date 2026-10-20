"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "./native";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * installed – opened from the Home Screen or the iPhone app.
 * prompt    – the browser offers its own install dialog (Chrome, Edge, Android).
 * ios       – Safari on iPhone and iPad: installing goes through Share → Add to Home Screen.
 * none      – nothing to offer here.
 */
export type InstallMode = "installed" | "prompt" | "ios" | "none";

const dismissedKey = "homie-install-dismissed";
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function read(): InstallMode {
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (standalone || isNativeApp()) return "installed";
  if (deferred) return "prompt";
  // Only WebKit on iPhone and iPad exposes navigator.standalone.
  if ("standalone" in navigator) return "ios";
  return "none";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
  };
}

export function useInstallMode() {
  return useSyncExternalStore(subscribe, read, () => "none" as InstallMode);
}

export async function promptInstall() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  notify();
}

export function installDismissed() {
  try {
    return localStorage.getItem(dismissedKey) !== null;
  } catch {
    return true;
  }
}

export function dismissInstall() {
  try {
    localStorage.setItem(dismissedKey, new Date().toISOString());
  } catch {
    /* private mode */
  }
}

/** The offline screen for the installed site; pages themselves always load from the network. */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || isNativeApp() || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
}

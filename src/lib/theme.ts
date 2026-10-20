"use client";

import { useEffect, useSyncExternalStore } from "react";
import { themeStorageKey } from "./theme-script";

export const themes = ["light", "dark", "system"] as const;
export type Theme = (typeof themes)[number];

const changeEvent = "homie:theme";
const statusBar = { light: "#f8f7f2", dark: "#121614" };

function read(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "dark" || value === "system" ? value : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  return () => window.removeEventListener(changeEvent, onChange);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, read, () => "light" as Theme);
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {}
  window.dispatchEvent(new Event(changeEvent));
}

/** Keeps the browser status bar color in step with the resolved appearance. */
export function useThemeColorSync() {
  const theme = useTheme();
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute("content", dark ? statusBar.dark : statusBar.light);
        meta.removeAttribute("media");
      });
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

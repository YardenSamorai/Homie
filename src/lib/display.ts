"use client";

import { useSyncExternalStore } from "react";
import { boldStorageKey, textStorageKey, tintStorageKey } from "./theme-script";

export const textSizes = ["0", "1", "2", "3", "4"] as const;
export type TextSize = (typeof textSizes)[number];

export const tints = ["sage", "coral", "teal", "indigo", "plum"] as const;
export type Tint = (typeof tints)[number];

const textScale: Record<TextSize, string> = {
  "0": "0.9",
  "1": "0.95",
  "2": "1",
  "3": "1.08",
  "4": "1.15",
};

const changeEvent = "homie:display";

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  return () => window.removeEventListener(changeEvent, onChange);
}

function ping() {
  window.dispatchEvent(new Event(changeEvent));
}

function readText(): TextSize {
  const value = document.documentElement.dataset.text;
  return textSizes.includes(value as TextSize) ? (value as TextSize) : "2";
}

function readTint(): Tint {
  const value = document.documentElement.dataset.tint;
  return tints.includes(value as Tint) ? (value as Tint) : "sage";
}

function readBold() {
  return document.documentElement.dataset.bold === "1";
}

export function useTextSize() {
  return useSyncExternalStore(subscribe, readText, () => "2" as TextSize);
}

export function useTint() {
  return useSyncExternalStore(subscribe, readTint, () => "sage" as Tint);
}

export function useBoldText() {
  return useSyncExternalStore(subscribe, readBold, () => false);
}

export function setTextSize(size: TextSize) {
  document.body.style.zoom = textScale[size];
  if (size === "2") delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = size;
  try {
    localStorage.setItem(textStorageKey, size);
  } catch {}
  ping();
}

export function setTint(tint: Tint) {
  if (tint === "sage") delete document.documentElement.dataset.tint;
  else document.documentElement.dataset.tint = tint;
  try {
    localStorage.setItem(tintStorageKey, tint);
  } catch {}
  ping();
}

export function setBoldText(bold: boolean) {
  if (bold) document.documentElement.dataset.bold = "1";
  else delete document.documentElement.dataset.bold;
  try {
    localStorage.setItem(boldStorageKey, bold ? "1" : "0");
  } catch {}
  ping();
}

export function nearestTextSize(fraction: number): TextSize {
  const index = Math.round(Math.min(1, Math.max(0, fraction)) * (textSizes.length - 1));
  return textSizes[index] ?? "2";
}

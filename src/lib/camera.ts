"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "./native";

/** The first iPhone build that declares camera use; opening the camera in an earlier one closes the app. */
const FIRST_CAMERA_BUILD = 7;

/** Known before the tap: iOS only opens a picker from inside the tap itself, not after an await. */
export function useCameraReady() {
  const [ready, setReady] = useState(true);
  useEffect(() => {
    if (!isNativeApp()) return;
    let live = true;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => live && setReady(Number(info.build) >= FIRST_CAMERA_BUILD))
      .catch(() => live && setReady(false));
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

/** Opens the camera (`camera`) or the photo picker, from a tap. Resolves null if the person backs out. */
export function pickPhoto({ camera }: { camera: boolean }) {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (camera) input.setAttribute("capture", "environment");
    input.style.display = "none";
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => done(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => done(null), { once: true });
    document.body.append(input);
    input.click();
  });
}

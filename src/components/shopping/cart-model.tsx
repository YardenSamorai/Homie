"use client";

import { useEffect, useRef } from "react";

const viewerStyle = [
  "width:100%",
  "height:100%",
  "background:transparent",
  "--poster-color:transparent",
  "touch-action:pan-y",
].join(";");

/** The household cart, in its own warm clay, standing side-on to the page. */
export function CartModel() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let viewer: HTMLElement | null = null;
    let cancelled = false;

    import("@google/model-viewer").then(() => {
      if (cancelled || !parent) return;
      viewer = document.createElement("model-viewer");
      viewer.setAttribute("src", "/models/cart.glb?v=2");
      viewer.setAttribute("alt", "");
      viewer.setAttribute("aria-hidden", "true");
      viewer.setAttribute("loading", "eager");
      viewer.setAttribute("interaction-prompt", "none");
      viewer.setAttribute("shadow-intensity", "0.4");
      viewer.setAttribute("shadow-softness", "1");
      viewer.setAttribute("environment-image", "neutral");
      viewer.setAttribute("exposure", "1.05");
      viewer.setAttribute("camera-orbit", "90deg 82deg auto");
      viewer.setAttribute("camera-target", "0m 0.42m 0m");
      viewer.setAttribute("field-of-view", "28deg");
      viewer.setAttribute("style", viewerStyle);
      const progress = document.createElement("div");
      progress.slot = "progress-bar";
      viewer.appendChild(progress);
      parent.appendChild(viewer);
    });

    return () => {
      cancelled = true;
      viewer?.remove();
    };
  }, []);

  return <div ref={host} className="h-full w-full" />;
}

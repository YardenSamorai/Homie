import { isNativeApp } from "./native";

const reloadedKey = "homie-reloaded-for-version";

/**
 * After a deploy, a page opened before it asks for code files that no longer exist (ChunkLoadError).
 * Reloading picks up the new version; once per minute at most, so a real outage can't loop.
 */
export function reloadForNewVersion(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (!/ChunkLoadError|Failed to load chunk|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(message)) return false;
  try {
    const last = Number(sessionStorage.getItem(reloadedKey));
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(reloadedKey, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** Sends uncaught errors to /api/client-error, a few per page at most, so problems on either phone reach the server log. */
export function reportErrors() {
  let sent = 0;
  const send = (message: string, stack?: string) => {
    if (sent >= 5 || !message) return;
    sent += 1;
    const body = JSON.stringify({ message, stack, path: location.pathname, app: isNativeApp() });
    // sendBeacon survives the page closing; fetch is the fallback where it's missing.
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  };
  const onError = (event: ErrorEvent) => {
    if (reloadForNewVersion(event.error ?? event.message)) return;
    send(event.message, event.error instanceof Error ? event.error.stack : undefined);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (reloadForNewVersion(reason)) return;
    send(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

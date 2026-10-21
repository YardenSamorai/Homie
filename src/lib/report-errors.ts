import { isNativeApp } from "./native";

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
  const onError = (event: ErrorEvent) => send(event.message, event.error instanceof Error ? event.error.stack : undefined);
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    send(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

/** Runs `refresh` when the app comes back to the screen or the network returns: a phone drops live connections in the background. */
export function onReturn(refresh: () => void) {
  const visible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("online", refresh);
  return () => {
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("online", refresh);
  };
}

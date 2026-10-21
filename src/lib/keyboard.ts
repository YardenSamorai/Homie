/** Room left between a focused field and the top of the keyboard. */
const MARGIN = 16;
/** Long enough for the keyboard's own slide (and the sheet riding on it) to finish. */
const SETTLE_MS = 480;

const behavior = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/**
 * The iPhone app's keyboard, followed by the page as it moves rather than after it lands.
 *
 * The plugin's own resize waits for the keyboard to finish opening and then snaps the web view shorter, so
 * the keyboard first covers the screen and the page jumps a moment later. Instead the web view keeps its size
 * and the page hears the keyboard's height the moment it starts to rise:
 *   --keyboard       its height in the body's (text-size zoomed) pixels; sheets and bars ride up on it with a
 *                    transition, and screens built on the viewport height shrink by it.
 *   --keyboard-room  scroll space under the page while it's up, so a field low on a page can scroll above it.
 *   data-keyboard    set while it's up.
 * Fields inside a [data-keyboard-aware] container move with that container; any other field the keyboard would
 * cover scrolls up alongside it.
 */
export async function followKeyboard() {
  const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
  await Keyboard.setResizeMode({ mode: KeyboardResize.None });
  const root = document.documentElement;
  let height = 0;
  let release = 0;
  let settle = 0;

  // The text size zooms the body, and with it the units element rects come back in; a full-screen probe
  // inside the body gives the ratio between those and the window's.
  let probe: HTMLDivElement | null = null;
  const scale = () => {
    if (!probe) {
      probe = document.createElement("div");
      probe.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none";
      document.body.append(probe);
    }
    return window.innerHeight / (probe.getBoundingClientRect().height || window.innerHeight);
  };
  /** How far, in window pixels, the keyboard would cover the field. */
  const covered = (field: HTMLElement) => field.getBoundingClientRect().bottom * scale() - (window.innerHeight - height - MARGIN);

  const reveal = () => {
    window.clearTimeout(settle);
    const field = document.activeElement;
    if (!(field instanceof HTMLElement) || !field.matches("input, textarea, [contenteditable]")) return;
    if (field.closest("[data-keyboard-aware]")) {
      // The container is moving itself; once it has, keep the field inside its own scroller.
      settle = window.setTimeout(() => {
        if (document.activeElement !== field || !height) return;
        field.scrollIntoView({ block: "nearest", behavior: behavior() });
        const overlap = covered(field);
        if (overlap > 0) window.scrollBy({ top: overlap, behavior: behavior() });
      }, SETTLE_MS);
      return;
    }
    const overlap = covered(field);
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: behavior() });
  };

  await Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) => {
    window.clearTimeout(release);
    const zoom = Number.parseFloat(document.body.style.zoom) || 1;
    height = keyboardHeight;
    root.style.setProperty("--keyboard", `${keyboardHeight / zoom}px`);
    root.style.setProperty("--keyboard-room", `${keyboardHeight}px`);
    root.setAttribute("data-keyboard", "");
    reveal();
  });

  await Keyboard.addListener("keyboardWillHide", () => {
    window.clearTimeout(settle);
    const room = height;
    height = 0;
    root.style.setProperty("--keyboard", "0px");
    root.removeAttribute("data-keyboard");
    // Glide out of the space the keyboard needed while it slides away, then take the space back.
    const rest = Math.max(0, root.scrollHeight - room - window.innerHeight);
    if (window.scrollY > rest) window.scrollTo({ top: rest, behavior: behavior() });
    release = window.setTimeout(() => root.style.setProperty("--keyboard-room", "0px"), SETTLE_MS + 120);
  });

  // Moving to another field with the keyboard already up sends no new keyboard event.
  document.addEventListener("focusin", () => {
    if (height) requestAnimationFrame(reveal);
  });
}

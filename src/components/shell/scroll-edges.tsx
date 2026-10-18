/** Content softens under the status bar and behind the floating tab bar instead of colliding with them. */
export function ScrollEdges() {
  return (
    <>
      <div
        aria-hidden
        className="scroll-edge-top pointer-events-none fixed inset-x-0 top-0 z-30 h-[calc(env(safe-area-inset-top,0px)+12px)]"
      />
      <div
        aria-hidden
        className="scroll-edge-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(env(safe-area-inset-bottom,0px)+96px)] md:hidden"
      />
    </>
  );
}

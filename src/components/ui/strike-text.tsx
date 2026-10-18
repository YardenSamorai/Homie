/** A title whose strikethrough draws across from the start edge when it is marked done. */
export function StrikeText({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span className="relative min-w-0 max-w-full self-start">
      <span
        className={`block truncate text-[17px] transition-colors duration-200 ${done ? "text-label-secondary" : "text-label"}`}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-1/2 h-[1.5px] origin-left rounded-full bg-label-secondary transition-transform duration-[250ms] ease-[var(--ease-out-strong)] rtl:origin-right motion-reduce:transition-none ${
          done ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </span>
  );
}

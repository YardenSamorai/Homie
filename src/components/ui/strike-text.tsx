/**
 * A title that wraps in full, struck through when it's done: the line fades in, so it works on every line.
 * Its own direction (an English title in a Hebrew list) decides where it breaks; the list decides its edge.
 */
export function StrikeText({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span
      dir="auto"
      className={`min-w-0 max-w-full text-pretty align-ui text-[17px] leading-snug line-through decoration-[1.5px] transition-[color,text-decoration-color] duration-200 [overflow-wrap:anywhere] motion-reduce:transition-none ${
        done ? "text-label-secondary decoration-label-secondary" : "text-label decoration-transparent"
      }`}
    >
      {children}
    </span>
  );
}

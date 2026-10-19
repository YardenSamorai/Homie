export type CartDrop = { name: string; from: { x: number; y: number } };

type Listener = (drop: CartDrop) => void;

const listeners = new Set<Listener>();

/** The shopping banner is listening. Other screens ignore the toss. */
export function dropInCart(drop: CartDrop) {
  listeners.forEach((listener) => listener(drop));
}

export function subscribeCartDrops(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function centerOf(element: Element | null | undefined): { x: number; y: number } | null {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

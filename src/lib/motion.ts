import type { Transition } from "motion/react";

/** Strong ease-out: fast start, gentle settle. Use for anything entering the screen. */
export const easeOut = [0.23, 1, 0.32, 1] as const;

/** Critically damped by default (Apple: bounce only after a momentum gesture). */
export const spring = {
  /** Selection indicators that slide between options. */
  snappy: { type: "spring", bounce: 0, duration: 0.3 },
  /** Elements that change size or position in a list. */
  gentle: { type: "spring", bounce: 0, duration: 0.4 },
  /** Rotation that follows a finger or pointer (Apple: damping 0.8, response 0.4). */
  tilt: { type: "spring", bounce: 0.2, duration: 0.4 },
  /** A tab icon settling after it becomes active, iOS 26 style. */
  pop: { type: "spring", bounce: 0.35, duration: 0.4 },
} satisfies Record<string, Transition>;

/** 3D illustrations rise into place, tipped back like a card being set down. */
export const settle = {
  initial: { opacity: 0, transform: "perspective(600px) rotateX(18deg) translateY(10px) scale(0.96)" },
  animate: { opacity: 1, transform: "perspective(600px) rotateX(0deg) translateY(0px) scale(1)" },
  transition: { duration: 0.45, ease: easeOut },
};

/** Press feedback for tappable surfaces. Never scale below ~0.95. */
export const press = { scale: 0.97 };

/** The home screen opens many times a day, so entrances stay short. */
export const enter = (delay = 0): Transition => ({ duration: 0.3, ease: easeOut, delay });

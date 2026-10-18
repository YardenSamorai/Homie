"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * Tips its content in 3D toward the pointer: followed on hover with a mouse,
 * pressed into on touch. Purely decorative, so it is off with reduced motion.
 */
export function Tilt({
  children,
  max = 12,
  className,
}: {
  children: React.ReactNode;
  /** Largest rotation in degrees, reached at the edges. */
  max?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, (v) => -v * max), spring.tilt);
  const rotateY = useSpring(useTransform(px, (v) => v * max), spring.tilt);
  const transform = useMotionTemplate`perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  if (reduce) return <div className={className}>{children}</div>;

  const follow = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      style={{ transform }}
      onPointerMove={(e) => e.pointerType === "mouse" && follow(e)}
      onPointerDown={(e) => e.pointerType !== "mouse" && follow(e)}
      onPointerUp={(e) => e.pointerType !== "mouse" && reset()}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className={className}
    >
      {children}
    </motion.div>
  );
}

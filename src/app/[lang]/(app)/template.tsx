"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { easeOut } from "@/lib/motion";

let hasNavigated = false;

/** Screens fade up on navigation; the first paint after load stays static so content is never hidden behind JS. */
export default function Template({ children }: { children: React.ReactNode }) {
  const animate = hasNavigated;
  useEffect(() => {
    hasNavigated = true;
  }, []);

  return (
    <motion.div
      initial={animate ? { opacity: 0, transform: "translateY(8px)" } : false}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.24, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

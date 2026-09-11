import { useReducedMotion } from "framer-motion";

export const MOTION = {
  duration: {
    fast: 0.12,
    base: 0.18,
    slow: 0.32,
  },
  ease: [0.16, 1, 0.3, 1] as const,
};

export function useMotionSafe() {
  const reduce = Boolean(useReducedMotion());
  return {
    reduce,
    fade: reduce
      ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
    pop: reduce
      ? { initial: false as const, animate: { opacity: 1, scale: 1, y: 0 } }
      : {
          initial: { opacity: 0, scale: 0.96, y: 12 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: 12 },
        },
    sheet: reduce
      ? { initial: false as const, animate: { y: 0 } }
      : {
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
        },
    duration: reduce ? 0 : MOTION.duration.base,
    ease: MOTION.ease,
  };
}

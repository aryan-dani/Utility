import { useReducedMotion } from "framer-motion";

/** Brand ease — shared by Framer and CSS (`--ease-out-premium`). */
export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;

export const MOTION = {
  duration: {
    /** Press feedback */
    instant: 0.08,
    /** Tooltips, menus, chevrons */
    fast: 0.12,
    /** Overlays, dialogs, popovers */
    base: 0.18,
    /** Page / section enter */
    enter: 0.28,
    /** Sidebar width, SRS flip */
    slow: 0.32,
  },
  ease: MOTION_EASE,
  /** Shared layout springs (nav active pill, palette highlight) */
  spring: { type: "spring" as const, stiffness: 450, damping: 35 },
  /** Soft enter springs (FadeIn / stagger) */
  springSoft: {
    type: "spring" as const,
    stiffness: 380,
    damping: 32,
    mass: 0.85,
  },
  press: { scale: 0.97 },
  hoverLift: { y: -2 },
  stagger: { children: 0.05, delay: 0.02 },
};

export type MotionSafe = ReturnType<typeof useMotionSafe>;

export function useMotionSafe() {
  const reduce = Boolean(useReducedMotion());
  const duration = {
    instant: reduce ? 0 : MOTION.duration.instant,
    fast: reduce ? 0 : MOTION.duration.fast,
    base: reduce ? 0 : MOTION.duration.base,
    enter: reduce ? 0 : MOTION.duration.enter,
    slow: reduce ? 0 : MOTION.duration.slow,
  };

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
          initial: { opacity: 0, scale: 0.96, y: 8 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: 8 },
        },
    sheet: reduce
      ? { initial: false as const, animate: { y: 0 } }
      : {
          initial: { y: "100%" },
          animate: { y: 0 },
          exit: { y: "100%" },
        },
    menu: reduce
      ? { initial: false as const, animate: { opacity: 1, scale: 1, y: 0 } }
      : {
          initial: { opacity: 0, scale: 0.98, y: 4 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.98, y: 4 },
        },
    tooltip: reduce
      ? { initial: false as const, animate: { opacity: 1, scale: 1, x: 0 } }
      : {
          initial: { opacity: 0, scale: 0.92, x: -6 },
          animate: { opacity: 1, scale: 1, x: 0 },
          exit: { opacity: 0, scale: 0.92, x: -4 },
        },
    /** Default overlay duration (base) */
    duration: duration.base,
    durations: duration,
    ease: MOTION.ease,
    spring: MOTION.spring,
    springSoft: MOTION.springSoft,
    press: MOTION.press,
    hoverLift: MOTION.hoverLift,
    stagger: reduce
      ? { children: 0, delay: 0 }
      : MOTION.stagger,
  };
}

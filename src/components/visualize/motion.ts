"use client";

import { MOTION, useMotionSafe } from "@/lib/motion";

export const easeOut = MOTION.ease;

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.06 },
  },
};

const reducedFadeUp = {
  hidden: { opacity: 1, y: 0 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0 },
  },
};

const reducedStagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0, delayChildren: 0 },
  },
};

export function useVizMotion() {
  const { reduce } = useMotionSafe();
  return {
    reduce,
    fadeUp: reduce ? reducedFadeUp : fadeUp,
    stagger: reduce ? reducedStagger : stagger,
    ease: easeOut,
    duration: reduce ? 0 : MOTION.duration.slow,
  };
}

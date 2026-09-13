"use client";

import { MOTION, useMotionSafe } from "@/lib/motion";

export const easeOut = MOTION.ease;

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION.duration.enter, ease: easeOut },
  },
};

export const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: MOTION.stagger.children,
      delayChildren: MOTION.stagger.delay,
    },
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
  const { reduce, durations } = useMotionSafe();
  return {
    reduce,
    fadeUp: reduce ? reducedFadeUp : fadeUp,
    stagger: reduce ? reducedStagger : stagger,
    ease: easeOut,
    duration: durations.enter,
  };
}

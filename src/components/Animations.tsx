"use client";

import { motion } from "framer-motion";
import { useMotionSafe } from "@/lib/motion";

export function FadeIn({
  children,
  delay = 0,
  y = 8,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const { reduce, springSoft } = useMotionSafe();
  return (
    <motion.div
      suppressHydrationWarning
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...springSoft,
        delay: reduce ? 0 : delay,
      }}
      className={className}
      style={{ willChange: reduce ? "auto" : "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

export function ScaleButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
}) {
  const { reduce, press, hoverLift, spring } = useMotionSafe();
  return (
    <motion.button
      suppressHydrationWarning
      whileHover={reduce ? {} : { ...hoverLift, scale: 1.01 }}
      whileTap={reduce ? {} : press}
      transition={spring}
      className={className}
      {...(props as object)}
      style={{ willChange: reduce ? "auto" : "transform" }}
    >
      {children}
    </motion.button>
  );
}

export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { stagger } = useMotionSafe();
  return (
    <motion.div
      suppressHydrationWarning
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: stagger.children,
            delayChildren: stagger.delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { reduce, springSoft } = useMotionSafe();
  return (
    <motion.div
      suppressHydrationWarning
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: springSoft,
        },
      }}
      className={className}
      style={{ willChange: reduce ? "auto" : "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedList ensures that items staggered on mount do not re-animate
 * when the list updates or individual items change.
 */
export function AnimatedList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <StaggerContainer className={className}>{children}</StaggerContainer>;
}

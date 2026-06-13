'use client';

import { motion, useReducedMotion } from 'framer-motion';

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
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      suppressHydrationWarning
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 0.8,
        delay: shouldReduceMotion ? 0 : delay, 
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

export function ScaleButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.button
      suppressHydrationWarning
      whileHover={shouldReduceMotion ? {} : { y: -2, scale: 1.02 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={className}
      {...(props as object)}
      style={{ willChange: shouldReduceMotion ? 'auto' : 'transform' }}
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
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      suppressHydrationWarning
      initial="hidden"
      animate="visible"
      variants={{
        visible: { 
          transition: { 
            staggerChildren: shouldReduceMotion ? 0 : 0.04,
            delayChildren: 0.02
          } 
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      suppressHydrationWarning
      variants={{
        hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
        visible: { 
          opacity: 1, 
          y: 0, 
          transition: { 
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 0.8
          } 
        },
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
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
  return (
    <StaggerContainer className={className}>
      {children}
    </StaggerContainer>
  );
}

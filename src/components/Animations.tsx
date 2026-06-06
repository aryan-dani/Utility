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
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: shouldReduceMotion ? 0.1 : 0.25, 
        delay: shouldReduceMotion ? 0 : delay, 
        ease: [0.22, 1, 0.36, 1] 
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
      whileHover={shouldReduceMotion ? {} : { y: -1, scale: 1.01 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
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
      variants={{
        hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
        visible: { 
          opacity: 1, 
          y: 0, 
          transition: { 
            duration: shouldReduceMotion ? 0.15 : 0.25, 
            ease: [0.22, 1, 0.36, 1] 
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

"use client";

import { motion } from "framer-motion";

export function FadeIn({ children, delay = 0, y = 15 }: { children: React.ReactNode, delay?: number, y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function ScaleButton({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

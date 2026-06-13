'use client';

import { Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Loading() {
  return (
    <div className="relative flex-1 w-full flex flex-col items-center justify-center min-h-[80vh] px-6 py-12 overflow-hidden">
      <div className="noise-overlay" />

      {/* Main Logo Loader */}
      <div className="flex flex-col items-center justify-center relative z-10 mb-12 animate-fade-in">
        <div className="relative mb-6">
          {/* Outer Ring Glow */}
          <motion.div
            animate={{
              scale: [0.9, 1.15, 0.9],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -inset-4 bg-accent/20 rounded-3xl blur-xl"
          />
          
          {/* Logo container */}
          <motion.div
            animate={{
              y: [0, -6, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-16 h-16 rounded-2xl bg-card border border-border/80 flex items-center justify-center shadow-popover relative"
          >
            <Layers className="w-8 h-8 text-foreground" />
          </motion.div>
        </div>

        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-center"
        >
          <h2 className="text-sm font-bold text-foreground tracking-wider uppercase">Utility Workspace</h2>
          <p className="text-xs text-muted mt-1.5">Synchronizing data...</p>
        </motion.div>
      </div>

      {/* Skeleton Shimmer Layout to represent page structure loading */}
      <div className="w-full max-w-xl space-y-4 relative z-10 opacity-40">
        <div className="h-6 w-1/3 skeleton rounded-lg" />
        <div className="space-y-2.5">
          <div className="h-4 w-full skeleton rounded-md" />
          <div className="h-4 w-5/6 skeleton rounded-md" />
          <div className="h-4 w-4/5 skeleton rounded-md" />
        </div>
        
        <div className="pt-4 grid grid-cols-2 gap-4">
          <div className="h-24 skeleton rounded-xl" />
          <div className="h-24 skeleton rounded-xl" />
        </div>
      </div>
    </div>
  );
}

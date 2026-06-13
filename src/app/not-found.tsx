'use client';

import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="relative flex-1 w-full flex flex-col items-center justify-center min-h-[80vh] px-4 py-16 overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-radial-gradient from-accent/5 via-transparent to-transparent pointer-events-none opacity-40" />
      <div className="noise-overlay" />
      
      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--border)/0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--border)/0.2)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card max-w-md w-full rounded-2xl p-8 sm:p-10 shadow-popover relative z-10 text-center"
      >
        <div className="relative mb-6">
          <span className="text-[100px] sm:text-[120px] font-black tracking-tighter leading-none select-none text-gradient-purple opacity-90 block">
            404
          </span>
          <div className="w-12 h-12 rounded-xl bg-card border border-border/85 flex items-center justify-center shadow-md absolute -bottom-2 right-[calc(50%-1.5rem)]">
            <FileQuestion className="w-5 h-5 text-accent" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
          Page Not Found
        </h1>
        
        <p className="text-foreground-subtle text-sm mb-8 leading-relaxed max-w-sm mx-auto">
          The page or academic resource you are looking for does not exist, or has been relocated to a different branch.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-all shadow-sm active:scale-95"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border text-foreground text-sm font-semibold hover:bg-surface-hover transition-all shadow-xs active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}

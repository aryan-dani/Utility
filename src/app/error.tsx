'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RotateCcw, Home, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('Global Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="relative flex-1 w-full flex flex-col items-center justify-center min-h-[80vh] px-4 py-16 overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-radial-gradient from-destructive/5 via-transparent to-transparent pointer-events-none opacity-40" />
      <div className="noise-overlay" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-card border border-border max-w-lg w-full rounded-2xl p-8 sm:p-10 shadow-md relative z-10 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6 mx-auto shadow-sm">
          <motion.div
            animate={{ 
              rotate: [0, -3, 3, -3, 3, 0],
              scale: [1, 1.05, 1.05, 1.05, 1.05, 1]
            }}
            transition={{ 
              repeat: Infinity, 
              repeatDelay: 5, 
              duration: 0.5 
            }}
          >
            <AlertCircle className="w-8 h-8 text-destructive" />
          </motion.div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-3 tracking-tight">
          Application Error
        </h1>
        
        <p className="text-foreground-subtle text-sm mb-8 leading-relaxed max-w-sm mx-auto">
          We encountered an unexpected issue while loading this page. The system error has been captured.
        </p>

        {/* Error Digest/Details */}
        {error.digest && (
          <div className="mb-8 text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors mx-auto"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showDetails ? 'Hide technical details' : 'Show technical details'}</span>
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <pre className="bg-background-subtle border border-border rounded-xl p-4 text-[11px] font-mono text-muted overflow-x-auto select-all max-h-[150px]">
                    <div className="font-bold text-foreground mb-1">Error Digest:</div>
                    {error.digest}
                    {error.message && (
                      <>
                        <div className="font-bold text-foreground mt-2 mb-1">Message:</div>
                        {error.message}
                      </>
                    )}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-all shadow-sm active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border text-foreground text-sm font-semibold hover:bg-surface-hover transition-all shadow-xs active:scale-95"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

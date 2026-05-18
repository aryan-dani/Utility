'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('Global Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6 shadow-sm">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Something went wrong</h2>
      <p className="text-muted text-sm max-w-md mb-8 leading-relaxed">
        We encountered an unexpected issue while loading this page. Our team has been notified.
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-border text-foreground text-sm font-semibold hover:bg-surface-hover transition-all shadow-xs"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

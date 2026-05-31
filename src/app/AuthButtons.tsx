'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ScaleButton } from '@/components/Animations';
import { auth } from '@/lib/firebase';

export default function AuthButtons() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  if (!mounted) return <div className="h-10" />; // Placeholder to prevent layout shift

  return isLoggedIn ? (
    <div className="flex flex-wrap gap-3 justify-center">
      <Link href="/planner">
        <ScaleButton className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-card">
          Open Planner <ArrowRight className="w-4 h-4" />
        </ScaleButton>
      </Link>
      <Link href="/resources">
        <ScaleButton className="inline-flex items-center gap-2 px-6 py-2.5 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
          Browse Resources
        </ScaleButton>
      </Link>
    </div>
  ) : (
    <div className="flex justify-center">
      <Link href="/login">
        <ScaleButton className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-card">
          Get Started <ArrowRight className="w-4 h-4" />
        </ScaleButton>
      </Link>
    </div>
  );
}

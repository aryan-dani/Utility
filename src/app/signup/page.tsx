'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const redirectTo = searchParams.get('redirectTo') || '/planner';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.href = redirectTo;
      }
    });
  }, [supabase, redirectTo]);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError(null);
    document.cookie = `utility_oauth_redirect=${encodeURIComponent(redirectTo)}; path=/; max-age=600; SameSite=Lax`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <div className="bg-card border border-border rounded-xl p-8 shadow-card">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-background" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Utility</p>
              <p className="text-xs text-muted">Create account</p>
            </div>
          </div>

          <h1 className="text-xl font-bold text-foreground mb-1">Sign up</h1>
          <p className="text-sm text-muted mb-6">
            Use your Google account to start using Utility.
          </p>

          {error && (
            <div className="mb-5 text-sm text-foreground bg-surface border border-border-strong p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="w-full bg-foreground text-background py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center text-sm font-bold leading-none">
                G
              </span>
            )}
            Continue with Google
          </button>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Already have an account?{' '}
          <Link
            href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

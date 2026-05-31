'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectTo = searchParams.get('redirectTo') || '/planner';

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        router.push(redirectTo);
      }
    });
    return () => unsubscribe();
  }, [redirectTo, router]);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setTimeout(() => {
        router.push(redirectTo);
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  const handleGithubSignup = async () => {
    setGithubLoading(true);
    setError(null);

    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
      setTimeout(() => {
        router.push(redirectTo);
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setGithubLoading(false);
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
            Choose a provider to create your account and start using Utility.
          </p>

          {error && (
            <div className="mb-5 text-sm text-foreground bg-surface border border-border-strong p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={googleLoading || githubLoading}
              className="bg-foreground text-background py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-background" />
              ) : (
                <span className="flex h-4.5 w-4.5 items-center justify-center text-sm font-black leading-none">
                  G
                </span>
              )}
              Google
            </button>
            <button
              type="button"
              onClick={handleGithubSignup}
              disabled={googleLoading || githubLoading}
              className="bg-foreground text-background py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {githubLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-background" />
              ) : (
                <svg className="w-4 h-4 text-background" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
              )}
              GitHub
            </button>
          </div>
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

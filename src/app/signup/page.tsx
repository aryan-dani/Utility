"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Layers, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";
import { motion } from "framer-motion";

function getFriendlyErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-email":
      return "The email address is not formatted correctly.";
    case "auth/user-disabled":
      return "This user account has been disabled.";
    case "auth/email-already-in-use":
      return "An account with this email address already exists.";
    case "auth/weak-password":
      return "The password is too weak. Please use at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "Sign-up was cancelled. Please try again.";
    case "auth/network-request-failed":
      return "A network error occurred. Please check your internet connection.";
    default:
      return "An unexpected error occurred. Please try again later.";
  }
}

function SignupContent() {
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectTo = searchParams.get("redirectTo") || "/planner";

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
      setError(getFriendlyErrorMessage(err.code || err.message));
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
      setError(getFriendlyErrorMessage(err.code || err.message));
      setGithubLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 overflow-hidden">
      {/* Ambient background animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20">
        <motion.div
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -30, 40, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] left-[10%] w-[35vw] h-[35vw] rounded-full bg-accent/5 blur-[80px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -40, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear", delay: 1 }}
          className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-indigo-500/5 blur-[80px]"
        />
      </div>
      <div className="noise-overlay opacity-30" />

      <div className="w-full max-w-sm relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl p-8 shadow-popover"
        >
          <div className="flex items-center gap-2.5 mb-8">
            <div className="flex items-center justify-center">
              <Layers className="w-8 h-8 text-foreground" />
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
            <div className="mb-5 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={googleLoading || githubLoading}
              className="bg-foreground text-background py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 duration-150 shadow-sm"
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
              className="bg-foreground text-background py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 duration-150 shadow-sm"
            >
              {githubLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-background" />
              ) : (
                <svg
                  className="w-4 h-4 text-background"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                  />
                </svg>
              )}
              GitHub
            </button>
          </div>
        </motion.div>

        <p className="text-center text-xs text-muted mt-6">
          Already have an account?{" "}
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

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}

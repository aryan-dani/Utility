"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import Link from "next/link";
import { ArrowLeft, Loader2, Eye, EyeOff, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import { sanitizeRedirectTo } from "@/lib/workspace";
import {
  signInWithPopupOrRedirect,
  consumeRedirectResult,
  rememberRedirectTo,
  takeRememberedRedirectTo,
  linkGithubOverGoogleAccount,
} from "@/lib/firebaseAuth";
import { describeError } from "@/lib/errors";
import { PageHeader } from "@/components/ui";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectTo = sanitizeRedirectTo(searchParams.get("redirectTo"));
  const redirectedRef = useRef(false);

  const goAfterAuth = (target?: string | null) => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.push(target != null ? sanitizeRedirectTo(target) : redirectTo);
  };

  // If already logged in, redirect after merge handling completes
  useEffect(() => {
    let cancelled = false;
    let mergeHandled = false;

    (async () => {
      try {
        const outcome = await consumeRedirectResult(auth);
        if (cancelled) return;
        mergeHandled = true;
        const remembered = takeRememberedRedirectTo();
        const next = remembered
          ? sanitizeRedirectTo(remembered)
          : redirectTo;
        if (outcome.status === "linked") {
          goAfterAuth(next);
        } else if (
          outcome.status === "needs-github-confirm" ||
          outcome.status === "needs-google-confirm"
        ) {
          goAfterAuth("/profile");
        } else if (auth.currentUser) {
          goAfterAuth(redirectTo);
        }
      } catch {
        mergeHandled = true;
        if (auth.currentUser) goAfterAuth(redirectTo);
      }
    })();

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!mergeHandled || !user) return;
      goAfterAuth(redirectTo);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redirect once per mount
  }, [redirectTo, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      goAfterAuth(redirectTo);
    } catch (err: unknown) {
      setError(describeError(err));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const cred = await signInWithPopupOrRedirect(auth, "google");
      if (!cred) {
        rememberRedirectTo(redirectTo);
        return;
      }
      goAfterAuth(redirectTo);
    } catch (err: unknown) {
      setError(describeError(err));
      setGoogleLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setGithubLoading(true);
    setError(null);

    try {
      const cred = await signInWithPopupOrRedirect(auth, "github");
      if (!cred) {
        rememberRedirectTo(redirectTo);
        return;
      }
      goAfterAuth(redirectTo);
    } catch (err: unknown) {
      try {
        const linked = await linkGithubOverGoogleAccount(auth, err);
        if (linked) {
          goAfterAuth(redirectTo);
          return;
        }
      } catch (linkErr: unknown) {
        setError(describeError(linkErr));
        setGithubLoading(false);
        return;
      }
      setError(describeError(err));
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
          className="absolute top-[20%] left-[10%] w-[35vw] h-[35vw] rounded-full bg-foreground/3 blur-[80px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -40, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear", delay: 1 }}
          className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-foreground/3 blur-[80px]"
        />
      </div>
      <div className="noise-overlay opacity-30" />

      <div className="w-full max-w-sm relative z-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        {/* Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: MOTION.duration.enter, ease: MOTION.ease }}
          className="bg-card border border-border rounded-2xl p-8 shadow-md"
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="flex items-center justify-center">
              <Layers className="w-8 h-8 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Utility</p>
              <p className="text-xs text-muted">Student workspace</p>
            </div>
          </div>

          <PageHeader
            className="mb-6"
            title="Sign in"
            description="Sign in to access your planner and resources."
          />

          {error && (
            <div className="mb-5 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || githubLoading || loading}
              className="bg-background border border-border text-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-surface disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-[0.97] duration-[var(--dur-fast)] ease-[var(--ease-out-premium)]"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <span className="flex h-4.5 w-4.5 items-center justify-center text-sm font-black leading-none text-foreground">
                  G
                </span>
              )}
              Google
            </button>
            <button
              type="button"
              onClick={handleGithubSignIn}
              disabled={googleLoading || githubLoading || loading}
              className="bg-background border border-border text-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-surface disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-[0.97] duration-[var(--dur-fast)] ease-[var(--ease-out-premium)]"
            >
              {githubLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <svg
                  className="w-4 h-4 text-foreground"
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

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-xs text-muted">
                or sign in with email
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-foreground mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-0 focus-visible:ring-0 focus:border-foreground/40 text-foreground placeholder:text-muted transition-[border-color,box-shadow] duration-150 input-premium-focus"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:ring-0 focus-visible:ring-0 focus:border-foreground/40 text-foreground placeholder:text-muted transition-[border-color,box-shadow] duration-150 input-premium-focus"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 inset-y-0 flex items-center text-muted hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-background py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.97] duration-[var(--dur-fast)] ease-[var(--ease-out-premium)] disabled:active:scale-100"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing inâ€¦
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-muted mt-6">
          New to Utility?{" "}
          <Link
            href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-foreground hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="text-center text-xs text-muted/80 mt-3 leading-relaxed">
          By continuing you agree to Utility&apos;s{" "}
          <Link href="/privacy" className="font-medium text-foreground hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3" role="status">
        <span className="loading-orb" aria-hidden />
        <p className="text-xs font-medium text-muted tracking-wide">Loadingâ€¦</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

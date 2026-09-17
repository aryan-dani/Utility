import { FirebaseError } from "firebase/app";
import {
  EmailAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  linkWithCredential,
  linkWithPopup,
  linkWithRedirect,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type AuthCredential,
  type OAuthCredential,
  type User,
  type UserCredential,
} from "firebase/auth";

function firebaseErrorCode(err: unknown): string | undefined {
  if (err instanceof FirebaseError) return err.code;
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export function githubAuthProvider() {
  const provider = new GithubAuthProvider();
  provider.addScope("user:email");
  return provider;
}

export function googleAuthProvider() {
  return new GoogleAuthProvider();
}

const INTENT_KEY = "utility.auth.intent";
const MERGE_KEY = "utility.auth.merge";
const REDIRECT_TO_KEY = "utility.auth.redirectTo";

type AuthIntent =
  | "signin-google"
  | "signin-github"
  | "link-google"
  | "link-github"
  | "reauth-github"
  | "reauth-google"
  | "reauth-session-google"
  | "reauth-session-github";

const PENDING_DELETE_KEY = "utility.auth.pendingDelete";

export function markPendingAccountDelete() {
  sessionStorage.setItem(PENDING_DELETE_KEY, "1");
}

export function takePendingAccountDelete(): boolean {
  const value = sessionStorage.getItem(PENDING_DELETE_KEY);
  sessionStorage.removeItem(PENDING_DELETE_KEY);
  return value === "1";
}

type StoredMerge = {
  googleIdToken: string | null;
  googleAccessToken: string | null;
  githubAccessToken: string | null;
};

export type LinkMergeResult =
  | { status: "linked"; user: User }
  | { status: "reauthed"; user: User }
  | { status: "redirecting" }
  | { status: "needs-github-confirm" }
  | { status: "needs-google-confirm" }
  | { status: "none" }
  | { status: "error"; code: string | null };

export type ReauthResult =
  | { status: "ok" }
  | { status: "redirecting" }
  | { status: "password-required" };

/** Fresh credential for sensitive actions (account deletion). */
export async function reauthenticateCurrentUser(
  auth: Auth,
  password?: string,
): Promise<ReauthResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const ids = providerIds(user);

  if (ids.includes("google.com")) {
    if (preferRedirectAuth()) {
      setIntent("reauth-session-google");
      await reauthenticateWithRedirect(user, googleAuthProvider());
      return { status: "redirecting" };
    }
    try {
      await reauthenticateWithPopup(user, googleAuthProvider());
      return { status: "ok" };
    } catch (err: unknown) {
      if (!isPopupBlocked(firebaseErrorCode(err))) throw err;
      setIntent("reauth-session-google");
      await reauthenticateWithRedirect(user, googleAuthProvider());
      return { status: "redirecting" };
    }
  }

  if (ids.includes("github.com")) {
    if (preferRedirectAuth()) {
      setIntent("reauth-session-github");
      await reauthenticateWithRedirect(user, githubAuthProvider());
      return { status: "redirecting" };
    }
    try {
      await reauthenticateWithPopup(user, githubAuthProvider());
      return { status: "ok" };
    } catch (err: unknown) {
      if (!isPopupBlocked(firebaseErrorCode(err))) throw err;
      setIntent("reauth-session-github");
      await reauthenticateWithRedirect(user, githubAuthProvider());
      return { status: "redirecting" };
    }
  }

  if (ids.includes("password")) {
    if (!password || !user.email) return { status: "password-required" };
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    return { status: "ok" };
  }

  throw new Error("No reauthentication provider available.");
}

function providerIds(user: User) {
  return user.providerData.map((p) => p.providerId);
}

function isPopupBlocked(code: string | undefined) {
  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/internal-error"
  );
}

/**
 * Store / installed PWA / WebView2 often cannot complete OAuth popups
 * (and Google may block OAuth inside embedded WebViews entirely).
 * Prefer full-page redirect there; callers should also offer email signup.
 */
export function preferRedirectAuth(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia("(display-mode: window-controls-overlay)").matches) {
      return true;
    }
    if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  } catch {
    // ignore
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;

  const ua = navigator.userAgent || "";
  if (/\bMSAppHost\b/i.test(ua) || /\bWebView2?\b/i.test(ua)) return true;
  // Packaged Edge WebView used by PWABuilder MSIX
  if (
    typeof (window as unknown as { chrome?: { webview?: unknown } }).chrome
      ?.webview !== "undefined"
  ) {
    return true;
  }
  // Some Store shells expose a Windows Runtime bridge
  if (
    typeof (window as unknown as { Windows?: unknown }).Windows !== "undefined"
  ) {
    return true;
  }
  // PWABuilder Edge standalone may not expose chrome.webview on all Win builds,
  // but the Sec-CH-UA brands list includes "Microsoft Edge WebView2".
  try {
    const uad = (
      navigator as Navigator & {
        userAgentData?: { brands?: { brand: string }[] };
      }
    ).userAgentData;
    if (uad?.brands?.some((b) => /WebView2/i.test(b.brand))) return true;
  } catch {
    // ignore
  }
  return false;
}

/** True in installed Store/PWA shells where OAuth is unreliable. */
export function shouldPreferEmailAuth(): boolean {
  return preferRedirectAuth();
}

function oauthParts(cred: AuthCredential | null) {
  const o = cred as OAuthCredential | null;
  return {
    idToken: o?.idToken ?? null,
    accessToken: o?.accessToken ?? null,
  };
}

function loadMerge(): StoredMerge | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MERGE_KEY);
    return raw ? (JSON.parse(raw) as StoredMerge) : null;
  } catch {
    return null;
  }
}

function saveMerge(next: StoredMerge) {
  sessionStorage.setItem(MERGE_KEY, JSON.stringify(next));
}

function clearMerge() {
  sessionStorage.removeItem(MERGE_KEY);
}

function setIntent(intent: AuthIntent) {
  sessionStorage.setItem(INTENT_KEY, intent);
}

function takeIntent(): AuthIntent | null {
  const intent = sessionStorage.getItem(INTENT_KEY) as AuthIntent | null;
  sessionStorage.removeItem(INTENT_KEY);
  return intent;
}

function googleFromStored(s: StoredMerge): AuthCredential | null {
  if (!s.googleIdToken && !s.googleAccessToken) return null;
  return GoogleAuthProvider.credential(s.googleIdToken, s.googleAccessToken);
}

function githubFromStored(s: StoredMerge): AuthCredential | null {
  if (!s.githubAccessToken) return null;
  return GithubAuthProvider.credential(s.githubAccessToken);
}

function stashGoogleFromError(err: unknown): boolean {
  const cred = err instanceof FirebaseError ? GoogleAuthProvider.credentialFromError(err) : null;
  const parts = oauthParts(cred);
  if (!parts.idToken && !parts.accessToken) return false;
  const prev = loadMerge() || { googleIdToken: null, googleAccessToken: null, githubAccessToken: null };
  saveMerge({ ...prev, googleIdToken: parts.idToken, googleAccessToken: parts.accessToken });
  return true;
}

function stashGithubFromError(err: unknown): boolean {
  const cred = err instanceof FirebaseError ? GithubAuthProvider.credentialFromError(err) : null;
  const token = oauthParts(cred).accessToken;
  if (!token) return false;
  const prev = loadMerge() || { googleIdToken: null, googleAccessToken: null, githubAccessToken: null };
  saveMerge({ ...prev, githubAccessToken: token });
  return true;
}

function stashGithubFromResult(result: UserCredential) {
  const cred = GithubAuthProvider.credentialFromResult(result);
  const token = oauthParts(cred).accessToken;
  if (!token) return false;
  const prev = loadMerge() || { googleIdToken: null, googleAccessToken: null, githubAccessToken: null };
  saveMerge({ ...prev, githubAccessToken: token });
  return true;
}

export function rememberRedirectTo(path: string) {
  sessionStorage.setItem(REDIRECT_TO_KEY, path);
}

export function takeRememberedRedirectTo(): string | null {
  const value = sessionStorage.getItem(REDIRECT_TO_KEY);
  sessionStorage.removeItem(REDIRECT_TO_KEY);
  return value;
}

export function getPendingMergeStep(): "github" | "google" | null {
  const pending = loadMerge();
  if (!pending) return null;
  const hasGoogle = !!(pending.googleIdToken || pending.googleAccessToken);
  const hasGithub = !!pending.githubAccessToken;
  if (hasGoogle && !hasGithub) return "github";
  if (hasGithub && !hasGoogle) return "google";
  return null;
}

export async function signInWithPopupOrRedirect(auth: Auth, kind: "google" | "github") {
  const provider = kind === "github" ? githubAuthProvider() : googleAuthProvider();
  const intent: AuthIntent = kind === "github" ? "signin-github" : "signin-google";

  // Installed Store / PWA: skip popup entirely (certification failure mode).
  if (preferRedirectAuth()) {
    setIntent(intent);
    await signInWithRedirect(auth, provider);
    return null;
  }

  try {
    return await signInWithPopup(auth, provider);
  } catch (err: unknown) {
    const code = firebaseErrorCode(err);
    // User dismissed the popup — don't force a redirect.
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw err;
    }
    if (!isPopupBlocked(code)) throw err;
    setIntent(intent);
    await signInWithRedirect(auth, provider);
    return null;
  }
}

/** If GitHub email already belongs to Google, sign in with Google and attach GitHub. */
export async function linkGithubOverGoogleAccount(auth: Auth, err: unknown) {
  const code = (err as { code?: string })?.code;
  if (code !== "auth/account-exists-with-different-credential") return false;
  stashGithubFromError(err);
  const pending = err instanceof FirebaseError ? GithubAuthProvider.credentialFromError(err) : null;
  try {
    const google = await signInWithPopup(auth, googleAuthProvider());
    if (pending) {
      await linkWithCredential(google.user, pending);
    }
    clearMerge();
    return true;
  } catch (e: unknown) {
    const code = firebaseErrorCode(e);
    if (preferRedirectAuth() || isPopupBlocked(code)) {
      setIntent("signin-google");
      await signInWithRedirect(auth, googleAuthProvider());
      return true;
    }
    throw e;
  }
}

export async function startProviderLink(auth: Auth, kind: "google" | "github"): Promise<LinkMergeResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const provider = kind === "github" ? githubAuthProvider() : googleAuthProvider();
  const intent: AuthIntent = kind === "github" ? "link-github" : "link-google";

  if (preferRedirectAuth()) {
    setIntent(intent);
    await linkWithRedirect(user, provider);
    return { status: "redirecting" };
  }

  try {
    const result = await linkWithPopup(user, provider);
    return { status: "linked", user: result.user };
  } catch (err: unknown) {
    const code = firebaseErrorCode(err);
    if (isPopupBlocked(code)) {
      setIntent(intent);
      await linkWithRedirect(user, provider);
      return { status: "redirecting" };
    }
    if (code === "auth/credential-already-in-use") {
      if (kind === "google" && stashGoogleFromError(err)) {
        return { status: "needs-github-confirm" };
      }
      if (kind === "github" && stashGithubFromError(err)) {
        return { status: "needs-google-confirm" };
      }
    }
    throw err;
  }
}

export async function confirmMergeWithGithub(auth: Auth): Promise<LinkMergeResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  try {
    const reauth = await reauthenticateWithPopup(user, githubAuthProvider());
    stashGithubFromResult(reauth);
    const merged = await completeMerge(auth);
    return { status: "linked", user: merged };
  } catch (err: unknown) {
    if (!isPopupBlocked(firebaseErrorCode(err))) throw err;
    setIntent("reauth-github");
    await reauthenticateWithRedirect(user, githubAuthProvider());
    return { status: "redirecting" };
  }
}

export async function confirmMergeWithGoogle(auth: Auth): Promise<LinkMergeResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  try {
    const reauth = await reauthenticateWithPopup(user, googleAuthProvider());
    const parts = oauthParts(GoogleAuthProvider.credentialFromResult(reauth));
    const prev = loadMerge() || { googleIdToken: null, googleAccessToken: null, githubAccessToken: null };
    saveMerge({ ...prev, googleIdToken: parts.idToken, googleAccessToken: parts.accessToken });
    const merged = await completeMerge(auth);
    return { status: "linked", user: merged };
  } catch (err: unknown) {
    if (!isPopupBlocked(firebaseErrorCode(err))) throw err;
    setIntent("reauth-google");
    await reauthenticateWithRedirect(user, googleAuthProvider());
    return { status: "redirecting" };
  }
}

let redirectOutcome: LinkMergeResult | null = null;
let redirectOutcomePromise: Promise<LinkMergeResult> | null = null;

export async function consumeRedirectResult(auth: Auth): Promise<LinkMergeResult> {
  if (redirectOutcome) return redirectOutcome;
  if (!redirectOutcomePromise) {
    redirectOutcomePromise = consumeRedirectResultImpl(auth).then((result) => {
      redirectOutcome = result;
      return result;
    });
  }
  return redirectOutcomePromise;
}

async function consumeRedirectResultImpl(auth: Auth): Promise<LinkMergeResult> {
  await auth.authStateReady();
  const peekIntent = typeof window !== "undefined" ? (sessionStorage.getItem(INTENT_KEY) as AuthIntent | null) : null;

  try {
    const result = await getRedirectResult(auth);
    const intent = takeIntent();

    if (intent === "reauth-github" && result) {
      stashGithubFromResult(result);
      const merged = await completeMerge(auth);
      return { status: "linked", user: merged };
    }
    if (intent === "reauth-google" && result) {
      const parts = oauthParts(GoogleAuthProvider.credentialFromResult(result));
      const prev = loadMerge() || { googleIdToken: null, googleAccessToken: null, githubAccessToken: null };
      saveMerge({ ...prev, googleIdToken: parts.idToken, googleAccessToken: parts.accessToken });
      const merged = await completeMerge(auth);
      return { status: "linked", user: merged };
    }
    if (
      (intent === "reauth-session-google" || intent === "reauth-session-github") &&
      result
    ) {
      return { status: "reauthed", user: result.user };
    }

    if (result && auth.currentUser) {
      const pending = loadMerge();
      const githubCred = pending ? githubFromStored(pending) : null;
      const ids = providerIds(auth.currentUser);
      if (githubCred && ids.includes("google.com") && !ids.includes("github.com")) {
        try {
          const linked = await linkWithCredential(auth.currentUser, githubCred);
          clearMerge();
          return { status: "linked", user: linked.user };
        } catch (linkErr: unknown) {
          if (firebaseErrorCode(linkErr) === "auth/credential-already-in-use") {
            const parts = oauthParts(GoogleAuthProvider.credentialFromResult(result));
            saveMerge({
              googleIdToken: parts.idToken,
              googleAccessToken: parts.accessToken,
              githubAccessToken: pending?.githubAccessToken ?? null,
            });
            const merged = await completeMerge(auth);
            return { status: "linked", user: merged };
          }
          throw linkErr;
        }
      }
      return { status: "linked", user: result.user };
    }

    const step = getPendingMergeStep();
    if (step === "github") return { status: "needs-github-confirm" };
    if (step === "google") return { status: "needs-google-confirm" };
    return { status: "none" };
  } catch (err: unknown) {
    const intent = takeIntent() || peekIntent;
    const code = firebaseErrorCode(err);
    if (code === "auth/credential-already-in-use") {
      if (intent === "link-github" || intent === "signin-github") {
        stashGithubFromError(err);
        return { status: "needs-google-confirm" };
      }
      stashGoogleFromError(err);
      return { status: "needs-github-confirm" };
    }
    return { status: "error", code: code || null };
  }
}

async function attachGithub(user: User, githubCred: AuthCredential): Promise<User> {
  const linked = await linkWithCredential(user, githubCred);
  return linked.user;
}

async function completeMerge(auth: Auth): Promise<User> {
  const pending = loadMerge();
  const current = auth.currentUser;
  if (!pending || !current) {
    throw new Error("Missing accounts to merge.");
  }
  const googleCred = googleFromStored(pending);
  const githubCred = githubFromStored(pending);
  if (!googleCred || !githubCred) {
    throw new Error("Missing Google or GitHub credential to merge.");
  }

  const ids = providerIds(current);

  // Google is the surviving identity - never delete Auth users.
  if (ids.includes("google.com")) {
    try {
      const linked = await attachGithub(current, githubCred);
      clearMerge();
      return linked;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/credential-already-in-use" || code === "auth/provider-already-linked") {
        clearMerge();
        throw new Error(
          "This GitHub account is already linked to another user. Sign in with Google and link GitHub from Profile.",
        );
      }
      throw err;
    }
  }

  if (ids.includes("github.com")) {
    // Switch to Google without deleting the GitHub Auth user (may leave an orphan).
    const googleSignIn = await signInWithCredential(auth, googleCred);
    try {
      const linked = await attachGithub(googleSignIn.user, githubCred);
      clearMerge();
      return linked;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/credential-already-in-use" || code === "auth/provider-already-linked") {
        clearMerge();
        throw new Error(
          "Could not link GitHub onto this Google account. Sign in with Google first, then link GitHub from Profile.",
        );
      }
      throw err;
    }
  }

  throw new Error(
    "Could not merge these accounts. Sign in with Google first, then link GitHub from Profile.",
  );
}

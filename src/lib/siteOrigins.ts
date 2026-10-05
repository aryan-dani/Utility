/** Canonical custom domain (blocked on some campus networks). */
export const CANONICAL_HOST = "utilityos.tech";
export const CANONICAL_WWW_HOST = "www.utilityos.tech";

/**
 * Vercel production host — first-visit fallback when the custom domain
 * cannot load JS (college Wi-Fi). Authorized for same-origin Firebase Auth.
 */
export const CAMPUS_HOST = "planner-flax-six.vercel.app";

export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
export const CANONICAL_WWW_ORIGIN = `https://${CANONICAL_WWW_HOST}`;
export const CAMPUS_ORIGIN = `https://${CAMPUS_HOST}`;

/**
 * Origins the installed PWA / Store shell should treat as one app.
 * Apex 308s to www; campus Wi-Fi hops to the Vercel host. Without
 * scope_extensions, Edge draws an out-of-scope tab + URL bar.
 */
export const PWA_SCOPE_ORIGINS = [
  CANONICAL_ORIGIN,
  CANONICAL_WWW_ORIGIN,
  CAMPUS_ORIGIN,
] as const;

export type PwaScopeExtension = {
  type: "origin";
  origin: string;
};

export function pwaScopeExtensions(): PwaScopeExtension[] {
  return PWA_SCOPE_ORIGINS.map((origin) => ({ type: "origin", origin }));
}

/** `/.well-known/web-app-origin-association` — keys are resolved manifest ids. */
export function webAppOriginAssociation(): Record<string, { scope: string }> {
  return Object.fromEntries(
    PWA_SCOPE_ORIGINS.map((origin) => [`${origin}/`, { scope: "/" }]),
  );
}

export const SAME_ORIGIN_AUTH_HOSTS = [
  CANONICAL_HOST,
  CANONICAL_WWW_HOST,
  CAMPUS_HOST,
] as const;

export function isCanonicalHost(host: string): boolean {
  return host === CANONICAL_HOST || host === CANONICAL_WWW_HOST;
}

export function isCampusHost(host: string): boolean {
  return host === CAMPUS_HOST;
}

export function isSameOriginAuthHost(host: string): boolean {
  return (
    host === CANONICAL_HOST ||
    host === CANONICAL_WWW_HOST ||
    host === CAMPUS_HOST
  );
}

/**
 * Prefer the current host for /__/auth only when same-origin OAuth is required
 * (installed PWA / Store WebView). Normal browser tabs use firebaseapp.com so
 * the Firebase helper scripts never ride the Vercel rewrite (Fast Origin Transfer).
 *
 * `firebaseAppAuthDomain` should be `<project>.firebaseapp.com`. When the env
 * still points at a site host (legacy Store setup), pass that fallback so
 * desktop does not keep proxying through Vercel.
 */
export function resolveClientAuthDomain(
  host: string,
  fromEnv: string,
  preferSameOriginAuth = false,
  firebaseAppAuthDomain?: string,
): string {
  if (preferSameOriginAuth && isSameOriginAuthHost(host)) return host;
  if (firebaseAppAuthDomain && isSameOriginAuthHost(fromEnv)) {
    return firebaseAppAuthDomain;
  }
  return fromEnv;
}

/** Static reachability probe — no Function, no origin transfer. */
export const ORIGIN_PROBE_PATH = "/ok.txt";

export function campusFallbackUrl(
  pathname: string,
  search = "",
  hash = "",
): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${CAMPUS_ORIGIN}${path}${search}${hash}`;
}

export const ORIGIN_PROBE_OK_KEY = "uo-origin-ok";
export const ORIGIN_HOP_REQUESTED_KEY = "uo-origin-hop";
/** Fast failure window — timeout alone must not hop (page may already be live). */
export const ORIGIN_PROBE_TIMEOUT_MS = 1500;

export function shouldProbeCanonicalOrigin(hostname: string): boolean {
  return isCanonicalHost(hostname);
}

/**
 * Hop to the Vercel campus host when the custom domain cannot load.
 * `originOk` is the result of this load's /ok.txt probe (not a session cache).
 */
export function shouldRequestCampusHop(
  hostname: string,
  originOk: boolean,
  hopRequested: boolean,
): boolean {
  return shouldProbeCanonicalOrigin(hostname) && !originOk && !hopRequested;
}

/** Service worker / offline page: online on the blocked host → campus. */
export function shouldCampusHopOnNavigateFailure(
  hostname: string,
  online: boolean,
): boolean {
  return isCanonicalHost(hostname) && online;
}

export function isCatalogNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

export function markOriginHealthy(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ORIGIN_PROBE_OK_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** One replace per tab session after a failed probe. Canonical hosts only. */
export function requestCampusHop(): boolean {
  if (typeof window === "undefined") return false;

  let hopRequested = false;
  try {
    hopRequested = sessionStorage.getItem(ORIGIN_HOP_REQUESTED_KEY) === "1";
  } catch {
    /* private mode */
  }

  // This load already failed the probe; do not skip for a prior ORIGIN_PROBE_OK.
  if (!shouldRequestCampusHop(window.location.hostname, false, hopRequested)) {
    return false;
  }

  try {
    sessionStorage.setItem(ORIGIN_HOP_REQUESTED_KEY, "1");
  } catch {
    /* ignore */
  }

  window.location.replace(
    campusFallbackUrl(
      window.location.pathname,
      window.location.search,
      window.location.hash,
    ),
  );
  return true;
}

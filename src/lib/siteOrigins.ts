/** Canonical custom domain (blocked on some campus networks). */
export const CANONICAL_HOST = "utilityos.tech";
export const CANONICAL_WWW_HOST = "www.utilityos.tech";

/**
 * Vercel production host — first-visit fallback when the custom domain
 * cannot load JS (college Wi-Fi). Authorized for same-origin Firebase Auth.
 */
export const CAMPUS_HOST = "planner-flax-six.vercel.app";

export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
export const CAMPUS_ORIGIN = `https://${CAMPUS_HOST}`;

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

/** Prefer the current host for /__/auth when it is a trusted app origin. */
export function resolveClientAuthDomain(host: string, fromEnv: string): string {
  if (isSameOriginAuthHost(host)) return host;
  return fromEnv;
}

export function campusFallbackUrl(
  pathname: string,
  search = "",
  hash = "",
): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${CAMPUS_ORIGIN}${path}${search}${hash}`;
}

export const ORIGIN_PROBE_OK_KEY = "uo-origin-ok";
export const ORIGIN_PROBE_TIMEOUT_MS = 4000;

export function shouldProbeCanonicalOrigin(hostname: string): boolean {
  return isCanonicalHost(hostname);
}

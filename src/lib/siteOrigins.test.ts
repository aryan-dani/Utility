import { describe, expect, it } from "vitest";
import {
  CAMPUS_HOST,
  CAMPUS_ORIGIN,
  CANONICAL_ORIGIN,
  CANONICAL_WWW_ORIGIN,
  campusFallbackUrl,
  isCanonicalHost,
  isCampusHost,
  isSameOriginAuthHost,
  pwaScopeExtensions,
  resolveClientAuthDomain,
  shouldCampusHopOnNavigateFailure,
  shouldProbeCanonicalOrigin,
  shouldRequestCampusHop,
  webAppOriginAssociation,
} from "./siteOrigins";

describe("siteOrigins", () => {
  it("treats utilityos.tech and www as canonical", () => {
    expect(isCanonicalHost("utilityos.tech")).toBe(true);
    expect(isCanonicalHost("www.utilityos.tech")).toBe(true);
    expect(isCanonicalHost(CAMPUS_HOST)).toBe(false);
    expect(isCanonicalHost("localhost")).toBe(false);
  });

  it("recognizes the campus Vercel host", () => {
    expect(isCampusHost(CAMPUS_HOST)).toBe(true);
    expect(isSameOriginAuthHost(CAMPUS_HOST)).toBe(true);
    expect(isSameOriginAuthHost("utilityos.tech")).toBe(true);
    expect(isSameOriginAuthHost("preview.vercel.app")).toBe(false);
  });

  it("uses the current host as authDomain only when same-origin OAuth is preferred", () => {
    expect(
      resolveClientAuthDomain(CAMPUS_HOST, "from-env.firebaseapp.com", true),
    ).toBe(CAMPUS_HOST);
    expect(
      resolveClientAuthDomain("utilityos.tech", "from-env.firebaseapp.com", true),
    ).toBe("utilityos.tech");
    expect(
      resolveClientAuthDomain("utilityos.tech", "from-env.firebaseapp.com", false),
    ).toBe("from-env.firebaseapp.com");
    expect(
      resolveClientAuthDomain("localhost", "from-env.firebaseapp.com", true),
    ).toBe("from-env.firebaseapp.com");
    // Legacy env set to the site host → desktop falls back to firebaseapp.com.
    expect(
      resolveClientAuthDomain(
        "utilityos.tech",
        "utilityos.tech",
        false,
        "proj.firebaseapp.com",
      ),
    ).toBe("proj.firebaseapp.com");
    expect(
      resolveClientAuthDomain(
        "utilityos.tech",
        "utilityos.tech",
        true,
        "proj.firebaseapp.com",
      ),
    ).toBe("utilityos.tech");
  });

  it("builds a campus fallback URL and only probes the custom domain", () => {
    expect(campusFallbackUrl("/clipboard", "?x=1", "#top")).toBe(
      `${CAMPUS_ORIGIN}/clipboard?x=1#top`,
    );
    expect(shouldProbeCanonicalOrigin("utilityos.tech")).toBe(true);
    expect(shouldProbeCanonicalOrigin(CAMPUS_HOST)).toBe(false);
    expect(shouldProbeCanonicalOrigin("localhost")).toBe(false);
    expect(shouldRequestCampusHop("www.utilityos.tech", false, false)).toBe(true);
    expect(shouldRequestCampusHop("utilityos.tech", true, false)).toBe(false);
    expect(shouldRequestCampusHop("utilityos.tech", false, true)).toBe(false);
    expect(shouldRequestCampusHop(CAMPUS_HOST, false, false)).toBe(false);
  });

  it("hops to campus when navigate fails while online on the custom domain", () => {
    expect(shouldCampusHopOnNavigateFailure("utilityos.tech", true)).toBe(true);
    expect(shouldCampusHopOnNavigateFailure("www.utilityos.tech", true)).toBe(
      true,
    );
    expect(shouldCampusHopOnNavigateFailure("utilityos.tech", false)).toBe(
      false,
    );
    expect(shouldCampusHopOnNavigateFailure(CAMPUS_HOST, true)).toBe(false);
    expect(shouldCampusHopOnNavigateFailure("localhost", true)).toBe(false);
  });

  it("lists apex, www, and campus as PWA scope extensions", () => {
    const origins = pwaScopeExtensions().map((entry) => entry.origin);
    expect(origins).toEqual([
      CANONICAL_ORIGIN,
      CANONICAL_WWW_ORIGIN,
      CAMPUS_ORIGIN,
    ]);
    expect(webAppOriginAssociation()).toEqual({
      [`${CANONICAL_ORIGIN}/`]: { scope: "/" },
      [`${CANONICAL_WWW_ORIGIN}/`]: { scope: "/" },
      [`${CAMPUS_ORIGIN}/`]: { scope: "/" },
    });
  });
});

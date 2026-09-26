import { describe, expect, it } from "vitest";
import {
  CAMPUS_HOST,
  CAMPUS_ORIGIN,
  campusFallbackUrl,
  isCanonicalHost,
  isCampusHost,
  isSameOriginAuthHost,
  resolveClientAuthDomain,
  shouldProbeCanonicalOrigin,
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

  it("uses the current host as authDomain on trusted origins", () => {
    expect(resolveClientAuthDomain(CAMPUS_HOST, "from-env.firebaseapp.com")).toBe(
      CAMPUS_HOST,
    );
    expect(
      resolveClientAuthDomain("utilityos.tech", "from-env.firebaseapp.com"),
    ).toBe("utilityos.tech");
    expect(
      resolveClientAuthDomain("localhost", "from-env.firebaseapp.com"),
    ).toBe("from-env.firebaseapp.com");
  });

  it("builds a campus fallback URL and only probes the custom domain", () => {
    expect(campusFallbackUrl("/clipboard", "?x=1", "#top")).toBe(
      `${CAMPUS_ORIGIN}/clipboard?x=1#top`,
    );
    expect(shouldProbeCanonicalOrigin("utilityos.tech")).toBe(true);
    expect(shouldProbeCanonicalOrigin(CAMPUS_HOST)).toBe(false);
    expect(shouldProbeCanonicalOrigin("localhost")).toBe(false);
  });
});

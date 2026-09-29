import { describe, expect, it } from "vitest";
import {
  decideOfflineNavigation,
  offlineWarmStorageKey,
  shouldBypassCampusNavigation,
  shouldWarmOfflineShell,
} from "./offlineNavigation";

describe("decideOfflineNavigation", () => {
  it("serves a cached document before hopping or going offline", () => {
    expect(
      decideOfflineNavigation({ hasCachedDocument: true, online: true }),
    ).toBe("use-cache");
    expect(
      decideOfflineNavigation({ hasCachedDocument: true, online: false }),
    ).toBe("use-cache");
  });

  it("hops to campus only when online and nothing is cached", () => {
    expect(
      decideOfflineNavigation({ hasCachedDocument: false, online: true }),
    ).toBe("campus-hop");
  });

  it("stays on the offline page when offline and uncached", () => {
    expect(
      decideOfflineNavigation({ hasCachedDocument: false, online: false }),
    ).toBe("offline-page");
  });
});

describe("shouldBypassCampusNavigation", () => {
  it("leaves Firebase Auth and login/signup to NetworkOnly", () => {
    expect(shouldBypassCampusNavigation("/__/auth/handler")).toBe(true);
    expect(shouldBypassCampusNavigation("/__/auth")).toBe(true);
    expect(shouldBypassCampusNavigation("/__/auth/iframe")).toBe(true);
    expect(shouldBypassCampusNavigation("/login")).toBe(true);
    expect(shouldBypassCampusNavigation("/signup")).toBe(true);
  });

  it("still handles normal app documents", () => {
    expect(shouldBypassCampusNavigation("/planner")).toBe(false);
    expect(shouldBypassCampusNavigation("/")).toBe(false);
    expect(shouldBypassCampusNavigation("/login/extra")).toBe(false);
  });
});

describe("offline shell warm", () => {
  it("keys warm state to the controlling service worker URL", () => {
    expect(offlineWarmStorageKey("https://utilityos.tech/sw.js")).toBe(
      "utility-offline-warm:https://utilityos.tech/sw.js",
    );
  });

  it("warms once per worker URL", () => {
    expect(shouldWarmOfflineShell("https://x/sw.js", false)).toBe(true);
    expect(shouldWarmOfflineShell("https://x/sw.js", true)).toBe(false);
    expect(shouldWarmOfflineShell(null, false)).toBe(false);
  });
});

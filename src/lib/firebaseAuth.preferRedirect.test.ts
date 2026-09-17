import { afterEach, describe, expect, it, vi } from "vitest";
import { preferRedirectAuth } from "@/lib/firebaseAuth";

describe("preferRedirectAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is true for standalone display mode", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q.includes("standalone"),
      }),
      chrome: undefined,
      Windows: undefined,
    });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0", standalone: false });
    expect(preferRedirectAuth()).toBe(true);
  });

  it("is true for chrome.webview (PWABuilder)", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      chrome: { webview: {} },
      Windows: undefined,
    });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0", standalone: false });
    expect(preferRedirectAuth()).toBe(true);
  });

  it("is true for Microsoft Edge WebView2 userAgentData brands", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      chrome: undefined,
      Windows: undefined,
    });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0",
      standalone: false,
      userAgentData: {
        brands: [
          { brand: "Chromium", version: "120" },
          { brand: "Microsoft Edge WebView2", version: "120" },
        ],
      },
    });
    expect(preferRedirectAuth()).toBe(true);
  });

  it("is false in a normal browser tab", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      chrome: undefined,
      Windows: undefined,
    });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
      standalone: false,
    });
    expect(preferRedirectAuth()).toBe(false);
  });
});

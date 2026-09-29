import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_INTENT_KEY,
  peekPendingSignInProvider,
} from "./firebaseAuth";

describe("peekPendingSignInProvider", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
    vi.stubGlobal("window", { sessionStorage: globalThis.sessionStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns google when signin-google intent is stored", () => {
    sessionStorage.setItem(AUTH_INTENT_KEY, "signin-google");
    expect(peekPendingSignInProvider()).toBe("google");
  });

  it("returns github when signin-github intent is stored", () => {
    sessionStorage.setItem(AUTH_INTENT_KEY, "signin-github");
    expect(peekPendingSignInProvider()).toBe("github");
  });

  it("returns null for other intents or empty storage", () => {
    expect(peekPendingSignInProvider()).toBe(null);
    sessionStorage.setItem(AUTH_INTENT_KEY, "link-google");
    expect(peekPendingSignInProvider()).toBe(null);
  });

  it("reads utility.auth.pendingUi after intent was cleared", () => {
    sessionStorage.setItem("utility.auth.pendingUi", "google");
    expect(peekPendingSignInProvider()).toBe("google");
    sessionStorage.setItem("utility.auth.pendingUi", "github");
    expect(peekPendingSignInProvider()).toBe("github");
  });
});

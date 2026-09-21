import { describe, it, expect } from "vitest";
import { decideWaitingWorkerAction } from "./updatePolicy";
import { isOfflineShellTitle, OFFLINE_SHELL_TITLE } from "./offlineShell";

describe("decideWaitingWorkerAction", () => {
  const base = {
    hasController: true,
    isVisible: true,
    wasWaitingOnLoad: false,
    dismissedThisSession: false,
    updateInFlight: false,
    forceRecovery: false,
  };

  it("silent-applies when waiting worker was already present on load (cold start)", () => {
    expect(
      decideWaitingWorkerAction({ ...base, wasWaitingOnLoad: true }),
    ).toBe("silent");
  });

  it("silent-applies when the tab is not visible", () => {
    expect(decideWaitingWorkerAction({ ...base, isVisible: false })).toBe(
      "silent",
    );
  });

  it("silent-applies on first SW install (no controller)", () => {
    expect(decideWaitingWorkerAction({ ...base, hasController: false })).toBe(
      "silent",
    );
  });

  it("toasts when controlled + visible + new install this session", () => {
    expect(decideWaitingWorkerAction(base)).toBe("toast");
  });

  it("skips toast when user dismissed Later this session", () => {
    expect(
      decideWaitingWorkerAction({ ...base, dismissedThisSession: true }),
    ).toBe("skip");
  });

  it("skips when an update is already in flight", () => {
    expect(decideWaitingWorkerAction({ ...base, updateInFlight: true })).toBe(
      "skip",
    );
  });

  it("force-recovers with silent even if dismissed", () => {
    expect(
      decideWaitingWorkerAction({
        ...base,
        dismissedThisSession: true,
        forceRecovery: true,
      }),
    ).toBe("silent");
  });

  it("prefers silent cold-start over toast even when visible", () => {
    expect(
      decideWaitingWorkerAction({
        ...base,
        wasWaitingOnLoad: true,
        isVisible: true,
      }),
    ).toBe("silent");
  });
});

describe("isOfflineShellTitle", () => {
  it("matches the exact offline page title", () => {
    expect(isOfflineShellTitle(OFFLINE_SHELL_TITLE)).toBe(true);
  });

  it("matches case-insensitive variants", () => {
    expect(isOfflineShellTitle("You're Offline")).toBe(true);
    expect(isOfflineShellTitle("  you're offline  ")).toBe(true);
  });

  it("rejects unrelated titles", () => {
    expect(isOfflineShellTitle("Utility")).toBe(false);
    expect(isOfflineShellTitle(null)).toBe(false);
  });
});

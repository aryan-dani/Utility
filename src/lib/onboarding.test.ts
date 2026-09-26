import { describe, expect, it } from "vitest";
import { onboardingKindFromCreatedAt } from "./onboarding";

describe("onboardingKindFromCreatedAt", () => {
  const now = Date.parse("2026-09-26T10:00:00.000Z");

  it("treats a brand-new account as a new user", () => {
    expect(
      onboardingKindFromCreatedAt("2026-09-26T09:50:00.000Z", now),
    ).toBe("new");
  });

  it("treats an account older than 36 hours as returning", () => {
    expect(
      onboardingKindFromCreatedAt("2026-09-24T09:00:00.000Z", now),
    ).toBe("returning");
  });

  it("defaults missing or invalid dates to new", () => {
    expect(onboardingKindFromCreatedAt(null, now)).toBe("new");
    expect(onboardingKindFromCreatedAt("not-a-date", now)).toBe("new");
  });
});

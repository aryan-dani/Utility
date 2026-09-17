import { describe, expect, it } from "vitest";
import { describeError, getFriendlyErrorMessage } from "@/lib/errors";

describe("describeError", () => {
  it("maps auth codes to friendly messages", () => {
    expect(describeError({ code: "auth/invalid-email" })).toBe(
      "The email address is not formatted correctly.",
    );
    expect(describeError({ code: "auth/wrong-password" })).toBe(
      "Incorrect email or password. If you are new, tap Create account first.",
    );
    expect(describeError({ code: "auth/email-already-in-use" })).toBe(
      "An account with this email address already exists.",
    );
    expect(describeError({ code: "auth/network-request-failed" })).toBe(
      "A network error occurred. Please check your internet connection.",
    );
  });

  it("maps permission-denied", () => {
    expect(describeError({ code: "permission-denied" })).toBe(
      "You do not have permission to do that.",
    );
    expect(describeError({ code: "firestore/permission-denied" })).toBe(
      "You do not have permission to do that.",
    );
  });

  it("maps unavailable", () => {
    expect(describeError({ code: "unavailable" })).toBe(
      "Service is temporarily unavailable. Try again shortly.",
    );
    expect(describeError({ code: "firestore/unavailable" })).toBe(
      "Service is temporarily unavailable. Try again shortly.",
    );
  });

  it("maps TypeError network failures", () => {
    expect(describeError(new TypeError("Failed to fetch"))).toBe(
      "A network error occurred. Please check your internet connection.",
    );
  });

  it("uses custom fallback and never returns raw SDK text", () => {
    const err = new Error("SECRET_SDK_TEXT");
    expect(describeError(err, "Custom fallback")).toBe("Custom fallback");
    expect(describeError(err)).not.toContain("SECRET_SDK_TEXT");
    expect(describeError(err)).toBe("Something went wrong. Try again.");
  });
});

describe("getFriendlyErrorMessage", () => {
  it("maps a code string", () => {
    expect(getFriendlyErrorMessage("auth/weak-password")).toBe(
      "The password is too weak. Please use at least 6 characters.",
    );
  });
});

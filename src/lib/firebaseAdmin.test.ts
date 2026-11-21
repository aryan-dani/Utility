import { afterEach, describe, expect, it } from "vitest";
import { hasFirebaseCredentials } from "./firebaseAdmin";

const KEYS = [
  "FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

const snapshot = Object.fromEntries(
  KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof KEYS)[number], string | undefined>;

afterEach(() => {
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
});

describe("hasFirebaseCredentials", () => {
  it("rejects the ci:build private-key sentinel", () => {
    process.env.FIREBASE_PROJECT_ID = "placeholder";
    process.env.FIREBASE_CLIENT_EMAIL = "ci@placeholder.local";
    process.env.FIREBASE_PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";
    expect(hasFirebaseCredentials()).toBe(false);
  });

  it("accepts a non-placeholder service account", () => {
    process.env.FIREBASE_PROJECT_ID = "utility-prod";
    process.env.FIREBASE_CLIENT_EMAIL = "svc@utility-prod.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n";
    expect(hasFirebaseCredentials()).toBe(true);
  });
});

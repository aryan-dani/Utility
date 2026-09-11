import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { verifyIdToken } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock("@/lib/firebaseAdmin", () => ({
  adminAuth: () => ({ verifyIdToken }),
}));

import {
  getAdminEmails,
  isAuthFailure,
  requireUser,
  requireAdmin,
  requireRecentUser,
} from "@/lib/apiAuth";

describe("getAdminEmails", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
  });

  it("parses comma-separated emails trimmed and lowercased", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.com ,  ";
    expect(getAdminEmails()).toEqual(["admin@example.com"]);
  });

  it("returns empty array when unset", () => {
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
  });
});

describe("isAuthFailure", () => {
  it("returns true for NextResponse", () => {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    expect(isAuthFailure(res)).toBe(true);
  });

  it("returns false for AuthedUser", () => {
    expect(isAuthFailure({ uid: "u1", email: "a@b.com", authTime: 1 })).toBe(
      false,
    );
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it("returns 401 without bearer token", async () => {
    const res = await requireUser(new Request("http://localhost/api"));
    expect(isAuthFailure(res)).toBe(true);
    if (isAuthFailure(res)) expect(res.status).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("bad token"));
    const res = await requireUser(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer bad" },
      }),
    );
    expect(isAuthFailure(res)).toBe(true);
    if (isAuthFailure(res)) expect(res.status).toBe(401);
  });

  it("returns user on success", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "u1",
      email: "user@example.com",
    });
    const result = await requireUser(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer good" },
      }),
    );
    expect(isAuthFailure(result)).toBe(false);
    expect(result).toEqual({
      uid: "u1",
      email: "user@example.com",
      authTime: 0,
    });
  });
});

describe("requireRecentUser", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it("returns 401 with requires-recent-login when auth_time is stale", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "u1",
      email: "user@example.com",
      auth_time: Math.floor(Date.now() / 1000) - 10 * 60,
    });
    const res = await requireRecentUser(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer good" },
      }),
    );
    expect(isAuthFailure(res)).toBe(true);
    if (isAuthFailure(res)) {
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({
        code: "requires-recent-login",
      });
    }
  });

  it("returns user when auth_time is recent", async () => {
    const authTime = Math.floor(Date.now() / 1000) - 30;
    verifyIdToken.mockResolvedValueOnce({
      uid: "u1",
      email: "user@example.com",
      auth_time: authTime,
    });
    const result = await requireRecentUser(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer good" },
      }),
    );
    expect(isAuthFailure(result)).toBe(false);
    expect(result).toEqual({
      uid: "u1",
      email: "user@example.com",
      authTime,
    });
  });
});

describe("requireAdmin", () => {
  const original = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    verifyIdToken.mockReset();
    process.env.ADMIN_EMAILS = "admin@example.com";
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
  });

  it("returns 403 when email is not in ADMIN_EMAILS", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "u1",
      email: "user@example.com",
    });
    const res = await requireAdmin(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer good" },
      }),
    );
    expect(isAuthFailure(res)).toBe(true);
    if (isAuthFailure(res)) expect(res.status).toBe(403);
  });

  it("returns user when admin", async () => {
    verifyIdToken.mockResolvedValueOnce({
      uid: "a1",
      email: "Admin@Example.com",
    });
    const result = await requireAdmin(
      new Request("http://localhost/api", {
        headers: { Authorization: "Bearer good" },
      }),
    );
    expect(isAuthFailure(result)).toBe(false);
    expect(result).toEqual({
      uid: "a1",
      email: "Admin@Example.com",
      authTime: 0,
    });
  });
});

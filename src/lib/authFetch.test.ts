import { describe, expect, it, vi, beforeEach } from "vitest";

const { getIdToken } = vi.hoisted(() => ({
  getIdToken: vi.fn(),
}));

vi.mock("@/lib/firebase/auth", () => ({
  auth: {
    currentUser: {
      getIdToken,
    },
  },
}));

import { authFetch } from "@/lib/authFetch";

describe("authFetch", () => {
  beforeEach(() => {
    getIdToken.mockReset();
    getIdToken.mockResolvedValue("token-1");
    vi.unstubAllGlobals();
  });

  it("retries once with a refreshed token on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await authFetch("/api/test");
    expect(res.status).toBe(200);
    expect(getIdToken).toHaveBeenCalledTimes(2);
    expect(getIdToken).toHaveBeenNthCalledWith(1);
    expect(getIdToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = fetchMock.mock.calls[1][1]?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer token-1");
  });

  it("returns the 401 response when refresh fails", async () => {
    const unauthorized = new Response(null, { status: 401 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(unauthorized));
    getIdToken
      .mockResolvedValueOnce("token-1")
      .mockRejectedValueOnce(new Error("refresh failed"));

    const res = await authFetch("/api/test");
    expect(res.status).toBe(401);
  });
});

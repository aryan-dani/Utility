import { describe, expect, it, vi, beforeEach } from "vitest";

const { utilityFetchMock, authFetchMock } = vi.hoisted(() => ({
  utilityFetchMock: vi.fn(),
  authFetchMock: vi.fn(),
}));

vi.mock("@/lib/utilityServer", () => ({
  utilityFetch: utilityFetchMock,
}));

vi.mock("@/lib/authFetch", () => ({
  authFetch: authFetchMock,
}));

import { homeOrVercelJson, homePayloadIsEmpty } from "./homeApi";

describe("homePayloadIsEmpty", () => {
  it("treats an empty doubt board as a miss so Firestore can answer", () => {
    expect(homePayloadIsEmpty("/v1/qa/questions", { questions: [] })).toBe(true);
    expect(
      homePayloadIsEmpty("/v1/qa/questions", { questions: [{ id: "1" }] }),
    ).toBe(false);
  });

  it("treats a never-written clipboard as a miss", () => {
    expect(homePayloadIsEmpty("/v1/clipboard", { text: "", updated_at: null })).toBe(
      true,
    );
    expect(
      homePayloadIsEmpty("/v1/clipboard", { text: "hi", updated_at: "2026-01-01" }),
    ).toBe(false);
  });
});

describe("homeOrVercelJson", () => {
  beforeEach(() => {
    utilityFetchMock.mockReset();
    authFetchMock.mockReset();
  });

  it("forwards 401 and 403 responses from home server without falling back to Vercel", async () => {
    for (const status of [401, 403] as const) {
      utilityFetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Denied" }), { status }),
      );
      const res = await homeOrVercelJson("/api/planner?month=1&year=2026");
      expect(res.status).toBe(status);
      expect(authFetchMock).not.toHaveBeenCalled();
    }
  });
});

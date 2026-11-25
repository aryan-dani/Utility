import { describe, expect, it } from "vitest";
import { resolveUploadOrigin } from "@/lib/adminDriveServer";

describe("resolveUploadOrigin", () => {
  it("accepts allowlisted origins including the campus mirror", () => {
    expect(
      resolveUploadOrigin(
        new Request("https://utilityos.tech/api/admin/drive/session", {
          headers: { origin: "https://utilityos.tech", host: "utilityos.tech" },
        }),
      ),
    ).toBe("https://utilityos.tech");

    expect(
      resolveUploadOrigin(
        new Request("https://planner-flax-six.vercel.app/api/admin/drive/session", {
          headers: {
            origin: "https://planner-flax-six.vercel.app",
            host: "planner-flax-six.vercel.app",
          },
        }),
      ),
    ).toBe("https://planner-flax-six.vercel.app");
  });

  it("rejects explicitly disallowed Origin headers even when Host is trusted", () => {
    expect(
      resolveUploadOrigin(
        new Request("https://utilityos.tech/api/admin/drive/session", {
          headers: {
            origin: "https://evil.example",
            host: "utilityos.tech",
          },
        }),
      ),
    ).toBeNull();
  });

  it("falls back to trusted Host only when Origin is absent", () => {
    expect(
      resolveUploadOrigin(
        new Request("https://utilityos.tech/api/admin/drive/session", {
          headers: { host: "utilityos.tech" },
        }),
      ),
    ).toBe("https://utilityos.tech");

    expect(
      resolveUploadOrigin(
        new Request("http://localhost:3000/api/admin/drive/session", {
          headers: { host: "localhost:3000" },
        }),
      ),
    ).toBe("http://localhost:3000");

    expect(
      resolveUploadOrigin(
        new Request("http://localhost/api/admin/drive/session", {
          headers: { host: "localhost:evil" },
        }),
      ),
    ).toBeNull();
  });
});

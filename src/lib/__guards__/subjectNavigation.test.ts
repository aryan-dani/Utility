import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../..");

describe("subject navigation stability", () => {
  it("updates subject URLs without router remounting", () => {
    const source = readFileSync(
      join(ROOT, "src/components/ResourcesClient.tsx"),
      "utf8",
    );
    expect(source).not.toContain("useRouter");
    expect(source).not.toContain("router.replace(");
    expect(source).toContain("window.history.replaceState");
  });

  it("holds the user menu in a resolving state", () => {
    const source = readFileSync(
      join(ROOT, "src/components/NavUserMenu.tsx"),
      "utf8",
    );
    expect(source).toContain("authResolved");
    expect(source).toContain("Loading account");
  });
});

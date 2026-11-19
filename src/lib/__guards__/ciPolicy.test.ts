import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../../");

describe("CI policy", () => {
  it("uses current action generations and Node 24", () => {
    const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const storage = readFileSync(
      join(ROOT, ".github/workflows/storage-sync.yml"),
      "utf8",
    );

    expect(ci).toContain("actions/checkout@v5");
    expect(ci).toContain("actions/setup-node@v6");
    expect(ci).toContain('node-version: "24"');
    expect(storage).toContain("actions/checkout@v5");
    expect(storage).toContain("actions/setup-node@v6");
  });

  it("audits both dependency trees and blocks moderate vulnerabilities", () => {
    const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("npm audit --audit-level=moderate");
    expect(ci).toContain(
      "npm audit --prefix server --audit-level=moderate",
    );
  });

  it("keeps storage revalidation non-blocking", () => {
    const workflow = readFileSync(
      join(ROOT, ".github/workflows/storage-sync.yml"),
      "utf8",
    );
    expect(workflow).toContain(
      'TARGET_URL="https://utilityos.tech/api/webhooks/revalidate-content"',
    );
    expect(workflow).toContain(
      'echo "Storage sync completed; cache revalidation is non-blocking."',
    );
  });
});

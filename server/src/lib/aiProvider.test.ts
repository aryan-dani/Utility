import { describe, expect, it } from "vitest";
import { isBedrockConfigured, resolveServerAiProvider } from "./aiProvider.js";

describe("server aiProvider", () => {
  it("picks bedrock when AI_PROVIDER=bedrock and AWS credentials exist", () => {
    expect(
      resolveServerAiProvider({
        AI_PROVIDER: "bedrock",
        AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
        AWS_SECRET_ACCESS_KEY: "secret",
      }),
    ).toBe("bedrock");
  });

  it("falls back to groq when AI_PROVIDER=bedrock without AWS credentials", () => {
    expect(
      resolveServerAiProvider({
        AI_PROVIDER: "bedrock",
        GROQ_API_KEY: "gsk_test",
      }),
    ).toBe("groq");
  });

  it("returns null when neither provider is configured", () => {
    expect(isBedrockConfigured({})).toBe(false);
    expect(resolveServerAiProvider({})).toBeNull();
  });
});

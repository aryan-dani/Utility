import { describe, expect, it } from "vitest";
import {
  DEFAULT_BEDROCK_CHAT_MODEL,
  DEFAULT_BEDROCK_FAST_MODEL,
  isBedrockConfigured,
  resolveAiProvider,
  resolveModelId,
} from "./aiProvider";
import { GROQ_CHAT_MODEL, GROQ_FAST_MODEL } from "./groqModels";

describe("aiProvider", () => {
  it("defaults to groq when AI_PROVIDER is unset", () => {
    expect(resolveAiProvider({})).toEqual({
      provider: "groq",
      fellBackFromBedrock: false,
    });
  });

  it("selects bedrock when AI_PROVIDER=bedrock and IAM credentials are set", () => {
    const env = {
      AI_PROVIDER: "bedrock",
      AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
      AWS_SECRET_ACCESS_KEY: "secret",
    };
    expect(isBedrockConfigured(env)).toBe(true);
    expect(resolveAiProvider(env)).toEqual({
      provider: "bedrock",
      fellBackFromBedrock: false,
    });
  });

  it("selects bedrock when AI_PROVIDER=bedrock and a Bedrock bearer token is set", () => {
    const env = {
      AI_PROVIDER: "bedrock",
      AWS_BEARER_TOKEN_BEDROCK: "token-value",
    };
    expect(isBedrockConfigured(env)).toBe(true);
    expect(resolveAiProvider(env)).toEqual({
      provider: "bedrock",
      fellBackFromBedrock: false,
    });
  });

  it("falls back to groq if AI_PROVIDER=bedrock but AWS credentials are missing", () => {
    const env = { AI_PROVIDER: "bedrock", GROQ_API_KEY: "gsk_test" };
    expect(isBedrockConfigured(env)).toBe(false);
    expect(resolveAiProvider(env)).toEqual({
      provider: "groq",
      fellBackFromBedrock: true,
    });
  });

  it("resolves default and overridden model IDs per tier", () => {
    expect(resolveModelId("groq", "chat", {})).toBe(GROQ_CHAT_MODEL);
    expect(resolveModelId("groq", "fast", {})).toBe(GROQ_FAST_MODEL);
    expect(resolveModelId("bedrock", "chat", {})).toBe(DEFAULT_BEDROCK_CHAT_MODEL);
    expect(resolveModelId("bedrock", "fast", {})).toBe(DEFAULT_BEDROCK_FAST_MODEL);
    expect(
      resolveModelId("bedrock", "chat", {
        BEDROCK_CHAT_MODEL: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      }),
    ).toBe("us.anthropic.claude-3-5-haiku-20241022-v1:0");
  });
});

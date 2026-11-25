import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { env, type ServerEnv } from "./env.js";

export type AiProviderName = "bedrock" | "groq";
export type ModelTier = "chat" | "fast";

export const DEFAULT_BEDROCK_REGION = "us-east-1";
export const DEFAULT_BEDROCK_CHAT_MODEL = "us.amazon.nova-lite-v1:0";
export const DEFAULT_BEDROCK_FAST_MODEL = "us.amazon.nova-micro-v1:0";
export const GROQ_CHAT_MODEL = "openai/gpt-oss-120b";
export const GROQ_FAST_MODEL = "openai/gpt-oss-20b";

type EnvSlice = Partial<
  Pick<
    ServerEnv,
    | "AI_PROVIDER"
    | "GROQ_API_KEY"
    | "AWS_REGION"
    | "AWS_ACCESS_KEY_ID"
    | "AWS_SECRET_ACCESS_KEY"
    | "AWS_SESSION_TOKEN"
    | "AWS_BEARER_TOKEN_BEDROCK"
    | "BEDROCK_CHAT_MODEL"
    | "BEDROCK_FAST_MODEL"
  >
>;

export function isBedrockConfigured(cfg: EnvSlice): boolean {
  if (cfg.AWS_BEARER_TOKEN_BEDROCK?.trim()) return true;
  return Boolean(
    cfg.AWS_ACCESS_KEY_ID?.trim() && cfg.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

export function resolveServerAiProvider(cfg: EnvSlice): AiProviderName | null {
  const requested = (cfg.AI_PROVIDER || "groq").trim().toLowerCase();
  if (requested === "bedrock") {
    if (isBedrockConfigured(cfg)) return "bedrock";
    if (cfg.GROQ_API_KEY?.trim()) return "groq";
    return null;
  }
  if (cfg.GROQ_API_KEY?.trim()) return "groq";
  if (isBedrockConfigured(cfg)) return "bedrock";
  return null;
}

export function isAiConfigured(): boolean {
  return resolveServerAiProvider(env()) !== null;
}

export function getServerLanguageModel(tier: ModelTier): {
  model: LanguageModel;
  provider: AiProviderName;
  modelId: string;
} {
  const cfg = env();
  const provider = resolveServerAiProvider(cfg);
  if (!provider) {
    throw new Error("No AI provider configured (set AWS Bedrock credentials or GROQ_API_KEY)");
  }

  if (provider === "bedrock") {
    const modelId =
      tier === "fast"
        ? cfg.BEDROCK_FAST_MODEL?.trim() || DEFAULT_BEDROCK_FAST_MODEL
        : cfg.BEDROCK_CHAT_MODEL?.trim() || DEFAULT_BEDROCK_CHAT_MODEL;
    const bedrock = createAmazonBedrock({
      region: cfg.AWS_REGION?.trim() || DEFAULT_BEDROCK_REGION,
      ...(cfg.AWS_BEARER_TOKEN_BEDROCK?.trim()
        ? { apiKey: cfg.AWS_BEARER_TOKEN_BEDROCK.trim() }
        : {
            accessKeyId: cfg.AWS_ACCESS_KEY_ID?.trim(),
            secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY?.trim(),
            sessionToken: cfg.AWS_SESSION_TOKEN?.trim() || undefined,
          }),
    });
    return {
      model: bedrock(modelId) as unknown as LanguageModel,
      provider,
      modelId,
    };
  }

  const modelId = tier === "fast" ? GROQ_FAST_MODEL : GROQ_CHAT_MODEL;
  const groq = createGroq({ apiKey: cfg.GROQ_API_KEY });
  return { model: groq(modelId), provider, modelId };
}

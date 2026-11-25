import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { GROQ_CHAT_MODEL, GROQ_FAST_MODEL } from "@/lib/groqModels";

export type AiProviderName = "bedrock" | "groq";
export type ModelTier = "chat" | "fast";

export const DEFAULT_BEDROCK_REGION = "us-east-1";
export const DEFAULT_BEDROCK_CHAT_MODEL = "us.amazon.nova-lite-v1:0";
export const DEFAULT_BEDROCK_FAST_MODEL = "us.amazon.nova-micro-v1:0";

type EnvMap = Record<string, string | undefined>;

export function isBedrockConfigured(envMap: EnvMap = process.env): boolean {
  if (envMap.AWS_BEARER_TOKEN_BEDROCK?.trim()) return true;
  return Boolean(
    envMap.AWS_ACCESS_KEY_ID?.trim() && envMap.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

/**
 * Picks the active AI provider from AI_PROVIDER ("bedrock" | "groq").
 * Defaults to Groq so existing deployments keep working unchanged.
 * If AI_PROVIDER=bedrock is set without AWS credentials, falls back to Groq when available.
 */
export function resolveAiProvider(envMap: EnvMap = process.env): {
  provider: AiProviderName;
  fellBackFromBedrock: boolean;
} {
  const requested = (envMap.AI_PROVIDER || "groq").trim().toLowerCase();
  if (requested === "bedrock") {
    if (isBedrockConfigured(envMap)) {
      return { provider: "bedrock", fellBackFromBedrock: false };
    }
    return { provider: "groq", fellBackFromBedrock: true };
  }
  return { provider: "groq", fellBackFromBedrock: false };
}

export function resolveModelId(
  provider: AiProviderName,
  tier: ModelTier,
  envMap: EnvMap = process.env,
): string {
  if (provider === "bedrock") {
    return tier === "fast"
      ? envMap.BEDROCK_FAST_MODEL?.trim() || DEFAULT_BEDROCK_FAST_MODEL
      : envMap.BEDROCK_CHAT_MODEL?.trim() || DEFAULT_BEDROCK_CHAT_MODEL;
  }
  return tier === "fast" ? GROQ_FAST_MODEL : GROQ_CHAT_MODEL;
}

let warnedFallback = false;

export function getLanguageModel(tier: ModelTier): {
  model: LanguageModel;
  provider: AiProviderName;
  modelId: string;
} {
  const { provider, fellBackFromBedrock } = resolveAiProvider();
  if (fellBackFromBedrock && !warnedFallback) {
    warnedFallback = true;
    console.warn(
      "AI_PROVIDER=bedrock requested without AWS credentials; falling back to Groq.",
    );
  }

  const modelId = resolveModelId(provider, tier);
  if (provider === "bedrock") {
    const bedrock = createAmazonBedrock({
      region: process.env.AWS_REGION?.trim() || DEFAULT_BEDROCK_REGION,
      ...(process.env.AWS_BEARER_TOKEN_BEDROCK?.trim()
        ? { apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK.trim() }
        : {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim(),
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim(),
            sessionToken: process.env.AWS_SESSION_TOKEN?.trim() || undefined,
          }),
    });
    return {
      model: bedrock(modelId) as unknown as LanguageModel,
      provider,
      modelId,
    };
  }

  return { model: groq(modelId), provider, modelId };
}

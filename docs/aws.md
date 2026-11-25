# Amazon Bedrock Setup (AWS)

Utility OS supports running its RAG AI assistant, study generator (flashcards, quizzes, PYQs), document summarizer, and natural-language planner parser on **Amazon Bedrock**, while keeping Groq as an automatic fallback.

## What runs on AWS

When `AI_PROVIDER=bedrock` is set along with valid AWS credentials, the following routes call Amazon Bedrock via `@ai-sdk/amazon-bedrock` (using AWS SigV4 or a Bedrock API key):

- **Next.js API (Vercel):** `/api/chat`, `/api/study`, `/api/resources/summarize`, `/api/planner/parse` (`src/lib/aiProvider.ts`)
- **Companion server (`server/`):** `/v1/chat`, `/v1/study`, `/v1/resources/:id/summarize`, `/v1/planner/parse` (`server/src/lib/aiProvider.ts`)

Both `/api/chat` and `/v1/chat` return an `X-AI-Provider: bedrock` (or `groq`) response header so you can verify which provider served a grounded answer in browser DevTools.

### Fallback behavior

- If `AI_PROVIDER` is unset or set to `groq`, Utility OS uses Groq as before.
- If `AI_PROVIDER=bedrock` is set without AWS credentials, Utility OS logs a warning and falls back to Groq automatically when `GROQ_API_KEY` is present.

### Why generation first (and embeddings note)

Switching answer generation to Amazon Bedrock works immediately with zero database re-indexing because the existing hybrid retrieval pipeline (BM25/FTS + 768-dim vectors + RRF) feeds retrieved chunks straight into the Vercel AI SDK. Amazon Titan Text Embeddings V2 (`amazon.titan-embed-text-v2:0`) outputs 256, 512, or 1024 dimensions rather than 768, so moving embeddings to Bedrock requires migrating the `vector(768)` column and re-indexing all chunks. Keeping Gemini for 768-dim embeddings while moving generation to Bedrock avoids breaking live vector search.

## Environment variables

Add these to `.env.local` (and Vercel Production / companion server `.env` when ready):

```env
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Optional: Bedrock API key instead of IAM access keys
# AWS_BEARER_TOKEN_BEDROCK=

# Optional model overrides (defaults shown)
BEDROCK_CHAT_MODEL=us.amazon.nova-lite-v1:0
BEDROCK_FAST_MODEL=us.amazon.nova-micro-v1:0
```

## Region and model IDs

| Region | Recommended chat model (`BEDROCK_CHAT_MODEL`) | Recommended fast model (`BEDROCK_FAST_MODEL`) |
|---|---|---|
| `us-east-1` (N. Virginia, default) | `us.amazon.nova-lite-v1:0` (or `us.anthropic.claude-3-5-haiku-20241022-v1:0`) | `us.amazon.nova-micro-v1:0` |
| `ap-south-1` (Mumbai, lowest latency from Pune) | `apac.amazon.nova-lite-v1:0` | `apac.amazon.nova-micro-v1:0` |

Always match the inference profile prefix (`us.` vs `apac.`) to your `AWS_REGION`.

## Minimal IAM permissions

Create a dedicated IAM user (for example `utility-os-bedrock`) with programmatic access only and attach the following least-privilege inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UtilityOSBedrockInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
        "arn:aws:bedrock:*:*:inference-profile/us.amazon.nova-*",
        "arn:aws:bedrock:*:*:inference-profile/apac.amazon.nova-*"
      ]
    }
  ]
}
```

If you switch `BEDROCK_CHAT_MODEL` to a Claude model, also add `arn:aws:bedrock:*::foundation-model/anthropic.claude-*` and the matching inference profile ARN to `Resource`.

## Verifying it works

1. Set `AI_PROVIDER=bedrock`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in `.env.local`.
2. Start the app with `npm run dev` and open `/ask`.
3. Ask a question from your syllabus and check the Network tab for `/api/chat` (or `/v1/chat`): the response headers will include `X-AI-Provider: bedrock`.

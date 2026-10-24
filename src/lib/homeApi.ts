/**
 * Prefer home-server /v1 routes; fall back to current Vercel /api routes.
 * Ask and QA stay on Firestore/Vercel for this pass (PDF grounding).
 */

import { authFetch } from "@/lib/authFetch";
import { utilityFetch } from "@/lib/utilityServer";
import type { RAGSearchResult } from "@/lib/ragSearch";

function stripJsonFence(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

function nonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function quizCorrectIndex(
  item: Record<string, unknown>,
  options: string[],
): number {
  const raw = item.correctIndex ?? item.correct_index;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n) && n >= 0 && n < options.length) return n;
  const answer = String(item.a || item.answer || "").trim();
  if (answer) {
    const match = options.findIndex(
      (opt) => opt.trim().toLowerCase() === answer.toLowerCase(),
    );
    if (match >= 0) return match;
  }
  return 0;
}

export async function homeOrVercelSearch(params: {
  q: string;
  year: string;
  branch: string;
  semester: number;
  signal?: AbortSignal;
}): Promise<RAGSearchResult[]> {
  const qs = new URLSearchParams({
    q: params.q,
    year: params.year,
    branch: params.branch,
    semester: String(params.semester),
  });

  const home = await utilityFetch(`/v1/search?${qs.toString()}`, {
    timeoutMs: 15_000,
  });
  if (home?.ok) {
    const data = (await home.json()) as {
      results?: RAGSearchResult[];
      sources?: Array<{
        resourceId?: string;
        title?: string;
        text?: string;
        sectionLabel?: string | null;
      }>;
    };
    if (nonEmptyArray(data.results)) {
      return data.results as RAGSearchResult[];
    }
    if (nonEmptyArray(data.sources)) {
      return data.sources.map((s) => ({
        resource_id: s.resourceId,
        title: s.title || "Resource",
        subject_name: "",
        snippet: (s.text || "").slice(0, 400),
        section_label: s.sectionLabel ?? undefined,
      }));
    }
    // Empty home index — fall through to Vercel (still has PDF text).
  }

  const res = await authFetch(`/api/search?${qs.toString()}`, {
    signal: params.signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: RAGSearchResult[] };
  return data.results || [];
}

export type StudyRequest = {
  type: "flashcards" | "quiz";
  topic: string;
  context?: {
    academicYear?: string;
    branch?: string;
    semester?: number;
    subjects?: string[];
  };
};

export async function homeOrVercelStudy(
  body: StudyRequest,
): Promise<Record<string, unknown>> {
  const home = await utilityFetch("/v1/study", {
    method: "POST",
    body: {
      mode: body.type === "quiz" ? "quiz" : "flashcards",
      query: body.topic,
      academicYear: body.context?.academicYear,
      branch: body.context?.branch,
      semester: body.context?.semester,
      type: body.type,
      topic: body.topic,
      context: body.context,
    },
    timeoutMs: 60_000,
  });

  if (home?.ok) {
    const data = (await home.json()) as {
      flashcards?: unknown;
      quiz?: unknown;
      text?: string;
      error?: string;
    };
    if (nonEmptyArray(data.flashcards) || nonEmptyArray(data.quiz)) {
      return data as Record<string, unknown>;
    }
    if (typeof data.text === "string" && data.text.trim()) {
      try {
        const parsed = JSON.parse(stripJsonFence(data.text)) as {
          items?: Array<Record<string, unknown>>;
          flashcards?: unknown;
          quiz?: unknown;
        };
        if (nonEmptyArray(parsed.flashcards) || nonEmptyArray(parsed.quiz)) {
          return parsed as Record<string, unknown>;
        }
        if (nonEmptyArray(parsed.items)) {
          if (body.type === "quiz") {
            return {
              quiz: parsed.items.map((item, i) => {
                const rawOpts = item.options;
                const options = Array.isArray(rawOpts)
                  ? rawOpts.map(String)
                  : [String(item.a || item.answer || "—")];
                return {
                  id: String(i + 1),
                  question: String(item.q || item.question || ""),
                  options,
                  correctIndex: quizCorrectIndex(item, options),
                  explanation: String(item.a || item.answer || ""),
                  citations: [],
                };
              }),
            };
          }
          return {
            flashcards: parsed.items.map((item, i) => ({
              id: String(i + 1),
              question: String(item.front || item.q || item.question || ""),
              answer: String(item.back || item.a || item.answer || ""),
            })),
          };
        }
      } catch {
        /* fall through to Vercel */
      }
    }
  }

  const res = await authFetch("/api/study", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      error:
        typeof data.error === "string"
          ? data.error
          : "Failed to generate study material",
    };
  }
  return data;
}

export async function homeOrVercelSummarize(
  resourceId: string,
  signal?: AbortSignal,
): Promise<{ summary?: string; error?: string; ok: boolean }> {
  const home = await utilityFetch(
    `/v1/resources/${encodeURIComponent(resourceId)}/summarize`,
    { timeoutMs: 60_000 },
  );
  if (home) {
    const data = (await home.json()) as { summary?: string; error?: string };
    if (home.ok && data.summary) {
      return { summary: data.summary, ok: true };
    }
    if (home.status === 404) {
      /* no indexed text on home — try Vercel */
    } else if (!home.ok) {
      return { error: data.error || "Failed to generate summary", ok: false };
    }
  }

  const res = await authFetch(`/api/resources/summarize?id=${resourceId}`, {
    signal,
  });
  const data = (await res.json()) as { summary?: string; error?: string };
  if (!res.ok) {
    return { error: data.error || "Failed to generate summary", ok: false };
  }
  return { summary: data.summary, ok: true };
}

/** Heatmap counts: home logs → date→count, else Vercel /api/activity. */
export async function homeOrVercelActivityCounts(
  idToken: string,
): Promise<Record<string, number>> {
  const home = await utilityFetch("/v1/activity", { timeoutMs: 10_000 });
  if (home?.ok) {
    const data = (await home.json()) as {
      counts?: Record<string, number>;
      logs?: Array<{ loggedDate: string; count: number }>;
    };
    if (data.counts && typeof data.counts === "object") {
      return data.counts;
    }
    const counts: Record<string, number> = {};
    for (const log of data.logs || []) {
      const date = log.loggedDate;
      const n = Number(log.count) || 0;
      if (!date || n <= 0) continue;
      counts[date] = (counts[date] || 0) + n;
    }
    return counts;
  }

  const res = await fetch("/api/activity", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { counts?: Record<string, number> };
  return data.counts && typeof data.counts === "object" ? data.counts : {};
}

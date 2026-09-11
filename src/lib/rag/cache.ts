import { createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, type Query } from "firebase-admin/firestore";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academic/scope";
import {
  RETRIEVAL_CACHE_TTL_MS,
  SEMANTIC_CACHE_DISTANCE,
  EMBED_DIMS,
} from "./config";
import { embedQuery } from "./embed";
import type { RetrievalResult } from "./types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const retrievalMemory = new Map<string, CacheEntry<RetrievalResult>>();
const SEMANTIC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function semanticCacheDocId(params: {
  query: string;
  academicYear?: string;
  branch: string;
  semester: number;
  resourceId?: string | null;
}): string {
  const key = [
    normalizeQuery(params.query),
    params.academicYear || DEFAULT_ACADEMIC_YEAR,
    params.branch,
    String(params.semester),
    params.resourceId || "",
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

export function getRetrievalCache(key: string): RetrievalResult | null {
  const entry = retrievalMemory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    retrievalMemory.delete(key);
    return null;
  }
  return entry.value;
}

export function setRetrievalCache(key: string, value: RetrievalResult): void {
  retrievalMemory.set(key, {
    value,
    expiresAt: Date.now() + RETRIEVAL_CACHE_TTL_MS,
  });
  if (retrievalMemory.size > 500) {
    const oldest = retrievalMemory.keys().next().value;
    if (oldest) retrievalMemory.delete(oldest);
  }
}

export interface SemanticCacheHit {
  response: string;
  sources?: unknown;
}

export async function lookupSemanticCache(params: {
  uid: string;
  query: string;
  academicYear?: string;
  branch: string;
  semester: number;
  resourceId?: string;
  queryEmbedding?: number[];
}): Promise<SemanticCacheHit | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const queryVector =
      params.queryEmbedding?.length === EMBED_DIMS
        ? params.queryEmbedding
        : await embedQuery(params.query);
    const db = adminDb();

    // Exact deterministic hit first
    const docId = semanticCacheDocId(params);
    const exact = await db.collection("semantic_cache").doc(docId).get();
    if (exact.exists) {
      const data = exact.data()!;
      const expiresAt = data.expires_at
        ? new Date(data.expires_at).getTime()
        : data.created_at
          ? new Date(data.created_at).getTime() + SEMANTIC_TTL_MS
          : 0;
      if (Date.now() < expiresAt && data.response) {
        return {
          response: data.response as string,
          sources: data.sources,
        };
      }
    }

    let ref: Query = db
      .collection("semantic_cache")
      .where("academic_year", "==", params.academicYear || DEFAULT_ACADEMIC_YEAR)
      .where("branch", "==", params.branch)
      .where("semester", "==", params.semester);

    if (params.resourceId) {
      ref = ref.where("resource_id", "==", params.resourceId);
    } else {
      ref = ref.where("resource_id", "==", null);
    }

    const vectorQuery = ref.findNearest({
      vectorField: "query_embedding",
      queryVector: FieldValue.vector(queryVector),
      limit: 3,
      distanceMeasure: "COSINE",
      distanceResultField: "_distance",
    });

    const snap = await vectorQuery.get();
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const distance = docSnap.get("_distance") as number;
      const expiresAt = data.expires_at
        ? new Date(data.expires_at).getTime()
        : data.created_at
          ? new Date(data.created_at).getTime() + SEMANTIC_TTL_MS
          : 0;
      const fresh = Date.now() < expiresAt;

      if (fresh && distance <= SEMANTIC_CACHE_DISTANCE && data.response) {
        return {
          response: data.response as string,
          sources: data.sources,
        };
      }
    }
  } catch (err) {
    console.warn("Semantic cache vector lookup failed:", err);
  }

  return null;
}

export async function storeSemanticCache(params: {
  uid: string;
  query: string;
  academicYear?: string;
  branch: string;
  semester: number;
  resourceId?: string;
  response: string;
  sources?: unknown;
  queryEmbedding?: number[];
}): Promise<void> {
  try {
    const db = adminDb();
    let queryEmbedding: number[] | null =
      params.queryEmbedding?.length === EMBED_DIMS ? params.queryEmbedding : null;

    if (!queryEmbedding && process.env.GEMINI_API_KEY) {
      try {
        queryEmbedding = await embedQuery(params.query);
      } catch {
        /* optional */
      }
    }

    const now = Date.now();
    const expiresAt = new Date(now + SEMANTIC_TTL_MS).toISOString();
    const docId = semanticCacheDocId(params);

    await db.collection("semantic_cache").doc(docId).set(
      {
        uid: params.uid,
        prompt: params.query,
        academic_year: params.academicYear || DEFAULT_ACADEMIC_YEAR,
        branch: params.branch,
        semester: params.semester,
        resource_id: params.resourceId || null,
        response: params.response,
        sources: params.sources || null,
        created_at: new Date(now).toISOString(),
        expires_at: expiresAt,
        ...(queryEmbedding?.length === EMBED_DIMS
          ? { query_embedding: FieldValue.vector(queryEmbedding) }
          : {}),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("Semantic cache store failed:", err);
  }
}

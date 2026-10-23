import { sql } from "drizzle-orm";
import { getPool } from "../db/client.js";
import { embedQuery } from "./embed.js";
import {
  CONTEXT_BUDGET_CHARS,
  MAX_CHUNKS_PER_RESOURCE,
  RRF_K,
  VECTOR_CANDIDATE_LIMIT,
  BM25_CANDIDATE_LIMIT,
} from "./ragConfig.js";

export type RetrievalSource = {
  resourceId: string;
  title: string;
  chunkId: string;
  chunkIndex: number;
  text: string;
  score: number;
  sectionLabel?: string | null;
};

export type RetrieveParams = {
  query: string;
  academicYear?: string;
  branch?: string;
  semester?: number;
  resourceId?: string;
};

function rrfMerge(
  lists: Array<Array<{ id: string; score: number }>>,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, idx) => {
      const add = 1 / (RRF_K + idx + 1);
      scores.set(item.id, (scores.get(item.id) || 0) + add);
    });
  }
  return scores;
}

export async function retrieve(
  params: RetrieveParams,
): Promise<{ sources: RetrievalSource[]; context: string }> {
  const pool = getPool();
  const q = params.query.trim();
  if (!q) return { sources: [], context: "" };

  const scopeParts: string[] = [];
  const scopeVals: unknown[] = [];
  let i = 1;
  if (params.resourceId) {
    scopeParts.push(`c.resource_id = $${i++}`);
    scopeVals.push(params.resourceId);
  } else {
    if (params.academicYear) {
      scopeParts.push(`c.academic_year = $${i++}`);
      scopeVals.push(params.academicYear);
    }
    if (params.branch) {
      scopeParts.push(`c.branch = $${i++}`);
      scopeVals.push(params.branch);
    }
    if (params.semester != null) {
      scopeParts.push(`c.semester = $${i++}`);
      scopeVals.push(params.semester);
    }
  }
  const whereScope = scopeParts.length
    ? `AND ${scopeParts.join(" AND ")}`
    : "";

  // Lexical via FTS
  const lexSql = `
    SELECT c.id, c.resource_id, c.chunk_index, c.text, c.section_label,
           r.title,
           ts_rank_cd(c.search_tsv, plainto_tsquery('english', $${i})) AS score
    FROM resource_chunks c
    JOIN resources r ON r.id = c.resource_id
    WHERE c.search_tsv @@ plainto_tsquery('english', $${i})
    ${whereScope}
    ORDER BY score DESC
    LIMIT ${BM25_CANDIDATE_LIMIT}
  `;
  const lexVals = [...scopeVals, q];
  const lexRes = await pool.query(lexSql, lexVals);

  // Vector
  let vecRows: Array<{
    id: string;
    resource_id: string;
    chunk_index: number;
    text: string;
    section_label: string | null;
    title: string;
    score: number;
  }> = [];
  const embedding = await embedQuery(q);
  if (embedding) {
    const vecLiteral = `[${embedding.join(",")}]`;
    const vecSql = `
      SELECT c.id, c.resource_id, c.chunk_index, c.text, c.section_label,
             r.title,
             1 - (c.embedding <=> $1::vector) AS score
      FROM resource_chunks c
      JOIN resources r ON r.id = c.resource_id
      WHERE c.embedding IS NOT NULL
      ${whereScope.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + 1}`)}
      ORDER BY c.embedding <=> $1::vector
      LIMIT ${VECTOR_CANDIDATE_LIMIT}
    `;
    const vecVals = [vecLiteral, ...scopeVals];
    const vecRes = await pool.query(vecSql, vecVals);
    vecRows = vecRes.rows;
  }

  const lexList = lexRes.rows.map(
    (r: { id: string; score: number }, idx: number) => ({
      id: r.id as string,
      score: Number(r.score) || 1 / (idx + 1),
    }),
  );
  const vecList = vecRows.map((r, idx) => ({
    id: r.id,
    score: Number(r.score) || 1 / (idx + 1),
  }));
  const fused = rrfMerge([lexList, vecList]);

  const byId = new Map<string, (typeof lexRes.rows)[0] | (typeof vecRows)[0]>();
  for (const r of lexRes.rows) byId.set(r.id, r);
  for (const r of vecRows) if (!byId.has(r.id)) byId.set(r.id, r);

  const ranked = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));

  const perResource = new Map<string, number>();
  const sources: RetrievalSource[] = [];
  let budget = CONTEXT_BUDGET_CHARS;

  for (const { id, score } of ranked) {
    const row = byId.get(id);
    if (!row) continue;
    const count = perResource.get(row.resource_id) || 0;
    if (count >= MAX_CHUNKS_PER_RESOURCE) continue;
    perResource.set(row.resource_id, count + 1);
    const text = String(row.text || "");
    if (budget <= 0) break;
    sources.push({
      resourceId: row.resource_id,
      title: row.title || "Resource",
      chunkId: row.id,
      chunkIndex: row.chunk_index,
      text: text.slice(0, budget),
      score,
      sectionLabel: row.section_label,
    });
    budget -= text.length;
  }

  const context = sources
    .map(
      (s, n) =>
        `[${n + 1}] ${s.title}${s.sectionLabel ? ` · ${s.sectionLabel}` : ""}\n${s.text}`,
    )
    .join("\n\n");

  return { sources, context };
}

/** Keep unused drizzle sql import from being tree-shaken oddly in some builds. */
void sql;

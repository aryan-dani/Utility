/**
 * runtime/tools/index-content.mjs
 * Indexes resources into resource_content (legacy) + resource_chunks (hybrid RAG).
 */

import crypto from "crypto";
import { select, upsert, upsertBatch, remove } from "../lib/db.mjs";
import { downloadFile } from "../lib/storage.mjs";
import { extractStructured } from "../lib/extractor.mjs";
import { getDrive } from "../lib/drive.mjs";
import { chunkUnits, capDocFreq } from "../lib/chunker.mjs";
import { embedChunks } from "../lib/embed.mjs";
import { MAX_DOC_FREQ_TERMS } from "../lib/rag/config.mjs";
import { db } from "../lib/firebase.mjs";
import { FieldValue } from "firebase-admin/firestore";

const SUPPORTED_EXTS = [".pdf", ".docx", ".pptx", ".xlsx"];
const PAGE_SIZE = 500;
const RESOURCE_CONCURRENCY = 2;
const CONTENT_MAX_CHARS = 6000;
const SEARCH_TOKENS_MAX = 800;
/** Cap changed-only / default runs so one job cannot blow Spark quota mid-flight. */
const CHANGED_ONLY_MAX_PER_RUN = 40;

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function getExt(resource) {
  const title = (resource.title || "").toLowerCase();
  const url = (resource.file_url || "").toLowerCase().split("?")[0];
  for (const ext of SUPPORTED_EXTS) {
    if (title.endsWith(ext.slice(1)) || url.endsWith(ext)) {
      return ext.slice(1);
    }
  }
  return (title.split(".").pop() || "").toLowerCase();
}

async function fetchAll(table, columns = "*") {
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await select(table, { columns, limit: PAGE_SIZE, offset });
    if (!data.length) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

async function downloadResourceBuffer(res) {
  if (res.file_url.includes("drive.google.com")) {
    const fileIdMatch = res.file_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch) throw new Error("Could not extract Google Drive file ID");
    const drive = getDrive();
    const driveRes = await drive.files.get(
      { fileId: fileIdMatch[1], alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(driveRes.data);
  }

  const url = new URL(res.file_url);
  const pathParts = decodeURIComponent(url.pathname).split("/course-content/");
  if (pathParts.length < 2) throw new Error("Invalid storage URL");
  return downloadFile("course-content", pathParts[1]);
}

async function deleteStaleChunks(resourceId, keepCount) {
  const { data } = await select("resource_chunks", {
    columns: "id,chunk_index",
    where: [{ column: "resource_id", op: "eq", value: resourceId }],
    limit: 5000,
  });
  const stale = data.filter((d) => (d.chunk_index ?? 0) >= keepCount);
  for (let i = 0; i < stale.length; i += 30) {
    const batch = stale.slice(i, i + 30);
    if (batch.length === 0) continue;
    await remove("resource_chunks", [
      { column: "id", op: "in", value: batch.map((s) => s.id) },
    ]);
  }
}

function excerptContent(text) {
  if (!text || typeof text !== "string") return "";
  return text.length > CONTENT_MAX_CHARS
    ? text.substring(0, CONTENT_MAX_CHARS)
    : text;
}

function buildSearchTokens(text) {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 3),
    ),
  ].slice(0, SEARCH_TOKENS_MAX);
}

/** Rewrite oversized resource_content.content fields to 6k excerpts (no full reindex). */
async function shrinkContentFields() {
  console.log("\n🗜️  Shrinking oversized resource_content fields…\n");
  let scanned = 0;
  let shrunk = 0;
  let offset = 0;

  while (true) {
    const { data } = await select("resource_content", {
      columns: "id, resource_id, content, search_tokens",
      limit: PAGE_SIZE,
      offset,
    });
    if (!data.length) break;

    for (const doc of data) {
      scanned++;
      const content = typeof doc.content === "string" ? doc.content : "";
      const tokens = Array.isArray(doc.search_tokens) ? doc.search_tokens : [];
      const needsShrink =
        content.length > CONTENT_MAX_CHARS || tokens.length > SEARCH_TOKENS_MAX;
      if (!needsShrink) continue;

      const excerpt = excerptContent(content);
      await upsert(
        "resource_content",
        {
          id: doc.id || doc.resource_id,
          resource_id: doc.resource_id || doc.id,
          content: excerpt,
          search_tokens: buildSearchTokens(excerpt),
          snippet: excerpt.substring(0, 500),
        },
        "resource_id",
      );
      shrunk++;
      console.log(
        `  ✅ Shrunk ${doc.resource_id || doc.id} (${content.length} → ${excerpt.length} chars)`,
      );
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`\n✨ Shrink complete. Scanned ${scanned}, shrunk ${shrunk}.\n`);
}

export default async function indexContent(options = {}) {
  const shrinkOnly =
    options.shrinkContent === true ||
    process.argv.includes("--shrink-content");

  if (shrinkOnly) {
    await shrinkContentFields();
    return;
  }

  const idFilters = new Set(
    [
      ...(options.ids || []),
      ...process.argv
        .filter((a) => a.startsWith("--id="))
        .map((a) => a.slice(5)),
    ].filter(Boolean),
  );
  const titleFilter = (
    options.title ||
    process.argv.find((a) => a.startsWith("--title="))?.slice(8) ||
    ""
  )
    .trim()
    .toLowerCase();
  const subjectFilter = (
    options.subject ||
    process.argv.find((a) => a.startsWith("--subject="))?.slice(10) ||
    ""
  )
    .trim()
    .toLowerCase();
  const pathFilter = (
    options.path ||
    process.argv.find((a) => a.startsWith("--path="))?.slice(7) ||
    ""
  )
    .trim()
    .replace(/\\/g, "/");

  const argv = options.argv || process.argv;
  const wantAll =
    options.all === true ||
    argv.includes("--all") ||
    argv.includes("--full");
  const rebuildStats =
    options.rebuildStats === true || argv.includes("--rebuild-stats");

  const targeted =
    idFilters.size > 0 || titleFilter || subjectFilter || pathFilter;

  // Default: changed-only. Pass --all/--full to scan every resource for stale hashes.
  const mode = targeted ? "targeted" : wantAll ? "all" : "changed-only";

  console.log(`\n🔍 Starting Hybrid Content Indexing (${mode})…\n`);

  if (mode === "all") {
    console.warn(
      "⚠️  Full resource scan mode. Prefer `npm run index-content` (changed-only) on Spark.\n",
    );
  }

  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  if (!hasGemini) {
    console.warn(
      "⚠️  GEMINI_API_KEY not set — embeddings skipped (lexical/BM25 search only).\n",
    );
  }

  const stats = { ok: 0, skipped: 0, failed: 0, chunksWritten: 0 };

  try {
    let resources;
    if (idFilters.size > 0) {
      resources = [];
      for (const id of idFilters) {
        const snap = await db.collection("resources").doc(id).get();
        if (snap.exists) resources.push({ id: snap.id, ...snap.data() });
        else console.warn(`  ⚠️  Resource not found: ${id}`);
      }
    } else if (mode === "changed-only") {
      // Spark-friendly: only resources flagged for reindex (content_hash cleared by sync).
      const snap = await db
        .collection("resources")
        .where("content_hash", "==", null)
        .limit(CHANGED_ONLY_MAX_PER_RUN)
        .get();
      resources = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log(
        `📌 Changed-only: ${resources.length} resource(s) with content_hash=null (max ${CHANGED_ONLY_MAX_PER_RUN}/run).\n`,
      );
      if (resources.length === 0) {
        console.log("✨ Nothing to index. Done.\n");
        return;
      }
    } else {
      resources = await fetchAll("resources");
    }

    if (titleFilter) {
      resources = resources.filter((r) =>
        String(r.title || "")
          .toLowerCase()
          .includes(titleFilter),
      );
    }
    if (pathFilter) {
      resources = resources.filter((r) =>
        String(r.drive_path || "").startsWith(pathFilter),
      );
    }

    // Prefer subject names from resource payloads; only load subjects map if needed.
    let subjectsMap = new Map();
    if (subjectFilter || resources.some((r) => !r.subject_name)) {
      const subjects = await fetchAll("subjects");
      subjectsMap = new Map(subjects.map((s) => [s.id, s]));
    }

    if (subjectFilter) {
      resources = resources.filter((r) => {
        const sub = subjectsMap.get(r.subject_id);
        return String(sub?.name || r.subject_name || "")
          .toLowerCase()
          .includes(subjectFilter);
      });
    }

    const indexable = resources.filter((r) => {
      const ext = getExt(r);
      return SUPPORTED_EXTS.some((e) => e === `.${ext}`);
    });

    console.log(`📦 ${indexable.length} indexable resources.\n`);

    // Avoid loading every resource_content / chunk row (was multi‑k reads/day).
    const indexedMap = new Map();
    if (mode === "all") {
      const indexedContent = await fetchAll(
        "resource_content",
        "resource_id, last_indexed, search_tokens, content_hash",
      );
      for (const i of indexedContent) indexedMap.set(i.resource_id, i);
    } else {
      for (const res of indexable) {
        const snap = await db.collection("resource_content").doc(res.id).get();
        if (snap.exists) {
          indexedMap.set(res.id, { resource_id: res.id, ...snap.data() });
        }
      }
    }

    const chunkHashMap = new Map();

    const toIndex = [];
    const queued = new Set();
    const queue = (res) => {
      if (queued.has(res.id)) return;
      queued.add(res.id);
      toIndex.push(res);
    };

    for (const res of indexable) {
      if (mode === "targeted" || mode === "changed-only") {
        queue(res);
        continue;
      }
      const doc = indexedMap.get(res.id);
      if (!doc) {
        queue(res);
        continue;
      }
      if (!doc.search_tokens?.length) {
        queue(res);
        continue;
      }
      if (!res.content_hash) {
        queue(res);
        continue;
      }
      if (doc.content_hash && res.content_hash !== doc.content_hash) {
        queue(res);
        continue;
      }
      const driveMtime = res.drive_modified_at || res.created_at;
      if (
        driveMtime &&
        doc.last_indexed &&
        new Date(driveMtime).getTime() > new Date(doc.last_indexed).getTime()
      ) {
        queue(res);
        continue;
      }
      if (res.content_hash && doc.content_hash === res.content_hash) continue;
      queue(res);
    }

    if (toIndex.length === 0) {
      console.log("✨ Nothing to (re)index. Done.\n");
      return;
    }

    console.log(`🚀 ${toIndex.length} resources to (re)index.\n`);

    // Load chunk hashes only for resources we will actually process.
    for (const res of toIndex) {
      const { data } = await select("resource_chunks", {
        columns: "resource_id, content_hash",
        where: [{ column: "resource_id", op: "eq", value: res.id }],
        limit: 5000,
      });
      chunkHashMap.set(res.id, new Set(data.map((d) => d.content_hash)));
    }

    const allChunkTokens = [];

    async function processResource(res, index) {
      try {
        console.log(`📄 [${index + 1}/${toIndex.length}] ${res.title}…`);
        const ext = getExt(res);
        const buffer = await downloadResourceBuffer(res);
        const contentHash = hashBuffer(buffer);

        const { units, pages, fullText } = await extractStructured(buffer, ext);
        if (!fullText?.trim() && units.length === 0) {
          console.warn(`   ⚠️  No text extracted, skipping.`);
          stats.skipped++;
          return;
        }

        const subject = subjectsMap.get(res.subject_id);
        const subjectName = subject?.name || res.subject_name || "";
        const branch = res.branch || subject?.branch || "";
        const semester =
          res.semester != null ? Number(res.semester) : (subject?.semester ?? null);
        const academicYear =
          res.academic_year || subject?.academic_year || "2026-2027";

        const cleanText = (fullText || units.map((u) => u.text).join("\n\n"))
          .replace(/\u0000/g, "")
          .replace(/\\u0000/g, "")
          .replace(/\x00/g, "");

        const excerpt = excerptContent(cleanText);
        const legacyTokens = buildSearchTokens(excerpt);
        await upsert(
          "resource_content",
          {
            id: res.id,
            resource_id: res.id,
            content: excerpt,
            pages,
            last_indexed: new Date().toISOString(),
            title: res.title || "",
            subject_name: subjectName,
            file_url: res.file_url || "",
            snippet: excerpt.substring(0, 500),
            branch,
            semester,
            academic_year: academicYear,
            search_tokens: legacyTokens,
            content_hash: contentHash,
          },
          "resource_id",
        );

        const chunks = chunkUnits(
          units.length
            ? units
            : [{ text: cleanText, sectionLabel: "Document", sectionIndex: 1 }],
        );

        for (const chunk of chunks) {
          chunk.content_hash = crypto
            .createHash("sha256")
            .update(`${contentHash}:${chunk.chunk_index}:${chunk.text}`)
            .digest("hex");
          allChunkTokens.push(chunk);
        }

        const skipHashes = chunkHashMap.get(res.id) || new Set();
        if (hasGemini) {
          await embedChunks(chunks, skipHashes);
        }

        const chunkPayloads = chunks.map((chunk) => {
          const docId = `${res.id}_${chunk.chunk_index}`;
          const payload = {
            id: docId,
            resource_id: res.id,
            chunk_index: chunk.chunk_index,
            text: chunk.text,
            section_label: chunk.section_label,
            section_index: chunk.section_index,
            heading: chunk.heading || "",
            branch,
            semester,
            academic_year: academicYear,
            subject_id: res.subject_id || "",
            subject_name: subjectName,
            category: res.category || "other",
            title: res.title || "",
            file_url: res.file_url || "",
            chunk_tokens: chunk.chunk_tokens,
            token_count: chunk.token_count,
            content_hash: chunk.content_hash,
            last_indexed: new Date().toISOString(),
          };
          if (chunk.embedding?.length) {
            payload.embedding = FieldValue.vector(chunk.embedding);
          }
          return payload;
        });

        await upsertBatch("resource_chunks", chunkPayloads, {
          batchSize: 400,
          pauseMs: 500,
        });
        stats.chunksWritten += chunkPayloads.length;

        await deleteStaleChunks(res.id, chunks.length);

        await db.collection("resources").doc(res.id).set(
          {
            content_hash: contentHash,
            ai_summary: null,
          },
          { merge: true },
        );

        console.log(`   ✅ ${chunks.length} chunks, ${pages} pages`);
        stats.ok++;
      } catch (err) {
        console.error(`   ❌ ${res.title}: ${err.message}`);
        stats.failed++;
      }
    }

    const executing = new Set();
    for (let i = 0; i < toIndex.length; i++) {
      const p = processResource(toIndex[i], i);
      executing.add(p);
      p.finally(() => executing.delete(p));
      if (executing.size >= RESOURCE_CONCURRENCY) await Promise.race(executing);
    }
    await Promise.all(executing);

    // NEVER fetchAll(resource_chunks) — that alone can exceed Spark's daily read quota.
    // Optional light merge from this run's tokens, or skip entirely.
    if (rebuildStats) {
      console.log(
        "\n📊 Merging corpus stats from this run only (no full chunk scan)…",
      );
      try {
        const prevSnap = await db.collection("rag_stats").doc("global").get();
        const prev = prevSnap.exists ? prevSnap.data() || {} : {};
        const df = { ...(prev.doc_freq || {}) };
        let addedTokens = 0;
        for (const chunk of allChunkTokens) {
          addedTokens += chunk.token_count || 0;
          for (const t of chunk.chunk_tokens || []) {
            if (!t) continue;
            df[t] = (Number(df[t]) || 0) + 1;
          }
        }
        const prevChunks = Number(prev.total_chunks) || 0;
        const prevAvg = Number(prev.avg_token_count) || 0;
        const newChunkCount = allChunkTokens.length;
        const newTotal = prevChunks + newChunkCount;
        const avgTokenCount = newTotal
          ? (prevAvg * prevChunks + addedTokens) / newTotal
          : 0;

        await db.collection("rag_stats").doc("global").set(
          {
            total_chunks: newTotal,
            avg_token_count: avgTokenCount,
            doc_freq: capDocFreq(df, MAX_DOC_FREQ_TERMS),
            updated_at: new Date().toISOString(),
          },
          { merge: true },
        );
        console.log(
          `\n✨ Indexing complete. Stats merged (+${newChunkCount} chunks this run; ~${newTotal} tracked).`,
        );
      } catch (err) {
        console.warn(
          `⚠️  Stats merge skipped (quota or error): ${err.message}`,
        );
        console.log(`\n✨ Indexing complete (stats unchanged).`);
      }
    } else {
      console.log(
        `\n✨ ${mode} indexing complete (corpus stats unchanged — pass --rebuild-stats to merge lightly).`,
      );
    }
    console.log(
      `   Resources: ${stats.ok} indexed, ${stats.skipped} skipped (no text), ${stats.failed} failed.`,
    );
    console.log(`   Wrote ${stats.chunksWritten} chunk documents this run.\n`);
    if (mode === "changed-only" && stats.ok >= CHANGED_ONLY_MAX_PER_RUN) {
      console.log(
        `   More pending? Re-run \`npm run index-content\` until it prints "Nothing to index".\n`,
      );
    }
  } catch (error) {
    const msg = error?.message || String(error);
    console.error(`\n❌ Indexing error: ${msg}`);
    if (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg)) {
      console.error(
        "  Firestore Spark quota exhausted. Soft-exiting; retry after daily reset.\n",
      );
      return { stats, quotaExhausted: true };
    }
    throw error;
  }
}

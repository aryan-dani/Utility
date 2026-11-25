/**
 * runtime/lib/db.mjs
 * Dynamic CRUD operations using Firebase Firestore.
 */

import { db } from "./firebase.mjs";

function normalizeWhere(table, where = []) {
  const filters = [];
  let chunkedIn = null;

  for (const filter of where) {
    let { column, op, value } = filter;
    if (column === "id") column = "__name__"; // Document ID in Firestore query is '__name__'

    let firestoreOp = op;
    if (op === "eq") firestoreOp = "==";
    else if (op === "neq") firestoreOp = "!=";
    else if (op === "gt") firestoreOp = ">";
    else if (op === "gte") firestoreOp = ">=";
    else if (op === "lt") firestoreOp = "<";
    else if (op === "lte") firestoreOp = "<=";
    else if (op === "contains") firestoreOp = "array-contains";

    if (firestoreOp === "in") {
      if (!Array.isArray(value) || value.length === 0) {
        return { empty: true, filters: [], chunkedIn: null };
      }
      const uniqueValues = [...new Set(value)];
      if (uniqueValues.length > 30) {
        if (chunkedIn) {
          throw new Error(
            `select("${table}"): multiple "in" filters with >30 elements are not supported.`,
          );
        }
        chunkedIn = { column, values: uniqueValues };
        continue;
      }
      value = uniqueValues;
    }

    filters.push({ column, op: firestoreOp, value });
  }

  return { empty: false, filters, chunkedIn };
}

function applyFilters(baseQuery, filters) {
  let q = baseQuery;
  for (const f of filters) {
    q = q.where(f.column, f.op, f.value);
  }
  return q;
}

function compareDocs(a, b, order) {
  const col = order.column;
  const dir = (order.ascending ?? true) ? 1 : -1;
  const av = a[col];
  const bv = b[col];
  if (av === bv) return 0;
  if (av == null) return 1 * dir;
  if (bv == null) return -1 * dir;
  if (typeof av === "number" && typeof bv === "number") {
    return (av - bv) * dir;
  }
  return String(av).localeCompare(String(bv)) * dir;
}

export async function select(table, options = {}) {
  // Default null = no limit (callers that need a cap must pass limit explicitly).
  const { where = [], order = null, limit = null, offset = 0 } = options;

  try {
    const { empty, filters, chunkedIn } = normalizeWhere(table, where);
    if (empty) {
      return { data: [], count: 0 };
    }

    if (chunkedIn) {
      const seenIds = new Set();
      let results = [];
      for (let i = 0; i < chunkedIn.values.length; i += 30) {
        const chunk = chunkedIn.values.slice(i, i + 30);
        const subQ = applyFilters(db.collection(table), filters).where(
          chunkedIn.column,
          "in",
          chunk,
        );
        const snap = await subQ.get();
        for (const doc of snap.docs) {
          if (seenIds.has(doc.id)) continue;
          seenIds.add(doc.id);
          results.push({ id: doc.id, ...doc.data() });
        }
      }
      if (order) {
        results.sort((a, b) => compareDocs(a, b, order));
      }
      if (offset > 0) results = results.slice(offset);
      if (limit != null) results = results.slice(0, limit);
      return { data: results, count: results.length };
    }

    let q = applyFilters(db.collection(table), filters);

    // Order
    if (order) {
      q = q.orderBy(order.column, (order.ascending ?? true) ? "asc" : "desc");
    }

    // Limit & Offset
    if (limit != null) q = q.limit(limit);
    if (offset > 0) q = q.offset(offset);

    const snap = await q.get();
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { data, count: snap.size };
  } catch (err) {
    throw new Error(`select("${table}"): ${err.message}`);
  }
}

export async function insert(table, data) {
  try {
    const payload = Array.isArray(data) ? data : [data];
    const results = [];
    for (const item of payload) {
      const docId = item.id;
      let docRef;
      if (docId) {
        docRef = db.collection(table).doc(docId);
      } else {
        docRef = db.collection(table).doc();
      }
      const cleanItem = { ...item };
      delete cleanItem.id;
      await docRef.set(cleanItem);
      results.push({ id: docRef.id, ...cleanItem });
    }
    return results;
  } catch (err) {
    throw new Error(`insert("${table}"): ${err.message}`);
  }
}

export async function update(table, filters, data) {
  try {
    // Paginate through all matches — avoid silently capping at a default limit.
    const matchedDocs = [];
    let offset = 0;
    const pageSize = 500;
    while (true) {
      const { data: page } = await select(table, {
        columns: "id",
        where: filters,
        limit: pageSize,
        offset,
      });
      matchedDocs.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    if (matchedDocs.length === 0) return [];

    const cleanData = { ...data };
    delete cleanData.id;

    for (let i = 0; i < matchedDocs.length; i += 400) {
      const slice = matchedDocs.slice(i, i + 400);
      const batch = db.batch();
      for (const doc of slice) {
        batch.update(db.collection(table).doc(doc.id), cleanData);
      }
      await batch.commit();
    }

    return matchedDocs.map((doc) => ({ ...doc, ...cleanData }));
  } catch (err) {
    throw new Error(`update("${table}"): ${err.message}`);
  }
}

export async function remove(table, filters) {
  if (!filters || filters.length === 0)
    throw new Error(`remove("${table}"): refusing to delete without filters.`);

  try {
    const matched = [];
    let offset = 0;
    const pageSize = 500;
    while (true) {
      const { data: page } = await select(table, {
        columns: "id",
        where: filters,
        limit: pageSize,
        offset,
      });
      matched.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    if (matched.length === 0) return [];

    for (let i = 0; i < matched.length; i += 400) {
      const slice = matched.slice(i, i + 400);
      const batch = db.batch();
      for (const doc of slice) {
        batch.delete(db.collection(table).doc(doc.id));
      }
      await batch.commit();
    }
    return matched;
  } catch (err) {
    throw new Error(`remove("${table}"): ${err.message}`);
  }
}

export async function count(table, where = []) {
  try {
    const { empty, filters, chunkedIn } = normalizeWhere(table, where);
    if (empty) return 0;

    if (chunkedIn) {
      let total = 0;
      for (let i = 0; i < chunkedIn.values.length; i += 30) {
        const chunk = chunkedIn.values.slice(i, i + 30);
        const subQ = applyFilters(db.collection(table), filters).where(
          chunkedIn.column,
          "in",
          chunk,
        );
        const snap = await subQ.count().get();
        total += snap.data().count;
      }
      return total;
    }

    const q = applyFilters(db.collection(table), filters);
    const snap = await q.count().get();
    return snap.data().count;
  } catch (err) {
    throw new Error(`count("${table}"): ${err.message}`);
  }
}

export async function upsert(table, data, onConflict) {
  try {
    const payload = Array.isArray(data) ? data : [data];
    const results = [];
    for (const item of payload) {
      const id = item.id;
      if (!id) {
        throw new Error(`upsert("${table}"): item must contain an "id" field.`);
      }
      const cleanItem = { ...item };
      delete cleanItem.id;
      const docRef = db.collection(table).doc(id);
      await docRef.set(cleanItem, { merge: true });
      results.push({ id, ...cleanItem });
    }
    return results;
  } catch (err) {
    throw new Error(`upsert("${table}"): ${err.message}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isQuotaError(err) {
  const msg = err?.message || String(err);
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded");
}

/** Batch-write documents with merge, pausing between batches to avoid quota spikes. */
export async function upsertBatch(table, items, options = {}) {
  const batchSize = options.batchSize ?? 400;
  const pauseMs = options.pauseMs ?? 400;
  const maxRetries = options.maxRetries ?? 6;

  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const batch = db.batch();
        for (const item of slice) {
          const id = item.id;
          if (!id) throw new Error(`upsertBatch("${table}"): missing id`);
          const clean = { ...item };
          delete clean.id;
          batch.set(db.collection(table).doc(id), clean, { merge: true });
        }
        await batch.commit();
        break;
      } catch (err) {
        attempt++;
        if (isQuotaError(err) && attempt < maxRetries) {
          const delay = Math.min(60_000, 2000 * 2 ** attempt);
          await sleep(delay);
          continue;
        }
        throw new Error(`upsertBatch("${table}"): ${err.message}`);
      }
    }

    if (i + batchSize < items.length) await sleep(pauseMs);
  }

  return items.length;
}

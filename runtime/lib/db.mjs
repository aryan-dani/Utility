/**
 * runtime/lib/db.mjs
 * Dynamic CRUD operations using Firebase Firestore.
 */

import { db } from "./firebase.mjs";

export async function select(table, options = {}) {
  const { columns = "*", where = [], order = null, limit = 100, offset = 0 } = options;
  
  try {
    let q = db.collection(table);
    
    // Apply filters
    for (const filter of where) {
      let { column, op, value } = filter;
      if (column === 'id') column = '__name__'; // Document ID in Firestore query is '__name__'
      
      let firestoreOp = op;
      if (op === 'eq') firestoreOp = '==';
      else if (op === 'neq') firestoreOp = '!=';
      else if (op === 'gt') firestoreOp = '>';
      else if (op === 'gte') firestoreOp = '>=';
      else if (op === 'lt') firestoreOp = '<';
      else if (op === 'lte') firestoreOp = '<=';
      else if (op === 'contains') firestoreOp = 'array-contains';
      
      if (firestoreOp === 'in') {
        if (!Array.isArray(value) || value.length === 0) {
          // Firestore throws an error if "in" list is empty. Return empty results.
          return { data: [], count: 0 };
        }
        // Firestore limit for 'in' is 30 elements, but for background script tasks we chunk it if necessary, 
        // or just apply directly. Let's assume it's small or handle up to 30.
        // If it's larger, let's partition, but usually for standard deletes we can chunk.
        // Let's implement chunking if value.length > 30.
        if (value.length > 30) {
          let results = [];
          for (let i = 0; i < value.length; i += 30) {
            const chunk = value.slice(i, i + 30);
            let subQ = db.collection(table).where(column, 'in', chunk);
            if (order) {
              subQ = subQ.orderBy(order.column, order.ascending ?? true ? 'asc' : 'desc');
            }
            const snap = await subQ.get();
            results.push(...snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }
          return { data: results, count: results.length };
        }
      }
      
      q = q.where(column, firestoreOp, value);
    }
    
    // Order
    if (order) {
      q = q.orderBy(order.column, order.ascending ?? true ? 'asc' : 'desc');
    }
    
    // Limit & Offset
    if (limit != null) q = q.limit(limit);
    if (offset > 0) q = q.offset(offset);
    
    const snap = await q.get();
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const { data: matchedDocs } = await select(table, { columns: "id", where: filters });
    if (matchedDocs.length === 0) return [];
    
    const batch = db.batch();
    const cleanData = { ...data };
    delete cleanData.id;
    
    for (const doc of matchedDocs) {
      const docRef = db.collection(table).doc(doc.id);
      batch.update(docRef, cleanData);
    }
    await batch.commit();
    
    return matchedDocs.map(doc => ({ ...doc, ...cleanData }));
  } catch (err) {
    throw new Error(`update("${table}"): ${err.message}`);
  }
}

export async function remove(table, filters) {
  if (!filters || filters.length === 0)
    throw new Error(`remove("${table}"): refusing to delete without filters.`);
    
  try {
    const { data } = await select(table, { columns: "id", where: filters });
    if (data.length === 0) return [];
    
    const batch = db.batch();
    for (const doc of data) {
      const docRef = db.collection(table).doc(doc.id);
      batch.delete(docRef);
    }
    await batch.commit();
    return data;
  } catch (err) {
    throw new Error(`remove("${table}"): ${err.message}`);
  }
}

export async function count(table, where = []) {
  try {
    const { count: n } = await select(table, { columns: "id", where, limit: 10000 });
    return n ?? 0;
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

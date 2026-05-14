/**
 * runtime/lib/db.mjs
 * Dynamic CRUD operations. No hardcoded table names.
 */

import { getClient } from "./supabase.mjs";

function applyFilters(query, where = []) {
  for (const { column, op, value } of where) {
    switch (op) {
      case "eq":       query = query.eq(column, value); break;
      case "neq":      query = query.neq(column, value); break;
      case "gt":       query = query.gt(column, value); break;
      case "gte":      query = query.gte(column, value); break;
      case "lt":       query = query.lt(column, value); break;
      case "lte":      query = query.lte(column, value); break;
      case "like":     query = query.like(column, value); break;
      case "ilike":    query = query.ilike(column, value); break;
      case "in":       query = query.in(column, value); break;
      case "is":       query = query.is(column, value); break;
      case "not":      query = query.not(column, "eq", value); break;
      case "contains": query = query.contains(column, value); break;
      default: console.warn(`⚠️  Unknown filter op: "${op}"`);
    }
  }
  return query;
}

export async function select(table, options = {}) {
  const { columns = "*", where = [], order = null, limit = 100, offset = 0 } = options;
  const supabase = getClient();
  let q = supabase.from(table).select(columns, { count: "exact" });
  q = applyFilters(q, where);
  if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
  if (limit != null) q = q.limit(limit);
  if (offset > 0) q = q.range(offset, offset + limit - 1);
  const { data, error, count } = await q;
  if (error) throw new Error(`select("${table}"): ${error.message}`);
  return { data: data ?? [], count };
}

export async function insert(table, data) {
  const supabase = getClient();
  const payload = Array.isArray(data) ? data : [data];
  const { data: rows, error } = await supabase.from(table).insert(payload).select();
  if (error) throw new Error(`insert("${table}"): ${error.message}`);
  return rows ?? [];
}

export async function update(table, filters, data) {
  const supabase = getClient();
  let q = supabase.from(table).update(data);
  q = applyFilters(q, filters);
  const { data: rows, error } = await q.select();
  if (error) throw new Error(`update("${table}"): ${error.message}`);
  return rows ?? [];
}

export async function remove(table, filters) {
  if (!filters || filters.length === 0)
    throw new Error(`remove("${table}"): refusing to delete without filters.`);
  const supabase = getClient();
  let q = supabase.from(table).delete();
  q = applyFilters(q, filters);
  const { data: rows, error } = await q.select();
  if (error) throw new Error(`remove("${table}"): ${error.message}`);
  return rows ?? [];
}

export async function count(table, where = []) {
  const supabase = getClient();
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  q = applyFilters(q, where);
  const { count: n, error } = await q;
  if (error) throw new Error(`count("${table}"): ${error.message}`);
  return n ?? 0;
}

export async function upsert(table, data, onConflict) {
  const supabase = getClient();
  const payload = Array.isArray(data) ? data : [data];
  const { data: rows, error } = await supabase
    .from(table)
    .upsert(payload, onConflict ? { onConflict } : undefined)
    .select();
  if (error) throw new Error(`upsert("${table}"): ${error.message}`);
  return rows ?? [];
}

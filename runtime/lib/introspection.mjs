/**
 * runtime/lib/introspection.mjs
 * Schema discovery engine — dynamically inspects all tables, columns,
 * relationships, and row counts from information_schema / pg_catalog.
 * No hardcoded table names. Adapts to any Supabase project.
 */

import { executeSQL, scalarSQL } from "./sql.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache");
const CACHE_FILE = join(CACHE_DIR, "topology.json");
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── All Tables ─────────────────────────────────────────────────────────────────

/**
 * List all user-defined tables in the public schema.
 * Falls back to OpenAPI spec if SQL fails.
 */
export async function getAllTables() {
  try {
    return await executeSQL(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_name
    `, { silent: true });
  } catch (err) {
    // Fallback to OpenAPI spec
    const { getUrl, getServiceKey } = await import("./supabase.mjs");
    const res = await fetch(`${getUrl()}/rest/v1/`, {
      headers: { "apikey": getServiceKey(), "Authorization": `Bearer ${getServiceKey()}` }
    });
    const data = await res.json();
    return Object.keys(data.definitions || {}).map(name => ({ table_name: name, table_type: "BASE TABLE" }));
  }
}

/**
 * Get column definitions for a table.
 * Falls back to OpenAPI spec if SQL fails.
 */
export async function getTableSchema(tableName) {
  try {
    return await executeSQL(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `, { silent: true });
  } catch (err) {
    // Fallback to OpenAPI spec
    const { getUrl, getServiceKey } = await import("./supabase.mjs");
    const res = await fetch(`${getUrl()}/rest/v1/`, {
      headers: { "apikey": getServiceKey(), "Authorization": `Bearer ${getServiceKey()}` }
    });
    const data = await res.json();
    const def = data.definitions[tableName];
    if (!def) return [];
    return Object.keys(def.properties || {}).map(name => ({
      column_name: name,
      data_type: def.properties[name].type,
      is_nullable: def.required?.includes(name) ? "NO" : "YES"
    }));
  }
}

// ── Primary Keys ───────────────────────────────────────────────────────────────

/**
 * Get primary key columns for a table.
 * Returns: [{ column_name }]
 */
export async function getPrimaryKeys(tableName) {
  return executeSQL(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = '${tableName.replace(/'/g, "''")}'
    ORDER BY kcu.ordinal_position
  `, { silent: true });
}

// ── Foreign Key Relationships ──────────────────────────────────────────────────

/**
 * Get all foreign key relationships for a table (both outgoing and incoming).
 * Returns: [{ from_table, from_column, to_table, to_column, constraint_name }]
 */
export async function getRelationships(tableName) {
  return executeSQL(`
    SELECT
      kcu.table_name      AS from_table,
      kcu.column_name     AS from_column,
      ccu.table_name      AS to_table,
      ccu.column_name     AS to_column,
      rc.constraint_name
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
      AND kcu.table_schema = 'public'
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND ccu.table_schema = 'public'
    WHERE kcu.table_name = '${tableName.replace(/'/g, "''")}' 
       OR ccu.table_name = '${tableName.replace(/'/g, "''")}'
    ORDER BY kcu.table_name
  `, { silent: true });
}

/**
 * Get ALL foreign key relationships in the entire public schema.
 */
export async function getAllRelationships() {
  return executeSQL(`
    SELECT
      kcu.table_name      AS from_table,
      kcu.column_name     AS from_column,
      ccu.table_name      AS to_table,
      ccu.column_name     AS to_column,
      rc.constraint_name
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
      AND kcu.table_schema = 'public'
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND ccu.table_schema = 'public'
    ORDER BY kcu.table_name, kcu.column_name
  `, { silent: true });
}

// ── Row Counts ─────────────────────────────────────────────────────────────────

/**
 * Get estimated row count for a table (fast, uses pg stats).
 */
export async function getRowCount(tableName) {
  const rows = await executeSQL(`
    SELECT n_live_tup AS count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
      AND relname = '${tableName.replace(/'/g, "''")}'
  `, { silent: true });
  return rows[0]?.count ?? 0;
}

/**
 * Get row counts for ALL tables.
 */
export async function getAllRowCounts() {
  return executeSQL(`
    SELECT relname AS table_name, n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname
  `, { silent: true });
}

// ── Indexes ────────────────────────────────────────────────────────────────────

/**
 * Get all indexes for a table.
 */
export async function getIndexes(tableName) {
  return executeSQL(`
    SELECT
      i.relname  AS index_name,
      ix.indisprimary AS is_primary,
      ix.indisunique  AS is_unique,
      array_to_string(
        ARRAY(SELECT a.attname
              FROM pg_attribute a
              WHERE a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)), ', '
      ) AS columns
    FROM pg_class t
    JOIN pg_index ix  ON t.oid = ix.indrelid
    JOIN pg_class i   ON i.oid = ix.indexrelid
    WHERE t.relkind = 'r'
      AND t.relname = '${tableName.replace(/'/g, "''")}'
    ORDER BY i.relname
  `, { silent: true });
}

// ── Full Topology ──────────────────────────────────────────────────────────────

/**
 * Build a complete metadata snapshot of the entire database.
 * Cached to .cache/topology.json with a 5-minute TTL.
 * @param {boolean} force - force refresh even if cache is fresh
 */
export async function getFullTopology(force = false) {
  // Check cache
  if (!force && existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
      const age = Date.now() - cached._cachedAt;
      if (age < CACHE_TTL_MS) return cached;
    } catch {}
  }

  console.log("  🔍 Building project topology…");

  let tables = [];
  let rowCounts = [];
  let relationships = [];

  try {
    tables = await getAllTables();
    try {
      rowCounts = await getAllRowCounts();
    } catch {
      console.warn("  ⚠️  Could not fetch row counts (SQL required).");
    }
    try {
      relationships = await getAllRelationships();
    } catch {
      console.warn("  ⚠️  Could not fetch relationships (SQL required).");
    }
  } catch (err) {
    console.error("  ❌ Failed to fetch tables:", err.message);
    return { tables: [], relationships: [] };
  }

  const rowCountMap = Object.fromEntries(
    rowCounts.map((r) => [r.table_name, Number(r.row_count)]),
  );

  // Fetch schema for each table concurrently
  const schemas = {};
  const pks = {};
  await Promise.all(
    tables.map(async ({ table_name }) => {
      try {
        const [schema, pk] = await Promise.all([
          getTableSchema(table_name),
          getPrimaryKeys(table_name).catch(() => []),
        ]);
        schemas[table_name] = schema;
        pks[table_name] = pk.map((p) => p.column_name);
      } catch (err) {
        console.warn(`  ⚠️  Failed to fetch schema for ${table_name}:`, err.message);
        schemas[table_name] = [];
        pks[table_name] = [];
      }
    }),
  );

  const topology = {
    tables: tables.map((t) => ({
      name: t.table_name,
      type: t.table_type,
      rowCount: rowCountMap[t.table_name] ?? 0,
      primaryKeys: pks[t.table_name] ?? [],
      columns: schemas[t.table_name] ?? [],
    })),
    relationships,
    _cachedAt: Date.now(),
    _generatedAt: new Date().toISOString(),
  };

  // Write cache
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(topology, null, 2));
  } catch {}

  return topology;
}

/**
 * runtime/lib/sql.mjs
 * Raw SQL executor via Supabase's /pg/query REST endpoint.
 * This is the same endpoint the Supabase Dashboard SQL Editor uses.
 * No RPC functions needed — works out of the box with the service role key.
 */

import { getUrl, getServiceKey } from "./supabase.mjs";

// ── Core executor ──────────────────────────────────────────────────────────────

/**
 * Execute any SQL statement and return rows.
 * @param {string} query - SQL query string
 * @param {object} opts
 * @param {boolean} opts.silent - suppress logging
 * @returns {Promise<Array>} - array of row objects
 */
export async function executeSQL(query, { silent = false } = {}) {
  const url = `${getUrl()}/pg/query`;

  if (!silent) {
    const preview = query.replace(/\s+/g, " ").trim().slice(0, 120);
    console.log(`\n  🔷 SQL › ${preview}${query.length > 120 ? "…" : ""}`);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getServiceKey()}`,
      apikey: getServiceKey(),
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.message || json.error || text;
    } catch {}
    throw new Error(`SQL Error (${res.status}): ${detail}\n  Query: ${query}`);
  }

  const json = await res.json();

  // Supabase /pg/query returns { rows: [...] } or directly an array
  if (Array.isArray(json)) return json;
  if (json.rows) return json.rows;
  if (json.data) return Array.isArray(json.data) ? json.data : [json.data];
  return [];
}

// ── Formatting ─────────────────────────────────────────────────────────────────

/**
 * Render rows as a formatted ASCII table.
 * @param {Array<object>} rows
 * @param {string} [title]
 */
export function formatTable(rows, title = "") {
  if (!rows || rows.length === 0) {
    return title ? `${title}\n  (no rows)` : "  (no rows)";
  }

  const cols = Object.keys(rows[0]);
  const colWidths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
  );

  const sep = "  +" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const header =
    "  |" +
    cols.map((c, i) => ` ${c.padEnd(colWidths[i])} `).join("|") +
    "|";

  const dataRows = rows.map(
    (row) =>
      "  |" +
      cols
        .map((c, i) => ` ${String(row[c] ?? "").padEnd(colWidths[i])} `)
        .join("|") +
      "|",
  );

  const lines = [
    "",
    ...(title ? [`  ${title}`] : []),
    sep,
    header,
    sep,
    ...dataRows,
    sep,
    `  ${rows.length} row${rows.length !== 1 ? "s" : ""}`,
    "",
  ];

  return lines.join("\n");
}

/**
 * Print formatted table to stdout.
 */
export function printTable(rows, title = "") {
  console.log(formatTable(rows, title));
}

// ── Convenience helpers ────────────────────────────────────────────────────────

/**
 * Run SELECT and print results as a table.
 */
export async function queryAndPrint(sql, title = "") {
  const rows = await executeSQL(sql);
  printTable(rows, title);
  return rows;
}

/**
 * Get a single scalar value from a query.
 * e.g. scalarSQL("SELECT COUNT(*) AS n FROM subjects") → 7
 */
export async function scalarSQL(sql, column) {
  const rows = await executeSQL(sql, { silent: true });
  if (!rows.length) return null;
  const col = column ?? Object.keys(rows[0])[0];
  return rows[0][col];
}

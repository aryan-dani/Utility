/**
 * runtime/tools/query.mjs
 * CLI query tool for running SELECT/INSERT/UPDATE/DELETE or raw SQL.
 * Supports table-based queries or direct SQL strings.
 */

import { select, insert, update, remove } from "../lib/db.mjs";
import { executeSQL, printTable } from "../lib/sql.mjs";

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
  Usage:
    node runtime/tools/query.mjs "<SQL_QUERY>"
    node runtime/tools/query.mjs --table <name> [--where "col=val"] [--limit 10]
    node runtime/tools/query.mjs --insert <table_name> --data '{"col": "val"}'
    `);
    return;
  }

  try {
    if (!args[0].startsWith("--")) {
      // Raw SQL
      const rows = await executeSQL(args[0]);
      printTable(rows, "QUERY RESULTS");
    } else {
      const params = {};
      for (let i = 0; i < args.length; i += 2) {
        params[args[i].replace("--", "")] = args[i + 1];
      }

      if (params.table) {
        const filters = [];
        if (params.where) {
          // Simple parser for "col=val" or "col:eq:val"
          const parts = params.where.split("=");
          if (parts.length === 2) {
            filters.push({ column: parts[0], op: "eq", value: parts[1] });
          }
        }
        
        const { data } = await select(params.table, {
          where: filters,
          limit: params.limit ? parseInt(params.limit) : 100
        });
        printTable(data, `SELECT FROM ${params.table}`);
      } else if (params.insert) {
        const data = JSON.parse(params.data);
        const rows = await insert(params.insert, data);
        printTable(rows, `INSERTED INTO ${params.insert}`);
      }
    }
  } catch (error) {
    console.error(`❌ Query error: ${error.message}`);
  }
}

main();

import { inArray } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import { resources, subjects, workspaceCatalogs } from "../db/schema.js";
import { buildCatalogScopes, type ResourceRow, type SubjectRow } from "./catalogBuild.js";

type Db = ReturnType<typeof getDb>;

export type CatalogSyncResult = {
  /** Scopes written or removed in this pass. 0 means nothing changed. */
  changed: number;
  removed: number;
  resourceCount: number;
};

/**
 * Rebuilds every academic scope from Postgres and writes only the scopes whose
 * content hash changed. Scopes that no longer have any rows are removed.
 */
export async function syncCatalogs(db: Db): Promise<CatalogSyncResult> {
  const resourceRows = (await db.select().from(resources)) as ResourceRow[];
  const subjectRows = (await db.select().from(subjects)) as SubjectRow[];
  const scopes = buildCatalogScopes(resourceRows, subjectRows);

  const existing = await db
    .select({ id: workspaceCatalogs.id, hash: workspaceCatalogs.contentHash })
    .from(workspaceCatalogs);
  const existingHash = new Map(existing.map((row) => [row.id, row.hash]));

  let changed = 0;
  for (const scope of scopes) {
    if (existingHash.get(scope.id) === scope.contentHash) continue;
    const now = new Date();
    await db
      .insert(workspaceCatalogs)
      .values({
        id: scope.id,
        academicYear: scope.academicYear,
        branch: scope.branch,
        semester: scope.semester,
        contentHash: scope.contentHash,
        resourceCount: scope.resourceCount,
        payload: scope.payload,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: workspaceCatalogs.id,
        set: {
          contentHash: scope.contentHash,
          resourceCount: scope.resourceCount,
          payload: scope.payload,
          updatedAt: now,
        },
      });
    changed += 1;
  }

  const keep = new Set(scopes.map((scope) => scope.id));
  const stale = existing.map((row) => row.id).filter((id) => !keep.has(id));
  if (stale.length > 0) {
    await db.delete(workspaceCatalogs).where(inArray(workspaceCatalogs.id, stale));
  }

  return {
    changed: changed + stale.length,
    removed: stale.length,
    resourceCount: resourceRows.length,
  };
}

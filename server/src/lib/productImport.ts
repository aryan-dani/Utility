import { eq, inArray } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import {
  clipboardShares,
  clipboards,
  communityDecks,
  migrateCheckpoint,
  plannerCollaborators,
  plannerPlans,
} from "../db/schema.js";
import { adminFirestore } from "./firebase.js";

type Db = ReturnType<typeof getDb>;

const PRODUCT_IMPORT_KEY = "product_state_v1";

function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate: () => Date }).toDate;
    return typeof fn === "function" ? fn.call(value) : null;
  }
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function int(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export type ProductImportResult = {
  alreadyRun: boolean;
  planners: number;
  collaborators: number;
  clipboards: number;
  shares: number;
  decks: number;
};

/**
 * One-time: copies planner, clipboard, and community data from Firestore into Postgres.
 * Existing Postgres rows win (the home server is newer for anything touched since the
 * switch), so re-runs never overwrite. Guarded by a checkpoint row and one transaction.
 */
export async function importProductState(db: Db): Promise<ProductImportResult> {
  const empty: ProductImportResult = {
    alreadyRun: true,
    planners: 0,
    collaborators: 0,
    clipboards: 0,
    shares: 0,
    decks: 0,
  };
  const [done] = await db
    .select({ done: migrateCheckpoint.done })
    .from(migrateCheckpoint)
    .where(eq(migrateCheckpoint.collection, PRODUCT_IMPORT_KEY))
    .limit(1);
  if (done?.done) return empty;

  const fs = adminFirestore();
  const [plansSnap, collabsSnap, clipsSnap, sharesSnap, decksSnap] = await Promise.all([
    fs.collection("planner_plans").get(),
    fs.collection("planner_collaborators").get(),
    fs.collection("clipboards").get(),
    fs.collection("clipboard_shares").get(),
    fs.collection("community_decks").get(),
  ]);

  const now = new Date();
  const planRows = plansSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const ownerId = text(d.owner_id, 128);
    const month = int(d.month, 0);
    const year = int(d.year, 0);
    if (!ownerId || month < 1 || month > 12 || year < 2000) return [];
    return [
      {
        id: doc.id,
        ownerId,
        ownerEmail: text(d.owner_email, 254),
        month,
        year,
        title: text(d.title, 200) ?? "Plan",
        isPublic: d.is_public === true,
        data: (d.data && typeof d.data === "object" ? d.data : {}) as Record<string, unknown>,
        updatedAt: toDate(d.updated_at) ?? now,
      },
    ];
  });
  const ownerByPlan = new Map(planRows.map((p) => [p.id, p.ownerId]));

  const collabRows = collabsSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const planId = text(d.plan_id, 128);
    const userEmail = text(d.user_email, 254)?.toLowerCase();
    if (!planId || !userEmail) return [];
    return [
      {
        id: doc.id,
        planId,
        userEmail,
        role: (text(d.role, 16) ?? "viewer").toLowerCase(),
        ownerId: text(d.owner_id, 128) ?? ownerByPlan.get(planId) ?? "",
      },
    ];
  });

  const clipRows = clipsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      userId: doc.id,
      text: typeof d.text === "string" ? d.text.slice(0, 32_000) : "",
      updatedAt: toDate(d.updated_at),
      shareId: text(d.share_id, 128),
      shareExpiresAt: toDate(d.share_expires_at),
      driveFileId: text(d.drive_file_id, 128),
      driveFileName: text(d.drive_file_name, 200),
    };
  });

  const liveShares = sharesSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const expiresAt = toDate(d.expires_at);
    const ownerId = text(d.owner_id, 128);
    if (!ownerId || !expiresAt || expiresAt.getTime() <= now.getTime()) return [];
    return [
      {
        id: doc.id,
        ownerId,
        expiresAt,
        createdAt: toDate(d.created_at) ?? now,
      },
    ];
  });

  const deckRows = decksSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const title = text(d.title, 200);
    const authorUid = text(d.author_uid, 128);
    if (!title || !authorUid) return [];
    return [
      {
        id: doc.id,
        title,
        branch: (text(d.branch, 32) ?? "").toUpperCase(),
        semester: int(d.semester, 0),
        authorName: text(d.author_name, 80),
        authorUid,
        flashcards: Array.isArray(d.flashcards) ? d.flashcards : [],
        upvotes: Math.max(0, int(d.upvotes, 0)),
        createdAt: toDate(d.created_at) ?? now,
      },
    ];
  });

  let collaborators = 0;
  await db.transaction(async (tx) => {
    for (const row of planRows) {
      await tx.insert(plannerPlans).values(row).onConflictDoNothing();
    }

    // Collaborator rows can only point at plans that exist (inserted now or earlier).
    const planIds = collabRows.map((c) => c.planId);
    const existing = planIds.length
      ? new Set(
          (
            await tx
              .select({ id: plannerPlans.id })
              .from(plannerPlans)
              .where(inArray(plannerPlans.id, [...new Set(planIds)]))
          ).map((r) => r.id),
        )
      : new Set<string>();
    for (const row of collabRows) {
      if (!existing.has(row.planId)) continue;
      await tx.insert(plannerCollaborators).values(row).onConflictDoNothing();
      collaborators += 1;
    }

    for (const row of clipRows) {
      await tx.insert(clipboards).values(row).onConflictDoNothing();
    }
    for (const row of liveShares) {
      await tx.insert(clipboardShares).values(row).onConflictDoNothing();
    }
    for (const row of deckRows) {
      await tx.insert(communityDecks).values(row).onConflictDoNothing();
    }

    await tx
      .insert(migrateCheckpoint)
      .values({ collection: PRODUCT_IMPORT_KEY, done: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: migrateCheckpoint.collection,
        set: { done: true, updatedAt: new Date() },
      });
  });

  return {
    alreadyRun: false,
    planners: planRows.length,
    collaborators,
    clipboards: clipRows.length,
    shares: liveShares.length,
    decks: deckRows.length,
  };
}

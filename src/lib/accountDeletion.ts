import type { Firestore, Query } from "firebase-admin/firestore";

/** Stay under Firestore's 500-op batch cap. */
export const DELETE_CHUNK = 400;

export async function deleteQueryInChunks(
  db: Firestore,
  query: Query,
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await query.limit(DELETE_CHUNK).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
    if (snap.size < DELETE_CHUNK) break;
  }
  return deleted;
}

async function deleteDocIfExists(
  db: Firestore,
  collection: string,
  id: string,
): Promise<void> {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (snap.exists) await ref.delete();
}

/**
 * Remove Firestore rows owned by this account. Auth user deletion is the
 * caller's responsibility (after this returns).
 */
export async function deleteUserFirestoreData(
  db: Firestore,
  uid: string,
  email: string | null,
): Promise<{ deleted: number }> {
  let deleted = 0;

  const ownedPlans = await db
    .collection("planner_plans")
    .where("owner_id", "==", uid)
    .get();

  for (const plan of ownedPlans.docs) {
    deleted += await deleteQueryInChunks(
      db,
      db.collection("planner_collaborators").where("plan_id", "==", plan.id),
    );
  }

  if (!ownedPlans.empty) {
    for (let i = 0; i < ownedPlans.docs.length; i += DELETE_CHUNK) {
      const batch = db.batch();
      const slice = ownedPlans.docs.slice(i, i + DELETE_CHUNK);
      for (const doc of slice) batch.delete(doc.ref);
      await batch.commit();
      deleted += slice.length;
    }
  }

  deleted += await deleteQueryInChunks(
    db,
    db.collection("planner_collaborators").where("owner_id", "==", uid),
  );

  if (email) {
    deleted += await deleteQueryInChunks(
      db,
      db
        .collection("planner_collaborators")
        .where("user_email", "==", email.toLowerCase()),
    );
  }

  const authoredDecks = await db
    .collection("community_decks")
    .where("author_uid", "==", uid)
    .get();

  for (const deck of authoredDecks.docs) {
    deleted += await deleteQueryInChunks(
      db,
      db.collection("community_deck_upvotes").where("deck_id", "==", deck.id),
    );
  }

  if (!authoredDecks.empty) {
    for (let i = 0; i < authoredDecks.docs.length; i += DELETE_CHUNK) {
      const batch = db.batch();
      const slice = authoredDecks.docs.slice(i, i + DELETE_CHUNK);
      for (const doc of slice) batch.delete(doc.ref);
      await batch.commit();
      deleted += slice.length;
    }
  }

  deleted += await deleteQueryInChunks(
    db,
    db.collection("community_deck_upvotes").where("uid", "==", uid),
  );

  const byOwner = [
    "visualize_progress",
    "visualize_grids",
    "visualize_telemetry",
  ] as const;
  for (const collection of byOwner) {
    deleted += await deleteQueryInChunks(
      db,
      db.collection(collection).where("owner_id", "==", uid),
    );
  }

  deleted += await deleteQueryInChunks(
    db,
    db.collection("resource_usage").where("user_id", "==", uid),
  );
  deleted += await deleteQueryInChunks(
    db,
    db.collection("activity_logs").where("user_id", "==", uid),
  );
  deleted += await deleteQueryInChunks(
    db,
    db.collection("support_messages").where("userId", "==", uid),
  );

  await deleteDocIfExists(db, "srs_data", uid);
  deleted += 1;
  await deleteDocIfExists(db, "users", uid);
  deleted += 1;

  return { deleted };
}

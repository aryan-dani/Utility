import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get("branch");
    const semesterStr = searchParams.get("semester");

    if (!branch || !semesterStr) {
      return NextResponse.json(
        { error: "Branch and semester are required" },
        { status: 400 }
      );
    }

    const semester = parseInt(semesterStr);
    const db = adminDb();

    // 1. Fetch subjects
    const subjectsSnapshot = await db
      .collection("subjects")
      .where("branch", "==", branch)
      .where("semester", "==", semester)
      .get();

    const subjects = subjectsSnapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || "",
        branch: d.branch || "",
        semester: Number(d.semester || 0),
      };
    });

    subjects.sort((a, b) => a.name.localeCompare(b.name));

    if (subjects.length === 0) {
      return NextResponse.json({ subjects: [], resources: [] });
    }

    const subjectIds = subjects.map((s) => s.id);
    const resourcesList: any[] = [];
    const chunkSize = 30;

    // 2. Fetch resources in chunks of 30 due to Firestore query limits
    for (let i = 0; i < subjectIds.length; i += chunkSize) {
      const chunk = subjectIds.slice(i, i + chunkSize);
      const resourcesSnapshot = await db
        .collection("resources")
        .where("subject_id", "in", chunk)
        .get();

      if (resourcesSnapshot.empty) continue;

      const resourceDocIds = resourcesSnapshot.docs.map((d) => d.id);
      const indexedResourceIds = new Set<string>();

      // 3. Query indexed resource contents in chunks of 30
      if (resourceDocIds.length > 0) {
        const resChunkSize = 30;
        const promises = [];
        for (let j = 0; j < resourceDocIds.length; j += resChunkSize) {
          const resChunk = resourceDocIds.slice(j, j + resChunkSize);
          promises.push(
            db
              .collection("resource_content")
              .where("resource_id", "in", resChunk)
              .get()
          );
        }
        const snapshots = await Promise.all(promises);
        snapshots.forEach((rcSnapshot) => {
          rcSnapshot.docs.forEach((doc) => {
            indexedResourceIds.add(doc.data().resource_id);
          });
        });
      }

      resourcesSnapshot.docs.forEach((doc) => {
        const d = doc.data();
        const title = d.title || "";
        if (title.toLowerCase().includes("emptyfolderplaceholder")) return;
        resourcesList.push({
          id: doc.id,
          title: title,
          file_url: d.file_url || "",
          subject_id: d.subject_id || "",
          is_indexed: indexedResourceIds.has(doc.id),
        });
      });
    }

    return NextResponse.json({ subjects, resources: resourcesList });
  } catch (error: any) {
    console.error("Error fetching admin resources:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch admin resources" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, title, subject_id } = body;

    if (!id || !title || !subject_id) {
      return NextResponse.json(
        { error: "id, title, and subject_id are required" },
        { status: 400 }
      );
    }

    const db = adminDb();
    await db.collection("resources").doc(id).update({
      title,
      subject_id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating resource:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update resource" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Resource ID is required" },
        { status: 400 }
      );
    }

    const db = adminDb();
    const batch = db.batch();
    batch.delete(db.collection("resources").doc(id));
    batch.delete(db.collection("resource_content").doc(id));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting resource:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete resource" },
      { status: 500 }
    );
  }
}

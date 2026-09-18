import { adminDb } from "./firebaseAdmin";
import { unstable_cache } from "next/cache";
import { matchesAcademicYear } from "@/lib/academic/scope";
import type { AcademicYear } from "@/lib/academic/scope";
import {
  WORKSPACE_CATALOG_COLLECTION,
  workspaceCatalogId,
  type WorkspaceCatalogDoc,
} from "@/lib/workspaceCatalog";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SubjectItem {
  id: string;
  name: string;
  branch: string;
  semester: number;
}

export interface ResourceItem {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
  subject_name: string;
  category: ResourceCategory;
}

export type ResourceCategory =
  | "notes"
  | "question-bank"
  | "solved-question-bank"
  | "ppt"
  | "pyq"
  | "other"
  | "writeup"
  | "codes";

export type WorkspaceListPayload = {
  resources: ResourceItem[];
  syllabusUrl: string | null;
};

// ─── Filter configuration ────────────────────────────────────────────────────

const EXCLUDED_TITLE_PATTERNS: RegExp[] = [/_notes_\d+$/i];

const EXCLUDED_TITLES: string[] = [
  "aies unit-2 extra (2022)",
  "aies unit_1 (2023)",
  ".emptyfolderplaceholder",
];

/** Per-branch subjects to hide from the site. Empty = show everything Drive syncs. */
const BRANCH_SUBJECT_EXCLUSIONS: Record<string, string[]> = {};

export function getResourceCategory(
  title: string,
  url: string,
): ResourceCategory {
  const haystack = `${title} ${decodeURIComponent(url)}`.toLowerCase();

  if (
    /\bpyqs?\b|[_/-]pyqs?[_/-]|previous[_\s-]*year|past[_\s-]*paper/i.test(
      haystack,
    )
  ) {
    return "pyq";
  }

  // Solved question banks - must check before regular QBs
  if (
    /solved.*\bqbs?\b|\bqbs?\b.*solved|solved.*question[_\s-]*bank/i.test(
      haystack,
    )
  ) {
    return "solved-question-bank";
  }

  if (
    /\bqbs?\b|[_/-]qbs?[_/-]|question[_\s-]*banks?|questions[_\s-]*bank/i.test(
      haystack,
    )
  ) {
    return "question-bank";
  }

  if (
    /_ppt\//.test(haystack) ||
    /[_.-]pptx?\b|\bpptx?\b|presentation|slides?/i.test(haystack)
  ) {
    return "ppt";
  }

  if (
    /_notes\//.test(haystack) ||
    /[_.-]notes?\b|\bnotes?\b|handwritten/i.test(haystack)
  ) {
    return "notes";
  }

  if (
    /_writeups?\//.test(haystack) ||
    /[_.-]writeups?\b|\bwriteups?\b/i.test(haystack)
  ) {
    return "writeup";
  }

  if (
    /_codes?\//.test(haystack) ||
    /[_.-]codes?\b|\bcodes?\b|assignment.*\.(c|h|sh|py)\b/i.test(haystack)
  ) {
    return "codes";
  }

  return "other";
}

function normalizeResources(resources: ResourceItem[], branch: string): ResourceItem[] {
  const excluded = (BRANCH_SUBJECT_EXCLUSIONS[branch] ?? []).map((s) =>
    s.toUpperCase(),
  );
  const seen = new Set<string>();
  return resources
    .filter((item) => {
      const titleLower = item.title.toLowerCase();

      if (!item.title.trim()) return false;
      if (EXCLUDED_TITLE_PATTERNS.some((re) => re.test(titleLower))) return false;
      if (EXCLUDED_TITLES.includes(titleLower)) return false;
      if (excluded.includes(item.subject_name.toUpperCase())) return false;

      const key = `${item.subject_name}-${item.category}-${titleLower}`;
      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    })
    .sort((a, b) =>
      a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchSubjectsFromDB(
  academicYear: AcademicYear,
  branch: string,
  semester: number,
): Promise<SubjectItem[]> {
  try {
    const db = adminDb();
    const snapshot = await db.collection("subjects")
      .where("branch", "==", branch)
      .where("semester", "==", semester)
      .get();

    const subjects: SubjectItem[] = snapshot.docs
      .filter((doc) =>
        matchesAcademicYear(
          doc.data().academic_year as string | undefined,
          academicYear,
        ),
      )
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || "",
          branch: d.branch || "",
          semester: Number(d.semester || 0),
        };
      });

    subjects.sort((a, b) => a.name.localeCompare(b.name));

    const excluded = (BRANCH_SUBJECT_EXCLUSIONS[branch] ?? []).map((s) =>
      s.toUpperCase(),
    );

    return subjects
      .filter((item) => !excluded.includes(item.name.toUpperCase()))
      .filter((item) => item.name.toUpperCase() !== "SYLLABUS");
  } catch (error) {
    console.error("Error fetching subjects from Firestore:", error);
    return [];
  }
}

/** Expensive path: subjects + chunked resource queries (~1 read per resource). */
async function fetchResourcesFromDBRaw(
  academicYear: AcademicYear,
  branch: string,
  semester: number,
): Promise<ResourceItem[]> {
  const db = adminDb();

  const subjectsSnapshot = await db.collection("subjects")
    .where("branch", "==", branch)
    .where("semester", "==", semester)
    .get();

  if (subjectsSnapshot.empty) return [];

  const subjectsMap = new Map<string, string>();
  const subjectIds: string[] = [];

  subjectsSnapshot.docs.forEach((doc) => {
    const d = doc.data();
    if (
      !matchesAcademicYear(d.academic_year as string | undefined, academicYear)
    ) {
      return;
    }
    if (d.name?.toUpperCase() !== "SYLLABUS") {
      subjectsMap.set(doc.id, d.name || "");
      subjectIds.push(doc.id);
    }
  });

  if (subjectIds.length === 0) return [];

  const resources: ResourceItem[] = [];
  const chunkSize = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < subjectIds.length; i += chunkSize) {
    chunks.push(subjectIds.slice(i, i + chunkSize));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      db.collection("resources").where("subject_id", "in", chunk).get(),
    ),
  );

  for (const resourcesSnapshot of snapshots) {
    resourcesSnapshot.docs.forEach((doc) => {
      const d = doc.data();
      const url = d.file_url || "";
      const subId = d.subject_id || "";
      const subName = subjectsMap.get(subId) || "Unknown";

      let createdAtStr = new Date().toISOString();
      if (d.created_at) {
        if (typeof d.created_at.toDate === "function") {
          createdAtStr = d.created_at.toDate().toISOString();
        } else if (d.created_at.seconds) {
          createdAtStr = new Date(d.created_at.seconds * 1000).toISOString();
        } else {
          createdAtStr = new Date(d.created_at).toISOString();
        }
      }

      resources.push({
        id: doc.id,
        title: d.title || "",
        file_url: url,
        created_at: createdAtStr,
        subject_name: subName,
        category: d.category || getResourceCategory(d.title || "", url),
      });
    });
  }

  return normalizeResources(resources, branch);
}

async function fetchSyllabusFile(
  academicYear: AcademicYear,
  branch: string,
  semester: number,
): Promise<string | null> {
  try {
    const db = adminDb();

    const subjectsSnapshot = await db.collection("subjects")
      .where("branch", "==", branch)
      .where("semester", "==", semester)
      .where("name", "==", "Syllabus")
      .limit(5)
      .get();

    const syllabusDoc = subjectsSnapshot.docs.find((doc) =>
      matchesAcademicYear(
        doc.data().academic_year as string | undefined,
        academicYear,
      ),
    );
    if (!syllabusDoc) return null;
    const syllabusSubjectId = syllabusDoc.id;

    const resourcesSnapshot = await db.collection("resources")
      .where("subject_id", "==", syllabusSubjectId)
      .limit(1)
      .get();

    if (resourcesSnapshot.empty) return null;
    return resourcesSnapshot.docs[0].data().file_url || null;
  } catch (error) {
    console.error("Error fetching syllabus file from Firestore:", error);
    return null;
  }
}

async function writeWorkspaceCatalog(
  academicYear: AcademicYear,
  branch: string,
  semester: number,
  payload: WorkspaceListPayload,
): Promise<void> {
  const db = adminDb();
  const id = workspaceCatalogId(academicYear, branch, semester);
  const doc: WorkspaceCatalogDoc = {
    academic_year: academicYear,
    branch,
    semester,
    resources: payload.resources,
    syllabusUrl: payload.syllabusUrl,
    resource_count: payload.resources.length,
    updated_at: new Date().toISOString(),
  };
  await db.collection(WORKSPACE_CATALOG_COLLECTION).doc(id).set(doc);
}

/**
 * Public vault list: prefer 1-doc workspace catalog (Spark-friendly).
 * Cold miss rebuilds once and write-through so later hits cost 1 read.
 */
async function fetchWorkspaceListRaw(
  academicYear: AcademicYear,
  branch: string,
  semester: number,
): Promise<WorkspaceListPayload> {
  const db = adminDb();
  const id = workspaceCatalogId(academicYear, branch, semester);

  try {
    const snap = await db.collection(WORKSPACE_CATALOG_COLLECTION).doc(id).get();
    if (snap.exists) {
      const d = snap.data() as WorkspaceCatalogDoc;
      if (Array.isArray(d.resources)) {
        return {
          resources: d.resources,
          syllabusUrl:
            typeof d.syllabusUrl === "string" || d.syllabusUrl === null
              ? d.syllabusUrl
              : null,
        };
      }
    }
  } catch (error) {
    console.warn("workspace catalog read failed, rebuilding:", error);
  }

  const [resources, syllabusUrl] = await Promise.all([
    fetchResourcesFromDBRaw(academicYear, branch, semester),
    fetchSyllabusFile(academicYear, branch, semester),
  ]);
  const payload = { resources, syllabusUrl };

  try {
    await writeWorkspaceCatalog(academicYear, branch, semester, payload);
  } catch (error) {
    console.warn("workspace catalog write-through failed:", error);
  }

  return payload;
}

// ─── Exported Cache-Wrapped API ───────────────────────────────────────────────

export const getSubjectsFromDB = (
  academicYear: AcademicYear,
  branch: string,
  semester: number,
) => unstable_cache(
  () => fetchSubjectsFromDB(academicYear, branch, semester),
  ["subjects-cache", academicYear, branch, semester.toString()],
  { revalidate: 86400, tags: ["subjects"] }
)();

export const getResourcesFromDB = (
  academicYear: AcademicYear,
  branch: string,
  semester: number,
) =>
  unstable_cache(
    async () => {
      const { resources } = await fetchWorkspaceListRaw(
        academicYear,
        branch,
        semester,
      );
      return resources;
    },
    ["resources-cache", academicYear, branch, semester.toString()],
    { revalidate: 86400, tags: ["resources"] },
  )();

export const getSyllabusFile = (
  academicYear: AcademicYear,
  branch: string,
  semester: number,
) =>
  unstable_cache(
    async () => {
      const { syllabusUrl } = await fetchWorkspaceListRaw(
        academicYear,
        branch,
        semester,
      );
      return syllabusUrl;
    },
    ["syllabus-cache", academicYear, branch, semester.toString()],
    { revalidate: 86400, tags: ["syllabus", "resources"] },
  )();

/** Single cached payload for /api/resources/list (1 Data Cache entry). */
export const getWorkspaceList = (
  academicYear: AcademicYear,
  branch: string,
  semester: number,
) =>
  unstable_cache(
    () => fetchWorkspaceListRaw(academicYear, branch, semester),
    ["workspace-list", academicYear, branch, semester.toString()],
    { revalidate: 86400, tags: ["resources", "syllabus"] },
  )();

export type HomeStats = {
  subjects: number;
  resources: number;
  branches: number;
  semesters: number;
};

async function fetchHomeStatsFromGlobal(): Promise<HomeStats | null> {
  try {
    const db = adminDb();
    const snap = await db.collection("stats").doc("global").get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    const subjects = Number(d.subjects);
    const resources = Number(d.resources);
    const branches = Number(d.branches);
    const semesters = Number(d.semesters);
    if (
      ![subjects, resources, branches, semesters].every((n) =>
        Number.isFinite(n),
      )
    ) {
      return null;
    }
    return { subjects, resources, branches, semesters };
  } catch (err) {
    console.warn("stats/global read failed:", err);
    return null;
  }
}

export const getHomeStats = () =>
  unstable_cache(
    () => fetchHomeStatsFromGlobal(),
    ["home-stats-global"],
    { revalidate: 86400, tags: ["subjects", "resources"] },
  )();

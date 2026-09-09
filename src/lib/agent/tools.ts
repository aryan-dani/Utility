import {
  AIDS_SEM_3_SUBJECTS_2026,
  AIDS_SEM_4_SUBJECTS,
  AIDS_SEM_5_SUBJECTS,
  type SyllabusOfficialSubject,
} from "@/lib/syllabusData";
import { retrieve } from "@/lib/rag/retrieve";
import type { RetrievalResult } from "@/lib/rag/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { matchesAcademicYear } from "@/lib/academic/scope";
import type { AcademicYear } from "@/lib/academic/scope";
import type { Query } from "firebase-admin/firestore";

export interface ToolContext {
  academicYear?: string;
  branch: string;
  semester: number;
  subjects: string[];
  resourceId?: string;
  queryEmbedding?: number[];
}

export async function searchNotes(
  query: string,
  ctx: ToolContext,
  category?: string,
): Promise<RetrievalResult> {
  return retrieve({
    query,
    academicYear: ctx.academicYear,
    branch: ctx.branch,
    semester: ctx.semester,
    resourceId: ctx.resourceId,
    limit: 5,
    categoryBoost: category ? [category] : undefined,
    subjects: ctx.subjects.length > 0 ? ctx.subjects : undefined,
    queryEmbedding: ctx.queryEmbedding,
  });
}

export async function findPyq(
  query: string,
  ctx: ToolContext,
): Promise<RetrievalResult> {
  return retrieve({
    query,
    academicYear: ctx.academicYear,
    branch: ctx.branch,
    semester: ctx.semester,
    limit: 5,
    categoryBoost: ["pyq", "question-bank", "solved-question-bank"],
    subjects: ctx.subjects.length > 0 ? ctx.subjects : undefined,
    queryEmbedding: ctx.queryEmbedding,
  });
}

export async function compareTopics(
  topicA: string,
  topicB: string,
  ctx: ToolContext,
): Promise<{ a: RetrievalResult; b: RetrievalResult }> {
  const [a, b] = await Promise.all([
    searchNotes(topicA, ctx),
    searchNotes(topicB, ctx),
  ]);
  return { a, b };
}

function allSyllabusSubjects(): SyllabusOfficialSubject[] {
  return [
    ...AIDS_SEM_3_SUBJECTS_2026,
    ...AIDS_SEM_4_SUBJECTS,
    ...AIDS_SEM_5_SUBJECTS,
  ];
}

export function getSyllabusUnit(
  subjectHint: string,
  unitNumber?: number,
): { subject: string; units: Array<{ title: string; desc: string }> } | null {
  const hint = subjectHint.toLowerCase();
  const subject = allSyllabusSubjects().find(
    (s) =>
      s.name.toLowerCase().includes(hint) ||
      s.code.toLowerCase() === hint ||
      s.id.toLowerCase() === hint,
  );

  if (!subject) return null;

  let modules = subject.modules;
  if (unitNumber != null && unitNumber >= 1 && unitNumber <= modules.length) {
    modules = [modules[unitNumber - 1]];
  }

  return {
    subject: subject.name,
    units: modules.map((m) => ({ title: m.title, desc: m.desc })),
  };
}

export async function listResources(
  ctx: ToolContext,
  category?: string,
): Promise<Array<{ id: string; title: string; category: string; subject_name: string }>> {
  const db = adminDb();
  let ref: Query = db.collection("resources");
  if (ctx.branch) ref = ref.where("branch", "==", ctx.branch);
  if (ctx.semester != null) ref = ref.where("semester", "==", ctx.semester);
  const snap = await ref.limit(100).get();

  let subjectRef: Query = db.collection("subjects");
  if (ctx.branch) subjectRef = subjectRef.where("branch", "==", ctx.branch);
  if (ctx.semester != null) subjectRef = subjectRef.where("semester", "==", ctx.semester);
  let subjectSnap;
  try {
    subjectSnap = await subjectRef.get();
  } catch {
    subjectSnap = await db.collection("subjects").get();
  }
  const subjectMap = new Map<string, string>(
    subjectSnap.docs.map((s) => [
      s.id,
      String(s.data().name || ""),
    ]),
  );

  const results: Array<{ id: string; title: string; category: string; subject_name: string }> = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    if (
      ctx.academicYear &&
      !matchesAcademicYear(d.academic_year as string | undefined, ctx.academicYear as AcademicYear)
    ) {
      continue;
    }
    if (ctx.branch && d.branch && d.branch !== ctx.branch) continue;
    if (ctx.semester != null && d.semester != null && Number(d.semester) !== Number(ctx.semester)) {
      continue;
    }
    if (category && d.category !== category) continue;
    const subjectName = subjectMap.get(d.subject_id as string) || "Unknown";
    if (ctx.subjects.length > 0 && !ctx.subjects.some((s) => subjectName.includes(s))) {
      continue;
    }
    results.push({
      id: doc.id,
      title: (d.title as string) || "Untitled",
      category: (d.category as string) || "other",
      subject_name: subjectName,
    });
  }

  return results.slice(0, 20);
}

export async function executeTool(
  toolName: string,
  args: Record<string, string | number | undefined>,
  ctx: ToolContext,
): Promise<RetrievalResult | { syllabus: ReturnType<typeof getSyllabusUnit> } | { resources: Awaited<ReturnType<typeof listResources>> } | { a: RetrievalResult; b: RetrievalResult }> {
  switch (toolName) {
    case "search_notes":
      return searchNotes(String(args.query || ""), ctx, args.category as string | undefined);
    case "find_pyq":
      return findPyq(String(args.query || ""), ctx);
    case "get_syllabus_unit":
      return {
        syllabus: getSyllabusUnit(
          String(args.subject || ""),
          typeof args.unitNumber === "number" ? args.unitNumber : undefined,
        ),
      };
    case "list_resources":
      return { resources: await listResources(ctx, args.category as string | undefined) };
    case "compare_topics":
      return compareTopics(
        String(args.topicA || ""),
        String(args.topicB || ""),
        ctx,
      );
    default:
      return searchNotes(String(args.query || ""), ctx);
  }
}

export function pickTool(intent: string): string {
  switch (intent) {
    case "pyq":
      return "find_pyq";
    case "syllabus":
      return "get_syllabus_unit";
    case "locate":
      return "list_resources";
    case "compare":
      return "compare_topics";
    default:
      return "search_notes";
  }
}

import { createClient as createBrowserClient } from "./supabase";
import { createAdminClient } from "./supabaseAdmin";
import { unstable_cache } from "next/cache";
import { SupabaseClient } from "@supabase/supabase-js";

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
  | "writeup";

// ─── Internal types for Supabase query results ────────────────────────────────

interface SubjectRow {
  id: string;
  name: string;
  branch: string;
  semester: number;
}

// ─── Filter configuration ────────────────────────────────────────────────────

const EXCLUDED_TITLE_PATTERNS: RegExp[] = [/_notes_\d+$/i];

const EXCLUDED_TITLES: string[] = [
  "aies unit-2 extra (2022)",
  "aies unit_1 (2023)",
  ".emptyfolderplaceholder",
];

const BRANCH_SUBJECT_EXCLUSIONS: Record<string, string[]> = {
  AIDS: ["DBMS"],
};

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

  // Solved question banks — must check before regular QBs
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
    /\bpptx?\b|presentation|slides?/.test(haystack)
  ) {
    return "ppt";
  }

  if (/_notes\//.test(haystack) || /\bnotes?\b|handwritten/.test(haystack)) {
    return "notes";
  }

  if (/_writeups?\//.test(haystack) || /\bwriteups?\b/.test(haystack)) {
    return "writeup";
  }

  return "other";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const getSubjectsFromDB = unstable_cache(
  async (
    branch: string,
    semester: number,
    supabaseClient?: SupabaseClient,
  ): Promise<SubjectItem[]> => {
    const supabase = supabaseClient ?? createBrowserClient();
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, branch, semester")
      .eq("branch", branch)
      .eq("semester", semester)
      .order("name");

    if (error) {
      console.error("Error fetching subjects:", error.message);
      return [];
    }

    const excluded = (BRANCH_SUBJECT_EXCLUSIONS[branch] ?? []).map((s) =>
      s.toUpperCase(),
    );

    return (data as SubjectRow[])
      .filter((item) => !excluded.includes(item.name.toUpperCase()))
      .filter((item) => item.name.toUpperCase() !== "SYLLABUS");
  },
  ["subjects-cache"],
  { revalidate: 3600 },
);

export const getResourcesFromDB = unstable_cache(
  async (
    branch: string,
    semester: number,
    supabaseClient?: SupabaseClient,
  ): Promise<ResourceItem[]> => {
    const supabase = supabaseClient ?? createBrowserClient();

    const { data, error } = await supabase
      .from("resources")
      .select(
        `
      id,
      title,
      file_url,
      created_at,
      subjects!inner(
        name,
        branch,
        semester
      )
    `,
      )
      .eq("subjects.branch", branch)
      .eq("subjects.semester", semester);

    if (error) {
      console.error("Error fetching resources:", error.message);
      return [];
    }

    const excluded = (BRANCH_SUBJECT_EXCLUSIONS[branch] ?? []).map((s) =>
      s.toUpperCase(),
    );

    const resources: ResourceItem[] = (data as any[])
      .filter((item) => item.subjects?.name?.toUpperCase() !== "SYLLABUS")
      .map((item) => {
        const url = item.file_url;

        return {
          id: item.id,
          title: item.title,
          file_url: url,
          created_at: item.created_at,
          subject_name: item.subjects?.name ?? "Unknown",
          category: getResourceCategory(item.title, url),
        };
      });

    // Deduplicate and filter
    const seen = new Set<string>();
    return resources
      .filter((item) => {
        const titleLower = item.title.toLowerCase();

        if (!item.title.trim()) return false;
        if (EXCLUDED_TITLE_PATTERNS.some((re) => re.test(titleLower)))
          return false;
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
  },
  ["resources-cache"],
  { revalidate: 3600 },
);

export const getSyllabusFile = unstable_cache(
  async (
    branch: string,
    semester: number,
    supabaseClient?: SupabaseClient,
  ): Promise<string | null> => {
    const supabase = supabaseClient ?? createBrowserClient();

    const { data, error } = await supabase
      .from("resources")
      .select(`file_url, subjects!inner(name, branch, semester)`)
      .eq("subjects.branch", branch)
      .eq("subjects.semester", semester)
      .eq("subjects.name", "Syllabus")
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.file_url;
  },
  ["syllabus-cache"],
  { revalidate: 3600 },
);

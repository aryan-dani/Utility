import { createClient } from "./supabase";

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
  category: "ppt" | "notes" | "other";
}

// ─── Internal types for Supabase query results ────────────────────────────────

interface SubjectRow {
  id: string;
  name: string;
  branch: string;
  semester: number;
}

interface ResourceRow {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
  subjects: Array<{
    name: string;
    branch: string;
    semester: number;
  }>;
}

// ─── Filter configuration ────────────────────────────────────────────────────

/**
 * Title patterns to exclude from the resource list.
 * These are legacy/duplicate files identified during cleanup.
 */
const EXCLUDED_TITLE_PATTERNS: RegExp[] = [
  /_notes_\d+$/i,       // e.g. "NOTES_1", "NOTES_2"
];

const EXCLUDED_TITLES: string[] = [
  "aies unit-2 extra (2022)",
  "aies unit_1 (2023)",
];

/**
 * Subjects to exclude for a specific branch.
 */
const BRANCH_SUBJECT_EXCLUSIONS: Record<string, string[]> = {
  AIDS: ["DBMS"],
};

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSubjectsFromDB(
  branch: string,
  semester: number,
): Promise<SubjectItem[]> {
  const supabase = createClient();
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

  return (data as SubjectRow[]).filter(
    (item) => !excluded.includes(item.name.toUpperCase()),
  );
}

export async function getResourcesFromDB(
  branch: string,
  semester: number,
): Promise<ResourceItem[]> {
  const supabase = createClient();

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

  const resources: ResourceItem[] = (data as any[]).map((item) => {
    const url = item.file_url;
    let category: "ppt" | "notes" | "other" = "other";
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes("_ppt/")) category = "ppt";
    else if (lowerUrl.includes("_notes/")) category = "notes";

    return {
      id: item.id,
      title: item.title,
      file_url: url,
      created_at: item.created_at,
      subject_name: item.subjects?.name ?? "Unknown",
      category,
    };
  });

  // Deduplicate and filter
  const seen = new Set<string>();
  return resources.filter((item) => {
    const titleLower = item.title.toLowerCase();

    // Excluded title patterns
    if (!item.title.trim()) return false;
    if (EXCLUDED_TITLE_PATTERNS.some((re) => re.test(titleLower))) return false;

    // Excluded specific titles
    if (EXCLUDED_TITLES.includes(titleLower)) return false;

    // Branch-specific subject exclusions
    if (excluded.includes(item.subject_name.toUpperCase())) return false;

    // Deduplicate by subject + category + title
    const key = `${item.subject_name}-${item.category}-${titleLower}`;
    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

import {
  BRANCHES,
  BRANCH_OPTIONS_LONG,
  DEFAULT_ACADEMIC_YEAR,
  SEMESTERS,
  type Branch,
  type Semester,
} from "@/lib/academic/scope";
import {
  getSubjectsFromDB,
  getWorkspaceList,
  type ResourceCategory,
  type ResourceItem,
  type SubjectItem,
} from "@/lib/dataFetcher";
import {
  AIDS_SEM_3_SUBJECTS_2026,
  AIDS_SEM_4_SUBJECTS,
  AIDS_SEM_5_SUBJECTS,
  type SyllabusOfficialSubject,
} from "@/lib/syllabusData";
import { absoluteUrl } from "@/lib/seo";

export const MIT_WPU_YEAR = DEFAULT_ACADEMIC_YEAR;

export type PublicResourceTitle = {
  title: string;
  category: ResourceCategory;
  subject_name: string;
};

export function branchLabel(branch: string): string {
  const hit = BRANCH_OPTIONS_LONG.find(
    (entry) => entry.value === branch.toUpperCase(),
  );
  return hit?.label ?? branch.toUpperCase();
}

export function branchSlug(branch: string): string {
  return branch.toLowerCase();
}

export function parseBranchParam(value: string): Branch | null {
  const upper = value.toUpperCase();
  return (BRANCHES as readonly string[]).includes(upper)
    ? (upper as Branch)
    : null;
}

export function parseSemesterParam(value: string): Semester | null {
  const n = Number(value);
  return (SEMESTERS as readonly number[]).includes(n) ? (n as Semester) : null;
}

export function slugifySubject(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function officialAidsSubjects(
  semester: number,
): SyllabusOfficialSubject[] {
  if (semester === 3) return AIDS_SEM_3_SUBJECTS_2026;
  if (semester === 4) return AIDS_SEM_4_SUBJECTS;
  if (semester === 5) return AIDS_SEM_5_SUBJECTS;
  return [];
}

export function findOfficialSubject(
  branch: string,
  semester: number,
  subjectSlug: string,
): SyllabusOfficialSubject | null {
  if (branch.toUpperCase() !== "AIDS") return null;
  return (
    officialAidsSubjects(semester).find(
      (subject) => slugifySubject(subject.name) === subjectSlug,
    ) ?? null
  );
}

/** Titles only — never expose Drive URLs on public HTML. */
export function publicResourceTitles(
  resources: ResourceItem[],
): PublicResourceTitle[] {
  return resources.map((resource) => ({
    title: resource.title,
    category: resource.category,
    subject_name: resource.subject_name,
  }));
}

export async function loadSemesterCatalog(branch: Branch, semester: Semester) {
  const [subjects, workspace] = await Promise.all([
    getSubjectsFromDB(MIT_WPU_YEAR, branch, semester),
    getWorkspaceList(MIT_WPU_YEAR, branch, semester),
  ]);
  return {
    subjects,
    resources: publicResourceTitles(workspace.resources),
    resourceCount: workspace.resources.length,
  };
}

export function matchSubjectResources(
  resources: PublicResourceTitle[],
  subjectName: string,
): PublicResourceTitle[] {
  const target = subjectName.trim().toLowerCase();
  return resources.filter(
    (resource) => resource.subject_name.trim().toLowerCase() === target,
  );
}

export function resolveSubjectName(
  subjects: SubjectItem[],
  subjectSlug: string,
  official: SyllabusOfficialSubject | null,
): string | null {
  if (official) return official.name;
  const hit = subjects.find(
    (subject) => slugifySubject(subject.name) === subjectSlug,
  );
  return hit?.name ?? null;
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function mitWpuHubPaths(): string[] {
  const paths = ["/mit-wpu"];
  for (const branch of BRANCHES) {
    const b = branchSlug(branch);
    paths.push(`/mit-wpu/${b}`);
    for (const semester of SEMESTERS) {
      paths.push(`/mit-wpu/${b}/semester/${semester}`);
    }
  }
  paths.push(
    "/mit-wpu/study-planner",
    "/mit-wpu/flashcards",
    "/mit-wpu/ask-ai",
    "/mit-wpu/focus-timer",
  );
  return paths;
}

export async function mitWpuSubjectPaths(): Promise<
  Array<{ branch: string; semester: string; subject: string }>
> {
  const params: Array<{ branch: string; semester: string; subject: string }> =
    [];

  const aidsBySem: Array<[number, SyllabusOfficialSubject[]]> = [
    [3, AIDS_SEM_3_SUBJECTS_2026],
    [4, AIDS_SEM_4_SUBJECTS],
    [5, AIDS_SEM_5_SUBJECTS],
  ];
  for (const [semester, list] of aidsBySem) {
    for (const subject of list) {
      params.push({
        branch: "aids",
        semester: String(semester),
        subject: slugifySubject(subject.name),
      });
    }
  }

  // Prefer catalog subjects when Firebase is available at build/ISR time.
  for (const branch of BRANCHES) {
    for (const semester of SEMESTERS) {
      try {
        const subjects = await getSubjectsFromDB(
          MIT_WPU_YEAR,
          branch,
          semester,
        );
        for (const subject of subjects) {
          params.push({
            branch: branchSlug(branch),
            semester: String(semester),
            subject: slugifySubject(subject.name),
          });
        }
      } catch {
        // Build environments without Firebase still get AIDS outline paths.
      }
    }
  }

  const seen = new Set<string>();
  return params.filter((entry) => {
    const key = `${entry.branch}/${entry.semester}/${entry.subject}`;
    if (seen.has(key) || !entry.subject) return false;
    seen.add(key);
    return true;
  });
}

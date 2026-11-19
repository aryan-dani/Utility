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

/** Catalog folders that should never get a public subject landing. */
const JUNK_SUBJECT_SLUGS = new Set(["general"]);

export type PublicResourceTitle = {
  title: string;
  category: ResourceCategory;
  subject_name: string;
};

export type MitWpuSubjectPath = {
  branch: string;
  semester: string;
  subject: string;
};

export type MitWpuSemesterPath = {
  branch: string;
  n: string;
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

export function isJunkSubjectSlug(slug: string): boolean {
  return JUNK_SUBJECT_SLUGS.has(slug);
}

export function officialAidsSubjects(
  semester: number,
): SyllabusOfficialSubject[] {
  if (semester === 3) return AIDS_SEM_3_SUBJECTS_2026;
  if (semester === 4) return AIDS_SEM_4_SUBJECTS;
  if (semester === 5) return AIDS_SEM_5_SUBJECTS;
  return [];
}

/** Canonical public slug is always the official full name. */
export function officialCanonicalSlug(
  subject: SyllabusOfficialSubject,
): string {
  return slugifySubject(subject.name);
}

export function officialAliasSlugs(
  subject: SyllabusOfficialSubject,
): string[] {
  const slugs = new Set<string>([
    slugifySubject(subject.name),
    slugifySubject(subject.code),
  ]);
  return [...slugs].filter(Boolean);
}

export function officialResourceAliases(
  subject: SyllabusOfficialSubject,
): string[] {
  return [subject.name, subject.code]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Match by full-name slug or official code slug (e.g. `ds` → Data Structures).
 */
export function findOfficialSubject(
  branch: string,
  semester: number,
  subjectSlug: string,
): SyllabusOfficialSubject | null {
  if (branch.toUpperCase() !== "AIDS") return null;
  return (
    officialAidsSubjects(semester).find((subject) =>
      officialAliasSlugs(subject).includes(subjectSlug),
    ) ?? null
  );
}

/**
 * When the request slug is a code alias, return the canonical name slug for a 308.
 */
export function officialRedirectSlug(
  branch: string,
  semester: number,
  subjectSlug: string,
): string | null {
  const official = findOfficialSubject(branch, semester, subjectSlug);
  if (!official) return null;
  const canonical = officialCanonicalSlug(official);
  return canonical !== subjectSlug ? canonical : null;
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
  // CI / local builds often lack Firebase Admin credentials. Public pages must
  // still prerender from in-repo AIDS outlines + empty resource titles.
  try {
    const [subjects, workspace] = await Promise.all([
      getSubjectsFromDB(MIT_WPU_YEAR, branch, semester),
      getWorkspaceList(MIT_WPU_YEAR, branch, semester),
    ]);
    return {
      subjects,
      resources: publicResourceTitles(workspace.resources),
      resourceCount: workspace.resources.length,
    };
  } catch {
    return {
      subjects: [] as SubjectItem[],
      resources: [] as PublicResourceTitle[],
      resourceCount: 0,
    };
  }
}

export function matchSubjectResources(
  resources: PublicResourceTitle[],
  subjectName: string,
  official: SyllabusOfficialSubject | null = null,
): PublicResourceTitle[] {
  const aliases = new Set(
    (official
      ? officialResourceAliases(official)
      : [subjectName.trim().toLowerCase()]
    ).filter(Boolean),
  );
  return resources.filter((resource) =>
    aliases.has(resource.subject_name.trim().toLowerCase()),
  );
}

export function resolveSubjectName(
  subjects: SubjectItem[],
  subjectSlug: string,
  official: SyllabusOfficialSubject | null,
): string | null {
  if (official) return official.name;
  if (isJunkSubjectSlug(subjectSlug)) return null;
  const hit = subjects.find(
    (subject) => slugifySubject(subject.name) === subjectSlug,
  );
  return hit?.name ?? null;
}

/**
 * Prefer official full names for AIDS Sem 3–5; append catalog-only subjects
 * that are not code aliases of an official outline.
 */
export function semesterSubjectLinks(
  branch: Branch,
  semester: Semester,
  subjects: SubjectItem[],
): Array<{ id: string; name: string; slug: string }> {
  const official = officialAidsSubjects(semester);
  if (branch === "AIDS" && official.length > 0) {
    const aliasSlugs = new Set(
      official.flatMap((subject) => officialAliasSlugs(subject)),
    );
    const extras = subjects
      .filter((subject) => {
        const slug = slugifySubject(subject.name);
        return slug && !isJunkSubjectSlug(slug) && !aliasSlugs.has(slug);
      })
      .map((subject) => ({
        id: subject.id,
        name: subject.name,
        slug: slugifySubject(subject.name),
      }));
    return [
      ...official.map((subject) => ({
        id: subject.id,
        name: subject.name,
        slug: officialCanonicalSlug(subject),
      })),
      ...extras,
    ];
  }

  return subjects
    .filter((subject) => {
      const slug = slugifySubject(subject.name);
      return slug && !isJunkSubjectSlug(slug);
    })
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      slug: slugifySubject(subject.name),
    }));
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
  return [
    "/mit-wpu",
    ...BRANCHES.map((branch) => `/mit-wpu/${branchSlug(branch)}`),
    "/mit-wpu/study-planner",
    "/mit-wpu/flashcards",
    "/mit-wpu/ask-ai",
    "/mit-wpu/focus-timer",
  ];
}

export function semesterHasIndexableSubjects(
  branch: Branch,
  semester: Semester,
  subjects: SubjectItem[],
): boolean {
  if (branch === "AIDS" && officialAidsSubjects(semester).length > 0) {
    return true;
  }
  return subjects.some((subject) => {
    const slug = slugifySubject(subject.name);
    return Boolean(slug) && !isJunkSubjectSlug(slug);
  });
}

export async function mitWpuSemesterPaths(): Promise<MitWpuSemesterPath[]> {
  const params: MitWpuSemesterPath[] = [];
  for (const branch of BRANCHES) {
    for (const semester of SEMESTERS) {
      const { subjects } = await loadSemesterCatalog(branch, semester);
      if (!semesterHasIndexableSubjects(branch, semester, subjects)) continue;
      params.push({
        branch: branchSlug(branch),
        n: String(semester),
      });
    }
  }
  return params;
}

export async function mitWpuSubjectPaths(): Promise<MitWpuSubjectPath[]> {
  const params: MitWpuSubjectPath[] = [];

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
        subject: officialCanonicalSlug(subject),
      });
    }
  }

  const officialAliasBySem = new Map<number, Set<string>>();
  for (const [semester, list] of aidsBySem) {
    officialAliasBySem.set(
      semester,
      new Set(list.flatMap((subject) => officialAliasSlugs(subject))),
    );
  }

  for (const branch of BRANCHES) {
    for (const semester of SEMESTERS) {
      try {
        const subjects = await getSubjectsFromDB(
          MIT_WPU_YEAR,
          branch,
          semester,
        );
        const aliases =
          branch === "AIDS"
            ? officialAliasBySem.get(semester) ?? new Set<string>()
            : new Set<string>();
        for (const subject of subjects) {
          const slug = slugifySubject(subject.name);
          if (!slug || isJunkSubjectSlug(slug)) continue;
          // AIDS Sem 3–5: skip code aliases already covered by official name URLs.
          if (aliases.has(slug)) continue;
          params.push({
            branch: branchSlug(branch),
            semester: String(semester),
            subject: slug,
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

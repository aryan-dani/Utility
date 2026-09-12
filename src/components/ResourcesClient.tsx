"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppLink from "@/components/ui/AppLink";
import { ResourceItem } from "@/lib/dataFetcher";
import { useAcademicStore } from "@/store/academicStore";
import { isSubjectMatch } from "@/lib/subjectMatcher";
import { motion } from "framer-motion";
import {
  HardDrive,
  BookOpenCheck,
  FileText,
  FileSpreadsheet,
  Folder,
  Layers,
  Search,
  PenTool,
  Brain,
  CheckCircle2,
  Code2,
  Loader2,
  ChevronRight,
  ClipboardList,
  Clock,
  Star,
  X,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { notify } from "@/lib/toast";
import ResourceSection from "./resources/ResourceSection";
import { cleanResourceTitle } from "@/lib/titleUtils";
import { NotesDisclaimer } from "./NotesDisclaimer";
import { isDatasetResource } from "@/lib/resourceLinks";
import { auth } from "@/lib/firebase";
import {
  groupByAssignment,
  groupByUnit,
  groupByYear,
  subjectSummaryCounts,
  folderIdForResource,
  folderLabelFromId,
  findAssignmentSiblings,
  folderScopeSubject,
  subjectFolderScope,
} from "@/lib/resourceGroups";
import {
  resolveSubjectName,
  subjectToSlug,
  parseResourceFilter,
  parseResourceFolder,
  buildResourcesHref,
  pageFromSectionLabel,
  type ResourceFilter,
} from "@/lib/resourceUrl";
import {
  getRecentResources,
  pushRecentResource,
  type RecentResource,
} from "@/lib/recentResources";
import {
  getFavoriteResources,
  toggleFavoriteResource,
  removeFavoriteResource,
  type FavoriteResource,
} from "@/lib/favoriteResources";
import { getReadingProgress } from "@/lib/readingProgress";
import { logResourceOpen } from "@/lib/activity";
import { authFetch } from "@/lib/authFetch";
import { useWorkspaceResources } from "@/lib/useWorkspaceResources";
import { Button, Card, Badge, PageHeader, Input, IconButton, EmptyState, ErrorState } from "@/components/ui";
import PageSkeleton from "@/components/PageSkeleton";
import type { RAGSearchResult } from "@/lib/ragSearch";

const ResourceViewer = dynamic(() => import("./ResourceViewer"), { ssr: false });
const SummaryModal = dynamic(() => import("./SummaryModal"), { ssr: false });
const QASubjectTab = dynamic(() => import("./qa/QASubjectTab"), { ssr: false });

const RESOURCE_FILTERS: { value: ResourceFilter; label: string; Icon: LucideIcon }[] =
  [
    { value: "all", label: "All", Icon: Layers },
    { value: "notes", label: "Notes", Icon: FileText },
    { value: "question-bank", label: "Question Banks", Icon: BookOpenCheck },
    { value: "ppt", label: "Presentations", Icon: FileSpreadsheet },
    { value: "pyq", label: "PYQ", Icon: FileText },
    { value: "writeup", label: "Writeups", Icon: PenTool },
    { value: "codes", label: "Codes", Icon: Code2 },
    { value: "social", label: "Social", Icon: MessageCircle },
  ];

function isAssignmentCategory(category: string): boolean {
  return category === "writeup" || category === "codes";
}

function filterLabel(filter: ResourceFilter): string | null {
  if (filter === "all") return null;
  if (filter === "social") return "Social";
  if (filter === "writeup" || filter === "codes") return "Assignments";
  const match = RESOURCE_FILTERS.find((f) => f.value === filter);
  return match?.label ?? filter;
}

export default function ResourcesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { searchQuery, setSearchQuery, aiSearchQuery, setAiSearchQuery } =
    useAcademicStore();
  const {
    resources,
    loading: catalogLoading,
    error: catalogError,
    retry: retryCatalog,
    academicYear,
    branch,
    semester,
  } = useWorkspaceResources();

  const initialFilter = parseResourceFilter(searchParams.get("filter"));
  const initialView = searchParams.get("view");
  const initialFolder = searchParams.get("folder");
  const initialSubject = searchParams.get("subject");

  // Defaults only for first paint — URL deep-links apply in useEffect after mount
  // so static SSR (empty searchParams) matches the client hydration pass.
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ResourceFilter>("all");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [viewerResource, setViewerResource] = useState<ResourceItem | null>(
    null,
  );
  const [viewerPage, setViewerPage] = useState<number | null>(null);
  const [recentResources, setRecentResources] = useState<RecentResource[]>([]);
  const [favoriteResources, setFavoriteResources] = useState<FavoriteResource[]>([]);
  const [summarizingResource, setSummarizingResource] =
    useState<ResourceItem | null>(null);
  const [contentResults, setContentResults] = useState<RAGSearchResult[]>([]);
  const [isSearchingContent, setIsSearchingContent] = useState(false);
  const [didOpenInitialView, setDidOpenInitialView] = useState(false);
  const [didHydrateFromUrl, setDidHydrateFromUrl] = useState(false);
  const [skipFolderUrlHydrate, setSkipFolderUrlHydrate] = useState(true);
  const [lastUserSubject, setLastUserSubject] = useState<string | null>(null);
  const [isSubjectPending, setIsSubjectPending] = useState(false);
  const scopeKey = `${academicYear}:${branch}:${semester}`;
  const [prevScope, setPrevScope] = useState(scopeKey);
  const [scopeLoading, setScopeLoading] = useState(false);
  const subjectPendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestId = useRef(0);

  if (prevScope !== scopeKey) {
    setPrevScope(scopeKey);
    setDidHydrateFromUrl(false);
    setLastUserSubject(null);
    setDidOpenInitialView(false);
    setScopeLoading(true);
    setSelectedFilter("all");
    setActiveFolderId(null);
    setViewerResource(null);
  }
  const isScopeLoading = scopeLoading && catalogLoading;
  if (scopeLoading && !catalogLoading) {
    setScopeLoading(false);
  }

  useEffect(() => {
    return () => {
      if (subjectPendingTimer.current) clearTimeout(subjectPendingTimer.current);
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setRecentResources(getRecentResources());
      setFavoriteResources(getFavoriteResources());
    });
  }, []);

  const syncUrl = useCallback(
    (next: {
      subject?: string | null;
      filter?: ResourceFilter;
      view?: string | null;
      folder?: string | null;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", academicYear);
      params.set("branch", branch);
      params.set("semester", String(semester));

      const subject =
        next.subject !== undefined ? next.subject : selectedSubject;
      const filter = next.filter !== undefined ? next.filter : selectedFilter;
      const view =
        next.view !== undefined ? next.view : (viewerResource?.id ?? null);
      const folder =
        next.folder !== undefined ? next.folder : activeFolderId;

      if (subject) params.set("subject", subjectToSlug(subject));
      else params.delete("subject");

      if (filter && filter !== "all") params.set("filter", filter);
      else params.delete("filter");

      if (folder) params.set("folder", folder);
      else params.delete("folder");

      if (view) params.set("view", view);
      else params.delete("view");

      const current = new URLSearchParams(searchParams.toString());
      current.set("year", academicYear);
      current.set("branch", branch);
      current.set("semester", String(semester));
      if (
        current.get("subject") === params.get("subject") &&
        current.get("filter") === params.get("filter") &&
        current.get("folder") === params.get("folder") &&
        current.get("view") === params.get("view") &&
        current.get("year") === params.get("year") &&
        current.get("branch") === params.get("branch") &&
        current.get("semester") === params.get("semester")
      ) {
        return;
      }

      const nextQs = params.toString();
      router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, {
        scroll: false,
      });
    },
    [
      searchParams,
      academicYear,
      branch,
      semester,
      selectedSubject,
      selectedFilter,
      activeFolderId,
      viewerResource?.id,
      router,
      pathname,
    ],
  );

  const subjectsMap = useMemo(
    () =>
      resources.reduce(
        (acc, resource) => {
          if (!acc[resource.subject_name]) acc[resource.subject_name] = [];
          acc[resource.subject_name].push(resource);
          return acc;
        },
        {} as Record<string, ResourceItem[]>,
      ),
    [resources],
  );

  const subjectNames = useMemo(
    () => Object.keys(subjectsMap).sort(),
    [subjectsMap],
  );

  const filteredSubjectNames = useMemo(() => {
    if (!searchQuery.trim()) return subjectNames;
    const q = searchQuery.toLowerCase();
    return subjectNames.filter((name) => {
      const subjResources = subjectsMap[name] ?? [];
      return (
        name.toLowerCase().includes(q) ||
        isSubjectMatch(name, searchQuery) ||
        subjResources.some((r) => r.title.toLowerCase().includes(q))
      );
    });
  }, [subjectNames, subjectsMap, searchQuery]);

  const selectSubject = useCallback(
    (subjectName: string, opts?: { filter?: ResourceFilter; fromUser?: boolean }) => {
      const filter = opts?.filter ?? "all";
      const fromUser = opts?.fromUser ?? true;

      if (fromUser) {
        setLastUserSubject(subjectName);
        setIsSubjectPending(true);
        if (subjectPendingTimer.current) clearTimeout(subjectPendingTimer.current);
        subjectPendingTimer.current = setTimeout(() => setIsSubjectPending(false), 180);
      }

      setSelectedSubject(subjectName);
      setSelectedFilter(filter);
      setActiveFolderId(null);
      setViewerResource(null);
      syncUrl({ subject: subjectName, filter, view: null, folder: null });
    },
    [syncUrl, setSelectedSubject, setSelectedFilter, setActiveFolderId, setViewerResource, setLastUserSubject],
  );

  const urlSlug = searchParams.get("subject");
  const urlFilterParam = searchParams.get("filter");
  const urlFolderParam = searchParams.get("folder");
  const subjectSyncKey = `${scopeKey}|${filteredSubjectNames.join("\0")}|${searchParams.toString()}|${initialSubject}|${initialFilter}|${initialFolder}`;
  const [prevSubjectSyncKey, setPrevSubjectSyncKey] = useState(subjectSyncKey);

  if (prevSubjectSyncKey !== subjectSyncKey) {
    setPrevSubjectSyncKey(subjectSyncKey);

    if (filteredSubjectNames.length === 0) {
      setSelectedSubject(null);
    } else {
      const fromLiveUrl = resolveSubjectName(urlSlug, filteredSubjectNames);
      const userPick = lastUserSubject;

      if (userPick) {
        if (filteredSubjectNames.includes(userPick)) {
          setSelectedSubject(userPick);
          if (fromLiveUrl === userPick || subjectToSlug(userPick) === urlSlug) {
            setLastUserSubject(null);
          }
        } else {
          setLastUserSubject(null);
        }
      } else if (!didHydrateFromUrl) {
        setDidHydrateFromUrl(true);
        const fromInitial = resolveSubjectName(initialSubject, filteredSubjectNames);
        const target = fromLiveUrl || fromInitial || filteredSubjectNames[0];
        setSelectedSubject(target);
        setSelectedFilter(parseResourceFilter(urlFilterParam || initialFilter));
        const urlFolder = parseResourceFolder(
          searchParams.get("folder") || initialFolder,
        );
        if (urlFolder) setActiveFolderId(urlFolder);
      } else if (fromLiveUrl) {
        setSelectedSubject(fromLiveUrl);
        setSelectedFilter(parseResourceFilter(urlFilterParam));
      } else if (!selectedSubject || !filteredSubjectNames.includes(selectedSubject)) {
        setSelectedSubject(filteredSubjectNames[0]);
        setSelectedFilter("all");
        setActiveFolderId(null);
      }
    }
  }

  const [prevUrlFolderParam, setPrevUrlFolderParam] = useState(urlFolderParam);
  if (!skipFolderUrlHydrate && prevUrlFolderParam !== urlFolderParam) {
    setPrevUrlFolderParam(urlFolderParam);
    const urlFolder = parseResourceFolder(urlFolderParam);
    if (!urlFolder) {
      setActiveFolderId(null);
    } else if (selectedSubject) {
      const scope = folderScopeSubject(urlFolder);
      const subjectScope = subjectFolderScope(selectedSubject);
      if (scope && scope !== subjectScope) {
        setActiveFolderId(null);
      } else {
        setActiveFolderId(urlFolder);
      }
    } else {
      setActiveFolderId(urlFolder);
    }
  }
  if (skipFolderUrlHydrate) {
    setSkipFolderUrlHydrate(false);
  }

  const effectiveSelectedFilter = useMemo(() => {
    if (!selectedSubject || selectedFilter === "all" || selectedFilter === "social") return selectedFilter;
    const items = subjectsMap[selectedSubject] ?? [];
    const hasItems =
      selectedFilter === "question-bank"
        ? items.some(
            (r) =>
              r.category === "question-bank" ||
              r.category === "solved-question-bank",
          )
        : selectedFilter === "writeup" || selectedFilter === "codes"
          ? items.some(
              (r) =>
                isAssignmentCategory(r.category) || isDatasetResource(r),
            )
          : items.some((r) => r.category === selectedFilter);
    return hasItems ? selectedFilter : "all";
  }, [selectedSubject, selectedFilter, subjectsMap]);

  const [prevEffectiveFilter, setPrevEffectiveFilter] =
    useState(effectiveSelectedFilter);
  if (prevEffectiveFilter !== effectiveSelectedFilter) {
    setPrevEffectiveFilter(effectiveSelectedFilter);
    if (selectedFilter !== effectiveSelectedFilter) {
      setSelectedFilter(effectiveSelectedFilter);
    }
  }

  const viewId = initialView || searchParams.get("view");
  const initialViewKey = `${viewId ?? ""}|${resources.length}|${scopeKey}`;
  const [prevInitialViewKey, setPrevInitialViewKey] = useState(initialViewKey);
  if (!didOpenInitialView && viewId && prevInitialViewKey !== initialViewKey) {
    setPrevInitialViewKey(initialViewKey);
    const match = resources.find((r) => r.id === viewId);
    if (match) {
      setDidOpenInitialView(true);
      setViewerResource(match);
      const pageRaw = searchParams.get("page");
      const pageNum = pageRaw ? Number(pageRaw) : NaN;
      setViewerPage(Number.isFinite(pageNum) && pageNum > 0 ? pageNum : null);
      setRecentResources(
        pushRecentResource(match, { academicYear, branch, semester }),
      );
      logResourceOpen({
        id: match.id,
        title: match.title,
        subject: match.subject_name,
      });
      if (match.subject_name) {
        setLastUserSubject(match.subject_name);
        setSelectedSubject(match.subject_name);
      }
      const folder = folderIdForResource(match);
      if (folder) setActiveFolderId(folder);
    }
  }

  const favoriteIds = useMemo(
    () => new Set(favoriteResources.map((f) => f.id)),
    [favoriteResources],
  );

  const handleFavorite = useCallback(
    (item: ResourceItem) => {
      const wasFavorite = favoriteIds.has(item.id);
      const next = toggleFavoriteResource(item, {
        academicYear,
        branch,
        semester,
      });
      setFavoriteResources(next);
      const title = cleanResourceTitle(item.title);
      if (!wasFavorite) {
        notify.star(title);
      } else {
        notify.unstar(title, {
          onUndo: () => {
            const restored = toggleFavoriteResource(item, {
              academicYear,
              branch,
              semester,
            });
            setFavoriteResources(restored);
            notify.star(title);
          },
        });
      }
    },
    [academicYear, branch, semester, favoriteIds, setFavoriteResources],
  );

  const handleUnfavorite = useCallback(
    (id: string, title: string) => {
      const snapshot = favoriteResources.find((f) => f.id === id);
      const next = removeFavoriteResource(id);
      setFavoriteResources(next);
      notify.unstar(cleanResourceTitle(title), {
        onUndo: () => {
          if (!snapshot) return;
          const restored = toggleFavoriteResource(
            {
              id: snapshot.id,
              title: snapshot.title,
              subject_name: snapshot.subject_name,
              category: snapshot.category as ResourceItem["category"],
              file_url: snapshot.file_url,
            },
            {
              academicYear: snapshot.academic_year,
              branch: snapshot.branch,
              semester: snapshot.semester,
            },
          );
          setFavoriteResources(restored);
          notify.star(cleanResourceTitle(title));
        },
      });
    },
    [favoriteResources, setFavoriteResources],
  );

  useEffect(() => {
    if (!selectedSubject) return;
    if (lastUserSubject && lastUserSubject !== selectedSubject) {
      return;
    }
    syncUrl({
      subject: selectedSubject,
      filter: selectedFilter,
      view: viewerResource?.id ?? null,
      folder: activeFolderId,
    });
  }, [selectedSubject, selectedFilter, viewerResource?.id, activeFolderId, syncUrl, lastUserSubject]);

  const openResource = useCallback(
    (item: ResourceItem, page?: number | null) => {
      const folder = folderIdForResource(item);
      if (folder) setActiveFolderId(folder);
      setViewerResource(item);
      const explicit = page && page > 0 ? page : null;
      const saved = explicit ? null : getReadingProgress(item.id);
      setViewerPage(explicit ?? saved);
      setRecentResources(
        pushRecentResource(item, { academicYear, branch, semester }),
      );
      logResourceOpen({
        id: item.id,
        title: item.title,
        subject: item.subject_name,
      });
    },
    [
      academicYear,
      branch,
      semester,
      setActiveFolderId,
      setViewerResource,
      setViewerPage,
      setRecentResources,
    ],
  );

  const shareResource = useCallback(
    async (item: ResourceItem) => {
      const href = buildResourcesHref({
        academicYear,
        branch,
        semester,
        subject: item.subject_name,
        view: item.id,
        folder: folderIdForResource(item),
      });
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${href}`
          : href;
      try {
        await navigator.clipboard.writeText(url);
        notify.success("Link copied", {
          description: cleanResourceTitle(item.title),
          id: "resources-share-link",
        });
      } catch {
        notify.error("Could not copy link", { id: "resources-share-link" });
      }
    },
    [academicYear, branch, semester],
  );

  const closeViewer = useCallback(() => {
    setViewerResource(null);
    setViewerPage(null);
  }, [setViewerResource, setViewerPage]);

  const handleFolderChange = useCallback((folderId: string | null) => {
    setActiveFolderId(folderId);
  }, [setActiveFolderId]);

  const handleVaultSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.trim().length >= 3) {
        setAiSearchQuery(value.trim());
      } else {
        setAiSearchQuery("");
      }
    },
    [setSearchQuery, setAiSearchQuery],
  );

  const aiSearchActive = aiSearchQuery.trim().length >= 3;
  const visibleContentResults = aiSearchActive ? contentResults : [];
  const visibleSearchingContent = aiSearchActive && isSearchingContent;

  useEffect(() => {
    if (!aiSearchActive) return;

    const abortController = new AbortController();
    const requestId = ++searchRequestId.current;
    const timer = setTimeout(async () => {
      try {
        setIsSearchingContent(true);
        const user = auth.currentUser;
        if (!user) {
          if (searchRequestId.current === requestId) {
            setContentResults([]);
            setIsSearchingContent(false);
            notify.message("Sign in for content search");
          }
          return;
        }
        const params = new URLSearchParams({
          q: aiSearchQuery,
          year: academicYear,
          branch,
          semester: String(semester),
        });
        const res = await authFetch(`/api/search?${params.toString()}`, {
          signal: abortController.signal,
        });
        if (!res.ok) {
          if (searchRequestId.current === requestId) setContentResults([]);
          return;
        }
        const data = await res.json();
        if (searchRequestId.current === requestId) {
          setContentResults(data.results || []);
        }
      } catch (err: unknown) {
        const name = err instanceof Error ? err.name : "";
        if (name !== "AbortError") {
          console.error("Content search error:", err);
        }
      } finally {
        if (searchRequestId.current === requestId) {
          setIsSearchingContent(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [aiSearchActive, aiSearchQuery, academicYear, branch, semester]);

  const searchedResources = useMemo(() => {
    const all = selectedSubject ? (subjectsMap[selectedSubject] ?? []) : [];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.subject_name.toLowerCase().includes(q) ||
        isSubjectMatch(r.subject_name, searchQuery),
    );
  }, [selectedSubject, subjectsMap, searchQuery]);

  /** For Codes/Writeups filters, include sibling assignment files so notebooks keep datasets. */
  const filteredResources = useMemo(() => {
    if (selectedFilter === "all") return searchedResources;
    if (selectedFilter === "question-bank") {
      return searchedResources.filter(
        (r) =>
          r.category === "question-bank" ||
          r.category === "solved-question-bank",
      );
    }
    if (selectedFilter === "writeup" || selectedFilter === "codes") {
      // Include all assignment-related files so folders stay complete
      return searchedResources.filter(
        (r) =>
          isAssignmentCategory(r.category) || isDatasetResource(r),
      );
    }
    return searchedResources.filter((r) => r.category === selectedFilter);
  }, [searchedResources, selectedFilter]);

  const filterCounts = useMemo(
    () =>
      RESOURCE_FILTERS.reduce(
        (acc, filter) => {
          if (filter.value === "all") {
            acc[filter.value] = searchedResources.length;
          } else if (filter.value === "social") {
            acc[filter.value] = 0;
          } else if (filter.value === "question-bank") {
            acc[filter.value] = searchedResources.filter(
              (r) =>
                r.category === "question-bank" ||
                r.category === "solved-question-bank",
            ).length;
          } else if (filter.value === "writeup" || filter.value === "codes") {
            acc[filter.value] = searchedResources.filter(
              (r) =>
                isAssignmentCategory(r.category) || isDatasetResource(r),
            ).length;
          } else {
            acc[filter.value] = searchedResources.filter(
              (r) => r.category === filter.value,
            ).length;
          }
          return acc;
        },
        {} as Record<ResourceFilter, number>,
      ),
    [searchedResources],
  );

  const assignmentItems = useMemo(
    () =>
      filteredResources.filter(
        (r) => isAssignmentCategory(r.category) || isDatasetResource(r),
      ),
    [filteredResources],
  );

  const assignmentFolders = useMemo(
    () =>
      groupByAssignment(assignmentItems, selectedSubject ?? undefined),
    [assignmentItems, selectedSubject],
  );

  const notesFolders = useMemo(
    () =>
      groupByUnit(
        filteredResources.filter((r) => r.category === "notes"),
        selectedSubject ?? undefined,
      ),
    [filteredResources, selectedSubject],
  );

  const pptFolders = useMemo(
    () =>
      groupByUnit(
        filteredResources.filter((r) => r.category === "ppt"),
        selectedSubject ?? undefined,
      ),
    [filteredResources, selectedSubject],
  );

  const pyqFolders = useMemo(
    () =>
      groupByYear(
        filteredResources.filter((r) => r.category === "pyq"),
        selectedSubject ?? undefined,
      ),
    [filteredResources, selectedSubject],
  );

  const qbItems = useMemo(
    () =>
      filteredResources.filter(
        (r) =>
          r.category === "question-bank" ||
          r.category === "solved-question-bank",
      ),
    [filteredResources],
  );

  const otherItems = useMemo(
    () =>
      filteredResources.filter(
        (r) =>
          r.category === "other" &&
          !isDatasetResource(r),
      ),
    [filteredResources],
  );

  const summary = useMemo(
    () => subjectSummaryCounts(searchedResources),
    [searchedResources],
  );

  const summaryHint = useMemo(() => {
    const parts: string[] = [];
    if (summary.assignments > 0) {
      parts.push(
        `${summary.assignments} assignment${summary.assignments === 1 ? "" : "s"}`,
      );
    }
    if (summary.notes > 0) {
      parts.push(`${summary.notes} note${summary.notes === 1 ? "" : "s"}`);
    }
    if (summary.ppt > 0) {
      parts.push(`${summary.ppt} PPT${summary.ppt === 1 ? "" : "s"}`);
    }
    if (summary.pyq > 0) {
      parts.push(`${summary.pyq} PYQ`);
    }
    if (summary.qb > 0) {
      parts.push(`${summary.qb} QB`);
    }
    return parts.join(" · ");
  }, [summary]);

  const viewerSiblings = useMemo(
    () =>
      viewerResource
        ? findAssignmentSiblings(viewerResource, resources)
        : [],
    [viewerResource, resources],
  );

  const breadcrumbFolderLabel = folderLabelFromId(activeFolderId);
  const breadcrumbFilterLabel =
    filterLabel(selectedFilter) ||
    (activeFolderId?.startsWith("assignment-")
      ? "Assignments"
      : activeFolderId?.startsWith("unit-")
        ? selectedFilter === "ppt"
          ? "Presentations"
          : "Notes"
        : activeFolderId?.startsWith("year-")
          ? "PYQ"
          : null);

  const showAssignments =
    selectedFilter === "all" ||
    selectedFilter === "writeup" ||
    selectedFilter === "codes";
  const showNotes = selectedFilter === "all" || selectedFilter === "notes";
  const showPpt = selectedFilter === "all" || selectedFilter === "ppt";
  const showPyq = selectedFilter === "all" || selectedFilter === "pyq";
  const showQb =
    selectedFilter === "all" || selectedFilter === "question-bank";
  const showOther = selectedFilter === "all" || selectedFilter === "other";

  if (catalogLoading && resources.length === 0) {
    return <PageSkeleton variant="split" />;
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto page-gutter py-8 min-h-[80vh]">
      <PageHeader
        className="mb-3"
        eyebrow="Vault"
        title="Resource Vault"
        description={`${branch} · Semester ${semester} · ${resources.length} files`}
      />

      {/* Breadcrumb trail */}
      <nav
        aria-label="Resource location"
        className="flex flex-wrap items-center gap-1 text-xs text-muted mb-4"
      >
        <span className="font-medium text-foreground/80">
          {branch} · Sem {semester}
        </span>
        {selectedSubject && (
          <>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <button
              type="button"
              onClick={() => {
                setSelectedFilter("all");
                setActiveFolderId(null);
              }}
              className="font-medium hover:text-foreground transition-colors truncate max-w-[10rem]"
            >
              {selectedSubject}
            </button>
          </>
        )}
        {breadcrumbFilterLabel && (
          <>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className="font-medium hover:text-foreground transition-colors"
            >
              {breadcrumbFilterLabel}
            </button>
          </>
        )}
        {breadcrumbFolderLabel && (
          <>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <span className="font-semibold text-foreground truncate max-w-[12rem]">
              {breadcrumbFolderLabel}
            </span>
          </>
        )}
        <span className="hidden sm:inline mx-2 text-border">|</span>
        <AppLink
          href={`/syllabus?year=${encodeURIComponent(academicYear)}&branch=${branch}&semester=${semester}`}
          className="hidden sm:inline hover:text-foreground transition-colors"
        >
          Syllabus
        </AppLink>
        <span className="hidden sm:inline text-border">·</span>
        <AppLink
          href={`/ask?year=${encodeURIComponent(academicYear)}&branch=${branch}&semester=${semester}`}
          className="hidden sm:inline hover:text-foreground transition-colors"
        >
          Ask AI
        </AppLink>
      </nav>

      <NotesDisclaimer className="mb-8" />

      <div className="border-b border-border mb-8" />

      {catalogError ? (
        <ErrorState
          className="mb-8"
          title="Couldn’t load the vault catalog"
          description={`${catalogError}. This isn’t an empty semester — try again.`}
          onRetry={retryCatalog}
        />
      ) : resources.length === 0 ? (
        <EmptyState
          icon={<Folder className="w-10 h-10 text-muted/40" />}
          title="No files found"
          description={`No resources uploaded for ${branch} Semester ${semester} yet.`}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <Card
            padding="none"
            className="w-full lg:w-60 shrink-0 shadow-sm overflow-hidden lg:sticky lg:top-24 z-10"
          >
            <div className="px-4 py-3 border-b border-border bg-surface/50 flex items-center justify-between">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted">
                Subjects
              </h3>
              <Badge>{filteredSubjectNames.length}</Badge>
            </div>
            <div className="flex flex-col max-h-[65vh] overflow-y-auto scrollbar-none p-2 gap-0.5 relative">
              {filteredSubjectNames.map((subjectName) => {
                const isActive = selectedSubject === subjectName;
                const subjectResources = subjectsMap[subjectName] ?? [];
                return (
                  <button
                    key={subjectName}
                    onClick={() => selectSubject(subjectName)}
                    className={`group flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-sm rounded-lg relative ${
                      isActive
                        ? "text-background font-medium shadow-sm"
                        : "text-muted hover:text-foreground hover:bg-surface/60"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSubject"
                        className="absolute inset-0 bg-foreground rounded-lg -z-10"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                    <Folder
                      className={`w-4 h-4 flex-shrink-0 z-10 ${isActive ? "text-background" : "text-muted group-hover:text-foreground"}`}
                    />
                    <span className="flex-1 truncate text-[13px] z-10">
                      {subjectName}
                    </span>
                    <Badge
                      variant={isActive ? "active" : "default"}
                      className={`z-10 text-[10px] ${isActive ? "bg-background/20 text-background border-transparent" : ""}`}
                    >
                      {subjectResources.length}
                    </Badge>
                  </button>
                );
              })}
              {filteredSubjectNames.length === 0 && (
                <p className="px-4 py-8 text-sm text-muted text-center font-medium">
                  No subjects match.
                </p>
              )}
            </div>
          </Card>

          <div className="flex-1 w-full min-w-0 relative">
            {(isSubjectPending || isScopeLoading) && (
              <div
                className="absolute inset-0 z-20 rounded-2xl bg-background/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3"
                role="status"
                aria-live="polite"
              >
                <span className="loading-orb" aria-hidden />
                <p className="text-xs font-medium text-muted tracking-wide">
                  {isScopeLoading ? "Loading semester…" : "Switching subject…"}
                </p>
              </div>
            )}
            {selectedSubject && subjectsMap[selectedSubject] ? (
              <motion.div
                key={selectedSubject}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isSubjectPending ? 0.55 : 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-8"
              >
                {favoriteResources.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-card">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-foreground text-background">
                        <Star className="w-3 h-3 fill-current" />
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        Favorites
                      </p>
                      <span className="text-[10px] font-semibold text-muted tabular-nums">
                        {favoriteResources.length}
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                      {favoriteResources.slice(0, 8).map((r) => {
                        const live = resources.find((x) => x.id === r.id);
                        const resume = getReadingProgress(r.id);
                        return (
                          <div
                            key={r.id}
                            className="group/fav relative shrink-0 max-w-[12rem] rounded-lg border border-border bg-surface/60 pl-2.5 pr-1 py-1.5 flex items-center gap-1.5 hover:bg-surface-hover hover:border-border-strong transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (live) openResource(live);
                                else if (r.subject_name) {
                                  setLastUserSubject(r.subject_name);
                                  setSelectedSubject(r.subject_name);
                                }
                              }}
                              className="min-w-0 flex-1 text-left"
                              title={cleanResourceTitle(r.title)}
                            >
                              <p className="text-xs font-medium text-foreground truncate">
                                {cleanResourceTitle(r.title)}
                              </p>
                              <p className="text-[10px] text-muted truncate mt-0.5">
                                {r.subject_name}
                                {resume ? ` · Resume p.${resume}` : ""}
                              </p>
                            </button>
                            <IconButton
                              size="sm"
                              variant="ghost"
                              label="Remove from favorites"
                              className="opacity-70 group-hover/fav:opacity-100 shrink-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleUnfavorite(r.id, r.title);
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recentResources.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-surface/40 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-muted" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        Recently viewed
                      </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                      {recentResources.slice(0, 8).map((r) => {
                        const live = resources.find((x) => x.id === r.id);
                        const resume = getReadingProgress(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              if (live) openResource(live);
                              else if (r.subject_name) {
                                setLastUserSubject(r.subject_name);
                                setSelectedSubject(r.subject_name);
                              }
                            }}
                            className="shrink-0 max-w-[11rem] rounded-lg border border-border bg-card px-2.5 py-2 text-left hover:bg-surface-hover transition-colors"
                            title={cleanResourceTitle(r.title)}
                          >
                            <p className="text-xs font-medium text-foreground truncate">
                              {cleanResourceTitle(r.title)}
                            </p>
                            <p className="text-[10px] text-muted truncate mt-0.5">
                              {r.subject_name}
                              {resume ? ` · Resume p.${resume}` : ""}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4 border-b border-border pb-5">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-bold text-foreground tracking-tight">
                        {selectedSubject}
                      </h2>
                      {(searchQuery || (selectedFilter !== "all" && selectedFilter !== "social")) && (
                        <div className="flex items-center gap-2">
                          <Badge>
                            {filteredResources.length}{" "}
                            {filteredResources.length !== 1
                              ? "results"
                              : "result"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              handleVaultSearch("");
                              setSelectedFilter("all");
                              setActiveFolderId(null);
                            }}
                            className="underline underline-offset-4"
                          >
                            Clear filters
                          </Button>
                        </div>
                      )}
                    </div>
                    {summaryHint && (
                      <p className="text-xs text-muted font-medium">
                        {summaryHint}
                      </p>
                    )}
                  </div>

                  {selectedFilter !== "social" && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                      <Input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => handleVaultSearch(e.target.value)}
                        placeholder="Search files… (3+ chars for content match)"
                        className="pl-9 rounded-xl"
                        aria-label="Search vault"
                      />
                    </div>
                  )}

                  <div
                    key={selectedSubject}
                    className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-none relative"
                  >
                    {RESOURCE_FILTERS.map(({ value, label, Icon }) => {
                      const count = filterCounts[value] ?? 0;
                      const active = selectedFilter === value;
                      if (value !== "all" && value !== "social" && count === 0) return null;
                      return (
                        <Button
                          key={value}
                          variant={active ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => {
                            setSelectedFilter(value);
                            setActiveFolderId(null);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap flex-shrink-0 relative min-h-0 ${
                            active ? "border-transparent shadow-sm" : ""
                          }`}
                        >
                          {active && (
                            <motion.div
                              layoutId="activeFilter"
                              className="absolute inset-0 bg-foreground rounded-lg -z-10"
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 30,
                              }}
                            />
                          )}
                          <Icon
                            className={`w-3 h-3 z-10 ${active ? "text-background" : "text-muted"}`}
                          />
                          <span className="z-10">{label}</span>
                          {value !== "social" ? (
                            <Badge
                              variant={active ? "active" : "default"}
                              className={`text-[9px] z-10 ${active ? "bg-background/20 text-background/70 border-transparent" : ""}`}
                            >
                              {count}
                            </Badge>
                          ) : (
                            <Badge
                              variant={active ? "active" : "default"}
                              className={`text-[9px] z-10 ${active ? "bg-background/20 text-background/70 border-transparent" : ""}`}
                            >
                              Q&A
                            </Badge>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {selectedFilter === "social" ? (
                  <QASubjectTab subjectName={selectedSubject} />
                ) : filteredResources.length === 0 ? (
                  <Card
                    padding="lg"
                    className="flex flex-col items-center justify-center py-16 text-center border-dashed bg-surface/50"
                  >
                    <Search className="w-6 h-6 text-muted/50 mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      No Matching Files
                    </p>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                      {searchQuery
                        ? `No files match "${searchQuery}" in this subject.`
                        : "No files match the selected filter."}
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-8">
                    {(visibleContentResults.length > 0 || visibleSearchingContent) && (
                      <div className="space-y-4 bg-surface/40 border border-border rounded-xl p-5 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 border-b border-border pb-3">
                          <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-foreground">
                            {visibleSearchingContent ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Brain className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                              Content Matches
                            </h3>
                            <p className="text-[10px] font-medium text-muted">
                              AI Semantic Search
                              {visibleContentResults.length > 0
                                ? ` · ${visibleContentResults.length} snippets`
                                : ""}
                              {visibleSearchingContent ? " · searching…" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {visibleContentResults.map((result, idx) => (
                            <Card
                              key={`${result.resource_id}-${idx}`}
                              hover
                              padding="sm"
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                const resource = resources.find(
                                  (r) => r.id === result.resource_id,
                                );
                                if (resource) {
                                  const page = pageFromSectionLabel(
                                    result.section_label,
                                  );
                                  openResource(resource, page);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  const resource = resources.find(
                                    (r) => r.id === result.resource_id,
                                  );
                                  if (resource) {
                                    const page = pageFromSectionLabel(
                                      result.section_label,
                                    );
                                    openResource(resource, page);
                                  }
                                }
                              }}
                              className="group text-left cursor-pointer flex flex-col justify-between h-full shadow-xs"
                            >
                              <div>
                                <Badge className="text-[10px]">
                                  {result.subject_name}
                                </Badge>
                                <h4
                                  className="text-sm font-medium text-foreground mt-2 mb-2 line-clamp-1 group-hover:text-primary transition-colors"
                                  title={result.title}
                                >
                                  {cleanResourceTitle(result.title)}
                                </h4>
                                <div className="border-l-2 border-border-strong pl-3 text-xs text-muted leading-relaxed font-mono line-clamp-3">
                                  &ldquo;...{result.snippet}...&rdquo;
                                </div>
                              </div>
                              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted group-hover:text-foreground transition-colors">
                                <span>Open document</span>
                                <span>→</span>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {showNotes && (
                      <ResourceSection
                        title="Notes"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        accentColor="var(--accent-notes)"
                        folders={notesFolders}
                        onOpenResource={openResource}
                        onSummarize={setSummarizingResource}
                        onShare={shareResource}
                        onFavorite={handleFavorite}
                        favoriteIds={favoriteIds}
                        activeFolderId={activeFolderId}
                        onFolderChange={handleFolderChange}
                        highlightFileId={viewerResource?.id}
                      />
                    )}

                    {showQb && qbItems.length > 0 && (
                      <ResourceSection
                        title="Question Banks"
                        icon={<BookOpenCheck className="w-3.5 h-3.5" />}
                        accentColor="var(--accent-qb)"
                        items={qbItems.filter(
                          (r) => r.category === "question-bank",
                        )}
                        onOpenResource={openResource}
                        onSummarize={setSummarizingResource}
                        onShare={shareResource}
                        onFavorite={handleFavorite}
                        favoriteIds={favoriteIds}
                      />
                    )}

                    {showQb &&
                      qbItems.some(
                        (r) => r.category === "solved-question-bank",
                      ) && (
                        <ResourceSection
                          title="Solved Question Banks"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          accentColor="var(--accent-qb-solved)"
                          items={qbItems.filter(
                            (r) => r.category === "solved-question-bank",
                          )}
                          onOpenResource={openResource}
                          onSummarize={setSummarizingResource}
                          onShare={shareResource}
                          onFavorite={handleFavorite}
                          favoriteIds={favoriteIds}
                        />
                      )}

                    {showPpt && (
                      <ResourceSection
                        title="Presentations"
                        icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                        accentColor="var(--accent-ppt)"
                        folders={pptFolders}
                        onOpenResource={openResource}
                        onSummarize={setSummarizingResource}
                        onShare={shareResource}
                        onFavorite={handleFavorite}
                        favoriteIds={favoriteIds}
                        activeFolderId={activeFolderId}
                        onFolderChange={handleFolderChange}
                        highlightFileId={viewerResource?.id}
                      />
                    )}

                    {showPyq && (
                      <ResourceSection
                        title="Previous Year Questions"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        accentColor="var(--accent-pyq)"
                        folders={pyqFolders}
                        onOpenResource={openResource}
                        onSummarize={setSummarizingResource}
                        onShare={shareResource}
                        onFavorite={handleFavorite}
                        favoriteIds={favoriteIds}
                        activeFolderId={activeFolderId}
                        onFolderChange={handleFolderChange}
                        highlightFileId={viewerResource?.id}
                      />
                    )}

                    {showAssignments && assignmentFolders.length > 0 && (
                      <ResourceSection
                        title="Assignments"
                        icon={<ClipboardList className="w-3.5 h-3.5" />}
                        accentColor="var(--accent-codes)"
                        folders={assignmentFolders}
                        onOpenResource={openResource}
                        onSummarize={setSummarizingResource}
                        onShare={shareResource}
                        onFavorite={handleFavorite}
                        favoriteIds={favoriteIds}
                        activeFolderId={activeFolderId}
                        onFolderChange={handleFolderChange}
                        highlightFileId={viewerResource?.id}
                      />
                    )}

                    {showOther && otherItems.length > 0 && (
                      <ResourceSection
                        title="Other Resources"
                        icon={<HardDrive className="w-3.5 h-3.5" />}
                        accentColor="var(--accent-other)"
                        items={otherItems}
                        onOpenResource={openResource}
                        onSummarize={setSummarizingResource}
                        onShare={shareResource}
                        onFavorite={handleFavorite}
                        favoriteIds={favoriteIds}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <Card
                padding="lg"
                className="flex flex-col items-center justify-center h-full text-center py-24 border-dashed bg-surface/30"
              >
                <Folder className="w-12 h-12 text-muted/30 mb-4" />
                <p className="text-base font-bold text-foreground mb-1">
                  Select a Subject
                </p>
                <p className="text-sm font-medium text-muted max-w-xs mx-auto">
                  Choose a subject from the sidebar to view its resources.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {viewerResource && (
        <ResourceViewer
          resource={viewerResource}
          onClose={closeViewer}
          assignmentSiblings={viewerSiblings}
          onOpenRelated={openResource}
          initialPage={viewerPage}
        />
      )}
      {summarizingResource && (
        <SummaryModal
          resourceId={summarizingResource.id}
          resourceTitle={cleanResourceTitle(summarizingResource.title)}
          onClose={() => setSummarizingResource(null)}
        />
      )}
    </div>
  );
}

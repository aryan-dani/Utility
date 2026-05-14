"use client";

import { useState, useMemo, useEffect } from "react";
import { ResourceCategory, ResourceItem } from "@/lib/dataFetcher";
import { useAcademicStore } from "@/store/academicStore";
import {
  HardDrive,
  BookOpenCheck,
  FileText,
  FileSpreadsheet,
  Folder,
  Layers,
  Search,
} from "lucide-react";

interface ResourcesClientProps {
  initialResources: ResourceItem[];
  branch: string;
  semester: number;
}

type ResourceFilter = "all" | ResourceCategory;

const RESOURCE_FILTERS = [
  { value: "all", label: "All", Icon: Layers },
  { value: "notes", label: "Notes", Icon: FileText },
  { value: "question-bank", label: "Question Banks", Icon: BookOpenCheck },
  { value: "ppt", label: "PPT", Icon: FileSpreadsheet },
  { value: "pyq", label: "PYQ", Icon: FileText },
] satisfies { value: ResourceFilter; label: string; Icon: typeof FileText }[];

export default function ResourcesClient({
  initialResources,
  branch,
  semester,
}: ResourcesClientProps) {
  const { searchQuery } = useAcademicStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ResourceFilter>("all");

  // Group by subject
  const subjectsMap = useMemo(
    () =>
      initialResources.reduce(
        (acc, resource) => {
          if (!acc[resource.subject_name]) acc[resource.subject_name] = [];
          acc[resource.subject_name].push(resource);
          return acc;
        },
        {} as Record<string, ResourceItem[]>,
      ),
    [initialResources],
  );

  const subjectNames = useMemo(() => Object.keys(subjectsMap).sort(), [subjectsMap]);

  // Auto-select first subject
  useEffect(() => {
    if (subjectNames.length > 0 && !selectedSubject) {
      setSelectedSubject(subjectNames[0]);
    }
  }, [subjectNames, selectedSubject]);

  const searchedResources = useMemo(() => {
    const all = selectedSubject ? (subjectsMap[selectedSubject] ?? []) : [];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.subject_name.toLowerCase().includes(q),
    );
  }, [selectedSubject, subjectsMap, searchQuery]);

  const filteredResources = useMemo(() => {
    if (selectedFilter === "all") return searchedResources;
    return searchedResources.filter((r) => r.category === selectedFilter);
  }, [searchedResources, selectedFilter]);

  const filterCounts = useMemo(() => {
    return RESOURCE_FILTERS.reduce(
      (acc, filter) => {
        acc[filter.value] =
          filter.value === "all"
            ? searchedResources.length
            : searchedResources.filter((r) => r.category === filter.value).length;
        return acc;
      },
      {} as Record<ResourceFilter, number>,
    );
  }, [searchedResources]);

  const filteredSubjectNames = useMemo(() => {
    if (!searchQuery.trim()) return subjectNames;
    const q = searchQuery.toLowerCase();
    return subjectNames.filter((name) => {
      const subjResources = subjectsMap[name] ?? [];
      return (
        name.toLowerCase().includes(q) ||
        subjResources.some((r) => r.title.toLowerCase().includes(q))
      );
    });
  }, [subjectNames, subjectsMap, searchQuery]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Resource Vault — {branch} Sem {semester}
          </h1>
          <p className="text-muted text-sm mt-1">
            Access your academic files stored securely in the cloud.
          </p>
        </div>
      </div>

      {initialResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-surface">
          <Folder className="w-10 h-10 text-muted mb-3" />
          <p className="text-lg font-semibold text-foreground mb-1">No Files Found</p>
          <p className="text-sm text-muted">
            No resources uploaded for {branch} Semester {semester} yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-64 shrink-0 border border-border rounded-lg bg-surface shadow-sm overflow-hidden">
            <div className="bg-muted/10 p-4 border-b border-border">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted">
                Folders
              </h3>
            </div>
            <div className="flex flex-col">
              {filteredSubjectNames.map((subjectName) => (
                <button
                  key={subjectName}
                  onClick={() => setSelectedSubject(subjectName)}
                  className={`flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0 ${
                    selectedSubject === subjectName
                      ? "bg-primary/10 text-primary border-r-2 border-r-primary font-medium"
                      : "text-foreground hover:bg-muted/5 hover:text-primary"
                  }`}
                >
                  <Folder
                    className={`w-4 h-4 ${selectedSubject === subjectName ? "text-primary" : "text-muted"}`}
                  />
                  <span className="flex-1 truncate text-sm">{subjectName}</span>
                  <span className="text-xs bg-background border border-border px-1.5 py-0.5 rounded text-muted">
                    {subjectsMap[subjectName].length}
                  </span>
                </button>
              ))}
              {filteredSubjectNames.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted text-center">
                  No subjects match your search.
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 w-full bg-surface border border-border rounded-lg p-6 shadow-sm min-h-[400px]">
            {selectedSubject && subjectsMap[selectedSubject] ? (
              <div className="space-y-10">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {selectedSubject}
                  </h2>
                  {(searchQuery || selectedFilter !== "all") && (
                    <span className="text-xs text-muted font-medium px-2 py-0.5 bg-background border border-border rounded">
                      {filteredResources.length} result
                      {filteredResources.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {RESOURCE_FILTERS.map(({ value, label, Icon }) => {
                    const active = selectedFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedFilter(value)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                            active
                              ? "bg-primary/15 text-primary"
                              : "bg-surface text-muted"
                          }`}
                        >
                          {filterCounts[value] ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {filteredResources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="w-10 h-10 text-muted/30 mb-3" />
                    <p className="text-base font-medium text-muted">
                      {searchQuery
                        ? `No files match "${searchQuery}"`
                        : "No files match this filter."}
                    </p>
                  </div>
                ) : (
                  <>
                    <ResourceSection
                      title="Question Banks"
                      icon={<BookOpenCheck className="w-4 h-4 text-emerald-500" />}
                      items={filteredResources.filter(
                        (r) => r.category === "question-bank",
                      )}
                    />
                    <ResourceSection
                      title="Class Presentations"
                      icon={<FileSpreadsheet className="w-4 h-4 text-orange-500" />}
                      items={filteredResources.filter((r) => r.category === "ppt")}
                    />
                    <ResourceSection
                      title="Previous Year Questions"
                      icon={<FileText className="w-4 h-4 text-blue-500" />}
                      items={filteredResources.filter((r) => r.category === "pyq")}
                    />
                    <ResourceSection
                      title="Handwritten Notes"
                      icon={<FileText className="w-4 h-4 text-red-500" />}
                      items={filteredResources.filter((r) => r.category === "notes")}
                    />
                    <ResourceSection
                      title="Other Resources"
                      icon={<HardDrive className="w-4 h-4 text-emerald-500" />}
                      items={filteredResources.filter((r) => r.category === "other")}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12">
                <Folder className="w-12 h-12 text-muted/30 mb-4" />
                <p className="text-lg font-medium text-muted">
                  Select a folder to view its contents
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: ResourceItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ResourceCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ResourceCard({ item }: { item: ResourceItem }) {
  const fileUpper = item.file_url.toUpperCase();
  const isPdf = fileUpper.endsWith(".PDF");
  const isPpt = fileUpper.endsWith(".PPT") || fileUpper.endsWith(".PPTX");

  return (
    <a href={item.file_url} target="_blank" rel="noopener noreferrer">
      <div className="bg-background p-4 rounded-lg flex flex-col gap-3 group cursor-pointer border border-border hover:border-primary/50 hover:shadow-md transition-all h-full">
        <div className="flex items-start justify-between">
          <div
            className={`w-10 h-10 rounded shrink-0 flex items-center justify-center border transition-colors ${
              isPdf
                ? "bg-red-50 border-red-100 group-hover:bg-red-100"
                : isPpt
                  ? "bg-orange-50 border-orange-100 group-hover:bg-orange-100"
                  : "bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100"
            }`}
          >
            {isPdf ? (
              <FileText className="w-5 h-5 text-red-600" />
            ) : isPpt ? (
              <FileSpreadsheet className="w-5 h-5 text-orange-600" />
            ) : (
              <HardDrive className="w-5 h-5 text-emerald-600" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 mt-1">
          <p
            className="text-sm font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors"
            title={item.title}
          >
            {item.title}
          </p>
        </div>
      </div>
    </a>
  );
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import { ResourceCategory, ResourceItem } from '@/lib/dataFetcher';
import { useAcademicStore } from '@/store/academicStore';
import {
  HardDrive,
  BookOpenCheck,
  FileText,
  FileSpreadsheet,
  Folder,
  Layers,
  Search,
  ExternalLink,
} from 'lucide-react';

interface ResourcesClientProps {
  initialResources: ResourceItem[];
  branch: string;
  semester: number;
}

type ResourceFilter = 'all' | ResourceCategory;

const RESOURCE_FILTERS = [
  { value: 'all', label: 'All', Icon: Layers },
  { value: 'notes', label: 'Notes', Icon: FileText },
  { value: 'question-bank', label: 'Question Banks', Icon: BookOpenCheck },
  { value: 'ppt', label: 'Presentations', Icon: FileSpreadsheet },
  { value: 'pyq', label: 'PYQ', Icon: FileText },
] satisfies { value: ResourceFilter; label: string; Icon: typeof FileText }[];

export default function ResourcesClient({ initialResources, branch, semester }: ResourcesClientProps) {
  const { searchQuery } = useAcademicStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ResourceFilter>('all');

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
      (r) => r.title.toLowerCase().includes(q) || r.subject_name.toLowerCase().includes(q),
    );
  }, [selectedSubject, subjectsMap, searchQuery]);

  const filteredResources = useMemo(() => {
    if (selectedFilter === 'all') return searchedResources;
    return searchedResources.filter((r) => r.category === selectedFilter);
  }, [searchedResources, selectedFilter]);

  const filterCounts = useMemo(
    () =>
      RESOURCE_FILTERS.reduce(
        (acc, filter) => {
          acc[filter.value] =
            filter.value === 'all'
              ? searchedResources.length
              : searchedResources.filter((r) => r.category === filter.value).length;
          return acc;
        },
        {} as Record<ResourceFilter, number>,
      ),
    [searchedResources],
  );

  const filteredSubjectNames = useMemo(() => {
    if (!searchQuery.trim()) return subjectNames;
    const q = searchQuery.toLowerCase();
    return subjectNames.filter((name) => {
      const subjResources = subjectsMap[name] ?? [];
      return name.toLowerCase().includes(q) || subjResources.some((r) => r.title.toLowerCase().includes(q));
    });
  }, [subjectNames, subjectsMap, searchQuery]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Resource Vault</h1>
          <p className="text-muted text-sm mt-1">
            {branch} · Semester {semester} · {initialResources.length} files
          </p>
        </div>
      </div>

      {initialResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-xl bg-surface">
          <Folder className="w-10 h-10 text-muted/40 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No Files Found</p>
          <p className="text-sm text-muted">No resources uploaded for {branch} Semester {semester} yet.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Sidebar */}
          <div className="w-full md:w-56 shrink-0 border border-border rounded-xl bg-card shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted">Subjects</h3>
            </div>
            <div className="flex flex-col">
              {filteredSubjectNames.map((subjectName) => (
                <button
                  key={subjectName}
                  onClick={() => setSelectedSubject(subjectName)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/50 last:border-0 text-sm ${
                      selectedSubject === subjectName
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'text-foreground hover:bg-surface'
                    }`}
                >
                  <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${selectedSubject === subjectName ? 'text-background' : 'text-muted'}`} />
                  <span className="flex-1 truncate">{subjectName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${selectedSubject === subjectName ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-surface text-muted'}`}>
                    {subjectsMap[subjectName].length}
                  </span>
                </button>
              ))}
              {filteredSubjectNames.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted text-center">No subjects match.</p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 w-full min-w-0">
            {selectedSubject && subjectsMap[selectedSubject] ? (
              <div className="space-y-8">
                {/* Subject title + filter */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-lg font-bold text-foreground">{selectedSubject}</h2>
                    {(searchQuery || selectedFilter !== 'all') && (
                      <span className="text-xs text-muted px-2 py-0.5 bg-surface border border-border rounded-full">
                        {filteredResources.length} result{filteredResources.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Filter pills */}
                  <div className="flex flex-wrap gap-2">
                    {RESOURCE_FILTERS.map(({ value, label, Icon }) => {
                      const active = selectedFilter === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setSelectedFilter(value)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            active
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border bg-card text-muted hover:border-border-strong hover:text-foreground'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {label}
                          <span className={`rounded-full px-1 py-0.5 text-[10px] leading-none ${active ? 'bg-background/20 text-background' : 'bg-surface text-muted'}`}>
                            {filterCounts[value] ?? 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredResources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-surface">
                    <Search className="w-8 h-8 text-muted/30 mb-3" />
                    <p className="text-sm font-medium text-muted">
                      {searchQuery ? `No files match "${searchQuery}"` : 'No files match this filter.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <ResourceSection
                      title="Question Banks"
                      icon={<BookOpenCheck className="w-3.5 h-3.5" />}
                      items={filteredResources.filter((r) => r.category === 'question-bank')}
                    />
                    <ResourceSection
                      title="Class Presentations"
                      icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                      items={filteredResources.filter((r) => r.category === 'ppt')}
                    />
                    <ResourceSection
                      title="Previous Year Questions"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      items={filteredResources.filter((r) => r.category === 'pyq')}
                    />
                    <ResourceSection
                      title="Handwritten Notes"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      items={filteredResources.filter((r) => r.category === 'notes')}
                    />
                    <ResourceSection
                      title="Other Resources"
                      icon={<HardDrive className="w-3.5 h-3.5" />}
                      items={filteredResources.filter((r) => r.category === 'other')}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-16 border border-dashed border-border rounded-xl bg-surface">
                <Folder className="w-10 h-10 text-muted/30 mb-3" />
                <p className="text-sm text-muted">Select a subject to view its files</p>
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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <ResourceCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ResourceCard({ item }: { item: ResourceItem }) {
  const fileUpper = item.file_url.toUpperCase();
  const isPdf = fileUpper.endsWith('.PDF');
  const isPpt = fileUpper.endsWith('.PPT') || fileUpper.endsWith('.PPTX');
  const isSolved = item.title.toLowerCase().includes('(solved)');

  return (
    <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="group block">
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:bg-surface hover:border-border-strong transition-all shadow-card h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 group-hover:bg-surface-hover transition-colors">
            {isPdf ? (
              <FileText className="w-4 h-4 text-foreground" />
            ) : isPpt ? (
              <FileSpreadsheet className="w-4 h-4 text-foreground" />
            ) : (
              <HardDrive className="w-4 h-4 text-foreground" />
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isSolved && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-surface border border-border text-muted px-1.5 py-0.5 rounded-full">
                Solved
              </span>
            )}
            <ExternalLink className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <p
          className="text-sm font-medium text-foreground line-clamp-2 leading-tight"
          title={item.title}
        >
          {item.title}
        </p>

        <p className="text-[10px] uppercase font-medium text-muted tracking-wider mt-auto">
          {isPdf ? 'PDF' : isPpt ? 'Presentation' : 'File'}
        </p>
      </div>
    </a>
  );
}

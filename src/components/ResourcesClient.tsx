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
  LayoutGrid,
  List,
  PenTool,
} from 'lucide-react';
import ResourceViewer from './ResourceViewer';

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
  { value: 'writeup', label: 'Writeups', Icon: PenTool },
] satisfies { value: ResourceFilter; label: string; Icon: any }[];

export default function ResourcesClient({ initialResources, branch, semester }: ResourcesClientProps) {
  const { searchQuery } = useAcademicStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ResourceFilter>('all');
  const [viewerResource, setViewerResource] = useState<ResourceItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
        <div className="flex items-center bg-surface border border-border rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {initialResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-xl bg-surface">
          <Folder className="w-10 h-10 text-muted/40 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No Files Found</p>
          <p className="text-sm text-muted">No resources uploaded for {branch} Semester {semester} yet.</p>
        </div>
      ) : (
        <div className="w-full">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjectNames.map((name) => (
                <SubjectCard
                  key={name}
                  name={name}
                  resources={subjectsMap[name]}
                  onClick={() => {
                    setSelectedSubject(name);
                    setViewMode('list');
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Sidebar */}
              <div className="w-full md:w-56 shrink-0 border border-border rounded-xl bg-card shadow-card overflow-hidden sticky top-24">
                <div className="px-4 py-3 border-b border-border bg-surface/50">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-muted">Subjects</h3>
                </div>
                <div className="flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar">
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
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setViewMode('grid')}
                          className="text-muted hover:text-foreground transition-colors p-1 -ml-1"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                        <h2 className="text-xl font-bold text-foreground">{selectedSubject}</h2>
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
                      <div className="space-y-10">
                        <ResourceSection
                          title="Question Banks"
                          icon={<BookOpenCheck className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'question-bank')}
                          onOpenResource={setViewerResource}
                        />
                        <ResourceSection
                          title="Class Presentations"
                          icon={<FileSpreadsheet className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'ppt')}
                          onOpenResource={setViewerResource}
                        />
                        <ResourceSection
                          title="Previous Year Questions"
                          icon={<FileText className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'pyq')}
                          onOpenResource={setViewerResource}
                        />
                        <ResourceSection
                          title="Handwritten Notes"
                          icon={<FileText className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'notes')}
                          onOpenResource={setViewerResource}
                        />
                        <ResourceSection
                          title="Writeups"
                          icon={<PenTool className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'writeup')}
                          onOpenResource={setViewerResource}
                        />
                        <ResourceSection
                          title="Other Resources"
                          icon={<HardDrive className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'other')}
                          onOpenResource={setViewerResource}
                        />
                      </div>
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
      )}
      {viewerResource && (
        <ResourceViewer
          resource={viewerResource}
          onClose={() => setViewerResource(null)}
        />
      )}
    </div>
  );
}

function SubjectCard({ 
  name, 
  resources, 
  onClick 
}: { 
  name: string; 
  resources: ResourceItem[]; 
  onClick: () => void 
}) {
  const counts = useMemo(() => {
    return resources.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [resources]);

  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left bg-card border border-border rounded-2xl p-6 hover:border-border-strong hover:shadow-card transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center group-hover:bg-primary/5 transition-colors">
          <Folder className="w-6 h-6 text-primary" />
        </div>
        <span className="text-xs font-bold text-muted bg-surface px-2.5 py-1 rounded-full border border-border">
          {resources.length} Files
        </span>
      </div>
      
      <h3 className="text-lg font-bold text-foreground mb-4 group-hover:text-primary transition-colors line-clamp-1">
        {name}
      </h3>

      <div className="grid grid-cols-2 gap-2 mt-auto">
        {RESOURCE_FILTERS.filter(f => f.value !== 'all').map(filter => {
          const count = counts[filter.value] || 0;
          if (count === 0) return null;
          return (
            <div key={filter.value} className="flex items-center gap-2 text-[11px] text-muted font-medium">
              <filter.Icon className="w-3 h-3" />
              <span>{count} {filter.label}</span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

function ResourceSection({
  title,
  icon,
  items,
  onOpenResource,
}: {
  title: string;
  icon: React.ReactNode;
  items: ResourceItem[];
  onOpenResource: (item: ResourceItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2.5 border-b border-border pb-2">
        <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center">
          {icon}
        </div>
        {title}
        <span className="ml-auto text-[10px] bg-surface px-2 py-0.5 rounded-full border border-border">
          {items.length}
        </span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ResourceCard key={item.id} item={item} onOpenResource={onOpenResource} />
        ))}
      </div>
    </div>
  );
}

function getFileExtension(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('.').pop()?.toLowerCase() ?? '';
  } catch {
    return url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';
  }
}

function ResourceCard({
  item,
  onOpenResource,
}: {
  item: ResourceItem;
  onOpenResource: (item: ResourceItem) => void;
}) {
  const extension = getFileExtension(item.file_url);
  const isPdf = extension === 'pdf';
  const isPpt = extension === 'ppt' || extension === 'pptx';
  const opensInViewer = isPdf || isPpt;
  const isSolved = item.title.toLowerCase().includes('(solved)');
  const cardContent = (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:bg-surface hover:border-border-strong transition-all shadow-card h-full text-left">
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
  );

  if (opensInViewer) {
    return (
      <button
        type="button"
        onClick={() => onOpenResource(item)}
        className="group block h-full w-full"
      >
        {cardContent}
      </button>
    );
  }

  return (
    <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="group block">
      {cardContent}
    </a>
  );
}

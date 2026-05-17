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
  Brain,
} from 'lucide-react';
import ResourceViewer from './ResourceViewer';
import SummaryModal from './SummaryModal';
import ResourceCard from './resources/ResourceCard';
import ResourceSection from './resources/ResourceSection';
import SubjectCard from './resources/SubjectCard';

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
  const [summarizingResource, setSummarizingResource] = useState<ResourceItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [contentResults, setContentResults] = useState<any[]>([]);
  const [isSearchingContent, setIsSearchingContent] = useState(false);

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

  const filteredSubjectNames = useMemo(() => {
    if (!searchQuery.trim()) return subjectNames;
    const q = searchQuery.toLowerCase();
    return subjectNames.filter((name) => {
      const subjResources = subjectsMap[name] ?? [];
      return name.toLowerCase().includes(q) || subjResources.some((r) => r.title.toLowerCase().includes(q));
    });
  }, [subjectNames, subjectsMap, searchQuery]);

  // Synchronize selectedSubject with active search/filter results
  useEffect(() => {
    if (filteredSubjectNames.length > 0) {
      if (!selectedSubject || !filteredSubjectNames.includes(selectedSubject)) {
        setSelectedSubject(filteredSubjectNames[0]);
      }
    }
  }, [filteredSubjectNames, selectedSubject]);

  // Automatically switch to list view when searching so files are instantly visible
  useEffect(() => {
    if (searchQuery.trim()) {
      setViewMode('list');
    }
  }, [searchQuery]);

  // Content Search Effect
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setContentResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingContent(true);
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setContentResults(data.results || []);
      } catch (err) {
        console.error('Content search error:', err);
      } finally {
        setIsSearchingContent(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
                  filters={RESOURCE_FILTERS}
                  onClick={() => {
                    setSelectedSubject(name);
                    setViewMode('list');
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Sidebar */}
              <div className="w-full md:w-64 shrink-0 border border-border rounded-xl bg-card shadow-sm overflow-hidden sticky top-24">
                <div className="px-4 py-3.5 border-b border-border bg-surface/50 flex items-center justify-between">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-muted">Subjects</h3>
                  <span className="text-[10px] font-semibold bg-surface px-2 py-0.5 rounded-md border border-border text-muted">
                    {filteredSubjectNames.length}
                  </span>
                </div>
                <div className="flex flex-col max-h-[65vh] overflow-y-auto custom-scrollbar p-2 gap-1">
                  {filteredSubjectNames.map((subjectName) => {
                    const isActive = selectedSubject === subjectName;
                    return (
                      <button
                        key={subjectName}
                        onClick={() => setSelectedSubject(subjectName)}
                        className={`group flex items-center gap-3 px-3 py-2.5 text-left transition-colors text-sm rounded-lg ${
                          isActive
                            ? 'bg-foreground text-background font-medium shadow-sm'
                            : 'text-muted hover:text-foreground hover:bg-surface/60'
                        }`}
                      >
                        <Folder className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-background' : 'text-muted group-hover:text-foreground'}`} />
                        <span className="flex-1 truncate">{subjectName}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors ${isActive ? 'bg-background text-foreground border border-background/20' : 'bg-surface border border-border text-muted group-hover:text-foreground'}`}>
                          {subjectsMap[subjectName].length}
                        </span>
                      </button>
                    );
                  })}
                  {filteredSubjectNames.length === 0 && (
                    <p className="px-4 py-8 text-sm text-muted text-center font-medium">No subjects match.</p>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 w-full min-w-0">
                {selectedSubject && subjectsMap[selectedSubject] ? (
                  <div className="space-y-10">
                    {/* Subject title + filter */}
                    <div className="flex flex-col gap-6 border-b border-border pb-6">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setViewMode('grid')}
                          className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground hover:border-border-strong transition-colors shadow-sm -ml-1"
                          title="Back to Grid"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                        <h2 className="text-2xl font-bold text-foreground tracking-tight">{selectedSubject}</h2>
                        {(searchQuery || selectedFilter !== 'all') && (
                          <span className="text-xs font-medium text-muted px-2.5 py-1 bg-surface border border-border rounded-md shadow-xs">
                            {filteredResources.length} {filteredResources.length !== 1 ? 'Results' : 'Result'}
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
                              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? 'border-foreground bg-foreground text-background shadow-sm'
                                  : 'border-border bg-surface/50 text-muted hover:border-border-strong hover:text-foreground hover:bg-surface'
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${active ? 'text-background' : 'text-muted group-hover:text-foreground'}`} />
                              {label}
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${active ? 'bg-background/20 text-background' : 'bg-card border border-border text-muted'}`}>
                                {filterCounts[value] ?? 0}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {filteredResources.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl bg-surface/50 shadow-sm">
                        <div className="w-12 h-12 rounded-lg bg-surface border border-border flex items-center justify-center mb-4 text-muted">
                          <Search className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">No Matching Files</p>
                        <p className="text-xs text-muted max-w-sm mx-auto">
                          {searchQuery ? `We couldn't find any files matching "${searchQuery}" in this subject.` : 'No files match the selected category filter.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-12">
                        {/* Intelligent Content Search Results */}
                        {contentResults.length > 0 && (
                          <div className="space-y-6 bg-surface/40 border border-border rounded-xl p-6 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-3 border-b border-border pb-4">
                              <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-foreground shadow-xs">
                                <Brain className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Content Matches</h3>
                                <p className="text-[10px] font-medium text-muted mt-0.5">AI Semantic Search</p>
                              </div>
                              <span className="ml-auto text-[10px] font-medium bg-surface text-muted px-2.5 py-1 rounded-md border border-border shadow-xs">
                                {contentResults.length} {contentResults.length === 1 ? 'Snippet' : 'Snippets'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {contentResults.map((result, idx) => (
                                <button
                                  key={`${result.resource_id}-${idx}`}
                                  onClick={() => {
                                    const resource = initialResources.find(r => r.id === result.resource_id);
                                    if (resource) setViewerResource(resource);
                                  }}
                                  className="group text-left bg-card border border-border hover:border-border-strong rounded-xl p-5 transition-colors flex flex-col justify-between h-full shadow-xs"
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-[10px] font-medium text-muted bg-surface border border-border px-2 py-0.5 rounded-md">
                                        {result.subject_name}
                                      </span>
                                      <ExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-foreground transition-colors" />
                                    </div>
                                    <h4 className="text-sm font-medium text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors leading-snug">
                                      {result.title}
                                    </h4>
                                    <div 
                                      className="border-l-2 border-border-strong pl-3 my-3 text-xs text-muted not-italic leading-relaxed font-mono"
                                      dangerouslySetInnerHTML={{ __html: `"...${result.snippet}..."` }}
                                    />
                                  </div>

                                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted group-hover:text-foreground transition-colors">
                                    <span>Open document</span>
                                    <span>→</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <ResourceSection
                          title="Question Banks"
                          icon={<BookOpenCheck className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'question-bank')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Class Presentations"
                          icon={<FileSpreadsheet className="w-4 h-4 text-primary" />}
                          items={filteredResources.filter((r) => r.category === 'ppt')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Previous Year Questions"
                          icon={<FileText className="w-4 h-4 text-primary" />}
                          items={filteredResources.filter((r) => r.category === 'pyq')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Handwritten Notes"
                          icon={<FileText className="w-4 h-4 text-primary" />}
                          items={filteredResources.filter((r) => r.category === 'notes')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Writeups"
                          icon={<PenTool className="w-4 h-4 text-primary" />}
                          items={filteredResources.filter((r) => r.category === 'writeup')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Other Resources"
                          icon={<HardDrive className="w-4 h-4 text-primary" />}
                          items={filteredResources.filter((r) => r.category === 'other')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-24 border border-dashed border-border rounded-2xl bg-surface/30 backdrop-blur-sm shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4 shadow-sm">
                      <Folder className="w-8 h-8 text-muted/40" />
                    </div>
                    <p className="text-base font-bold text-foreground mb-1">Select a Subject</p>
                    <p className="text-sm font-medium text-muted max-w-xs mx-auto">Choose a subject from the sidebar to view its notes, presentations, and question banks.</p>
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
      {summarizingResource && (
        <SummaryModal
          resourceId={summarizingResource.id}
          resourceTitle={summarizingResource.title}
          onClose={() => setSummarizingResource(null)}
        />
      )}
    </div>
  );
}

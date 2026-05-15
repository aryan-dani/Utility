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

  useEffect(() => {
    if (subjectNames.length > 0 && !selectedSubject) {
      setSelectedSubject(subjectNames[0]);
    }
  }, [subjectNames, selectedSubject]);

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
                  filters={RESOURCE_FILTERS}
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
                        {/* Intelligent Content Search Results */}
                        {contentResults.length > 0 && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2.5 border-b border-primary/20 pb-2">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Brain className="w-4 h-4 text-primary" />
                              </div>
                              Content Matches
                              <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                {contentResults.length} Snippets
                              </span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {contentResults.map((result, idx) => (
                                <button
                                  key={`${result.resource_id}-${idx}`}
                                  onClick={() => {
                                    // Map result back to a ResourceItem for the viewer
                                    const resource = initialResources.find(r => r.id === result.resource_id);
                                    if (resource) setViewerResource(resource);
                                  }}
                                  className="group text-left bg-primary/5 border border-primary/10 rounded-xl p-4 hover:border-primary/30 hover:bg-primary/[0.08] transition-all shadow-sm"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{result.subject_name}</span>
                                    <ExternalLink className="w-3 h-3 text-primary/50" />
                                  </div>
                                  <h4 className="text-sm font-bold text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors">{result.title}</h4>
                                  <p 
                                    className="text-xs text-muted leading-relaxed line-clamp-3 italic"
                                    dangerouslySetInnerHTML={{ __html: `"...${result.snippet}..."` }}
                                  />
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
                          icon={<FileSpreadsheet className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'ppt')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Previous Year Questions"
                          icon={<FileText className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'pyq')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Handwritten Notes"
                          icon={<FileText className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'notes')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Writeups"
                          icon={<PenTool className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'writeup')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
                        />
                        <ResourceSection
                          title="Other Resources"
                          icon={<HardDrive className="w-4 h-4" />}
                          items={filteredResources.filter((r) => r.category === 'other')}
                          onOpenResource={setViewerResource}
                          onSummarize={setSummarizingResource}
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

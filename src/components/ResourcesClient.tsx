'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ResourceCategory, ResourceItem } from '@/lib/dataFetcher';
import { useAcademicStore } from '@/store/academicStore';
import { isSubjectMatch } from '@/lib/subjectMatcher';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
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
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import ResourceViewer from './ResourceViewer';
import SummaryModal from './SummaryModal';
import ResourceCard from './resources/ResourceCard';
import ResourceSection from './resources/ResourceSection';

interface ResourcesClientProps {
  initialResources: ResourceItem[];
  branch: string;
  semester: number;
}

type ResourceFilter = 'all' | ResourceCategory;

// Simplified filter config — only main categories, no clutter
const RESOURCE_FILTERS: { value: ResourceFilter; label: string; Icon: any }[] = [
  { value: 'all', label: 'All', Icon: Layers },
  { value: 'notes', label: 'Notes', Icon: FileText },
  { value: 'question-bank', label: 'Question Banks', Icon: BookOpenCheck },
  { value: 'ppt', label: 'Presentations', Icon: FileSpreadsheet },
  { value: 'pyq', label: 'PYQ', Icon: FileText },
  { value: 'writeup', label: 'Writeups', Icon: PenTool },
];

// Section rendering config with accent colors
const SECTION_CONFIG = [
  { category: 'notes' as const, title: 'Notes', icon: <FileText className="w-3.5 h-3.5" />, accentColor: 'var(--accent-notes)' },
  { category: 'question-bank' as const, title: 'Question Banks', icon: <BookOpenCheck className="w-3.5 h-3.5" />, accentColor: 'var(--accent-qb)' },
  { category: 'solved-question-bank' as const, title: 'Solved Question Banks', icon: <CheckCircle2 className="w-3.5 h-3.5" />, accentColor: 'var(--accent-qb-solved)' },
  { category: 'ppt' as const, title: 'Presentations', icon: <FileSpreadsheet className="w-3.5 h-3.5" />, accentColor: 'var(--accent-ppt)' },
  { category: 'pyq' as const, title: 'Previous Year Questions', icon: <FileText className="w-3.5 h-3.5" />, accentColor: 'var(--accent-pyq)' },
  { category: 'writeup' as const, title: 'Writeups', icon: <PenTool className="w-3.5 h-3.5" />, accentColor: 'var(--accent-writeup)' },
  { category: 'other' as const, title: 'Other Resources', icon: <HardDrive className="w-3.5 h-3.5" />, accentColor: 'var(--accent-other)' },
];

export default function ResourcesClient({ initialResources, branch, semester }: ResourcesClientProps) {
  const { searchQuery } = useAcademicStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ResourceFilter>('all');
  const [viewerResource, setViewerResource] = useState<ResourceItem | null>(null);
  const [summarizingResource, setSummarizingResource] = useState<ResourceItem | null>(null);
  const [contentResults, setContentResults] = useState<any[]>([]);
  const [isSearchingContent, setIsSearchingContent] = useState(false);

  // ── Realtime state ──
  const [resources, setResources] = useState<ResourceItem[]>(initialResources);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Realtime: Supabase subscription ──
  const refetchResources = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/resources/list?branch=${encodeURIComponent(branch)}&semester=${semester}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (data.resources) {
        setResources(data.resources);
      }
    } catch (err) {
      console.error('Failed to refetch resources:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [branch, semester]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('resources-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        () => {
          // On any INSERT/UPDATE/DELETE, refetch the full list
          // This guarantees we get properly joined data with subject names
          refetchResources();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchResources]);

  // ── Derived data ──
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

  const subjectNames = useMemo(() => Object.keys(subjectsMap).sort(), [subjectsMap]);

  const filteredSubjectNames = useMemo(() => {
    if (!searchQuery.trim()) return subjectNames;
    const q = searchQuery.toLowerCase();
    return subjectNames.filter((name) => {
      const subjResources = subjectsMap[name] ?? [];
      return name.toLowerCase().includes(q) || 
             isSubjectMatch(name, searchQuery) || 
             subjResources.some((r) => r.title.toLowerCase().includes(q));
    });
  }, [subjectNames, subjectsMap, searchQuery]);

  // Auto-select first subject
  useEffect(() => {
    if (filteredSubjectNames.length > 0) {
      if (!selectedSubject || !filteredSubjectNames.includes(selectedSubject)) {
        setSelectedSubject(filteredSubjectNames[0]);
      }
    }
  }, [filteredSubjectNames, selectedSubject]);

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
      (r) => r.title.toLowerCase().includes(q) || 
             r.subject_name.toLowerCase().includes(q) || 
             isSubjectMatch(r.subject_name, searchQuery),
    );
  }, [selectedSubject, subjectsMap, searchQuery]);

  const filteredResources = useMemo(() => {
    if (selectedFilter === 'all') return searchedResources;
    // When "Question Banks" filter is active, show both solved and unsolved
    if (selectedFilter === 'question-bank') {
      return searchedResources.filter((r) => r.category === 'question-bank' || r.category === 'solved-question-bank');
    }
    return searchedResources.filter((r) => r.category === selectedFilter);
  }, [searchedResources, selectedFilter]);

  const filterCounts = useMemo(
    () =>
      RESOURCE_FILTERS.reduce(
        (acc, filter) => {
          if (filter.value === 'all') {
            acc[filter.value] = searchedResources.length;
          } else if (filter.value === 'question-bank') {
            // Count both solved and unsolved QBs under the QB filter
            acc[filter.value] = searchedResources.filter((r) => r.category === 'question-bank' || r.category === 'solved-question-bank').length;
          } else {
            acc[filter.value] = searchedResources.filter((r) => r.category === filter.value).length;
          }
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
            {branch} · Semester {semester} · {resources.length} files
          </p>
        </div>
        
        {/* Realtime status indicator */}
        <div className="flex items-center gap-3">
          {isRefreshing && (
            <RefreshCw className="w-3.5 h-3.5 text-muted animate-spin" />
          )}
          <div className="flex items-center gap-1.5" title={`Realtime: ${realtimeStatus}`}>
            {realtimeStatus === 'connected' ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : realtimeStatus === 'connecting' ? (
              <Wifi className="w-3.5 h-3.5 text-muted animate-pulse" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
              {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'connecting' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-xl bg-surface">
          <Folder className="w-10 h-10 text-muted/40 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No Files Found</p>
          <p className="text-sm text-muted">No resources uploaded for {branch} Semester {semester} yet.</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* ── Sidebar: Subject list ── */}
          <div className="w-full md:w-60 shrink-0 border border-border rounded-xl bg-card shadow-sm overflow-hidden sticky top-24">
            <div className="px-4 py-3 border-b border-border bg-surface/50 flex items-center justify-between">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted">Subjects</h3>
              <span className="text-[10px] font-semibold bg-surface px-2 py-0.5 rounded-md border border-border text-muted">
                {filteredSubjectNames.length}
              </span>
            </div>
            <div className="flex flex-col max-h-[65vh] overflow-y-auto custom-scrollbar p-2 gap-0.5 relative">
              {filteredSubjectNames.map((subjectName) => {
                const isActive = selectedSubject === subjectName;
                const subjectResources = subjectsMap[subjectName] ?? [];
                return (
                  <button
                    key={subjectName}
                    onClick={() => {
                      setSelectedSubject(subjectName);
                      setSelectedFilter('all');
                    }}
                    className={`group flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-sm rounded-lg relative ${
                      isActive
                        ? 'text-background font-medium shadow-sm'
                        : 'text-muted hover:text-foreground hover:bg-surface/60'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSubject"
                        className="absolute inset-0 bg-foreground rounded-lg -z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Folder className={`w-4 h-4 flex-shrink-0 z-10 ${isActive ? 'text-background' : 'text-muted group-hover:text-foreground'}`} />
                    <span className="flex-1 truncate text-[13px] z-10">{subjectName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold transition-colors z-10 ${isActive ? 'bg-background/20 text-background' : 'text-muted'}`}>
                      {subjectResources.length}
                    </span>
                  </button>
                );
              })}
              {filteredSubjectNames.length === 0 && (
                <p className="px-4 py-8 text-sm text-muted text-center font-medium">No subjects match.</p>
              )}
            </div>
          </div>

          {/* ── Content area ── */}
          <div className="flex-1 w-full min-w-0">
            {selectedSubject && subjectsMap[selectedSubject] ? (
              <div className="space-y-8">
                {/* Subject header + compact filter pills */}
                <div className="flex flex-col gap-4 border-b border-border pb-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-foreground tracking-tight">{selectedSubject}</h2>
                    {(searchQuery || selectedFilter !== 'all') && (
                      <span className="text-xs font-medium text-muted px-2 py-0.5 bg-surface border border-border rounded-md">
                        {filteredResources.length} {filteredResources.length !== 1 ? 'results' : 'result'}
                      </span>
                    )}
                  </div>

                  {/* Compact filter pills — scrollable on mobile */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-none relative">
                    {RESOURCE_FILTERS.map(({ value, label, Icon }) => {
                      const count = filterCounts[value] ?? 0;
                      const active = selectedFilter === value;
                      if (value !== 'all' && count === 0) return null; // Hide empty filters
                      return (
                        <button
                          key={value}
                          onClick={() => setSelectedFilter(value)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all whitespace-nowrap flex-shrink-0 relative ${
                            active
                              ? 'border-transparent text-background shadow-sm'
                              : 'border-border bg-surface/50 text-muted hover:border-border-strong hover:text-foreground'
                          }`}
                        >
                          {active && (
                            <motion.div
                              layoutId="activeFilter"
                              className="absolute inset-0 bg-foreground rounded-lg -z-10"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                          <Icon className={`w-3 h-3 z-10 ${active ? 'text-background' : 'text-muted'}`} />
                          <span className="z-10">{label}</span>
                          <span className={`text-[9px] font-bold z-10 ${active ? 'text-background/70' : 'text-muted'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredResources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-surface/50">
                    <Search className="w-6 h-6 text-muted/50 mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">No Matching Files</p>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                      {searchQuery ? `No files match "${searchQuery}" in this subject.` : 'No files match the selected filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Intelligent Content Search Results */}
                    {contentResults.length > 0 && (
                      <div className="space-y-4 bg-surface/40 border border-border rounded-xl p-5 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2.5 border-b border-border pb-3">
                          <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-foreground">
                            <Brain className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Content Matches</h3>
                            <p className="text-[10px] font-medium text-muted">AI Semantic Search · {contentResults.length} snippets</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {contentResults.map((result, idx) => (
                            <button
                              key={`${result.resource_id}-${idx}`}
                              onClick={() => {
                                const resource = resources.find(r => r.id === result.resource_id);
                                if (resource) setViewerResource(resource);
                              }}
                              className="group text-left bg-card border border-border hover:border-border-strong rounded-xl p-4 transition-colors flex flex-col justify-between h-full shadow-xs"
                            >
                              <div>
                                <span className="text-[10px] font-medium text-muted bg-surface border border-border px-2 py-0.5 rounded-md">
                                  {result.subject_name}
                                </span>
                                <h4 className="text-sm font-medium text-foreground mt-2 mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                                  {result.title}
                                </h4>
                                <div 
                                  className="border-l-2 border-border-strong pl-3 text-xs text-muted leading-relaxed font-mono line-clamp-3"
                                  dangerouslySetInnerHTML={{ __html: `"...${result.snippet}..."` }}
                                />
                              </div>
                              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted group-hover:text-foreground transition-colors">
                                <span>Open document</span>
                                <span>→</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resource sections — organized by type */}
                    {SECTION_CONFIG.map((section) => (
                      <ResourceSection
                        key={section.category}
                        title={section.title}
                        icon={section.icon}
                        accentColor={section.accentColor}
                        items={filteredResources.filter((r) => r.category === section.category)}
                        onOpenResource={setViewerResource}
                        onSummarize={setSummarizingResource}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-24 border border-dashed border-border rounded-2xl bg-surface/30">
                <Folder className="w-12 h-12 text-muted/30 mb-4" />
                <p className="text-base font-bold text-foreground mb-1">Select a Subject</p>
                <p className="text-sm font-medium text-muted max-w-xs mx-auto">
                  Choose a subject from the sidebar to view its resources.
                </p>
              </div>
            )}
          </div>
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

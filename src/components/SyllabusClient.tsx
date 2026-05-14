'use client';

import { useMemo } from 'react';
import { SubjectItem } from '@/lib/dataFetcher';
import { useAcademicStore } from '@/store/academicStore';
import { BookMarked, Layers, Search, FileText, ArrowRight } from 'lucide-react';

interface SyllabusClientProps {
  subjects: SubjectItem[];
  branch: string;
  semester: number;
  syllabusUrl?: string | null;
}

export default function SyllabusClient({ subjects, branch, semester, syllabusUrl }: SyllabusClientProps) {
  const { searchQuery } = useAcademicStore();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase();
    return subjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [subjects, searchQuery]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Syllabus Directory</h1>
          <p className="text-muted text-sm mt-1">
            {branch} · Semester {semester} · {filtered.length} subject{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {syllabusUrl && (
          <a
            href={syllabusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity shadow-card flex-shrink-0"
          >
            <FileText className="w-4 h-4" />
            Download Full Syllabus
          </a>
        )}
      </div>

      {/* Subject Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((subject, i) => (
          <div
            key={subject.id}
            className="group bg-card border border-border rounded-xl p-5 hover:bg-surface hover:border-border-strong transition-all shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 group-hover:bg-surface-hover transition-colors">
                <BookMarked className="w-4 h-4 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground leading-tight truncate">
                    {subject.name}
                  </h2>
                  <span className="text-[10px] font-mono text-muted flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {branch} · Sem {semester}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty states */}
      {filtered.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-xl bg-surface">
          <Search className="w-10 h-10 text-muted/30 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No matches for &ldquo;{searchQuery}&rdquo;</p>
          <p className="text-sm text-muted">Try a different search term.</p>
        </div>
      )}

      {filtered.length === 0 && !searchQuery && (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-xl bg-surface">
          <BookMarked className="w-10 h-10 text-muted/30 mb-3" />
          <p className="text-base font-semibold text-foreground mb-1">No Subjects Found</p>
          <p className="text-sm text-muted">
            No subjects configured for {branch} Semester {semester}.
          </p>
        </div>
      )}

      {/* Hint to resources */}
      {filtered.length > 0 && (
        <div className="mt-12 flex items-center justify-center">
          <a
            href={`/resources?branch=${branch}&semester=${semester}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors group"
          >
            <Layers className="w-4 h-4" />
            View all study materials for these subjects
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      )}
    </div>
  );
}

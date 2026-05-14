"use client";

import { useMemo } from "react";
import { SubjectItem } from "@/lib/dataFetcher";
import { useAcademicStore } from "@/store/academicStore";
import { BookMarked, Layers, Search } from "lucide-react";

interface SyllabusClientProps {
  subjects: SubjectItem[];
  branch: string;
  semester: number;
}

export default function SyllabusClient({ subjects, branch, semester }: SyllabusClientProps) {
  const { searchQuery } = useAcademicStore();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase();
    return subjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [subjects, searchQuery]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Syllabus Directory
          </h1>
          <p className="text-muted text-sm mt-1">
            {branch} — Semester {semester}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface border border-border text-foreground font-medium text-sm">
          <Layers className="w-4 h-4 text-muted" />
          <span>{filtered.length} Subject{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((subject) => (
          <div
            key={subject.id}
            className="bg-white border border-border p-6 rounded-lg shadow-sm hover:shadow transition-shadow"
          >
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded bg-surface flex items-center justify-center border border-border flex-shrink-0 text-foreground">
                <BookMarked className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground leading-tight">
                  {subject.name}
                </h2>
                <p className="text-sm text-muted mt-1">
                  {branch} · Semester {semester}
                </p>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && searchQuery && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-surface">
            <Search className="w-10 h-10 text-muted mb-3" />
            <p className="text-lg font-semibold text-foreground mb-1">
              No matches for &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-sm text-muted">
              Try a different search term.
            </p>
          </div>
        )}

        {filtered.length === 0 && !searchQuery && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-surface">
            <BookMarked className="w-10 h-10 text-muted mb-3" />
            <p className="text-lg font-semibold text-foreground mb-1">
              No Subjects Found
            </p>
            <p className="text-sm text-muted">
              No subjects are configured for {branch} Semester {semester}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

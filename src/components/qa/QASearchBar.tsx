"use client";

import { Search, X } from "lucide-react";
import { Segmented } from "@/components/ui";
import type { QuestionCategory, QuestionStatus } from "@/lib/qa/types";

interface QASearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  category: QuestionCategory | "all";
  onCategoryChange: (c: QuestionCategory | "all") => void;
  status: QuestionStatus | "all";
  onStatusChange: (s: QuestionStatus | "all") => void;
}

export default function QASearchBar({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
}: QASearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search questions…"
          className="w-full pl-9 pr-8 py-2 rounded-xl border border-border bg-surface text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Category filter */}
      <Segmented
        value={category}
        onChange={onCategoryChange}
        size="sm"
        aria-label="Filter by category"
        options={[
          { value: "all", label: "All" },
          { value: "doubt", label: "Doubt" },
          { value: "general", label: "General" },
        ]}
      />

      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Status filter */}
      <Segmented
        value={status}
        onChange={onStatusChange}
        size="sm"
        aria-label="Filter by status"
        options={[
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" },
        ]}
      />
    </div>
  );
}

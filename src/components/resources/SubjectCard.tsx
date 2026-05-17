'use client';

import { useMemo } from 'react';
import { Folder } from 'lucide-react';
import { ResourceItem } from '@/lib/dataFetcher';

interface SubjectCardProps {
  name: string;
  resources: ResourceItem[];
  onClick: () => void;
  filters: { value: string; label: string; Icon: any }[];
}

export default function SubjectCard({ 
  name, 
  resources, 
  onClick,
  filters
}: SubjectCardProps) {
  const counts = useMemo(() => {
    return resources.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [resources]);

  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left bg-card border border-border rounded-xl p-6 hover:border-border-strong hover:shadow-sm transition-colors"
    >
      <div className="flex items-center justify-between mb-6 w-full">
        <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-muted group-hover:text-foreground transition-colors shadow-xs">
          <Folder className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold bg-surface px-2.5 py-1 rounded-md border border-border text-muted group-hover:text-foreground transition-colors">
          {resources.length} {resources.length === 1 ? 'File' : 'Files'}
        </span>
      </div>
      
      <h3 className="text-base font-bold text-foreground mb-6 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
        {name}
      </h3>

      <div className="grid grid-cols-2 gap-2 mt-auto w-full pt-4 border-t border-border">
        {filters.filter(f => f.value !== 'all').map(filter => {
          const count = counts[filter.value] || 0;
          if (count === 0) return null;
          return (
            <div key={filter.value} className="flex items-center gap-2 text-xs text-muted font-medium">
              <filter.Icon className="w-3.5 h-3.5" />
              <span className="truncate">{count} {filter.label}</span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

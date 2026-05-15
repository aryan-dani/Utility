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
        {filters.filter(f => f.value !== 'all').map(filter => {
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

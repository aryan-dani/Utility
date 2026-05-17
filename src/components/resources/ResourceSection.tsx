'use client';

import { ResourceItem } from '@/lib/dataFetcher';
import ResourceCard from './ResourceCard';

interface ResourceSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ResourceItem[];
  onOpenResource: (item: ResourceItem) => void;
  onSummarize: (item: ResourceItem) => void;
}

export default function ResourceSection({
  title,
  icon,
  items,
  onOpenResource,
  onSummarize,
}: ResourceSectionProps) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-foreground shadow-xs">
          {icon}
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
          {title}
        </h3>
        <span className="ml-auto text-[10px] font-semibold bg-surface px-2.5 py-1 rounded-md border border-border text-muted">
          {items.length} {items.length === 1 ? 'Item' : 'Items'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <ResourceCard 
            key={item.id} 
            item={item} 
            onOpenResource={onOpenResource} 
            onSummarize={onSummarize}
          />
        ))}
      </div>
    </div>
  );
}

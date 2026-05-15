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

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ResourceItem } from '@/lib/dataFetcher';
import ResourceCard from './ResourceCard';

interface ResourceSectionProps {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  items: ResourceItem[];
  onOpenResource: (item: ResourceItem) => void;
  onSummarize: (item: ResourceItem) => void;
  defaultExpanded?: boolean;
}

export default function ResourceSection({
  title,
  icon,
  accentColor,
  items,
  onOpenResource,
  onSummarize,
  defaultExpanded = true,
}: ResourceSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Clickable section header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 pb-3 border-b border-border group cursor-pointer select-none"
      >
        <div 
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ 
            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
          {title}
        </h3>
        <span 
          className="text-[10px] font-bold px-2 py-0.5 rounded-md"
          style={{
            background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
            color: accentColor,
          }}
        >
          {items.length}
        </span>
        <ChevronDown 
          className={`w-4 h-4 ml-auto text-muted group-hover:text-foreground transition-all duration-200 ${
            isExpanded ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>

      {/* Collapsible content with animation */}
      <div 
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
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

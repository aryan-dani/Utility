"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ResourceItem } from "@/lib/dataFetcher";
import {
  ResourceFolderNode,
  countFolderFiles,
  isSingletonFolder,
  singletonFile,
} from "@/lib/resourceGroups";
import ResourceFileRow from "./ResourceFileRow";
import { MOTION } from "@/lib/motion";

interface ResourceFolderProps {
  folder: ResourceFolderNode;
  expanded: boolean;
  onToggle: (folderId: string) => void;
  expandedIds: Set<string>;
  onOpenResource: (item: ResourceItem) => void;
  onSummarize?: (item: ResourceItem) => void;
  onShare?: (item: ResourceItem) => void;
  onFavorite?: (item: ResourceItem) => void;
  favoriteIds?: Set<string>;
  depth?: number;
  highlightFileId?: string | null;
  activeFolderId?: string | null;
  scrollToId?: string | null;
}

export default function ResourceFolder({
  folder,
  expanded,
  onToggle,
  expandedIds,
  onOpenResource,
  onSummarize,
  onShare,
  onFavorite,
  favoriteIds,
  depth = 0,
  highlightFileId = null,
  activeFolderId = null,
  scrollToId = null,
}: ResourceFolderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fileCount = countFolderFiles(folder);
  const paddingLeft = 8 + depth * 12;

  useEffect(() => {
    if (scrollToId === folder.id && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [scrollToId, folder.id]);

  return (
    <div
      ref={ref}
      data-folder-scroll={folder.id}
      className="border-b border-border/60 last:border-b-0"
    >
      <button
        type="button"
        onClick={() => onToggle(folder.id)}
        className="w-full flex items-center gap-2.5 py-3 pr-3 hover:bg-surface/50 transition-colors text-left group"
        style={{ paddingLeft }}
        aria-expanded={expanded}
      >
        <ChevronDown
          className={`w-4 h-4 text-muted flex-shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
        />
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface border border-border text-muted group-hover:text-foreground transition-colors">
          {expanded ? (
            <FolderOpen className="w-4 h-4" />
          ) : (
            <Folder className="w-4 h-4" />
          )}
        </div>
        <span className="text-sm font-semibold text-foreground flex-1 truncate">
          {folder.label}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface border border-border text-muted">
          {fileCount}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.duration.base, ease: MOTION.ease }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 bg-card/50">
              {folder.files.map((item) => (
                <ResourceFileRow
                  key={item.id}
                  item={item}
                  onOpenResource={onOpenResource}
                  onSummarize={onSummarize}
                  onShare={onShare}
                  onFavorite={onFavorite}
                  isFavorite={favoriteIds?.has(item.id)}
                  depth={depth + 1}
                  highlight={highlightFileId === item.id}
                />
              ))}
              {folder.children.map((child) => {
                if (isSingletonFolder(child)) {
                  const item = singletonFile(child);
                  if (!item) return null;
                  return (
                    <ResourceFileRow
                      key={child.id}
                      item={item}
                      onOpenResource={onOpenResource}
                      onSummarize={onSummarize}
                      onShare={onShare}
                      onFavorite={onFavorite}
                      isFavorite={favoriteIds?.has(item.id)}
                      depth={depth + 1}
                      highlight={
                        highlightFileId === item.id ||
                        activeFolderId === child.id
                      }
                      scrollTarget={
                        scrollToId === child.id || activeFolderId === child.id
                      }
                    />
                  );
                }
                return (
                  <ResourceFolder
                    key={child.id}
                    folder={child}
                    expanded={expandedIds.has(child.id)}
                    onToggle={onToggle}
                    expandedIds={expandedIds}
                    onOpenResource={onOpenResource}
                    onSummarize={onSummarize}
                    onShare={onShare}
                    onFavorite={onFavorite}
                    favoriteIds={favoriteIds}
                    depth={depth + 1}
                    highlightFileId={highlightFileId}
                    activeFolderId={activeFolderId}
                    scrollToId={scrollToId}
                  />
                );
              })}
              {folder.files.length === 0 && folder.children.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted" style={{ paddingLeft: paddingLeft + 40 }}>
                  Empty folder
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { ResourceItem } from "@/lib/dataFetcher";
import {
  ResourceFolderNode,
  countFolderFiles,
  isSingletonFolder,
  singletonFile,
  allTopLevelSingletons,
  collectSingletonFiles,
  folderScrollSelector,
} from "@/lib/resourceGroups";
import { motion, AnimatePresence } from "framer-motion";
import ResourceCard from "./ResourceCard";
import ResourceFolder from "./ResourceFolder";
import ResourceFileRow from "./ResourceFileRow";
import { NotesDisclaimer } from "../NotesDisclaimer";
import { MOTION } from "@/lib/motion";

interface ResourceSectionProps {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  /** Flat list fallback when folders are not provided */
  items?: ResourceItem[];
  /** Hierarchical folder tree (preferred) */
  folders?: ResourceFolderNode[];
  onOpenResource: (item: ResourceItem) => void;
  onSummarize: (item: ResourceItem) => void;
  onShare?: (item: ResourceItem) => void;
  onFavorite?: (item: ResourceItem) => void;
  favoriteIds?: Set<string>;
  defaultExpanded?: boolean;
  relatedCodesById?: Record<string, ResourceItem[]>;
  /** Folder id to keep expanded / scroll into view */
  activeFolderId?: string | null;
  onFolderChange?: (folderId: string | null) => void;
  highlightFileId?: string | null;
}

function collectExpandDefaults(
  folders: ResourceFolderNode[],
  activeFolderId: string | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  // Expand first multi-file folder by default when nothing is active
  if (!activeFolderId && folders.length > 0) {
    const firstBundle = folders.find((f) => !isSingletonFolder(f));
    if (firstBundle) ids.add(firstBundle.id);
  }
  const walk = (nodes: ResourceFolderNode[]) => {
    for (const node of nodes) {
      if (activeFolderId && (node.id === activeFolderId || hasDescendant(node, activeFolderId))) {
        ids.add(node.id);
      }
      walk(node.children);
    }
  };
  walk(folders);
  return ids;
}

function hasDescendant(node: ResourceFolderNode, id: string): boolean {
  for (const child of node.children) {
    if (child.id === id || hasDescendant(child, id)) return true;
  }
  return false;
}

export default function ResourceSection({
  title,
  icon,
  accentColor,
  items = [],
  folders,
  onOpenResource,
  onSummarize,
  onShare,
  onFavorite,
  favoriteIds,
  defaultExpanded = true,
  relatedCodesById = {},
  activeFolderId = null,
  onFolderChange,
  highlightFileId = null,
}: ResourceSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const useFolders = folders && folders.length > 0;
  const flattenAllSingles =
    useFolders && allTopLevelSingletons(folders!);
  const totalCount = useFolders
    ? folders.reduce((sum, f) => sum + countFolderFiles(f), 0)
    : items.length;

  const singletonCardItems = flattenAllSingles
    ? collectSingletonFiles(folders!)
    : [];

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    useFolders ? collectExpandDefaults(folders!, activeFolderId) : new Set(),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flattenAllSingles || !activeFolderId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      folderScrollSelector(activeFolderId),
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [flattenAllSingles, activeFolderId, singletonCardItems.length]);

  const [prevActiveFolder, setPrevActiveFolder] = useState(activeFolderId);
  if (useFolders && folders && activeFolderId && prevActiveFolder !== activeFolderId) {
    setPrevActiveFolder(activeFolderId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      const ensure = (nodes: ResourceFolderNode[]) => {
        for (const node of nodes) {
          if (node.id === activeFolderId || hasDescendant(node, activeFolderId)) {
            if (!next.has(node.id)) {
              next.add(node.id);
              changed = true;
            }
          }
          ensure(node.children);
        }
      };
      ensure(folders);
      return changed ? next : prev;
    });
  }

  const toggleFolder = useCallback(
    (folderId: string) => {
      const wasExpanded = expandedIds.has(folderId);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (prev.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        return next;
      });
      // Parent setState must stay outside the updater (pure) to avoid
      // "Cannot update a component while rendering a different component".
      if (wasExpanded) {
        if (activeFolderId === folderId) onFolderChange?.(null);
      } else {
        onFolderChange?.(folderId);
      }
    },
    [activeFolderId, expandedIds, onFolderChange],
  );

  if (totalCount === 0) return null;

  return (
    <div className="space-y-4">
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
          {totalCount}
        </span>
        <ChevronDown
          className={`w-4 h-4 ml-auto text-muted group-hover:text-foreground transition-all duration-200 ${
            isExpanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.duration.enter, ease: MOTION.ease }}
            className="overflow-hidden"
          >
            {/notes/i.test(title) && (
              <NotesDisclaimer compact className="mb-3" />
            )}

            {useFolders ? (
              flattenAllSingles ? (
                <div
                  ref={scrollRef}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm"
                >
                  {singletonCardItems.map((item, index) => {
                    const folderMatch = folders!.find(
                      (f) => singletonFile(f)?.id === item.id,
                    );
                    const highlighted =
                      highlightFileId === item.id ||
                      (!!activeFolderId && folderMatch?.id === activeFolderId);
                    return (
                      <motion.div
                        key={item.id}
                        {...(folderMatch && activeFolderId === folderMatch.id
                          ? { "data-folder-scroll": folderMatch.id }
                          : {})}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: MOTION.duration.base,
                          delay: Math.min(index * 0.03, 0.15),
                          ease: MOTION.ease,
                        }}
                        className={`h-full bg-card ${
                          highlighted ? "ring-2 ring-inset ring-foreground/20" : ""
                        }`}
                        style={{ willChange: "transform, opacity" }}
                      >
                        <ResourceCard
                          item={item}
                          onOpenResource={onOpenResource}
                          onShare={onShare}
                          onFavorite={onFavorite}
                          isFavorite={favoriteIds?.has(item.id)}
                          relatedCodes={relatedCodesById[item.id]}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 overflow-hidden shadow-sm bg-card">
                  {folders!.map((folder) => {
                    if (isSingletonFolder(folder)) {
                      const item = singletonFile(folder);
                      if (!item) return null;
                      return (
                        <ResourceFileRow
                          key={folder.id}
                          item={item}
                          onOpenResource={onOpenResource}
                          onSummarize={onSummarize}
                          onShare={onShare}
                          onFavorite={onFavorite}
                          isFavorite={favoriteIds?.has(item.id)}
                          highlight={
                            highlightFileId === item.id ||
                            activeFolderId === folder.id
                          }
                          scrollTarget={activeFolderId === folder.id}
                        />
                      );
                    }
                    return (
                      <ResourceFolder
                        key={folder.id}
                        folder={folder}
                        expanded={expandedIds.has(folder.id)}
                        onToggle={toggleFolder}
                        expandedIds={expandedIds}
                        onOpenResource={onOpenResource}
                        onSummarize={onSummarize}
                        onShare={onShare}
                        onFavorite={onFavorite}
                        favoriteIds={favoriteIds}
                        highlightFileId={highlightFileId}
                        activeFolderId={activeFolderId}
                        scrollToId={activeFolderId}
                      />
                    );
                  })}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: MOTION.duration.base,
                      delay: Math.min(index * 0.03, 0.15),
                      ease: MOTION.ease,
                    }}
                    className="h-full bg-card"
                    style={{ willChange: "transform, opacity" }}
                  >
                    <ResourceCard
                      item={item}
                      onOpenResource={onOpenResource}
                      onShare={onShare}
                      onFavorite={onFavorite}
                      isFavorite={favoriteIds?.has(item.id)}
                      relatedCodes={relatedCodesById[item.id]}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

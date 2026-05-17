'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  BookOpen,
  FileText,
  CalendarCheck,
  Brain,
  ShieldCheck,
  Timer,
  Coffee,
  Sparkles,
  Database,
  Network,
  Cpu,
  Layers,
  Calculator,
  Terminal,
  Folder,
  X,
  ArrowRight,
  Users,
} from 'lucide-react';
import { useAcademicStore } from '../store/academicStore';
import { createClient } from '../lib/supabase';

interface CommandItem {
  id: string;
  title: string;
  category: 'Quick Actions' | 'Navigation' | 'Subjects';
  icon: any;
  action: () => void;
  shortcut?: string;
  badge?: string;
}

export default function CommandPalette() {
  const router = useRouter();
  const { branch, semester, isCommandPaletteOpen, setCommandPaletteOpen, setSearchQuery } = useAcademicStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMac, setIsMac] = useState(true);
  const [dynamicSubjects, setDynamicSubjects] = useState<Array<{ id: string; name: string }>>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastInteraction = useRef<'key' | 'mouse'>('key');
  const supabaseClient = useRef(createClient());

  // Fetch dynamic subjects for the current branch & semester
  useEffect(() => {
    supabaseClient.current
      .from('subjects')
      .select('id, name')
      .eq('branch', branch)
      .eq('semester', semester)
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) {
          setDynamicSubjects(data.filter(s => s.name.toUpperCase() !== 'SYLLABUS'));
        }
      });
  }, [branch, semester]);

  // Detect Mac vs Windows/Linux for accurate shortcut display
  useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && (navigator.userAgent.includes('Mac') || navigator.platform.includes('Mac')));
  }, []);

  // Global keydown listener for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      lastInteraction.current = 'key';
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isCommandPaletteOpen]);

  // Define dynamic command items
  const items = useMemo<CommandItem[]>(() => {
    const baseItems: CommandItem[] = [
      // Quick Actions
      {
        id: 'timer-start',
        title: 'Start 25m Pomodoro Timer',
        category: 'Quick Actions',
        icon: Timer,
        shortcut: 'T',
        badge: 'Focus',
        action: () => {
          router.push('/timer');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'break-start',
        title: 'Take 5m Short Break',
        category: 'Quick Actions',
        icon: Coffee,
        shortcut: 'B',
        badge: 'Rest',
        action: () => {
          router.push('/timer');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'ask-ai-quick',
        title: 'Ask AI Study Assistant',
        category: 'Quick Actions',
        icon: Brain,
        shortcut: 'A',
        badge: 'AI RAG',
        action: () => {
          router.push('/ask');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'gpa-calc-quick',
        title: `Calculate Sem ${semester} GPA Strategy`,
        category: 'Quick Actions',
        icon: Calculator,
        shortcut: 'G',
        badge: 'Simulator',
        action: () => {
          router.push('/gpa');
          setCommandPaletteOpen(false);
        },
      },

      // Navigation
      {
        id: 'nav-community',
        title: 'Explore Community Shared Decks',
        category: 'Navigation',
        icon: Users,
        shortcut: 'C',
        badge: 'Social',
        action: () => {
          router.push('/community');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-syllabus',
        title: 'View Syllabus & Curriculum',
        category: 'Navigation',
        icon: BookOpen,
        action: () => {
          router.push('/syllabus');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-resources',
        title: 'Browse Resource Vault (Notes, PYQs)',
        category: 'Navigation',
        icon: FileText,
        action: () => {
          router.push('/resources');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-planner',
        title: 'Open Weekly Study Planner',
        category: 'Navigation',
        icon: CalendarCheck,
        action: () => {
          router.push('/planner');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-admin',
        title: 'Admin Storage Sync Dashboard',
        category: 'Navigation',
        icon: Terminal,
        badge: 'Admin',
        action: () => {
          router.push('/admin');
          setCommandPaletteOpen(false);
        },
      },
    ];

    const subjectItems: CommandItem[] = dynamicSubjects.map((sub) => ({
      id: `subj-${sub.id}`,
      title: `${sub.name}`,
      category: 'Subjects',
      icon: Folder,
      badge: `${branch} Sem ${semester}`,
      action: () => {
        setSearchQuery(sub.name);
        router.push('/resources');
        setCommandPaletteOpen(false);
      },
    }));

    return [...baseItems, ...subjectItems];
  }, [router, setCommandPaletteOpen, setSearchQuery, dynamicSubjects, branch, semester]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.badge?.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, CommandItem[]>);
  }, [filteredItems]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
    lastInteraction.current = 'key';
  }, [query]);

  // Handle keyboard navigation inside modal
  useEffect(() => {
    if (!isCommandPaletteOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        lastInteraction.current = 'key';
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        inputRef.current?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        lastInteraction.current = 'key';
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        inputRef.current?.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isCommandPaletteOpen, filteredItems, selectedIndex, setCommandPaletteOpen]);

  // Auto-scroll to selected item without triggering mouse events
  useEffect(() => {
    if (!listRef.current || filteredItems.length === 0) return;
    const activeElem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeElem) {
      activeElem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, filteredItems]);

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 pb-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setCommandPaletteOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-2xl"
          >
            {/* Top glowing gradient accent */}
            <div className="h-1 bg-gradient-to-r from-primary/40 via-muted to-primary/40" />

            {/* Search Input Header */}
            <div className="relative flex items-center px-4 py-3.5 border-b border-border bg-surface/30">
              <Search className="w-5 h-5 text-primary shrink-0 mr-3 animate-pulse" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search (e.g. 'timer', 'DBMS', 'Ask AI')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-base font-medium text-foreground placeholder:text-muted pr-4 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1.5 text-muted hover:text-foreground rounded-md transition-colors mr-2 bg-surface/50 hover:bg-surface"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-surface border border-border text-muted rounded shadow-sm">
                ESC
              </span>
            </div>

            {/* Results List */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2.5 space-y-4 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-8 h-8 text-muted/30 mb-3 animate-bounce" />
                  <p className="text-sm font-medium text-foreground mb-1">No results found</p>
                  <p className="text-xs text-muted">Try searching for 'timer', 'DBMS', or 'planner'</p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([category, catItems]) => (
                  <div key={category} className="space-y-1.5">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2 select-none">
                      <span>{category}</span>
                      <div className="h-px flex-1 bg-border/50" />
                    </div>
                    {catItems.map((item) => {
                      const globalIdx = filteredItems.findIndex((i) => i.id === item.id);
                      const isSelected = globalIdx === selectedIndex;
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          tabIndex={-1}
                          data-index={globalIdx}
                          onClick={item.action}
                          onMouseMove={() => {
                            lastInteraction.current = 'mouse';
                          }}
                          onMouseEnter={() => {
                            if (lastInteraction.current === 'mouse') {
                              setSelectedIndex(globalIdx);
                            }
                          }}
                          className={`relative w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors duration-150 text-sm group border focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${
                            isSelected
                              ? 'bg-surface-hover border-border-strong text-foreground shadow-md font-semibold'
                              : 'border-transparent text-foreground hover:bg-surface/60'
                          }`}
                        >
                          {/* Active Left Indicator Bar */}
                          {isSelected && (
                            <motion.div
                              layoutId="activePaletteIndicator"
                              className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"
                              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                          )}

                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-background border border-border text-primary shadow-sm'
                                : 'bg-surface border border-border text-muted group-hover:text-foreground'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{item.title}</p>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors ${
                                isSelected
                                  ? 'bg-background border border-border text-foreground shadow-sm'
                                  : 'bg-surface border border-border text-muted'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.shortcut && (
                            <kbd
                              className={`hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold rounded shadow-sm transition-colors ${
                                isSelected
                                  ? 'bg-background border border-border text-foreground shadow-sm'
                                  : 'bg-surface border border-border text-muted'
                              }`}
                            >
                              {isMac ? '⌘' : 'Ctrl+'}{item.shortcut}
                            </kbd>
                          )}
                          {isSelected && <ArrowRight className="w-4 h-4 shrink-0 animate-in fade-in text-muted" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="px-4 py-3 border-t border-border bg-surface/30 flex items-center justify-between text-[10px] font-medium text-muted select-none">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded shadow-sm font-bold text-foreground">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded shadow-sm font-bold text-foreground">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded shadow-sm font-bold text-foreground">↵</kbd>
                  to select
                </span>
              </div>
              <span className="flex items-center gap-1 text-muted">
                <span>Academic Spotlight OS</span>
                <span className="px-1.5 py-0.5 bg-surface border border-border rounded text-[9px] font-bold uppercase tracking-wider">
                  {isMac ? 'macOS' : 'Windows'}
                </span>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

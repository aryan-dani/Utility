'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  BookOpen,
  FileText,
  CalendarCheck,
  Brain,
  Timer,
  Coffee,
  Sparkles,
  Layers,
  Calculator,
  Terminal,
  Folder,
  X,
  ArrowRight,
  Users,
  Building2,
  MapPin,
  BookUser,
  FlaskConical,
  Waypoints,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAcademicStore } from '../store/academicStore';
import { loadWorkspaceResources } from '@/lib/useWorkspaceResources';
import { startNavigationProgress } from './NavigationProgress';
import { subjectToSlug } from '@/lib/resourceUrl';
import { fetchAdminStatus } from '@/lib/adminStatus';
import { workspaceQuery } from '@/lib/workspace';
import { notify } from '@/lib/toast';
import { useIsMac } from '@/lib/clientHooks';
import { Kbd, IconButton } from '@/components/ui';

interface CommandItem {
  id: string;
  title: string;
  category: 'Quick Actions' | 'Navigation' | 'Subjects';
  icon: LucideIcon;
  action: () => void;
  shortcut?: string;
  badge?: string;
  hint?: string;
}

const SUBJECT_CACHE_TTL_MS = 5 * 60 * 1000;
const subjectCache = new Map<
  string,
  { fetchedAt: number; subjects: Array<{ id: string; name: string }> }
>();

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'i'));
  const qLower = query.toLowerCase();
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === qLower ? (
          <mark key={i} className="bg-primary/20 text-primary font-bold rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const { academicYear, branch, semester, isCommandPaletteOpen, setCommandPaletteOpen } = useAcademicStore();
  const navigate = useCallback((href: string) => {
    startNavigationProgress();
    router.push(href);
  }, [router]);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const isMac = useIsMac();
  const [isAdmin, setIsAdmin] = useState(false);
  const [dynamicSubjects, setDynamicSubjects] = useState<Array<{ id: string; name: string }>>(() => {
    const cacheKey = `${academicYear}:${branch}:${semester}`;
    const cached = subjectCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < SUBJECT_CACHE_TTL_MS) {
      return cached.subjects;
    }
    return [];
  });
  const subjectsCacheKey = `${academicYear}:${branch}:${semester}`;
  const [prevSubjectsCacheKey, setPrevSubjectsCacheKey] =
    useState(subjectsCacheKey);

  if (prevSubjectsCacheKey !== subjectsCacheKey) {
    setPrevSubjectsCacheKey(subjectsCacheKey);
    const cached = subjectCache.get(subjectsCacheKey);
    if (cached) {
      setDynamicSubjects(cached.subjects);
    } else {
      setDynamicSubjects([]);
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [lastInteraction, setLastInteraction] = useState<'key' | 'mouse'>('key');

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        const user = auth.currentUser;
        if (!user) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const { isAdmin: admin } = await fetchAdminStatus(
          () => user.getIdToken(),
          user.uid,
        );
        if (!cancelled) setIsAdmin(admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCommandPaletteOpen]);

  // Fetch dynamic subjects for the current branch & semester only when open
  useEffect(() => {
    if (!isCommandPaletteOpen) return;

    const cacheKey = `${academicYear}:${branch}:${semester}`;
    const cached = subjectCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < SUBJECT_CACHE_TTL_MS) {
      return;
    }

    let cancelled = false;
    loadWorkspaceResources(academicYear, branch, semester)
      .then((entry) => {
        if (cancelled) return;
        const filtered = entry.subjects
          .filter((name) => name.toUpperCase() !== 'SYLLABUS')
          .map((name) => ({ id: subjectToSlug(name), name }));
        subjectCache.set(cacheKey, { fetchedAt: Date.now(), subjects: filtered });
        setDynamicSubjects(filtered);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error fetching subjects in CommandPalette:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [academicYear, branch, semester, isCommandPaletteOpen]);

  // Global keydown listener for ⌘K / Ctrl+K and other shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Check for Ctrl+K / Meta+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

      // 2. Check for other shortcuts (Alt+Letter)
      const isModifier = e.altKey;
      if (!isModifier) return;

      const activeEl = document.activeElement;
      const isInsideCommandPaletteInput = activeEl === inputRef.current;

      // Do not hijack Alt combinations when user is in input/textarea, except when inside command palette itself
      if (
        activeEl &&
        !isInsideCommandPaletteInput &&
        (activeEl.tagName === 'INPUT' ||
         activeEl.tagName === 'TEXTAREA' ||
         activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const qs = workspaceQuery(academicYear, branch, semester);
      const key = e.key.toLowerCase();
      const shortcutMap: Record<string, () => void> = {
        t: () => {
          navigate(`/timer?mode=work&start=true&${qs}`);
          setCommandPaletteOpen(false);
        },
        b: () => {
          navigate(`/timer?mode=break&start=true&${qs}`);
          setCommandPaletteOpen(false);
        },
        a: () => {
          navigate(`/ask?${qs}`);
          setCommandPaletteOpen(false);
        },
        g: () => {
          navigate(`/gpa?${qs}`);
          setCommandPaletteOpen(false);
        },
        r: () => {
          navigate(`/srs?${qs}`);
          setCommandPaletteOpen(false);
        },
        s: () => {
          navigate(`/syllabus?${qs}`);
          setCommandPaletteOpen(false);
        },
        c: () => {
          navigate(`/community?${qs}`);
          setCommandPaletteOpen(false);
        },
        '?': () => {
          setCommandPaletteOpen(true);
          setQuery('?');
        },
        '/': () => {
          setCommandPaletteOpen(true);
          setQuery('?');
        },
      };

      if (shortcutMap[key]) {
        e.preventDefault();
        shortcutMap[key]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen, academicYear, branch, semester, navigate]);

  const [prevPaletteOpen, setPrevPaletteOpen] = useState(isCommandPaletteOpen);
  if (isCommandPaletteOpen && !prevPaletteOpen) {
    setQuery('');
    setSelectedIndex(0);
    setLastInteraction('key');
  }
  if (prevPaletteOpen !== isCommandPaletteOpen) {
    setPrevPaletteOpen(isCommandPaletteOpen);
  }

  // Focus input when modal opens
  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [isCommandPaletteOpen]);

  // Define dynamic command items
  const items = useMemo<CommandItem[]>(() => {
    const qs = workspaceQuery(academicYear, branch, semester);
    const baseItems: CommandItem[] = [
      {
        id: 'help-shortcuts',
        title: 'Keyboard shortcuts help',
        category: 'Quick Actions',
        icon: HelpCircle,
        badge: '?',
        hint: 'Alt+T timer · Alt+B break · Alt+A ask · Alt+G GPA · Alt+R SRS · Alt+S syllabus · Alt+C community · Viewer: Ctrl+F find, Esc close, F fullscreen, D download, O open',
        action: () => {
          notify.message('Shortcuts', {
            description:
              'Alt+T timer · Alt+B break · Alt+A ask · Alt+G GPA · Alt+R SRS · Alt+S syllabus · Alt+C community. Viewer: Ctrl/⌘+F find, Esc close, F fullscreen, D download, O open tab.',
            duration: 8000,
          });
          setCommandPaletteOpen(false);
        },
      },
      // Quick Actions
      {
        id: 'timer-start',
        title: 'Start 25m Pomodoro Timer',
        category: 'Quick Actions',
        icon: Timer,
        shortcut: 'T',
        badge: 'Focus',
        action: () => {
          navigate(`/timer?mode=work&start=true&${qs}`);
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
          navigate(`/timer?mode=break&start=true&${qs}`);
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
          navigate(`/ask?${qs}`);
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
          navigate(`/gpa?${qs}`);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'srs-review-quick',
        title: 'Review Due Flashcards (SRS)',
        category: 'Quick Actions',
        icon: Layers,
        shortcut: 'R',
        badge: 'Active Recall',
        action: () => {
          navigate(`/srs?${qs}`);
          setCommandPaletteOpen(false);
        },
      },

      // Navigation
      {
        id: 'nav-srs',
        title: 'Open SRS Flashcards Deck Reviewer',
        category: 'Navigation',
        icon: Layers,
        badge: 'Recall',
        action: () => {
          navigate(`/srs?${qs}`);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-community',
        title: 'Explore Community Shared Decks',
        category: 'Navigation',
        icon: Users,
        shortcut: 'C',
        badge: 'Social',
        action: () => {
          navigate(`/community?${qs}`);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-campus',
        title: 'Campus Hub: Seating, Directory, Labs',
        category: 'Navigation',
        icon: Building2,
        badge: 'Campus',
        action: () => {
          navigate('/campus');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-campus-seating',
        title: 'Faculty Seating Chart',
        category: 'Navigation',
        icon: MapPin,
        action: () => {
          navigate('/campus/seating');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-campus-directory',
        title: 'Faculty Directory',
        category: 'Navigation',
        icon: BookUser,
        action: () => {
          navigate('/campus/directory');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-campus-labs',
        title: 'Campus Lab Registry',
        category: 'Navigation',
        icon: FlaskConical,
        action: () => {
          navigate('/campus/labs');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-syllabus',
        title: 'View Syllabus & Curriculum',
        category: 'Navigation',
        icon: BookOpen,
        shortcut: 'S',
        badge: 'Curriculum',
        action: () => {
          navigate(`/syllabus?${qs}`);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-resources',
        title: 'Browse Resource Vault (Notes, PYQs)',
        category: 'Navigation',
        icon: FileText,
        action: () => {
          navigate(`/resources?${qs}`);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-planner',
        title: 'Open Weekly Study Planner',
        category: 'Navigation',
        icon: CalendarCheck,
        action: () => {
          navigate(`/planner?${qs}`);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'nav-visualize',
        title: 'Open Algorithm Visualizers',
        category: 'Navigation',
        icon: Waypoints,
        badge: 'AI',
        action: () => {
          navigate('/visualize');
          setCommandPaletteOpen(false);
        },
      },
      ...(isAdmin
        ? [
            {
              id: 'nav-admin',
              title: 'Admin Storage Sync Dashboard',
              category: 'Navigation' as const,
              icon: Terminal,
              badge: 'Admin',
              action: () => {
                navigate('/admin');
                setCommandPaletteOpen(false);
              },
            },
          ]
        : []),
    ];

    const subjectItems: CommandItem[] = dynamicSubjects.map((sub) => ({
      id: `subj-${sub.id}`,
      title: `${sub.name}`,
      category: 'Subjects',
      icon: Folder,
      badge: `${branch} Sem ${semester}`,
      hint: 'Open vault · notes, assignments',
      action: () => {
        const params = new URLSearchParams({
          year: academicYear,
          branch,
          semester: String(semester),
          subject: subjectToSlug(sub.name),
        });
        navigate(`/resources?${params.toString()}`);
        setCommandPaletteOpen(false);
      },
    }));

    return [...baseItems, ...subjectItems];
  }, [navigate, setCommandPaletteOpen, dynamicSubjects, branch, semester, academicYear, isAdmin]);

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

  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelectedIndex(0);
    setLastInteraction('key');
  }

  // Handle keyboard navigation inside modal
  useEffect(() => {
    if (!isCommandPaletteOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredItems.length === 0) return;
        setLastInteraction('key');
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        inputRef.current?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredItems.length === 0) return;
        setLastInteraction('key');
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        inputRef.current?.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusable = root.querySelectorAll<HTMLElement>(
          'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        e.preventDefault();
        const list = Array.from(focusable);
        const idx = list.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey
          ? (idx <= 0 ? list.length - 1 : idx - 1)
          : (idx >= list.length - 1 ? 0 : idx + 1);
        list[next]?.focus();
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isCommandPaletteOpen, filteredItems, selectedIndex, setCommandPaletteOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isCommandPaletteOpen]);

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
        <div className="fixed inset-0 z-launcher flex items-start justify-center pt-[calc(4rem+env(safe-area-inset-top))] sm:pt-24 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl os-window shadow-window flex flex-col z-10"
          >

            {/* Search Input Header */}
            <div className="relative flex items-center px-4 py-3 border-b border-border bg-card">
              <Search className="w-5 h-5 text-muted shrink-0 mr-3" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search (e.g. 'timer', 'DBMS', 'Ask AI')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-base font-medium text-foreground placeholder:text-muted/50 pr-4 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              />
              {query && (
                <IconButton
                  size="sm"
                  label="Clear search"
                  onClick={() => setQuery('')}
                  className="mr-2"
                >
                  <X className="w-4 h-4" />
                </IconButton>
              )}
              <Kbd className="hidden sm:inline-flex">Esc</Kbd>
            </div>

            {/* Results List */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2.5 space-y-4 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-8 h-8 text-muted/30 mb-3 animate-bounce" />
                  <p className="text-sm font-medium text-foreground mb-1">No results found</p>
                  <p className="text-xs text-muted">Try searching for &apos;timer&apos;, &apos;DBMS&apos;, or &apos;planner&apos;</p>
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
                            setLastInteraction('mouse');
                          }}
                          onMouseEnter={() => {
                            if (lastInteraction === 'mouse') {
                              setSelectedIndex(globalIdx);
                            }
                          }}
                          className={`relative w-full flex items-center gap-3 px-3.5 py-3 min-h-11 rounded-xl text-left transition-all duration-150 text-sm group border focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${
                            isSelected
                              ? 'bg-surface-hover border-border-strong text-foreground shadow-sm font-semibold'
                              : 'border-transparent text-foreground-subtle hover:bg-surface/30 hover:text-foreground active:bg-surface/50'
                          }`}
                        >
                          {/* Active Left Indicator Bar */}
                          {isSelected && (
                            <motion.div
                              layoutId="activePaletteIndicator"
                              className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-primary rounded-full"
                              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                            />
                          )}

                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-background border border-border text-primary shadow-sm'
                                : 'bg-surface/60 border border-border/50 text-muted group-hover:text-foreground'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{highlightMatch(item.title, query)}</p>
                            {item.hint && (
                              <p className="text-[10px] text-muted truncate mt-0.5 font-medium">
                                {item.hint}
                              </p>
                            )}
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors ${
                                isSelected
                                  ? 'bg-background border border-border text-foreground shadow-sm'
                                  : 'bg-surface border border-border/80 text-muted'
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
                                  : 'bg-surface border border-border/85 text-muted'
                              }`}
                            >
                              Alt+{item.shortcut}
                            </kbd>
                          )}
                          {isSelected && <ArrowRight className="w-4 h-4 shrink-0 text-muted animate-pulse" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer Navigation Hints — keyboard-only, hide on phones */}
            <div className="hidden md:flex px-4 py-3 border-t border-border bg-surface/30 items-center justify-between text-xs font-medium text-muted select-none">
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

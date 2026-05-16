'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useTheme } from 'next-themes';
import {
  Search,
  BookOpen,
  FileText,
  CalendarCheck,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Brain,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicStore, Branch, Semester } from '../store/academicStore';
import { createClient } from '@/lib/supabase';

const NAV_LINKS = [
  { href: '/syllabus', label: 'Syllabus', Icon: BookOpen },
  { href: '/resources', label: 'Resources', Icon: FileText },
  { href: '/ask', label: 'Ask AI', Icon: Brain },
  { href: '/gpa', label: 'GPA', Icon: ShieldCheck },
  { href: '/planner', label: 'Planner', Icon: CalendarCheck },
];

const BRANCH_OPTIONS = [
  { value: 'AIDS', label: 'AIDS' },
  { value: 'CSE', label: 'CSE' },
];

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((sem) => ({
  value: sem,
  label: `Sem ${sem}`,
}));

function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  label,
  icon: Icon,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  icon?: any;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 bg-surface/50 border border-border rounded-lg text-xs font-semibold transition-all hover:bg-surface-hover hover:border-border-strong focus:ring-1 focus:ring-primary ${isOpen ? 'ring-1 ring-primary border-primary bg-surface' : ''}`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-muted" />}
        <span className="text-foreground">{selectedOption?.label || label}</span>
        <ChevronDown className={`w-3 h-3 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 min-w-[120px] bg-card border border-border rounded-xl shadow-popover overflow-hidden z-[100] backdrop-blur-xl"
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
                    value === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted hover:bg-surface hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface transition-colors"
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        <Icon className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-36 bg-card border border-border rounded-xl shadow-popover overflow-hidden z-50 backdrop-blur-xl"
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {(
                [
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark', label: 'Dark', Icon: Moon },
                  { value: 'system', label: 'System', Icon: Monitor },
                ] as const
              ).map(({ value: val, label, Icon: OptionIcon }) => (
                <button
                  key={val}
                  onClick={() => {
                    setTheme(val);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    theme === val
                      ? 'bg-surface text-foreground font-semibold shadow-sm'
                      : 'text-muted hover:bg-surface hover:text-foreground'
                  }`}
                >
                  <OptionIcon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavbarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searchQuery, setBranch, setSemester, setSearchQuery } = useAcademicStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ email: string | undefined } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient());

  const branch = (searchParams.get('branch') as Branch) || 'AIDS';
  const semester = Number(searchParams.get('semester') || '4') as Semester;

  useEffect(() => {
    setBranch(branch);
    setSemester(semester);
  }, [branch, semester, setBranch, setSemester]);

  // Check auth session
  useEffect(() => {
    supabase.current.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email } : null);
    });
    const { data: listener } = supabase.current.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateUrl = useCallback(
    (newBranch: string, newSem: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('branch', newBranch);
      params.set('semester', newSem.toString());
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value && pathname !== '/resources' && pathname !== '/syllabus') {
      const params = new URLSearchParams(searchParams.toString());
      router.push(`/resources?${params.toString()}`);
    }
  };

  const handleLogout = async () => {
    await supabase.current.auth.signOut();
    setUserMenuOpen(false);
    window.location.href = '/';
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map((e) => e.trim()) ?? [];
  const isAdmin = user && adminEmails.includes(user.email ?? '');

  const showSelectors = pathname === '/resources' || pathname === '/syllabus' || pathname === '/gpa' || pathname.startsWith('/resources');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background backdrop-blur-md border-b border-border h-16 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-foreground flex items-center gap-2 shrink-0"
        >
          <div className="w-7 h-7 rounded bg-foreground flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-background" />
          </div>
          <span>Utility</span>
        </Link>

        {/* Desktop Controls */}
        <div className="hidden md:flex gap-1 items-center flex-1 justify-end">
          {/* Selectors — only show on relevant pages */}
          {showSelectors && (
            <div className="flex items-center gap-2 mr-2">
              <CustomSelect
                label="Branch"
                value={branch}
                options={BRANCH_OPTIONS}
                onChange={(val) => updateUrl(val, semester)}
                icon={GraduationCap}
              />
              <CustomSelect
                label="Semester"
                value={semester}
                options={SEMESTER_OPTIONS}
                onChange={(val) => updateUrl(branch, Number(val))}
                icon={Calendar}
              />
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-3.5 h-3.5 text-muted" />
            </div>
            <input
              ref={searchRef}
              suppressHydrationWarning
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-8 py-1.5 bg-surface border border-border rounded-md outline-none text-sm w-56 focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted transition-all focus:w-72"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Nav Links */}
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const params = new URLSearchParams(searchParams.toString());
            const finalHref = `${href}?${params.toString()}`;
            return (
              <Link
                key={href}
                href={finalHref}
                className={`px-3 py-1.5 flex items-center gap-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-surface text-foreground'
                    : 'text-muted hover:text-foreground hover:bg-surface'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            );
          })}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Menu / Login */}
          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-bold text-foreground uppercase">
                  {user.email?.[0] ?? '?'}
                </div>
                <ChevronDown className="w-3 h-3" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.1, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-popover overflow-hidden z-50 backdrop-blur-xl"
                  >
                    <div className="px-4 py-3 border-b border-border bg-surface/30">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Signed in as</p>
                      <p className="text-xs font-semibold text-foreground truncate">{user.email}</p>
                    </div>
                    <div className="p-1.5 flex flex-col gap-0.5">
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-muted hover:bg-surface hover:text-foreground rounded-lg transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground hover:bg-surface rounded-md transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile: Theme + Hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-background border-b border-border shadow-popover z-40 px-4 py-4 flex flex-col gap-3 animate-slide-down">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              suppressHydrationWarning
              type="text"
              placeholder="Search resources, topics…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-md outline-none text-sm focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted"
            />
          </div>

          {/* Selectors */}
          {showSelectors && (
            <div className="flex gap-2">
              <div className="flex-1">
                <CustomSelect
                  label="Branch"
                  value={branch}
                  options={BRANCH_OPTIONS}
                  onChange={(val) => updateUrl(val, semester)}
                  icon={GraduationCap}
                />
              </div>
              <div className="flex-1">
                <CustomSelect
                  label="Semester"
                  value={semester}
                  options={SEMESTER_OPTIONS}
                  onChange={(val) => updateUrl(branch, Number(val))}
                  icon={Calendar}
                />
              </div>
            </div>
          )}

          {/* Nav Links */}
          <div className="border-t border-border pt-3 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, Icon }) => {
              const params = new URLSearchParams(searchParams.toString());
              const finalHref = `${href}?${params.toString()}`;
              return (
                <Link
                  key={href}
                  href={finalHref}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive(href)
                      ? 'bg-surface text-foreground'
                      : 'text-muted hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* User section */}
          <div className="border-t border-border pt-3">
            {user ? (
              <div className="flex flex-col gap-1">
                <p className="px-3 py-1 text-xs text-muted">{user.email}</p>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-16" />}>
      <NavbarInner />
    </Suspense>
  );
}

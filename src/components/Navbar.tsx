'use client';
import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BookOpen,
  FileText,
  CalendarCheck,
  Menu,
  X,
  Search,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Brain,
  GraduationCap,
  Calendar,
  Users,
  LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcademicStore, Branch, Semester } from '../store/academicStore';
import { createClient } from '@/lib/supabase';

const PRIMARY_LINKS = [
  { href: '/syllabus', label: 'Syllabus', Icon: BookOpen },
  { href: '/resources', label: 'Resources', Icon: FileText },
  { href: '/ask', label: 'Ask AI', Icon: Brain },
];

const SECONDARY_LINKS = [
  { href: '/community', label: 'Community', Icon: Users, desc: 'Collaborate and connect with peers' },
  { href: '/gpa', label: 'GPA Calculator', Icon: ShieldCheck, desc: 'Plan and project your semester GPA' },
  { href: '/planner', label: 'Study Planner', Icon: CalendarCheck, desc: 'Manage your academic schedule' },
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:text-foreground focus:outline-none ${isOpen ? 'bg-surface text-foreground shadow-xs border border-border/80' : 'text-muted hover:bg-surface/50 border border-transparent'}`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-muted shrink-0" />}
        <span className="text-foreground font-semibold">{selectedOption?.label || label}</span>
        <ChevronDown className={`w-3 h-3 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 min-w-[130px] bg-card border border-border rounded-2xl shadow-popover overflow-hidden z-[100] backdrop-blur-xl p-1.5 flex flex-col gap-0.5"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left ${
                  value === opt.value
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
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
        className="w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-foreground hover:bg-surface/50 transition-colors"
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
            className="absolute right-0 top-full mt-2 w-36 bg-card border border-border rounded-2xl shadow-popover overflow-hidden z-50 backdrop-blur-xl p-1.5 flex flex-col gap-0.5"
          >
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
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                  theme === val
                    ? 'bg-surface text-foreground font-semibold shadow-xs border border-border/60'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`}
              >
                <OptionIcon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
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
  const { searchQuery, setBranch, setSemester, setSearchQuery, setCommandPaletteOpen } = useAcademicStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [user, setUser] = useState<{ email: string | undefined } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient());

  const branch = (searchParams.get('branch') as Branch) || 'AIDS';
  const semester = Number(searchParams.get('semester') || '4') as Semester;

  useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && (navigator.userAgent.includes('Mac') || navigator.platform.includes('Mac')));
  }, []);

  useEffect(() => {
    setBranch(branch);
    setSemester(semester);
  }, [branch, semester, setBranch, setSemester]);

  useEffect(() => {
    supabase.current.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email } : null);
    });
    const { data: listener } = supabase.current.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (appsRef.current && !appsRef.current.contains(e.target as Node)) {
        setAppsOpen(false);
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
    [pathname, router, searchParams]
  );

  useEffect(() => {
    setMobileOpen(false);
    setAppsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            onClick={() => setSearchQuery('')}
            className="text-base font-bold tracking-tight text-foreground flex items-center gap-2.5 shrink-0 group"
          >
            <div className="w-7 h-7 rounded-xl bg-foreground flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <BookOpen className="w-3.5 h-3.5 text-background" />
            </div>
            <span className="font-bold tracking-tight text-foreground">Utility</span>
          </Link>

          <div className="hidden md:flex items-center gap-1.5">
            {PRIMARY_LINKS.map(({ href, label }) => {
              const params = new URLSearchParams(searchParams.toString());
              const finalHref = `${href}?${params.toString()}`;
              return (
                <Link
                  key={href}
                  href={finalHref}
                  onClick={() => setSearchQuery('')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    isActive(href)
                      ? 'bg-surface text-foreground shadow-xs border border-border/80'
                      : 'text-muted hover:text-foreground hover:bg-surface/40 border border-transparent'
                  }`}
                >
                  {label}
                </Link>
              );
            })}

            <div ref={appsRef} className="relative">
              <button
                onClick={() => setAppsOpen((o) => !o)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  appsOpen || SECONDARY_LINKS.some(l => isActive(l.href))
                    ? 'bg-surface text-foreground shadow-xs border border-border/80'
                    : 'text-muted hover:text-foreground hover:bg-surface/40 border border-transparent'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1 text-muted" />
                <span>Apps</span>
                <ChevronDown className={`w-3 h-3 text-muted transition-transform duration-200 ${appsOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {appsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.1, ease: 'easeOut' }}
                    className="absolute left-0 top-full mt-2 w-72 bg-card border border-border rounded-2xl shadow-popover overflow-hidden z-[100] backdrop-blur-xl p-2 grid gap-1"
                  >
                    <div className="px-3 py-2 border-b border-border/60 mb-1">
                      <p className="text-[10px] uppercase font-extrabold tracking-wider text-muted">Academic Tools</p>
                    </div>
                    {SECONDARY_LINKS.map(({ href, label, Icon, desc }) => {
                      const params = new URLSearchParams(searchParams.toString());
                      const finalHref = `${href}?${params.toString()}`;
                      const active = isActive(href);
                      return (
                        <Link
                          key={href}
                          href={finalHref}
                          onClick={() => {
                            setSearchQuery('');
                            setAppsOpen(false);
                          }}
                          className={`flex items-start gap-3 p-2.5 rounded-xl transition-all group ${
                            active ? 'bg-surface border border-border/80 shadow-xs' : 'hover:bg-surface/50 border border-transparent'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                            active ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface border-border text-muted group-hover:text-foreground group-hover:border-border-strong'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className={`text-xs font-bold leading-tight ${active ? 'text-primary' : 'text-foreground'}`}>{label}</p>
                            <p className="text-[10px] text-muted mt-0.5 leading-snug">{desc}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          {showSelectors && (
            <div className="flex items-center gap-1 bg-surface/30 p-1 border border-border/80 rounded-xl shadow-inner">
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

          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center justify-between px-3 py-1.5 bg-surface/50 border border-border/80 rounded-xl text-xs w-48 text-muted hover:text-foreground hover:border-border-strong transition-all hover:w-56 shadow-xs group"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
              <span className="font-medium">Search...</span>
            </span>
            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold bg-background border border-border rounded-md shadow-xs text-muted group-hover:border-border-strong transition-colors">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>

          <div className="w-px h-4 bg-border/80 mx-0.5" />

          <ThemeToggle />

          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface/50 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-bold text-foreground uppercase shadow-xs">
                  {user.email?.[0] ?? '?'}
                </div>
                <ChevronDown className="w-3 h-3 text-muted" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.1, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-popover overflow-hidden z-50 backdrop-blur-xl"
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
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-muted hover:bg-surface hover:text-foreground rounded-xl transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
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
              className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface/50 rounded-xl transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            className="p-1.5 rounded-xl text-muted hover:text-foreground hover:bg-surface/50 transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-background border-b border-border shadow-popover z-40 px-4 py-4 flex flex-col gap-3 animate-slide-down">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              suppressHydrationWarning
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-xl outline-none text-sm focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted shadow-xs"
            />
          </div>

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

          <div className="border-t border-border pt-4 flex flex-col gap-1">
            <p className="px-3 py-1 text-[10px] uppercase font-extrabold tracking-wider text-muted">Primary</p>
            {PRIMARY_LINKS.map(({ href, label, Icon }) => {
              const params = new URLSearchParams(searchParams.toString());
              const finalHref = `${href}?${params.toString()}`;
              return (
                <Link
                  key={href}
                  href={finalHref}
                  onClick={() => {
                    setSearchQuery('');
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive(href)
                      ? 'bg-surface text-foreground font-semibold border border-border/80 shadow-xs'
                      : 'text-muted hover:text-foreground hover:bg-surface/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}

            <p className="px-3 pt-3 py-1 text-[10px] uppercase font-extrabold tracking-wider text-muted border-t border-border/50 mt-2">Apps & Tools</p>
            {SECONDARY_LINKS.map(({ href, label, Icon }) => {
              const params = new URLSearchParams(searchParams.toString());
              const finalHref = `${href}?${params.toString()}`;
              return (
                <Link
                  key={href}
                  href={finalHref}
                  onClick={() => {
                    setSearchQuery('');
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive(href)
                      ? 'bg-surface text-foreground font-semibold border border-border/80 shadow-xs'
                      : 'text-muted hover:text-foreground hover:bg-surface/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-border pt-3">
            {user ? (
              <div className="flex flex-col gap-1">
                <p className="px-3 py-1 text-xs text-muted">{user.email}</p>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface/50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface/50 w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            ) : (
               <Link
                href="/login"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface/50"
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

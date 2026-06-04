"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
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
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Brain,
  Calendar,
  Users,
  Layers,
  Download,
  Timer,
  GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAcademicStore, Branch, Semester } from "../store/academicStore";
import { auth } from "@/lib/firebase";
import { signOut, onIdTokenChanged } from "firebase/auth";

export interface NavLinkItem {
  href: string;
  label: string;
  Icon: React.ComponentType<any>;
  featured?: boolean;
  desc: string;
}

const ACADEMIC_LINKS: NavLinkItem[] = [
  { href: "/resources", label: "Resources", Icon: FileText, featured: true, desc: "Subject files, notes, & answers" },
  { href: "/ask", label: "Ask AI", Icon: Brain, desc: "RAG-powered academic assistant" },
  { href: "/syllabus", label: "Syllabus", Icon: BookOpen, desc: "Course syllabus tracker" },
];

const PRODUCTIVITY_LINKS: NavLinkItem[] = [
  { href: "/planner", label: "Study Planner", Icon: CalendarCheck, desc: "Collaborative schedule & logs" },
  { href: "/timer", label: "Focus Timer", Icon: Timer, desc: "Pomodoro study sessions" },
  { href: "/gpa", label: "GPA Calculator", Icon: GraduationCap, desc: "Track and project your grades" },
  { href: "/srs", label: "SRS Flashcards", Icon: Layers, desc: "Spaced repetition reviewer" },
];

const SOCIAL_LINKS: NavLinkItem[] = [
  { href: "/community", label: "Community", Icon: Users, desc: "Connect with peers" },
];

const SYSTEM_LINKS: NavLinkItem[] = [
  { href: "/install", label: "Install App", Icon: Download, desc: "PWA desktop application" },
];

const BRANCH_OPTIONS = [
  { value: "AIDS", label: "AIDS" },
  { value: "CSE", label: "CSE" },
];

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((sem) => ({
  value: sem,
  label: `Semester ${sem}`,
}));

function WorkspaceSelect<T extends string | number>({
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-1.5 px-2 py-2 bg-background border border-border/80 rounded-xl text-xs font-semibold hover:border-border-strong hover:bg-surface/55 transition-all text-foreground"
      >
        <span className="flex items-center gap-1 truncate">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted shrink-0" />}
          <span className="truncate">{selectedOption?.label || label}</span>
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-popover overflow-hidden z-[110] backdrop-blur-xl p-1 flex flex-col gap-0.5"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                  value === opt.value
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted hover:bg-surface hover:text-foreground"
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

function SegmentedThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 bg-surface/50 rounded-xl border border-border/80 w-full animate-pulse" />;
  }

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;

  return (
    <div className="flex bg-surface/60 border border-border/70 p-0.5 rounded-xl w-full">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg text-xs font-medium transition-all relative ${
              active
                ? "bg-background border border-border/80 text-foreground shadow-xs font-semibold"
                : "text-muted hover:text-foreground hover:bg-surface/30"
            }`}
            title={opt.label}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function NavigationInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const branch = (searchParams.get("branch") as Branch) || "AIDS";
  const semester = Number(searchParams.get("semester") || "4") as Semester;

  const {
    searchQuery,
    setBranch,
    setSemester,
    setSearchQuery,
    setAiSearchQuery,
    setCommandPaletteOpen,
  } = useAcademicStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ email: string | undefined } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);

  const handleCollapseToggle = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem("sidebar-collapsed", String(nextState));
  };

  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        (navigator.userAgent.includes("Mac") ||
          navigator.platform.includes("Mac")),
    );
  }, []);

  useEffect(() => {
    setBranch((searchParams.get("branch") as Branch) || "AIDS");
    setSemester(Number(searchParams.get("semester") || "4") as Semester);
  }, [searchParams, setBranch, setSemester]);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ email: firebaseUser.email || undefined });
        try {
          const token = await firebaseUser.getIdToken();
          document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax; Secure`;
        } catch (e) {
          console.error("Error getting Firebase ID token:", e);
        }
      } else {
        setUser(null);
        document.cookie =
          "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateUrl = useCallback(
    (newBranch: string, newSem: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("branch", newBranch);
      params.set("semester", newSem.toString());
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    setUserMenuOpen(false);
    window.location.href = "/";
  };

  const cycleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim()) ?? [];
  const isAdmin = user && adminEmails.includes(user.email ?? "");

  const showSelectors =
    pathname === "/resources" ||
    pathname === "/syllabus" ||
    pathname === "/gpa" ||
    pathname.startsWith("/resources");

  const renderNavLink = (link: NavLinkItem) => {
    const params = new URLSearchParams(searchParams.toString());
    const finalHref = `${link.href}?${params.toString()}`;
    const active = isActive(link.href);
    return (
      <Link
        key={link.href}
        href={finalHref}
        onClick={() => setSearchQuery("")}
        title={collapsed ? link.label : undefined}
        className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all border group relative ${
          active
            ? "bg-primary/10 border-primary/20 text-primary font-bold shadow-xs"
            : "text-muted hover:text-foreground hover:bg-surface/50 border-transparent"
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <link.Icon className={`w-4 h-4 shrink-0 transition-transform ${active ? "text-primary" : "text-muted group-hover:text-foreground"}`} />
          {!collapsed && <span className="truncate">{link.label}</span>}
        </span>
        {!collapsed && link.featured && (
          <span className="flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shrink-0">
            Core
          </span>
        )}
      </Link>
    );
  };

  const renderSidebarContent = (isMobile: boolean = false) => {
    const isCollapsed = collapsed && !isMobile;
    return (
      <div className="flex flex-col h-full select-none">
        {/* Brand / Logo */}
        <div className={`p-4 flex ${isCollapsed ? "flex-col items-center justify-center gap-3" : "items-center justify-between"} border-b border-border/40 min-h-[60px]`}>
          <Link
            href="/"
            onClick={() => setSearchQuery("")}
            className="text-base font-bold tracking-tight text-foreground flex items-center gap-2.5 group"
          >
            <div className="flex items-center justify-center p-1.5 bg-foreground text-background rounded-xl transition-transform group-hover:scale-105 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <span className="font-extrabold tracking-tight text-foreground bg-clip-text">
                Utility OS
              </span>
            )}
          </Link>

          {!isMobile && (
            <button
              onClick={handleCollapseToggle}
              className={`p-1.5 rounded-lg hover:bg-surface border border-transparent text-muted hover:text-foreground transition-all shrink-0 hover:border-border/60 ${isCollapsed ? "" : "ml-2"}`}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Global Context / Selector Card */}
        <AnimatePresence mode="wait">
          {showSelectors && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-3 pt-3 overflow-hidden"
            >
              <div className="bg-surface/40 border border-border/70 p-2.5 rounded-2xl flex flex-col gap-2 shadow-xs">
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-muted/80">
                  Workspace Filters
                </p>
                <div className="flex gap-1.5">
                  <WorkspaceSelect
                    label="Branch"
                    value={branch}
                    options={BRANCH_OPTIONS}
                    onChange={(val) => updateUrl(val, semester)}
                    icon={Calendar}
                  />
                  <WorkspaceSelect
                    label="Sem"
                    value={semester}
                    options={SEMESTER_OPTIONS}
                    onChange={(val) => updateUrl(branch, Number(val))}
                    icon={BookOpen}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Search Button */}
        <div className="px-3 pt-3">
          {isCollapsed ? (
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-center p-2.5 bg-surface/50 border border-border/80 rounded-xl text-muted hover:text-foreground hover:border-border-strong transition-all shadow-xs"
              title="Search (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-muted" />
            </button>
          ) : (
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 bg-surface/50 border border-border/80 rounded-xl text-xs text-muted hover:text-foreground hover:border-border-strong transition-all shadow-xs group"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
                <span className="font-medium">Search...</span>
              </span>
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[9px] font-bold bg-background border border-border rounded-md shadow-xs text-muted">
                {isMac ? "⌘K" : "Ctrl+K"}
              </kbd>
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5 custom-scrollbar">
          {/* Section 1: Academic Workspace */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <p className="px-3 text-[9px] font-extrabold tracking-widest uppercase text-muted/70 mb-1.5">
                Academic Workspace
              </p>
            ) : (
              <div className="border-t border-border/40 my-2" />
            )}
            <div className="space-y-0.5">
              {ACADEMIC_LINKS.map(renderNavLink)}
            </div>
          </div>

          {/* Section 2: Productivity Apps */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <p className="px-3 text-[9px] font-extrabold tracking-widest uppercase text-muted/70 mb-1.5">
                Productivity Tools
              </p>
            ) : (
              <div className="border-t border-border/40 my-2" />
            )}
            <div className="space-y-0.5">
              {PRODUCTIVITY_LINKS.map(renderNavLink)}
            </div>
          </div>

          {/* Section 3: Social & Connect */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <p className="px-3 text-[9px] font-extrabold tracking-widest uppercase text-muted/70 mb-1.5">
                Connect
              </p>
            ) : (
              <div className="border-t border-border/40 my-2" />
            )}
            <div className="space-y-0.5">
              {SOCIAL_LINKS.map(renderNavLink)}
            </div>
          </div>

          {/* Section 4: System */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <p className="px-3 text-[9px] font-extrabold tracking-widest uppercase text-muted/70 mb-1.5">
                System
              </p>
            ) : (
              <div className="border-t border-border/40 my-2" />
            )}
            <div className="space-y-0.5">
              {SYSTEM_LINKS.map(renderNavLink)}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setSearchQuery("")}
                  title={isCollapsed ? "Admin Dashboard" : undefined}
                  className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5 px-3 py-2"} rounded-xl text-xs font-semibold tracking-wide transition-all border group ${
                    isActive("/admin")
                      ? "bg-primary/10 border-primary/20 text-primary font-bold shadow-xs"
                      : "text-muted hover:text-foreground hover:bg-surface/50 border-transparent"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-muted group-hover:text-foreground" />
                  {!isCollapsed && <span>Admin Dashboard</span>}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-3 border-t border-border/40 space-y-3 bg-surface/10">
          {/* Theme segment toggle or single cycle button */}
          {isCollapsed ? (
            <button
              onClick={cycleTheme}
              className="w-full flex items-center justify-center p-2 bg-surface/60 border border-border/70 rounded-xl text-muted hover:text-foreground transition-all"
              title={`Theme: ${theme}`}
            >
              {theme === "light" ? (
                <Sun className="w-4 h-4" />
              ) : theme === "dark" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
            </button>
          ) : (
            <SegmentedThemeToggle />
          )}

          {/* User profile / Logout actions */}
          {user ? (
            <div ref={userMenuRef} className="relative w-full flex justify-center">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className={`flex items-center ${isCollapsed ? "justify-center w-8 h-8" : "justify-between w-full p-1.5"} rounded-xl border border-transparent hover:border-border/80 hover:bg-surface/50 transition-all group`}
                title={isCollapsed ? user.email : undefined}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center text-xs font-extrabold uppercase shadow-xs shrink-0">
                    {user.email?.[0] ?? "?"}
                  </div>
                  {!isCollapsed && (
                    <div className="text-left min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {user.email?.split("@")[0]}
                      </p>
                      <p className="text-[10px] text-muted truncate">
                        {user.email}
                      </p>
                    </div>
                  )}
                </div>
                {!isCollapsed && <ChevronDown className="w-3.5 h-3.5 text-muted group-hover:text-foreground transition-colors shrink-0 mr-1" />}
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className={`absolute bottom-full mb-2 bg-card border border-border rounded-xl shadow-popover overflow-hidden z-50 backdrop-blur-xl p-1 ${isCollapsed ? "w-28 left-1/2 -translate-x-1/2" : "left-0 right-0"}`}
                  >
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Sign out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href="/login"
              className={`flex items-center justify-center ${isCollapsed ? "w-8 h-8 rounded-lg" : "w-full py-2 rounded-xl"} bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-all shadow-xs`}
              title={isCollapsed ? "Sign In" : undefined}
            >
              {isCollapsed ? <LogOut className="w-3.5 h-3.5 rotate-180" /> : "Sign in"}
            </Link>
          )}

          {isCollapsed ? (
            <div className="flex justify-center pt-2 border-t border-border/20">
              <a
                href="https://www.aryandani.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-extrabold hover:text-foreground text-muted/70 transition-colors"
                title="Crafted by Aryan Dani"
              >
                AD
              </a>
            </div>
          ) : (
            <p className="text-[10px] text-muted/50 text-center tracking-tight font-semibold pt-1 border-t border-border/20">
              Crafted by{" "}
              <a
                href="https://www.aryandani.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold hover:underline hover:text-foreground text-muted/80 transition-colors"
              >
                Aryan Dani
              </a>
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. Desktop Sticky Sidebar with collapse transition */}
      <aside
        className={`h-screen sticky top-0 left-0 border-r border-border bg-card/60 backdrop-blur-xl z-40 hidden md:flex flex-col shrink-0 transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* 2. Mobile Top Header */}
      <header className="h-14 fixed top-0 left-0 right-0 border-b border-border bg-background/80 backdrop-blur-md z-30 flex items-center justify-between px-4 md:hidden">
        <Link
          href="/"
          onClick={() => setSearchQuery("")}
          className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2"
        >
          <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center text-background">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="font-extrabold">Utility</span>
        </Link>

        <button
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface/50 border border-transparent transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* 3. Mobile Navigation Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] md:hidden"
            />

            {/* Sidebar drawer content */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-card border-r border-border shadow-popover z-[101] md:hidden flex flex-col"
            >
              {/* Close Button */}
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface/50 border border-transparent transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Navigation() {
  return (
    <Suspense
      fallback={
        <div className="w-64 h-screen sticky top-0 left-0 border-r border-border bg-card/60 backdrop-blur-xl z-40 hidden md:block" />
      }
    >
      <NavigationInner />
    </Suspense>
  );
}

"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense, startTransition } from "react";
import AppLink from "@/components/ui/AppLink";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  Layers,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useAcademicStore, AcademicYear, Branch, Semester } from "../store/academicStore";
import { startNavigationProgress } from "./NavigationProgress";
import {
  readStoredWorkspace,
  resolveWorkspace,
  writeStoredWorkspace,
} from "@/lib/workspace";
import { ScopeSelector } from "@/components/academic/ScopeSelector";
import { fetchAdminStatus } from "@/lib/adminStatus";
import { useIsClient, useIsMac, useLocalStorageBoolean, useMediaQuery, writeLocalStorageBoolean } from "@/lib/clientHooks";
import { useIsStandalone } from "@/lib/pwa/displayMode";
import { Sheet, TabBar } from "@/components/ui";
import { SegmentedThemeToggle } from "@/components/shell/ThemeToggle";
import { DockTooltip } from "@/components/shell/DockTooltip";
import {
  ACADEMIC_LINKS,
  CAMPUS_LINKS,
  MORE_LINKS,
  PHONE_TABS,
  PRODUCTIVITY_LINKS,
  SOCIAL_LINKS,
  SYSTEM_LINKS,
  type NavLinkItem,
} from "@/components/shell/navConfig";
import { useMotionSafe } from "@/lib/motion";

export type { NavLinkItem };

const NavUserMenu = dynamic(() => import("./NavUserMenu"), {
  ssr: false,
  loading: () => (
    <div className="h-10 w-full skeleton rounded-xl" aria-hidden />
  ),
});

function branchMonogram(branch: string): string {
  const code = branch.trim().toUpperCase();
  if (code === "AIDS") return "AI";
  if (code === "CSE") return "CS";
  if (code === "ECE") return "EC";
  if (code.length <= 2) return code;
  return code.slice(0, 2);
}

function NavSection({
  title,
  collapsed,
  hideCollapsedDivider = false,
  children,
}: {
  title: string;
  collapsed: boolean;
  /** Skip the hairline when the previous chrome already separates the first group. */
  hideCollapsedDivider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={collapsed ? "space-y-0" : "space-y-0.5"}>
      <div
        className={`flex items-center px-2.5 relative overflow-hidden ${
          collapsed ? (hideCollapsedDivider ? "h-0.5" : "h-3") : "h-6"
        }`}
      >
        {/* Expanded label */}
        <div
          className="flex items-center gap-2 w-full transition-[opacity,transform] duration-200"
          style={{
            opacity: collapsed ? 0 : 1,
            transform: collapsed ? "translateX(-6px)" : "translateX(0)",
            pointerEvents: collapsed ? "none" : "auto",
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted/50 truncate">
            {title}
          </span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        {/* Collapsed divider */}
        {!hideCollapsedDivider && (
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none"
            style={{ opacity: collapsed ? 1 : 0 }}
          >
            <div className="w-3.5 h-px rounded-full bg-border/40" />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Syncs URL workspace params into the store. Isolated so Navigation chrome never suspends. */
function NavigationUrlSync() {
  const searchParams = useSearchParams();
  const setWorkspace = useAcademicStore((s) => s.setWorkspace);
  const didHydrateWorkspace = useRef(false);

  const urlYear = searchParams.get("year");
  const urlBranch = searchParams.get("branch");
  const urlSemester = searchParams.get("semester");

  useEffect(() => {
    const live = new URLSearchParams(window.location.search);
    const year = live.get("year") ?? urlYear;
    const branch = live.get("branch") ?? urlBranch;
    const semester = live.get("semester") ?? urlSemester;
    const hasUrl = !!(year || branch || semester);
    const stored = !didHydrateWorkspace.current ? readStoredWorkspace() : null;
    didHydrateWorkspace.current = true;

    if (!hasUrl && !stored) return;

    const resolved = resolveWorkspace(
      { year, branch, semester },
      hasUrl
        ? null
        : {
            academicYear: stored?.academicYear,
            branch: stored?.branch,
            semester: stored?.semester,
          },
    );
    setWorkspace(resolved.academicYear, resolved.branch, resolved.semester);
  }, [urlYear, urlBranch, urlSemester, setWorkspace]);

  return null;
}

function currentSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function NavigationInner() {
  const pathname = usePathname();
  const router = useRouter();
  const academicYear = useAcademicStore((s) => s.academicYear);
  const branch = useAcademicStore((s) => s.branch);
  const semester = useAcademicStore((s) => s.semester);
  const standalone = useIsStandalone();
  const motionSafe = useMotionSafe();

  const {
    setAcademicYear,
    setBranch,
    setSemester,
    setWorkspace,
    setSearchQuery,
    setCommandPaletteOpen,
  } = useAcademicStore();

  const [moreOpen, setMoreOpen] = useState(false);
  const collapsed = useLocalStorageBoolean("sidebar-collapsed", false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);
  const isMac = useIsMac();
  const isClient = useIsClient();
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const showTabletRail = isClient && isMd && !isLg;
  const { theme, setTheme } = useTheme();

  const prefsAppliedRef = useRef(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) {
        setScopeOpen(false);
      }
    }
    if (scopeOpen) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [scopeOpen]);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (moreOpen) setMoreOpen(false);
    if (scopeOpen) setScopeOpen(false);
  }

  const handleCollapseToggle = () => {
    writeLocalStorageBoolean("sidebar-collapsed", !collapsed);
  };

  const updateUrl = useCallback(
    (newYear: AcademicYear, newBranch: string, newSem: number) => {
      const params = currentSearchParams();
      params.set("year", newYear);
      params.set("branch", newBranch);
      params.set("semester", newSem.toString());
      params.delete("subject");
      params.delete("filter");
      params.delete("view");
      params.delete("folder");
      setWorkspace(newYear, newBranch as Branch, newSem as Semester);
      writeStoredWorkspace(
        newYear,
        newBranch as Branch,
        newSem as Semester,
      );
      startNavigationProgress();
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, setWorkspace],
  );

  const applyPrefsToUrl = useCallback(
    (prefYear: AcademicYear, prefBranch: Branch, prefSemester: Semester) => {
      if (prefsAppliedRef.current) return;
      const current = currentSearchParams();
      const hasYear = !!current.get("year");
      const hasBranch = !!current.get("branch");
      const hasSemester = !!current.get("semester");
      if (hasYear && hasBranch && hasSemester) {
        prefsAppliedRef.current = true;
        return;
      }
      setWorkspace(prefYear, prefBranch, prefSemester);
      writeStoredWorkspace(prefYear, prefBranch, prefSemester);
      prefsAppliedRef.current = true;
      const params = currentSearchParams();
      if (!hasYear) params.set("year", prefYear);
      if (!hasBranch) params.set("branch", prefBranch);
      if (!hasSemester) params.set("semester", String(prefSemester));
      const nextQs = params.toString();
      const currentQs = current.toString();
      if (nextQs !== currentQs) {
        startTransition(() => {
          router.replace(`${pathname}?${nextQs}`);
        });
      }
    },
    [pathname, router, setWorkspace],
  );

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      if (!userEmail) {
        setIsAdmin(false);
        return;
      }
      try {
        const { auth } = await import("@/lib/firebase");
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
    }
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const cycleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };

  const isActive = useCallback((href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href),
    [pathname]
  );

  const showSelectors =
    pathname === "/resources" ||
    pathname.startsWith("/resources") ||
    pathname === "/syllabus" ||
    pathname === "/gpa" ||
    pathname === "/ask" ||
    pathname.startsWith("/ask") ||
    pathname === "/planner" ||
    pathname.startsWith("/planner") ||
    pathname === "/qa" ||
    pathname.startsWith("/qa");

  const scopedHref = useCallback(
    (href: string) =>
      `${href}?year=${encodeURIComponent(academicYear)}&branch=${branch}&semester=${semester}`,
    [academicYear, branch, semester],
  );

  const systemLinks = SYSTEM_LINKS.filter(
    (link) => !(standalone && link.href === "/install"),
  );
  const moreLinks = MORE_LINKS.filter(
    (link) => !(standalone && link.href === "/install"),
  );

  const renderNavLink = useCallback(
    (link: NavLinkItem, isCollapsed: boolean) => {
      const finalHref = scopedHref(link.href);
      const active = isActive(link.href);

      return (
        <DockTooltip
          key={link.href}
          label={link.label}
          badge={link.featured ? "Core" : undefined}
          disabled={!isCollapsed}
        >
          {({ ref, onMouseEnter, onMouseLeave, onFocus, onBlur }) => (
            <AppLink
              ref={ref as React.RefObject<HTMLAnchorElement>}
              href={finalHref}
              onClick={() => setSearchQuery("")}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onFocus={onFocus}
              onBlur={onBlur}
              aria-label={link.label}
              className={`relative flex items-center my-0.5 rounded-xl group transition-all active:scale-[0.97] ${
                isCollapsed
                  ? "w-10 h-10 mx-auto justify-center px-0"
                  : "w-full h-10 px-2.5 justify-start"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="dockActivePill"
                  className="absolute inset-0 rounded-xl bg-foreground shadow-md"
                  transition={
                    motionSafe.reduce
                      ? { duration: 0 }
                      : motionSafe.spring
                  }
                />
              )}
              {!active && (
                <div className="absolute inset-0 rounded-xl bg-foreground/[0.04] dark:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity" />
              )}

              {/* Fixed icon container: 40x40 when collapsed, 24x24 when expanded */}
              <div
                className={`flex items-center justify-center shrink-0 relative z-10 ${
                  isCollapsed ? "w-10 h-10" : "w-6 h-6"
                }`}
              >
                <link.Icon
                  className={`w-[18px] h-[18px] transition-all ${
                    active
                      ? "text-background"
                      : "text-muted group-hover:text-foreground"
                  }`}
                />
              </div>

              {/* Label & Core badge */}
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0 ml-2.5 relative z-10 overflow-hidden">
                  <span
                    className={`truncate text-sm font-medium tracking-tight ${
                      active
                        ? "text-background font-semibold"
                        : "text-muted group-hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </span>
                  {link.featured && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-3xs font-bold uppercase tracking-[0.12em] shrink-0 ml-2 transition-colors ${
                        active
                          ? "bg-background/20 text-background"
                          : "bg-foreground/10 text-foreground dark:bg-white/10 dark:text-foreground"
                      }`}
                    >
                      Core
                    </span>
                  )}
                </div>
              )}
            </AppLink>
          )}
        </DockTooltip>
      );
    },
    [isActive, setSearchQuery, scopedHref, motionSafe.reduce, motionSafe.spring],
  );

  const renderSidebarContent = (opts: { collapsed: boolean }) => {
    const isCollapsed = opts.collapsed;
    const link = (item: NavLinkItem) => renderNavLink(item, isCollapsed);

    return (
      <div className="flex flex-col h-full select-none overflow-hidden rounded-shell">
        {/* Header - Identical fixed h-14 row in both collapsed & expanded */}
        <div
          className={`h-14 flex items-center border-b border-border/50 shrink-0 relative overflow-hidden ${
            isCollapsed ? "justify-center px-0" : "justify-between px-3.5"
          }`}
        >
          {isCollapsed ? (
            <DockTooltip label="Expand sidebar">
              {({ ref, onMouseEnter, onMouseLeave, onFocus, onBlur }) => (
                <button
                  ref={ref as React.RefObject<HTMLButtonElement>}
                  onClick={handleCollapseToggle}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                  className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center shadow-md transition-all active:scale-[0.97] group relative cursor-pointer"
                >
                  <Layers className="w-5 h-5 transition-opacity duration-200 group-hover:opacity-0" />
                  <ChevronRight className="w-5 h-5 absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </button>
              )}
            </DockTooltip>
          ) : (
            <>
              <AppLink
                href="/"
                onClick={() => setSearchQuery("")}
                aria-label="Utility OS Home"
                className="flex items-center group min-w-0"
              >
                <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center shadow-md transition-all shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="flex items-center ml-2.5 overflow-hidden min-w-0">
                  <span className="font-display text-[1.15rem] leading-none font-bold tracking-tight text-foreground truncate">
                    Utility
                    <span className="ml-1.5 text-[0.65rem] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-surface border border-border/70 text-muted">
                      OS
                    </span>
                  </span>
                </div>
              </AppLink>

              <button
                onClick={handleCollapseToggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="w-8 h-8 rounded-xl hover:bg-surface active:bg-surface-hover border border-transparent hover:border-border/70 text-muted hover:text-foreground transition-all shrink-0 hidden lg:inline-flex items-center justify-center cursor-pointer active:scale-[0.97]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Workspace + Search chrome */}
        <div
          className={`relative z-30 shrink-0 ${
            isCollapsed
              ? "flex flex-col items-center gap-1.5 px-0 pt-2"
              : "space-y-0"
          }`}
        >
          {showSelectors && (
            <div
              ref={scopeRef}
              className={`relative ${isCollapsed ? "" : "pt-2 px-2.5"}`}
            >
              <DockTooltip
                label={`${branch} · Sem ${semester}`}
                badge="Switch"
                disabled={!isCollapsed}
              >
                {({ ref, onMouseEnter, onMouseLeave, onFocus, onBlur }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={() => setScopeOpen((o) => !o)}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    aria-expanded={scopeOpen}
                    aria-label={`Workspace ${branch} Semester ${semester}`}
                    className={`relative flex items-center rounded-xl active:scale-[0.97] transition-all ${
                      isCollapsed
                        ? `w-10 h-10 justify-center flex-col gap-0.5 shadow-md ${
                            scopeOpen
                              ? "bg-foreground/90 text-background ring-2 ring-foreground/30 ring-offset-1 ring-offset-card"
                              : "bg-foreground text-background"
                          }`
                        : "w-full h-10 px-3 justify-between bg-surface/50 hover:bg-surface border border-border/70 hover:border-border-strong text-muted hover:text-foreground shadow-xs"
                    }`}
                  >
                    {isCollapsed ? (
                      <>
                        <span className="text-[12px] font-extrabold tracking-tight uppercase leading-none">
                          {branchMonogram(branch)}
                        </span>
                        <span className="text-[9px] font-bold tabular-nums leading-none text-background/65">
                          S{semester}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="inline-flex items-center justify-center h-5 px-1.5 pt-[1px] rounded-md bg-foreground text-background text-[10px] font-extrabold tracking-wide uppercase leading-none shrink-0 shadow-2xs">
                            {branch.slice(0, 4)}
                          </span>
                          <div className="flex items-baseline gap-1.5 overflow-hidden min-w-0">
                            <span className="text-xs font-bold text-foreground truncate leading-none">
                              Sem {semester}
                            </span>
                            <span className="text-[11px] font-medium text-muted truncate leading-none">
                              · {academicYear.split("-")[0]}
                            </span>
                          </div>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ${
                            scopeOpen ? "rotate-180" : ""
                          }`}
                        />
                      </>
                    )}
                  </button>
                )}
              </DockTooltip>

              {/* Floating Workspace Popover */}
              <AnimatePresence>
                {scopeOpen && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      scale: 0.96,
                      y: isCollapsed ? 0 : 4,
                      x: isCollapsed ? -6 : 0,
                    }}
                    animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.96,
                      y: isCollapsed ? 0 : 4,
                      x: isCollapsed ? -6 : 0,
                    }}
                    transition={{
                      duration: motionSafe.durations.fast,
                      ease: motionSafe.ease,
                    }}
                    className={`absolute bg-card/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl p-3 z-50 ${
                      isCollapsed
                        ? "w-72 left-full ml-3 top-0"
                        : "w-[calc(100%-1rem)] left-2 top-full mt-2"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted/70">
                        Workspace Scope
                      </p>
                      <span className="text-2xs font-semibold text-muted tabular-nums px-1.5 py-0.5 rounded-md bg-surface border border-border/60">
                        {branch} · Sem {semester}
                      </span>
                    </div>
                    <ScopeSelector
                      academicYear={academicYear}
                      branch={branch}
                      semester={semester}
                      variant="sidebar"
                      onAcademicYearChange={(val) => {
                        updateUrl(val, branch, semester);
                      }}
                      onBranchChange={(val) => {
                        updateUrl(academicYear, val, semester);
                      }}
                      onSemesterChange={(val) => {
                        updateUrl(academicYear, branch, val);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Search */}
          <div className={isCollapsed ? "" : "pt-2 px-2.5"}>
            <DockTooltip
              label="Search"
              shortcut={isMac ? "⌘K" : "Ctrl+K"}
              disabled={!isCollapsed}
            >
              {({ ref, onMouseEnter, onMouseLeave, onFocus, onBlur }) => (
                <button
                  ref={ref as React.RefObject<HTMLButtonElement>}
                  onClick={() => setCommandPaletteOpen(true)}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  aria-label="Search resources"
                  className={`flex items-center rounded-xl active:scale-[0.97] transition-all ${
                    isCollapsed
                      ? "w-10 h-10 justify-center text-muted hover:text-foreground hover:bg-foreground/[0.06] dark:hover:bg-white/[0.08]"
                      : "w-full h-10 px-3 justify-between bg-surface/50 hover:bg-surface border border-border/70 hover:border-border-strong text-muted hover:text-foreground shadow-xs"
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <Search className="w-[18px] h-[18px]" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center justify-between flex-1 ml-2 overflow-hidden min-w-0">
                      <span className="text-xs font-medium truncate">Search…</span>
                      <kbd
                        className="kbd hidden sm:inline-flex bg-background/60 border border-border/70 text-[10px] ml-1.5 shrink-0"
                        suppressHydrationWarning
                      >
                        {isMac ? "⌘K" : "Ctrl+K"}
                      </kbd>
                    </div>
                  )}
                </button>
              )}
            </DockTooltip>
          </div>
        </div>

        {/* Navigation Links */}
        <div
          className={`flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden ${
            isCollapsed ? "px-0 py-1.5 space-y-1" : "px-2.5 py-2.5 space-y-3"
          }`}
        >
          <NavSection title="Academic" collapsed={isCollapsed} hideCollapsedDivider>
            {ACADEMIC_LINKS.map(link)}
          </NavSection>

          <NavSection title="Campus" collapsed={isCollapsed}>
            {CAMPUS_LINKS.map(link)}
          </NavSection>

          <NavSection title="Productivity" collapsed={isCollapsed}>
            {PRODUCTIVITY_LINKS.map(link)}
          </NavSection>

          <NavSection title="Connect" collapsed={isCollapsed}>
            {SOCIAL_LINKS.map(link)}
          </NavSection>

          <NavSection title="System" collapsed={isCollapsed}>
            {systemLinks.map(link)}
            {isAdmin && (
              <DockTooltip
                label="Admin Dashboard"
                disabled={!isCollapsed}
              >
                {({ ref, onMouseEnter, onMouseLeave, onFocus, onBlur }) => (
                  <AppLink
                    ref={ref as React.RefObject<HTMLAnchorElement>}
                    href="/admin"
                    onClick={() => setSearchQuery("")}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    aria-label="Admin Dashboard"
                    className={`relative flex items-center my-0.5 rounded-xl group transition-all active:scale-[0.97] ${
                      isCollapsed
                        ? "w-10 h-10 mx-auto justify-center px-0"
                        : "w-full h-10 px-2.5 justify-start"
                    } ${
                      isActive("/admin")
                        ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center shrink-0 relative z-10 ${
                        isCollapsed ? "w-10 h-10" : "w-6 h-6"
                      }`}
                    >
                      <ShieldCheck className="w-[18px] h-[18px]" />
                    </div>
                    {!isCollapsed && (
                      <div className="flex items-center flex-1 min-w-0 ml-2.5 relative z-10 overflow-hidden">
                        <span className="truncate text-sm font-medium tracking-tight">
                          Admin Dashboard
                        </span>
                      </div>
                    )}
                  </AppLink>
                )}
              </DockTooltip>
            )}
          </NavSection>
        </div>

        {/* Dock Footer Deck */}
        <div
          className={`border-t border-border/50 space-y-2 bg-surface/30 dark:bg-card/40 rounded-b-[24px] shrink-0 overflow-hidden ${
            isCollapsed ? "p-2" : "p-2.5"
          }`}
        >
          {/* Theme toggle */}
          {isCollapsed ? (
            <div className="flex justify-center">
              <DockTooltip label={`Theme: ${theme ?? "system"}`}>
                {({ ref, onMouseEnter, onMouseLeave, onFocus, onBlur }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={cycleTheme}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-foreground hover:bg-foreground/[0.06] dark:hover:bg-white/[0.08] active:scale-[0.97] transition-all"
                    aria-label="Cycle color theme"
                  >
                    {theme === "light" ? (
                      <Sun className="w-4 h-4" />
                    ) : theme === "dark" ? (
                      <Moon className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                  </button>
                )}
              </DockTooltip>
            </div>
          ) : (
            <SegmentedThemeToggle theme={theme} setTheme={setTheme} />
          )}

          <NavUserMenu
            collapsed={isCollapsed}
            academicYear={academicYear}
            branch={branch}
            semester={semester}
            setAcademicYear={setAcademicYear}
            setBranch={setBranch}
            setSemester={setSemester}
            onWorkspaceFromPrefs={applyPrefsToUrl}
            onUserChange={(u) => setUserEmail(u?.email)}
          />

          {/* Crafted By */}
          <div className="flex justify-center pt-0.5 border-t border-border/20">
            {isCollapsed ? (
              <DockTooltip label="Crafted by Aryan Dani">
                {({ ref, onMouseEnter, onMouseLeave, onFocus, onBlur }) => (
                  <a
                    ref={ref as React.RefObject<HTMLAnchorElement>}
                    href="https://www.aryandani.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black tracking-wider text-muted/55 hover:text-foreground hover:bg-surface/80 transition-colors"
                    aria-label="Crafted by Aryan Dani"
                  >
                    AD
                  </a>
                )}
              </DockTooltip>
            ) : (
              <p className="text-[10px] text-muted/50 text-center tracking-tight font-semibold py-0.5">
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
      </div>
    );
  };

  const tabActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <Suspense fallback={null}>
        <NavigationUrlSync />
      </Suspense>

      {/* Desktop Floating Dock */}
      <div
        className={`hidden lg:block shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? "w-[5.75rem]" : "w-[18.75rem]"
        }`}
        aria-hidden="true"
      />
      <aside
        key="desktop-dock"
        aria-label="Primary Navigation"
        data-app-chrome=""
        className={`hidden lg:flex fixed top-3.5 left-3.5 bottom-3.5 z-40 flex-col shell-island transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
          collapsed ? "w-[4.75rem]" : "w-[17.5rem]"
        }`}
        style={{ willChange: "width" }}
      >
        {renderSidebarContent({ collapsed })}
      </aside>

      {/* Tablet Floating Dock Rail */}
      {showTabletRail && (
        <>
          <div className="hidden md:block lg:hidden shrink-0 w-[5.75rem]" aria-hidden="true" />
          <aside
            key="tablet-dock"
            aria-label="Tablet Navigation"
            data-app-chrome=""
            className="hidden md:flex lg:hidden fixed top-3.5 left-3.5 bottom-3.5 z-40 flex-col w-[4.75rem] shell-island select-none"
          >
            {renderSidebarContent({ collapsed: true })}
          </aside>
        </>
      )}

      {/* Mobile Header (< md) */}
      <header data-app-chrome="" className="fixed top-0 inset-x-0 w-full max-w-[100vw] h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b border-border/80 bg-background/80 backdrop-blur-md z-sticky flex items-center justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:hidden transition-colors">
        <AppLink
          href="/"
          onClick={() => setSearchQuery("")}
          className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 min-h-11 min-w-0"
        >
          <div className="w-6 h-6 rounded-lg bg-foreground flex items-center justify-center text-background shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-medium truncate">Utility</span>
        </AppLink>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="hidden xs:inline-flex items-center max-w-[7.5rem] min-h-11 px-2 rounded-lg text-2xs font-semibold text-muted truncate"
            onClick={() => setMoreOpen(true)}
            aria-label="Workspace"
          >
            {branch} · {semester}
          </button>
          <button
            type="button"
            className="tap-target shrink-0 rounded-lg text-muted hover:text-foreground hover:bg-surface/50 active:bg-surface border border-transparent transition-colors"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search resources"
            title="Search (Ctrl+K)"
          >
            <Search className="w-5 h-5" />
          </button>
          <div className="max-w-[2.75rem]">
            <NavUserMenu
              collapsed
              academicYear={academicYear}
              branch={branch}
              semester={semester}
              setAcademicYear={setAcademicYear}
              setBranch={setBranch}
              setSemester={setSemester}
              onWorkspaceFromPrefs={applyPrefsToUrl}
              onUserChange={(u) => setUserEmail(u?.email)}
            />
          </div>
        </div>
      </header>

      {/* Mobile TabBar (< md) */}
      <TabBar
        items={[
          ...PHONE_TABS.map((tab) => ({
            href: scopedHref(tab.href),
            label: tab.label,
            icon: <tab.Icon className="w-5 h-5" />,
            active: tabActive(tab.href),
          })),
          {
            label: "More",
            icon: <MoreHorizontal className="w-5 h-5" />,
            active: moreOpen,
            onClick: () => setMoreOpen(true),
          },
        ]}
      />

      {/* Mobile More Sheet (< md) */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="px-1 pb-2">
          <div className="bg-card border border-border/80 p-3 rounded-2xl mb-3">
            <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted/70 mb-2">
              Workspace
            </p>
            <ScopeSelector
              academicYear={academicYear}
              branch={branch}
              semester={semester}
              variant="sidebar"
              onAcademicYearChange={(val) => updateUrl(val, branch, semester)}
              onBranchChange={(val) => updateUrl(academicYear, val, semester)}
              onSemesterChange={(val) => updateUrl(academicYear, branch, val)}
            />
          </div>
          <nav className="flex flex-col gap-0.5">
            {moreLinks.map((item) => (
              <AppLink
                key={item.href}
                href={scopedHref(item.href)}
                onClick={() => {
                  setSearchQuery("");
                  setMoreOpen(false);
                }}
                className={`flex items-center gap-3 min-h-11 px-3 rounded-lg text-sm ${
                  isActive(item.href)
                    ? "bg-foreground text-background"
                    : "text-foreground hover:bg-surface"
                }`}
              >
                <item.Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </AppLink>
            ))}
            {isAdmin && (
              <AppLink
                href="/admin"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 min-h-11 px-3 rounded-lg text-sm text-foreground hover:bg-surface"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </AppLink>
            )}
          </nav>
          <div className="mt-4">
            <SegmentedThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </Sheet>
    </>
  );
}

export default function Navigation() {
  return <NavigationInner />;
}

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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Layers,
  MoreHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
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

const SIDEBAR_EXPANDED = "lg:w-72";
const SIDEBAR_COLLAPSED = "lg:w-[4.25rem]";
const TABLET_RAIL = "w-[4.25rem]";

function NavSection({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      {collapsed ? (
        <div className="mx-2.5 my-2 border-t border-border/50" />
      ) : (
        <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/55">
          {title}
        </p>
      )}
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

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (moreOpen) setMoreOpen(false);
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
    pathname.startsWith("/planner");

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

  const renderNavLink = useCallback((link: NavLinkItem, isCollapsed: boolean) => {
    const finalHref = scopedHref(link.href);
    const active = isActive(link.href);
    return (
      <AppLink
        key={link.href}
        href={finalHref}
        onClick={() => setSearchQuery("")}
        aria-label={link.label}
        title={isCollapsed ? link.label : undefined}
        className={`flex items-center min-h-10 mx-1 ${isCollapsed ? "justify-center px-0" : "justify-between px-2.5"} py-2 rounded-lg text-sm font-medium tracking-tight transition-colors border group relative overflow-visible ${
          active
            ? "bg-foreground text-background border-transparent shadow-card"
            : "text-muted hover:text-foreground hover:bg-surface/60 active:bg-surface border-transparent"
        }`}
      >
        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-background/80"
            transition={motionSafe.reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
          />
        )}

        <span className="flex items-center gap-2.5 min-w-0">
          <link.Icon className={`w-[17px] h-[17px] shrink-0 ${active ? "text-background" : "text-muted group-hover:text-foreground"}`} />
          {!isCollapsed && <span className="truncate">{link.label}</span>}
        </span>
        {!isCollapsed && link.featured && (
          <span className={`flex items-center px-1.5 py-px rounded-md text-3xs font-bold uppercase tracking-[0.12em] shrink-0 ${
            active ? "bg-background/20 text-background" : "bg-foreground text-background"
          }`}>
            Core
          </span>
        )}
      </AppLink>
    );
  }, [isActive, setSearchQuery, scopedHref, motionSafe.reduce]);

  const renderSidebarContent = (opts: { collapsed: boolean }) => {
    const isCollapsed = opts.collapsed;
    const link = (item: NavLinkItem) => renderNavLink(item, isCollapsed);
    return (
      <div className="flex flex-col h-full select-none">
        <div className={`px-3 py-3.5 flex ${isCollapsed ? "flex-col items-center justify-center gap-3" : "items-center justify-between gap-2"} border-b border-border/50 min-h-[3.75rem]`}>
          <AppLink
            href="/"
            onClick={() => setSearchQuery("")}
            aria-label="Utility OS Home"
            className="text-base font-bold tracking-tight text-foreground flex items-center gap-2.5 group min-w-0"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-foreground text-background rounded-lg transition-transform group-hover:scale-[1.03] shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <span className="font-display text-[1.15rem] leading-none tracking-tight text-foreground truncate">
                Utility
                <span className="ml-1 text-[0.7em] font-sans font-semibold text-muted tracking-wide">OS</span>
              </span>
            )}
          </AppLink>

          <button
            onClick={handleCollapseToggle}
            className="tap-target w-8 h-8 rounded-lg hover:bg-surface active:bg-surface-hover border border-transparent text-muted hover:text-foreground hover:border-border/70 transition-all shrink-0 hidden lg:inline-flex items-center justify-center"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {showSelectors && !isCollapsed && (
          <div className="px-3 pt-3 overflow-visible relative z-50">
            <div className="bg-card border border-border/80 p-3 rounded-2xl flex flex-col gap-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-muted/70">
                  Workspace
                </p>
                <span className="text-2xs font-semibold text-muted tabular-nums truncate">
                  {branch} · Sem {semester}
                </span>
              </div>
              <ScopeSelector
                academicYear={academicYear}
                branch={branch}
                semester={semester}
                variant="sidebar"
                onAcademicYearChange={(val) =>
                  updateUrl(val, branch, semester)
                }
                onBranchChange={(val) =>
                  updateUrl(academicYear, val, semester)
                }
                onSemesterChange={(val) =>
                  updateUrl(academicYear, branch, val)
                }
              />
            </div>
          </div>
        )}

        <div className="px-3 pt-3">
          {isCollapsed ? (
            <button
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Search resources"
              className="w-full flex items-center justify-center min-h-10 p-2 bg-card border border-border/80 rounded-xl text-muted hover:text-foreground hover:border-border-strong active:bg-surface transition-all"
              title="Search (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-muted" />
            </button>
          ) : (
            <button
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Search resources"
              className="w-full flex items-center justify-between min-h-10 px-3 py-2 bg-card border border-border/80 rounded-xl text-xs text-muted hover:text-foreground hover:border-border-strong active:bg-surface transition-all group"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-muted group-hover:text-foreground transition-colors" />
                <span className="font-medium">Search…</span>
              </span>
              <kbd
                className="kbd hidden sm:inline-flex"
                suppressHydrationWarning
              >
                {isMac ? "⌘K" : "Ctrl+K"}
              </kbd>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5 custom-scrollbar">
          <NavSection title="Academic" collapsed={isCollapsed}>
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
              <AppLink
                href="/admin"
                onClick={() => setSearchQuery("")}
                title={isCollapsed ? "Admin Dashboard" : undefined}
                aria-label="Admin Dashboard"
                className={`flex items-center min-h-10 ${isCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5 py-2"} rounded-lg text-[13px] font-medium tracking-tight transition-colors border group ${
                  isActive("/admin")
                    ? "bg-primary/10 border-primary/20 text-primary shadow-xs"
                    : "text-muted hover:text-foreground hover:bg-surface/60 active:bg-surface border-transparent"
                }`}
              >
                <ShieldCheck className="w-[17px] h-[17px] text-muted group-hover:text-foreground" />
                {!isCollapsed && <span>Admin Dashboard</span>}
              </AppLink>
            )}
          </NavSection>
        </div>

        <div className="p-3 border-t border-border/50 space-y-2.5 bg-card/40">
          {isCollapsed ? (
            <button
              onClick={cycleTheme}
              className="w-full flex items-center justify-center min-h-11 p-2 bg-surface/60 border border-border/70 rounded-xl text-muted hover:text-foreground active:bg-surface transition-all"
              title={`Theme: ${theme}`}
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

  const tabActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <Suspense fallback={null}>
        <NavigationUrlSync />
      </Suspense>

      <aside
        aria-label="Primary"
        data-app-chrome=""
        className={`h-screen sticky top-0 left-0 border-r border-border/80 bg-background-subtle z-40 hidden lg:flex flex-col shrink-0 transition-all duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)] w-0 overflow-hidden lg:overflow-visible ${
          collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
        }`}
        style={{ willChange: "width" }}
      >
        {renderSidebarContent({ collapsed })}
      </aside>

      {showTabletRail && (
        <aside
          aria-label="Primary"
          data-app-chrome=""
          className={`h-screen sticky top-0 left-0 border-r border-border/80 bg-background-subtle z-40 flex flex-col shrink-0 ${TABLET_RAIL}`}
        >
          {renderSidebarContent({ collapsed: true })}
        </aside>
      )}

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

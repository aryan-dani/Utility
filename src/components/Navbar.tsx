"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, BookOpen, FileText, CalendarCheck, Menu, X } from "lucide-react";
import { useAcademicStore, Branch, Semester } from "../store/academicStore";

const NAV_LINKS = [
  { href: "/syllabus", label: "Syllabus", Icon: BookOpen },
  { href: "/resources", label: "Resources", Icon: FileText },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searchQuery, setBranch, setSemester, setSearchQuery } =
    useAcademicStore();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Get values from URL or fallback to defaults
  const branch = (searchParams.get("branch") as Branch) || "AIDS";
  const semester = Number(searchParams.get("semester") || "4") as Semester;

  // Sync store with URL on mount or change
  useEffect(() => {
    setBranch(branch);
    setSemester(semester);
  }, [branch, semester, setBranch, setSemester]);

  const updateUrl = useCallback((newBranch: string, newSem: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", newBranch);
    params.set("semester", newSem.toString());
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Handle keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value && pathname !== "/resources" && pathname !== "/syllabus") {
      const params = new URLSearchParams(searchParams.toString());
      router.push(`/resources?${params.toString()}`);
    }
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-16 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 flex justify-between items-center">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2 shrink-0"
        >
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span>Utility</span>
        </Link>

        {/* Desktop Controls */}
        <div className="hidden md:flex gap-2 items-center">
          {/* Branch & Semester Selectors */}
          <div className="flex items-center gap-2 mr-2">
            <select
              title="Select Branch"
              className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
              value={branch}
              onChange={(e) => updateUrl(e.target.value, semester)}
            >
              <option value="AIDS">AIDS</option>
              <option value="CSE">CSE</option>
            </select>
            <select
              title="Select Semester"
              className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
              value={semester}
              onChange={(e) => updateUrl(branch, Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Sem {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search resources, topics… (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-surface border border-border rounded-md outline-none text-sm font-medium w-80 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="h-5 w-px bg-border mx-2" />

          {/* Nav Links */}
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const params = new URLSearchParams(searchParams.toString());
            const finalHref = href === "/" ? "/" : `${href}?${params.toString()}`;
            return (
              <Link
                key={href}
                href={finalHref}
                className={`px-3 py-1.5 flex items-center gap-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-surface text-foreground font-semibold"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            );
          })}

          <Link
            href="/planner"
            className={`ml-2 px-4 py-1.5 flex items-center gap-2 rounded-md text-sm font-medium transition-colors ${
              isActive("/planner")
                ? "bg-primary/90 text-white"
                : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>My Utility</span>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-muted hover:text-foreground hover:bg-surface transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-background border-b border-border shadow-lg z-40 px-6 py-4 flex flex-col gap-3">
          {/* Selectors */}
          <div className="flex gap-2">
            <select
              title="Select Branch"
              className="flex-1 bg-surface border border-border rounded-md px-2 py-2 text-sm font-medium outline-none focus:border-primary text-foreground"
              value={branch}
              onChange={(e) => updateUrl(e.target.value, semester)}
            >
              <option value="AIDS">AIDS</option>
              <option value="CSE">CSE</option>
            </select>
            <select
              title="Select Semester"
              className="flex-1 bg-surface border border-border rounded-md px-2 py-2 text-sm font-medium outline-none focus:border-primary text-foreground"
              value={semester}
              onChange={(e) => updateUrl(branch, Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Sem {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search resources, topics…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-md outline-none text-sm font-medium focus:border-primary text-foreground placeholder:text-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-2.5 flex items-center text-muted hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Nav Links */}
          <div className="border-t border-border pt-3 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, Icon }) => {
              const params = new URLSearchParams(searchParams.toString());
              const finalHref = href === "/" ? "/" : `${href}?${params.toString()}`;
              return (
                <Link
                  key={href}
                  href={finalHref}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive(href)
                      ? "bg-surface text-foreground font-semibold"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
            <Link
              href="/planner"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive("/planner")
                  ? "bg-primary/90 text-white"
                  : "bg-primary text-white hover:bg-primary-hover"
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              My Utility
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

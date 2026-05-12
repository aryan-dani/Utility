"use client";

import Link from "next/link";
import { Search, Home, BookOpen, FileText, CalendarCheck } from "lucide-react";
import { useAcademicStore, Branch, Semester } from "../store/academicStore";

export default function Navbar() {
  const { branch, semester, setBranch, setSemester } = useAcademicStore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-16 flex items-center justify-center">
      <div className="w-full max-w-7xl mx-auto px-6 flex justify-between items-center">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span>AcademicPlanner</span>
        </Link>

        <div className="flex gap-2 items-center">
          {/* Branch & Semester Selectors */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            <select
              title="Select Branch"
              className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
              value={branch}
              onChange={(e) => setBranch(e.target.value as Branch)}
            >
              <option value="AIDS">AIDS</option>
              <option value="CSE">CSE</option>
            </select>
            <select
              title="Select Semester"
              className="bg-surface border border-border rounded-md px-2 py-1.5 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value) as Semester)}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Sem {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar - Structured */}
          <div className="hidden md:flex relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-4 py-1.5 bg-surface border border-border rounded-md outline-none text-sm font-medium w-64 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted"
            />
          </div>

          <div className="h-5 w-px bg-border mx-2 hidden md:block"></div>

          <Link
            href="/"
            className="px-3 py-1.5 flex items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <Link
            href="/syllabus"
            className="px-3 py-1.5 flex items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Syllabus</span>
          </Link>
          <Link
            href="/resources"
            className="px-3 py-1.5 flex items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Resources</span>
          </Link>
          <Link
            href="/planner"
            className="ml-2 px-4 py-1.5 flex items-center gap-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            <CalendarCheck className="w-4 h-4" />
            <span className="hidden sm:inline">My Planner</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

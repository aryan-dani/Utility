"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAcademicStore } from "@/store/academicStore";
import { workspaceQuery } from "@/lib/workspace";
import { startNavigationProgress } from "@/components/NavigationProgress";

/** Always-on shortcuts. The palette chunk loads only after ⌘K / Ctrl+K. */
export function CommandShortcuts() {
  const router = useRouter();
  const academicYear = useAcademicStore((s) => s.academicYear);
  const branch = useAcademicStore((s) => s.branch);
  const semester = useAcademicStore((s) => s.semester);
  const isCommandPaletteOpen = useAcademicStore((s) => s.isCommandPaletteOpen);
  const setCommandPaletteOpen = useAcademicStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    const navigate = (href: string) => {
      startNavigationProgress();
      router.push(href);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

      if (!e.altKey) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const qs = workspaceQuery(academicYear, branch, semester);
      const key = e.key.toLowerCase();
      const go = (href: string) => {
        setCommandPaletteOpen(false);
        navigate(href);
      };
      const shortcutMap: Record<string, () => void> = {
        t: () => go(`/timer?mode=work&start=true&${qs}`),
        b: () => go(`/timer?mode=break&start=true&${qs}`),
        a: () => go(`/ask?${qs}`),
        g: () => go(`/gpa?${qs}`),
        r: () => go(`/srs?${qs}`),
        s: () => go(`/syllabus?${qs}`),
        c: () => go(`/community?${qs}`),
        "?": () => setCommandPaletteOpen(true),
        "/": () => setCommandPaletteOpen(true),
      };

      if (shortcutMap[key]) {
        e.preventDefault();
        shortcutMap[key]();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    academicYear,
    branch,
    semester,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    router,
  ]);

  return null;
}

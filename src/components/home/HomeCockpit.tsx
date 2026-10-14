"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Brain,
  ClipboardCopy,
  GraduationCap,
  Layers,
  Timer,
  Waypoints,
  Building2,
  HelpCircle,
} from "lucide-react";
import AppLink from "@/components/ui/AppLink";
import { useAcademicStore } from "@/store/academicStore";
import { workspaceQuery } from "@/lib/workspace";
import { getRecentResources } from "@/lib/recentResources";
import { readPlannerMonth } from "@/lib/plannerStorage";
import { localDateKey } from "@/lib/dateLocal";
import { startFocusMinutes } from "@/lib/focusTimer";
import { readStudyScope } from "@/lib/studyScope";

function todayTasks(): string[] {
  const key = localDateKey();
  const [year, month] = key.split("-").map(Number);
  const stored = readPlannerMonth(year, month);
  const day = stored?.data[key];
  if (!Array.isArray(day)) return [];
  return day.filter((task) => !task.done).slice(0, 3).map((task) => task.text);
}

const EMPTY_SNAP = JSON.stringify({
  tasks: [] as string[],
  recentTitle: "",
  recentId: "",
  scope: "",
});

function cockpitSnapshot(): string {
  const recent = getRecentResources()[0];
  const scope = readStudyScope();
  return JSON.stringify({
    tasks: todayTasks(),
    recentTitle: recent?.title || "",
    recentId: recent?.id || "",
    scope: scope.subject
      ? scope.unit
        ? `${scope.subject} · ${scope.unit}`
        : scope.subject
      : "",
  });
}

function subscribeCockpit(onStoreChange: () => void) {
  window.addEventListener("focus", onStoreChange);
  return () => window.removeEventListener("focus", onStoreChange);
}

export function HomeCockpit() {
  const router = useRouter();
  const academicYear = useAcademicStore((s) => s.academicYear);
  const branch = useAcademicStore((s) => s.branch);
  const semester = useAcademicStore((s) => s.semester);
  const qs = workspaceQuery(academicYear, branch, semester);
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const snap = JSON.parse(
    useSyncExternalStore(subscribeCockpit, cockpitSnapshot, () => EMPTY_SNAP),
  ) as { tasks: string[]; recentTitle: string; recentId: string; scope: string };
  const tasks = snap.tasks;
  const scopeLabel = snap.scope;
  const recentHref = snap.recentId
    ? `/resources?${qs}&view=${encodeURIComponent(snap.recentId)}`
    : "";

  const ask = (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) {
      router.push(`/ask?tab=chat&${qs}`);
      return;
    }
    router.push(`/ask?tab=chat&prompt=${encodeURIComponent(text)}&${qs}`);
  };

  const openCode = (event: FormEvent) => {
    event.preventDefault();
    const id = code.trim().toLowerCase();
    if (id.length < 4) return;
    router.push(`/clipboard/s/${encodeURIComponent(id)}`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto page-gutter py-8 sm:py-12 space-y-px">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <section className="bg-card p-4 sm:p-5 min-h-[11rem] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Today</p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg border border-border text-xs font-medium"
              onClick={() => startFocusMinutes(25, scopeLabel || "Focus")}
            >
              <Timer className="w-3.5 h-3.5" />
              25m
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted">No open tasks for today.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {tasks.map((task) => (
                <li key={task} className="truncate">{task}</li>
              ))}
            </ul>
          )}
          <AppLink href={`/planner?${qs}`} className="mt-auto text-xs font-medium underline underline-offset-4">
            Open planner
          </AppLink>
        </section>

        <section className="bg-card p-4 sm:p-5 min-h-[11rem] flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Continue</p>
          <p className="text-sm font-medium leading-snug">
            {snap.recentTitle || scopeLabel || "Open a vault file or a syllabus unit."}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            {recentHref && (
              <AppLink href={recentHref} className="text-xs font-medium underline underline-offset-4">
                Last file
              </AppLink>
            )}
            <AppLink href={`/syllabus?${qs}`} className="text-xs font-medium underline underline-offset-4">
              Syllabus
            </AppLink>
          </div>
        </section>

        <form onSubmit={ask} className="bg-card p-4 sm:p-5 min-h-[11rem] flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ask AI</p>
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={`Ask about ${branch} sem ${semester}`}
            className="h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none"
          />
          <button type="submit" className="mt-auto h-9 rounded-lg bg-foreground text-background text-xs font-medium">
            Ask
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
        {[
          { href: `/syllabus?${qs}`, label: "Syllabus", Icon: BookOpen },
          { href: `/resources?${qs}`, label: "Vault", Icon: Layers },
          { href: `/srs?${qs}`, label: "SRS", Icon: Brain },
          { href: `/gpa?${qs}`, label: "GPA", Icon: GraduationCap },
        ].map(({ href, label, Icon }) => (
          <AppLink key={label} href={href} className="bg-card p-4 flex items-center gap-2 text-sm font-medium min-h-16">
            <Icon className="w-4 h-4" />
            {label}
          </AppLink>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
        <form onSubmit={openCode} className="bg-card p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <ClipboardCopy className="w-3.5 h-3.5" /> Lab clipboard
          </p>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Share code"
            className="h-9 px-2 rounded-lg border border-border bg-background text-sm font-mono"
            aria-label="Clipboard share code"
          />
        </form>
        {[
          { href: "/visualize", label: "Visualize", Icon: Waypoints },
          { href: `/qa?${qs}`, label: "Doubt Board", Icon: HelpCircle },
          { href: "/campus", label: "Campus", Icon: Building2 },
        ].map(({ href, label, Icon }) => (
          <AppLink key={label} href={href} className="bg-card p-4 flex items-center gap-2 text-sm font-medium min-h-[5.5rem]">
            <Icon className="w-4 h-4" />
            {label}
          </AppLink>
        ))}
      </div>
    </div>
  );
}

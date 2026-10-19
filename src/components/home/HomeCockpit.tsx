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
  ArrowRight,
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

const TILE =
  "bg-card px-4 flex items-center gap-2.5 text-sm font-medium h-14 hover:bg-surface transition-colors";

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
    <div className="w-full max-w-7xl mx-auto page-gutter pb-10 sm:pb-14">
      <div className="rounded-xl border border-border overflow-hidden bg-border grid grid-cols-1 lg:grid-cols-12 gap-px">
        {/* Primary row */}
        <section className="lg:col-span-4 bg-card p-4 sm:p-5 flex flex-col gap-3 min-h-[9.5rem]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Today
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border text-xs font-medium tabular-nums hover:bg-surface"
              onClick={() => startFocusMinutes(25, scopeLabel || "Focus")}
            >
              <Timer className="w-3.5 h-3.5" />
              25m
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted leading-relaxed">
              Nothing scheduled. Add a task or start a focus block.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {tasks.map((task) => (
                <li key={task} className="truncate text-foreground">
                  {task}
                </li>
              ))}
            </ul>
          )}
          <AppLink
            href={`/planner?${qs}`}
            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline underline-offset-4"
          >
            Open planner
            <ArrowRight className="w-3 h-3" />
          </AppLink>
        </section>

        <section className="lg:col-span-4 bg-card p-4 sm:p-5 flex flex-col gap-3 min-h-[9.5rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Continue
          </p>
          <p className="text-sm font-medium leading-snug line-clamp-3">
            {snap.recentTitle ||
              scopeLabel ||
              "Pick up a vault file or a syllabus unit."}
          </p>
          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1">
            {recentHref ? (
              <AppLink
                href={recentHref}
                className="text-xs font-medium hover:underline underline-offset-4"
              >
                Last file
              </AppLink>
            ) : null}
            <AppLink
              href={`/syllabus?${qs}`}
              className="text-xs font-medium text-muted hover:text-foreground hover:underline underline-offset-4"
            >
              Syllabus
            </AppLink>
          </div>
        </section>

        <form
          onSubmit={ask}
          className="lg:col-span-4 bg-card p-4 sm:p-5 flex flex-col gap-3 min-h-[9.5rem]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Ask AI
          </p>
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={`Ask about ${branch} sem ${semester}`}
            className="h-10 px-3 rounded-md border border-border bg-background text-sm outline-none focus:border-border-strong"
          />
          <button
            type="submit"
            className="mt-auto h-9 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90"
          >
            Ask
          </button>
        </form>

        {/* Academic graph */}
        {(
          [
            { href: `/syllabus?${qs}`, label: "Syllabus", Icon: BookOpen },
            { href: `/resources?${qs}`, label: "Vault", Icon: Layers },
            { href: `/srs?${qs}`, label: "SRS", Icon: Brain },
            { href: `/gpa?${qs}`, label: "GPA", Icon: GraduationCap },
          ] as const
        ).map(({ href, label, Icon }) => (
          <AppLink
            key={label}
            href={href}
            className={`${TILE} lg:col-span-3`}
          >
            <Icon className="w-4 h-4 shrink-0 text-muted" />
            <span>{label}</span>
          </AppLink>
        ))}

        {/* Utilities dock — one height */}
        <form
          onSubmit={openCode}
          className={`${TILE} lg:col-span-3 gap-2`}
        >
          <ClipboardCopy className="w-4 h-4 shrink-0 text-muted" />
          <span className="sr-only">Lab clipboard</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Share code"
            className="min-w-0 flex-1 h-8 px-2 rounded-md border border-border bg-background text-xs font-mono outline-none"
            aria-label="Clipboard share code"
          />
        </form>
        {(
          [
            { href: "/visualize", label: "Visualize", Icon: Waypoints },
            { href: `/qa?${qs}`, label: "Doubt Board", Icon: HelpCircle },
            { href: "/campus", label: "Campus", Icon: Building2 },
          ] as const
        ).map(({ href, label, Icon }) => (
          <AppLink
            key={label}
            href={href}
            className={`${TILE} lg:col-span-3`}
          >
            <Icon className="w-4 h-4 shrink-0 text-muted" />
            <span>{label}</span>
          </AppLink>
        ))}
      </div>
    </div>
  );
}

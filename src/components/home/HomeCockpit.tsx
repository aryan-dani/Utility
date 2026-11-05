"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/auth";
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
  StickyNote,
} from "lucide-react";
import AppLink from "@/components/ui/AppLink";
import { useAcademicStore } from "@/store/academicStore";
import { workspaceQuery } from "@/lib/workspace";
import { getRecentResources } from "@/lib/recentResources";
import { getReadingProgress } from "@/lib/readingProgress";
import { loadPlannerMonth, savePlannerMonth, type LivePlan } from "@/lib/plannerLive";
import { readPlannerMonth, type PlannerTask } from "@/lib/plannerStorage";
import { getSoonestUpcomingExam, type UpcomingExam } from "@/lib/examCountdown";
import { localDateKey } from "@/lib/dateLocal";
import { startFocusMinutes } from "@/lib/focusTimer";
import { readStudyScope } from "@/lib/studyScope";
import { utilityFetch } from "@/lib/utilityServer";
import { EmptyState } from "@/components/ui";

const EMPTY_SNAP = JSON.stringify({
  recentTitle: "",
  recentId: "",
  recentPage: 0,
  scope: "",
});

function cockpitSnapshot(): string {
  const recent = getRecentResources()[0];
  const scope = readStudyScope();
  const page =
    (recent?.page && recent.page > 0 ? recent.page : null) ??
    (recent ? getReadingProgress(recent.id) : null) ??
    0;
  return JSON.stringify({
    recentTitle: recent?.title || "",
    recentId: recent?.id || "",
    recentPage: page,
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
  ) as { recentTitle: string; recentId: string; recentPage: number; scope: string };
  const scopeLabel = snap.scope;
  const todayKey = localDateKey();
  const [year, month] = todayKey.split("-").map(Number);
  const [plan, setPlan] = useState<LivePlan | null>(null);
  const [exam, setExam] = useState<UpcomingExam | null>(null);
  const [syncStale, setSyncStale] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        const local = readPlannerMonth(year, month);
        if (!cancelled) {
          setPlan(
            local
              ? {
                  id: local.meta.id,
                  title: local.meta.title,
                  isPublic: Boolean(local.meta.is_public),
                  data: local.data,
                  source: "local",
                }
              : {
                  title: "Study Plan",
                  isPublic: false,
                  data: {},
                  source: "local",
                },
          );
          setExam(getSoonestUpcomingExam());
        }
        return;
      }
      void (async () => {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const [current] = await Promise.all([
          loadPlannerMonth(year, month),
          loadPlannerMonth(next.getFullYear(), next.getMonth() + 1),
        ]);
        if (cancelled) return;
        setPlan(current);
        setExam(getSoonestUpcomingExam());
      })();
    });
    void utilityFetch("/health/ready", { public: true, timeoutMs: 4_000 }).then(
      async (res) => {
        if (cancelled || !res) return;
        const body = (await res.json().catch(() => null)) as {
          checks?: { sync?: string };
        } | null;
        if (!cancelled && body?.checks?.sync === "stale") setSyncStale(true);
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [year, month]);

  const openTasks = (plan?.data[todayKey] || []).filter((task) => !task.done).slice(0, 5);

  const completeTask = async (task: PlannerTask) => {
    if (!plan || savingId) return;
    const day = plan.data[todayKey] || [];
    const data = {
      ...plan.data,
      [todayKey]: day.map((row) =>
        row.id === task.id ? { ...row, done: true } : row,
      ),
    };
    const next = { ...plan, data };
    setPlan(next);
    setSavingId(task.id);
    const saved = await savePlannerMonth(year, month, next);
    setPlan(saved);
    setExam(getSoonestUpcomingExam());
    setSavingId(null);
  };

  const recentHref = snap.recentId
    ? `/resources?${qs}&view=${encodeURIComponent(snap.recentId)}${
        snap.recentPage > 0 ? `&page=${snap.recentPage}` : ""
      }`
    : "";
  const examLabel =
    exam == null
      ? ""
      : exam.daysUntil === 0
        ? "Exam today"
        : exam.daysUntil === 1
          ? "Exam tomorrow"
          : `Exam in ${exam.daysUntil} days`;

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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border text-xs font-medium tabular-nums hover:bg-surface"
                onClick={() => startFocusMinutes(25, scopeLabel || "Focus")}
              >
                <Timer className="w-3.5 h-3.5" />
                25m
              </button>
              <AppLink
                href="/notes"
                className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border text-xs font-medium hover:bg-surface"
              >
                <StickyNote className="w-3.5 h-3.5" />
                Notes
              </AppLink>
            </div>
          </div>
          {syncStale ? (
            <p className="text-xs text-muted leading-relaxed">
              Drive sync is behind. Search may miss new files.
            </p>
          ) : null}
          {openTasks.length === 0 ? (
            <EmptyState
              className="py-4 px-3"
              title="Nothing scheduled"
              description="Add a task for today, or start a 25 minute block."
              action={
                <AppLink
                  href={`/planner?${qs}`}
                  className="text-xs font-medium hover:underline underline-offset-4"
                >
                  Add today’s task
                </AppLink>
              }
            />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {openTasks.map((task) => (
                <li key={task.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    aria-label={`Mark done: ${task.text}`}
                    disabled={savingId === task.id}
                    onChange={() => void completeTask(task)}
                  />
                  <span className="truncate text-foreground">{task.text}</span>
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
          {snap.recentPage > 0 ? (
            <p className="text-xs text-muted">Page {snap.recentPage}</p>
          ) : null}
          {exam ? (
            <AppLink
              href={`/planner?${qs}`}
              className="text-xs font-medium hover:underline underline-offset-4"
              title={exam.text}
            >
              {examLabel}
              <span className="text-muted"> · {exam.text}</span>
            </AppLink>
          ) : null}
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

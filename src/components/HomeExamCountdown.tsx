"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import AppLink from "@/components/ui/AppLink";
import { CalendarCheck } from "lucide-react";
import { auth } from "@/lib/firebase/auth";
import { getSoonestUpcomingExam, type UpcomingExam } from "@/lib/examCountdown";
import { loadPlannerMonth } from "@/lib/plannerLive";

export default function HomeExamCountdown() {
  const [exam, setExam] = useState<UpcomingExam | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (!cancelled) setExam(getSoonestUpcomingExam());
        return;
      }
      void (async () => {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await Promise.all([
          loadPlannerMonth(now.getFullYear(), now.getMonth() + 1),
          loadPlannerMonth(next.getFullYear(), next.getMonth() + 1),
        ]);
        if (!cancelled) setExam(getSoonestUpcomingExam());
      })();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!exam) return null;

  const label =
    exam.daysUntil === 0
      ? "Exam today"
      : exam.daysUntil === 1
        ? "Exam tomorrow"
        : `Exam in ${exam.daysUntil} days`;

  return (
    <AppLink
      href="/planner"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-surface transition-colors"
      title={exam.text}
    >
      <CalendarCheck className="w-3.5 h-3.5 text-muted shrink-0" />
      <span>{label}</span>
      <span className="text-muted font-medium truncate max-w-[12rem]">
        · {exam.text}
      </span>
    </AppLink>
  );
}

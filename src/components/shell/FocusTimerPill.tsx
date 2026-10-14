"use client";

import { useEffect, useState } from "react";
import AppLink from "@/components/ui/AppLink";
import { Timer } from "lucide-react";
import {
  clearFocusRun,
  formatFocusClock,
  markFocusLogged,
  readFocusRun,
  subscribeFocusRun,
  type FocusRun,
} from "@/lib/focusTimer";

export function FocusTimerPill() {
  const [run, setRun] = useState<FocusRun | null>(null);
  const [clock, setClock] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const sync = () => setRun(readFocusRun());
    sync();
    return subscribeFocusRun(sync);
  }, []);

  useEffect(() => {
    if (!run) return;
    const tick = () => {
      const remaining = run.endsAt - Date.now();
      setClock(formatFocusClock(run.endsAt));
      if (remaining > 0) return;
      setFinished(true);
      if (run.mode === "work" && !run.logged) {
        markFocusLogged();
        void import("@/lib/activity").then(({ logActivity }) => {
          logActivity("focus_timer_completed", 1);
        });
      }
      clearFocusRun();
      setRun(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [run]);

  if (!run || finished) return null;

  return (
    <AppLink
      href="/timer"
      className="inline-flex items-center gap-1.5 h-8 max-w-[11rem] px-2 rounded-lg border border-border bg-card text-xs font-medium tabular-nums text-foreground"
      title={run.label}
    >
      <Timer className="w-3.5 h-3.5 shrink-0" />
      <span>{clock}</span>
      <span className="truncate text-muted">{run.label}</span>
    </AppLink>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  isUtilityServerLikelyDown,
  probeUtilityServer,
} from "@/lib/utilityServer";

/** Quiet banner when the home server is unreachable. Never a blank error. */
export function ServerStatusBanner() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (isUtilityServerLikelyDown()) {
        if (!cancelled) setDown(true);
        return;
      }
      const ok = await probeUtilityServer();
      if (!cancelled) setDown(!ok);
    };
    void run();
    const id = window.setInterval(run, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!down) return null;

  return (
    <div
      role="status"
      className="w-full border-b border-border bg-surface px-3 py-1.5 text-center text-xs text-muted"
    >
      Home server offline — using Drive previews and cached data. Ask AI answers
      without notes until it returns.
    </div>
  );
}

"use client";

import { useEffect } from "react";
import {
  campusFallbackUrl,
  ORIGIN_PROBE_OK_KEY,
  ORIGIN_PROBE_TIMEOUT_MS,
  shouldProbeCanonicalOrigin,
} from "@/lib/siteOrigins";

/**
 * Cached service workers on utilityos.tech can still run JS when the live
 * origin is blocked. One tiny /api/ok probe per tab session; on failure,
 * replace to the Vercel campus host. No polling.
 */
export function CampusOriginGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldProbeCanonicalOrigin(window.location.hostname)) return;

    try {
      if (sessionStorage.getItem(ORIGIN_PROBE_OK_KEY) === "1") return;
    } catch {
      /* private mode */
    }

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ORIGIN_PROBE_TIMEOUT_MS);

    fetch("/api/ok", { cache: "no-store", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("unreachable");
        try {
          sessionStorage.setItem(ORIGIN_PROBE_OK_KEY, "1");
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (controller.signal.aborted && !timedOut) return;
        window.location.replace(
          campusFallbackUrl(
            window.location.pathname,
            window.location.search,
            window.location.hash,
          ),
        );
      })
      .finally(() => {
        window.clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}

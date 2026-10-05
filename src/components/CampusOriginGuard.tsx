"use client";

import { useEffect } from "react";
import {
  markOriginHealthy,
  ORIGIN_PROBE_PATH,
  ORIGIN_PROBE_TIMEOUT_MS,
  requestCampusHop,
  shouldProbeCanonicalOrigin,
} from "@/lib/siteOrigins";

/** True when this document was fetched over the network (not SW / disk cache). */
function documentCameFromNetwork(): boolean {
  try {
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return true;
    // transferSize 0 with a decoded body is typical of Cache API / bfcache.
    if (nav.transferSize === 0 && nav.decodedBodySize > 0) return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Cached service workers on utilityos.tech can still run JS when the live
 * origin is blocked. Probe static /ok.txt on every full load of the custom
 * domain. Hop on a definite failure, or on a slow probe only when this
 * document itself was served from cache (SW still alive on a blocked host).
 */
export function CampusOriginGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldProbeCanonicalOrigin(window.location.hostname)) return;

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ORIGIN_PROBE_TIMEOUT_MS);

    fetch(ORIGIN_PROBE_PATH, { cache: "no-store", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("unreachable");
        markOriginHealthy();
      })
      .catch(() => {
        if (cancelled) return;
        // Unmount abort — never hop.
        if (controller.signal.aborted && !timedOut) return;
        // Slow probe while the page already came from the network — stay put.
        if (timedOut && documentCameFromNetwork()) return;
        requestCampusHop();
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

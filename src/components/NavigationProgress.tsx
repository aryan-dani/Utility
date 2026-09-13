"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export const NAV_PROGRESS_EVENT = "utility:nav-start";

/** Call before router.push / Link navigations that fetch server data. */
export function startNavigationProgress() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAV_PROGRESS_EVENT));
}

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const isFirstRoute = useRef(true);

  const clearTimers = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (finishRef.current) {
      clearTimeout(finishRef.current);
      finishRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setActive(true);
    setWidth(12);
    trickleRef.current = setInterval(() => {
      setWidth((w) => {
        if (w >= 88) return w;
        const step = w < 40 ? 8 : w < 70 ? 4 : 1.5;
        return Math.min(88, w + step);
      });
    }, 200);
  }, [clearTimers]);

  useLayoutEffect(() => {
    if (isFirstRoute.current) {
      isFirstRoute.current = false;
      return;
    }
    clearTimers();
    setWidth(100);
    finishRef.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 220);
  }, [routeKey, clearTimers]);

  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(NAV_PROGRESS_EVENT, onStart);

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
        const currentKey = `${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`;
        if (nextKey === currentKey) return;
        start();
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener(NAV_PROGRESS_EVENT, onStart);
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, [start, clearTimers]);

  if (!active && width === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-[2.5px]"
      aria-hidden
    >
      <div
        className="h-full bg-foreground origin-left transition-[width,opacity] duration-[var(--dur-base)] ease-[var(--ease-out-premium)] shadow-[0_0_8px_rgb(var(--foreground)/0.35)]"
        style={{
          width: `${width}%`,
          opacity: active || width > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}

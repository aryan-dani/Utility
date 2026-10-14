"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { campusFallbackUrl, isCanonicalHost } from "@/lib/siteOrigins";

const DISMISS_KEY = "utility-campus-pill-dismissed";
const EVENT = "utility-campus-pill";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  return () => window.removeEventListener(EVENT, onStoreChange);
}

function campusPillVisible(): boolean {
  if (!isCanonicalHost(window.location.hostname)) return false;
  return localStorage.getItem(DISMISS_KEY) !== "1";
}

export function CampusMirrorPill() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const visible = useSyncExternalStore(subscribe, campusPillVisible, () => false);

  if (!visible) return null;

  const search = searchParams.toString();
  const href = campusFallbackUrl(pathname, search ? `?${search}` : "");

  return (
    <span className="inline-flex items-center gap-1 h-8 pl-2 pr-1 rounded-lg border border-border bg-card text-2xs text-muted">
      <a href={href} className="font-medium text-foreground hover:underline">
        Campus mirror
      </a>
      <button
        type="button"
        className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-surface"
        aria-label="Dismiss campus mirror"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          window.dispatchEvent(new Event(EVENT));
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

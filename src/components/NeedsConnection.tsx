"use client";

import { useSyncExternalStore } from "react";
import { ErrorState } from "@/components/ui/States";

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

/** Client-only online flag; SSR and first paint assume online to avoid mismatch. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

const DEFAULT_DESCRIPTION =
  "This part of Utility needs the internet. Planner, Timer, GPA, SRS, and Syllabus still work offline.";

export function NeedsConnection({
  description = DEFAULT_DESCRIPTION,
  onRetry,
  className,
}: {
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <ErrorState
      className={className}
      title="Needs a connection"
      description={description}
      onRetry={onRetry}
    />
  );
}

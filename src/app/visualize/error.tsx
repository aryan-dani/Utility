"use client";

import { ErrorState } from "@/components/ui";

export default function VisualizeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 w-full max-w-lg mx-auto page-gutter py-16">
      <ErrorState
        title="Visualizer failed to load"
        description={error.message || "Something went wrong."}
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}

"use client";

import { ErrorState } from "@/components/ui";

export default function AskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-shell max-w-lg">
      <ErrorState
        title="Ask AI failed to load"
        description={error.message || "Something went wrong."}
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}

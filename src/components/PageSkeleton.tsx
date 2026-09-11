export default function PageSkeleton({
  variant = "list",
}: {
  variant?: "list" | "split" | "simple";
}) {
  return (
    <div
      className="flex-1 w-full max-w-7xl mx-auto page-gutter py-8 min-h-[60vh]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
    >
      {variant === "simple" ? (
        <>
          <div className="skeleton h-8 w-48 rounded-lg mb-3" />
          <div className="skeleton h-4 w-72 rounded-md mb-10" />
          <div className="skeleton-stack space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-full rounded-xl" />
            ))}
          </div>
        </>
      ) : variant === "split" ? (
        <>
          <div className="skeleton h-8 w-56 rounded-lg mb-2" />
          <div className="skeleton h-4 w-64 rounded-md mb-8" />
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="w-full lg:w-60 shrink-0 border border-border rounded-xl bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="skeleton h-3 w-20 rounded" />
              </div>
              <div className="skeleton-stack p-2 space-y-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-full rounded-lg" />
                ))}
              </div>
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="skeleton h-7 w-40 rounded-lg" />
              <div className="skeleton h-10 w-full rounded-xl" />
              <div className="skeleton-stack grid gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-20 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="skeleton h-8 w-48 rounded-lg mb-2" />
          <div className="skeleton h-4 w-80 rounded-md mb-8" />
          <div className="skeleton h-3 w-full rounded-full mb-8 max-w-xl" />
          <div className="skeleton-stack space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[72px] w-full rounded-2xl" />
            ))}
          </div>
        </>
      )}

      <div className="mt-10 flex items-center justify-center gap-2.5 text-muted">
        <span className="loading-orb" aria-hidden />
        <p className="text-xs font-medium tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

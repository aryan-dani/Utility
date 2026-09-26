import CommunityClient from "./CommunityClient";
import { Suspense } from "react";

export const revalidate = 86400;

export default function CommunityPage() {
  return (
    <Suspense fallback={<CommunityLoading />}>
      <CommunityClient initialDecks={[]} />
    </Suspense>
  );
}

function CommunityLoading() {
  return (
    <div
      className="flex flex-col justify-center items-center gap-3 py-40 min-h-[80vh] w-full"
      role="status"
      aria-live="polite"
    >
      <span className="loading-orb" aria-hidden />
      <p className="text-xs font-medium text-muted tracking-wide">Loading community…</p>
    </div>
  );
}

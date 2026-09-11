import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import PageSkeleton from "@/components/PageSkeleton";

const ResourcesClient = nextDynamic(() => import("@/components/ResourcesClient"), {
  loading: () => <PageSkeleton variant="split" />,
});

export const revalidate = 86400;
export const dynamic = "force-static";

export default function ResourcesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="split" />}>
      <ResourcesClient />
    </Suspense>
  );
}

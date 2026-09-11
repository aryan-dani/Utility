import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import PageSkeleton from "@/components/PageSkeleton";

const SyllabusClient = nextDynamic(() => import("@/components/SyllabusClient"), {
  loading: () => <PageSkeleton variant="list" />,
});

export const revalidate = 86400;
export const dynamic = "force-static";

export default function SyllabusPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SyllabusClient />
    </Suspense>
  );
}

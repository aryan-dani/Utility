import type { Metadata } from "next";
import { Suspense } from "react";
import PageSkeleton from "@/components/PageSkeleton";
import { getHomeCampusData, isIshaniConfigured } from "@/lib/ishani";
import { indexableMeta } from "@/lib/seo";
import LabsClient from "./LabsClient";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Campus labs",
  ...indexableMeta("/campus/labs"),
};

export default async function LabsPage() {
  const configured = isIshaniConfigured();
  const data = configured
    ? await getHomeCampusData()
    : { staff: [], infrastructure: [] };

  return (
    <Suspense fallback={<PageSkeleton variant="simple" />}>
      <LabsClient
        initialLabs={data.infrastructure}
        configured={configured}
      />
    </Suspense>
  );
}

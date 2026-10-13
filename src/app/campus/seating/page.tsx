import type { Metadata } from "next";
import { Suspense } from "react";
import PageSkeleton from "@/components/PageSkeleton";
import { getFacultySeating, isIshaniConfigured } from "@/lib/ishani";
import { indexableMeta } from "@/lib/seo";
import SeatingClient from "./SeatingClient";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Faculty seating",
  ...indexableMeta("/campus/seating"),
};

export default async function FacultySeatingPage() {
  const configured = isIshaniConfigured();
  const seating = configured ? await getFacultySeating() : [];

  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SeatingClient initialSeating={seating} configured={configured} />
    </Suspense>
  );
}

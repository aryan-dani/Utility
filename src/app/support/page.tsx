import type { Metadata } from "next";
import SupportClient from "./SupportClient";
import { PageHeader } from "@/components/ui";
import { indexableMeta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Support",
  ...indexableMeta("/support"),
};

export default function SupportPage() {
  return (
    <div className="flex-1 w-full">
      <div className="page-shell max-w-3xl">
        <PageHeader
          className="mb-14"
          size="hero"
          eyebrow="Utility"
          title="Support the project"
          description="Optional. If this workspace helped your semester, a small UPI contribution keeps hosting and updates going."
        />

        <SupportClient />
      </div>
    </div>
  );
}

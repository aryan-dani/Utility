import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Browse notes, presentations, labs, and PYQs organized by branch and semester.",
  robots: PRIVATE_ROBOTS,
};

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

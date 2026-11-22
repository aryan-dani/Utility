import type { Metadata } from "next";
import { indexableMeta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Syllabus",
  ...indexableMeta("/syllabus"),
};

export default function SyllabusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

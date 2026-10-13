import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Syllabus",
  description: "Track course syllabus modules and schedule study blocks.",
  robots: PRIVATE_ROBOTS,
};

export default function SyllabusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "GPA Calculator",
  description: "Calculate SGPA and project CGPA across semesters.",
  robots: PRIVATE_ROBOTS,
};

export default function GpaLayout({ children }: { children: React.ReactNode }) {
  return children;
}

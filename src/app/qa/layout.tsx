import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Doubt Board",
  description:
    "Ask and answer questions about paper-format problems, syllabus scope, and share handwritten solutions with peers.",
  robots: PRIVATE_ROBOTS,
};

export default function QALayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

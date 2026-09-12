import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doubt Board",
  description:
    "Ask and answer questions about paper-format problems, syllabus scope, and share handwritten solutions with peers.",
};

export default function QALayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

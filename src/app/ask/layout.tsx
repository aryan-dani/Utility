import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Ask AI",
  description: "RAG-powered academic assistant grounded in your course materials.",
  robots: PRIVATE_ROBOTS,
};

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return children;
}

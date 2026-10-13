import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Study Planner",
  description: "Collaborative monthly planner for assignments and study sessions.",
  robots: PRIVATE_ROBOTS,
};

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

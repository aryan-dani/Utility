import type { Metadata } from "next";
import { indexableMeta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Focus timer",
  ...indexableMeta("/timer"),
};

export default function TimerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";
import { indexableMeta } from "@/lib/seo";

export const metadata: Metadata = {
  ...indexableMeta("/visualize"),
  title: "Algorithm visualizer",
  description:
    "Step through BFS, DFS, A*, N-Queens, and more — free educational visualizers on Utility OS.",
};

export default function VisualizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

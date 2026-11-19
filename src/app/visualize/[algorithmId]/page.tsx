import { notFound } from "next/navigation";
import { getAlgorithm } from "@/lib/visualize/catalog";
import { VisualizerWorkspace } from "@/components/visualize/VisualizerWorkspace";
import { absoluteUrl } from "@/lib/seo";

export function generateStaticParams() {
  return [
    { algorithmId: "bfs" },
    { algorithmId: "dfs" },
    { algorithmId: "ucs" },
    { algorithmId: "greedy-bfs" },
    { algorithmId: "a-star" },
    { algorithmId: "hill-climbing" },
    { algorithmId: "genetic-algorithm" },
    { algorithmId: "minimax" },
    { algorithmId: "alpha-beta" },
    { algorithmId: "n-queens" },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ algorithmId: string }>;
}) {
  const { algorithmId } = await params;
  const algorithm = getAlgorithm(algorithmId);
  return {
    title: algorithm ? algorithm.name : "Visualizer",
    description: algorithm?.description,
    alternates: {
      canonical: algorithm
        ? absoluteUrl(`/visualize/${algorithmId}`)
        : absoluteUrl("/visualize"),
    },
  };
}

export default async function VisualizerPage({
  params,
}: {
  params: Promise<{ algorithmId: string }>;
}) {
  const { algorithmId } = await params;
  const algorithm = getAlgorithm(algorithmId);
  if (!algorithm) notFound();

  return <VisualizerWorkspace algorithm={algorithm} />;
}

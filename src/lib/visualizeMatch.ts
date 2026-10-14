const MATCHES: Array<{ id: string; needles: string[] }> = [
  { id: "bfs", needles: ["breadth-first", "breadth first", " bfs"] },
  { id: "dfs", needles: ["depth-first", "depth first", " dfs"] },
  { id: "ucs", needles: ["uniform cost", "uniform-cost"] },
  { id: "a-star", needles: ["a*", "a-star", "a star", "astar"] },
  { id: "hill-climbing", needles: ["hill climbing", "hill-climbing"] },
  { id: "genetic-algorithm", needles: ["genetic algorithm"] },
  { id: "minimax", needles: ["minimax", "mini-max"] },
  { id: "n-queens", needles: ["n-queens", "n queens", "8-queens", "8 queens"] },
];

/** Return a visualizer id when a syllabus line names an algorithm we can play. */
export function matchVisualizer(text: string): string | null {
  const hay = ` ${text.toLowerCase()} `;
  for (const entry of MATCHES) {
    if (entry.needles.some((needle) => hay.includes(needle))) return entry.id;
  }
  return null;
}

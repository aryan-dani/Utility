/** Parent-child search tree for BFS/DFS/UCS/Greedy/A* (not Minimax game trees). */

export interface SearchTreeNodeDef {
  id: string;
  label: string;
  parentId: string | null;
  /** Edge cost from parent (0 for root). */
  edgeCost: number;
  /** Textbook h(n) printed on the diagram. */
  hPrinted: number;
  children: string[];
}

export interface SearchTreeGraph {
  rootId: string;
  goalId: string;
  nodes: Record<string, SearchTreeNodeDef>;
}

export interface SearchTreeRuntimeNode {
  id: string;
  label: string;
  parentId: string | null;
  edgeCost: number;
  hPrinted: number;
  children: string[];
  gCost: number;
  hCost: number;
  fCost: number;
}

export interface SearchTreeState {
  graph: SearchTreeGraph;
  nodes: Record<string, SearchTreeRuntimeNode>;
  startId: string;
  goalId: string;
  currentNodeId: string | null;
  frontierIds: string[];
  visitedIds: string[];
  pathIds: string[];
  consideredChildIds: string[];
}

export type TreeHeuristicMode =
  | "printed"
  | "zero"
  | "underestimate"
  | "overestimate";

export interface TreeLayoutNode {
  id: string;
  x: number;
  y: number;
  depth: number;
}

export interface TreeLayoutEdge {
  fromId: string;
  toId: string;
  cost: number;
}

export interface SearchTreeLayout {
  width: number;
  height: number;
  nodes: TreeLayoutNode[];
  edges: TreeLayoutEdge[];
}

type TreeBuilderNode = {
  label: string;
  edgeCost: number;
  hPrinted: number;
  children?: TreeBuilderNode[];
};

function buildFromNested(
  nested: TreeBuilderNode,
  goalLabel: string,
  idPrefix = "n",
): SearchTreeGraph {
  const nodes: Record<string, SearchTreeNodeDef> = {};
  let counter = 0;
  let goalId = "";

  function walk(
    spec: TreeBuilderNode,
    parentId: string | null,
  ): string {
    const id = `${idPrefix}${counter++}`;
    const children: string[] = [];

    nodes[id] = {
      id,
      label: spec.label,
      parentId,
      edgeCost: parentId === null ? 0 : spec.edgeCost,
      hPrinted: spec.hPrinted,
      children,
    };

    if (spec.label === goalLabel) {
      goalId = id;
    }

    for (const child of spec.children ?? []) {
      const childId = walk(child, id);
      children.push(childId);
    }

    return id;
  }

  const rootId = walk(nested, null);
  if (!goalId) {
    goalId = rootId;
  }

  return { rootId, goalId, nodes };
}

/** Fixed lecture-style tree: S at root, G deep on one branch, mixed costs. */
export function createCourseSearchTree(): SearchTreeGraph {
  return buildFromNested(
    {
      label: "S",
      edgeCost: 0,
      hPrinted: 8,
      children: [
        {
          label: "A",
          edgeCost: 2,
          hPrinted: 6,
          children: [
            {
              label: "D",
              edgeCost: 1,
              hPrinted: 4,
              children: [
                { label: "G", edgeCost: 3, hPrinted: 0 },
                { label: "H", edgeCost: 5, hPrinted: 2 },
              ],
            },
            {
              label: "E",
              edgeCost: 4,
              hPrinted: 5,
              children: [{ label: "I", edgeCost: 2, hPrinted: 3 }],
            },
          ],
        },
        {
          label: "B",
          edgeCost: 1,
          hPrinted: 7,
          children: [
            {
              label: "F",
              edgeCost: 2,
              hPrinted: 3,
              children: [{ label: "J", edgeCost: 1, hPrinted: 1 }],
            },
          ],
        },
        {
          label: "C",
          edgeCost: 3,
          hPrinted: 5,
          children: [{ label: "K", edgeCost: 2, hPrinted: 4 }],
        },
      ],
    },
    "G",
    "c",
  );
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Small random tree for replay (branching 2–3, depth 3–4). */
export function createRandomSearchTree(): SearchTreeGraph {
  const targetDepth = randomInt(3, 4);
  let counter = 0;
  const nodes: Record<string, SearchTreeNodeDef> = {};
  let goalId = "";

  function makeNode(
    label: string,
    parentId: string | null,
    edgeCost: number,
    hPrinted: number,
  ): string {
    const id = `r${counter++}`;
    nodes[id] = {
      id,
      label,
      parentId,
      edgeCost,
      hPrinted,
      children: [],
    };
    return id;
  }

  const rootId = makeNode("S", null, 0, targetDepth + 2);
  const nonGoalLabels = "ABCDEFHIJKLMNOPQRTUVWXYZ";
  let labelCursor = 0;

  function expand(parentId: string, depth: number) {
    if (depth >= targetDepth) return;
    const branchCount = randomInt(2, 3);
    for (let i = 0; i < branchCount; i++) {
      const isGoal = depth === targetDepth - 1 && !goalId;
      const label = isGoal
        ? "G"
        : nonGoalLabels[labelCursor++ % nonGoalLabels.length];
      const edgeCost = randomInt(1, 4);
      const hPrinted = isGoal
        ? 0
        : Math.max(1, targetDepth - depth + randomInt(0, 2));
      const childId = makeNode(label, parentId, edgeCost, hPrinted);
      nodes[parentId].children.push(childId);
      if (isGoal) {
        goalId = childId;
      } else {
        expand(childId, depth + 1);
      }
    }
  }

  expand(rootId, 0);

  if (!goalId) {
    const leaves = Object.values(nodes).filter((n) => n.children.length === 0);
    const pick = leaves[randomInt(0, leaves.length - 1)];
    pick.label = "G";
    pick.hPrinted = 0;
    goalId = pick.id;
  }

  return { rootId, goalId, nodes };
}

export function cloneSearchTreeGraph(graph: SearchTreeGraph): SearchTreeGraph {
  const nodes: Record<string, SearchTreeNodeDef> = {};
  for (const [id, node] of Object.entries(graph.nodes)) {
    nodes[id] = {
      ...node,
      children: [...node.children],
    };
  }
  return {
    rootId: graph.rootId,
    goalId: graph.goalId,
    nodes,
  };
}

export function setSearchTreeGoal(
  graph: SearchTreeGraph,
  newGoalId: string,
): SearchTreeGraph {
  if (newGoalId === graph.rootId || !graph.nodes[newGoalId]) {
    return graph;
  }
  const next = cloneSearchTreeGraph(graph);
  for (const node of Object.values(next.nodes)) {
    if (node.label === "G" && node.id !== newGoalId) {
      node.label = node.id.replace(/^[cr]/, "").toUpperCase() || "N";
    }
  }
  next.nodes[newGoalId].label = "G";
  next.nodes[newGoalId].hPrinted = 0;
  next.goalId = newGoalId;
  return next;
}

export function createInitialSearchTreeState(
  graph: SearchTreeGraph,
): SearchTreeState {
  const nodes: Record<string, SearchTreeRuntimeNode> = {};
  for (const [id, def] of Object.entries(graph.nodes)) {
    nodes[id] = {
      ...def,
      children: [...def.children],
      gCost: Infinity,
      hCost: Infinity,
      fCost: Infinity,
    };
  }
  return {
    graph,
    nodes,
    startId: graph.rootId,
    goalId: graph.goalId,
    currentNodeId: null,
    frontierIds: [],
    visitedIds: [],
    pathIds: [],
    consideredChildIds: [],
  };
}

export function resolveTreeHeuristic(
  mode: TreeHeuristicMode,
  node: SearchTreeRuntimeNode,
  goalId: string,
  _graph: SearchTreeGraph,
): number {
  if (node.id === goalId) return 0;
  switch (mode) {
    case "printed":
      return node.hPrinted;
    case "zero":
      return 0;
    case "underestimate":
      return Math.max(0, Math.floor(node.hPrinted * 0.6));
    case "overestimate":
      return node.hPrinted + 3;
    default:
      return node.hPrinted;
  }
}

/** Level-order layout for SVG rendering. */
export function layoutSearchTree(graph: SearchTreeGraph): SearchTreeLayout {
  const NODE_W = 72;
  const NODE_H = 56;
  const H_GAP = 28;
  const V_GAP = 72;
  const MARGIN = 32;

  const depths = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [{ id: graph.rootId, depth: 0 }];
  let maxDepth = 0;

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    depths.set(id, depth);
    maxDepth = Math.max(maxDepth, depth);
    for (const childId of graph.nodes[id]?.children ?? []) {
      queue.push({ id: childId, depth: depth + 1 });
    }
  }

  const byDepth: string[][] = [];
  for (const [id, depth] of depths) {
    if (!byDepth[depth]) byDepth[depth] = [];
    byDepth[depth].push(id);
  }

  const layoutNodes: TreeLayoutNode[] = [];
  for (let d = 0; d <= maxDepth; d++) {
    const row = byDepth[d] ?? [];
    row.forEach((id, index) => {
      layoutNodes.push({
        id,
        depth: d,
        x: MARGIN + index * (NODE_W + H_GAP) + NODE_W / 2,
        y: MARGIN + d * (NODE_H + V_GAP) + NODE_H / 2,
      });
    });
  }

  const maxRowWidth = Math.max(
    ...byDepth.map(
      (row) => row.length * NODE_W + Math.max(0, row.length - 1) * H_GAP,
    ),
    NODE_W,
  );

  const edges: TreeLayoutEdge[] = [];
  for (const node of Object.values(graph.nodes)) {
    for (const childId of node.children) {
      edges.push({
        fromId: node.id,
        toId: childId,
        cost: graph.nodes[childId]?.edgeCost ?? 0,
      });
    }
  }

  // Center each depth row within the widest row
  for (let d = 0; d <= maxDepth; d++) {
    const row = layoutNodes.filter((n) => n.depth === d);
    const rowWidth = row.length * NODE_W + (row.length - 1) * H_GAP;
    const offset = (maxRowWidth - rowWidth) / 2 + MARGIN;
    row.forEach((n, i) => {
      n.x = offset + i * (NODE_W + H_GAP) + NODE_W / 2;
    });
  }

  const width = maxRowWidth + MARGIN * 2;
  const height = MARGIN * 2 + (maxDepth + 1) * NODE_H + maxDepth * V_GAP;

  return { width, height, nodes: layoutNodes, edges };
}

export function getSearchTreePath(
  nodes: Record<string, SearchTreeRuntimeNode>,
  goalId: string,
): string[] {
  const path: string[] = [];
  let current: string | null = goalId;
  while (current) {
    path.unshift(current);
    current = nodes[current]?.parentId ?? null;
  }
  return path;
}

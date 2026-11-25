import { Position, GridNode, GridState, cloneGrid } from "@/lib/visualize/grid";
import { AlgorithmStep } from "@/lib/visualize/types";
import { MinHeap } from "@/lib/visualize/priorityQueue";
import { manhattanDistance, HeuristicFunction } from "@/lib/visualize/heuristics";

export function generateGreedyBfsSteps(
  initialGrid: GridNode[][],
  startPos: Position,
  goalPos: Position,
  heuristic: HeuristicFunction = manhattanDistance,
): AlgorithmStep<GridState>[] {
  const steps: AlgorithmStep<GridState>[] = [];
  let stepCounter = 0;

  const workingGrid = cloneGrid(initialGrid);
  const startNode = workingGrid[startPos.row][startPos.col];
  startNode.gCost = 0;
  startNode.hCost = heuristic(startPos, goalPos);
  startNode.fCost = startNode.hCost;

  const openSet = new MinHeap<GridNode>((a, b) => a.hCost - b.hCost);

  const openSetPositions: Position[] = [];
  const closedSetPositions: Position[] = [];
  const closedSetKey = new Set<string>();

  openSet.push({ ...startNode });
  openSetPositions.push({ row: startPos.row, col: startPos.col });

  steps.push({
    stepIndex: stepCounter++,
    description: `Initialized Greedy Best-First Search. Heuristic h(n) = ${startNode.hCost.toFixed(2)}.`,
    highlightedLine: 1,
    state: {
      grid: cloneGrid(workingGrid),
      startPos: { ...startPos },
      goalPos: { ...goalPos },
      currentNode: { ...startPos },
      openSetPositions: [...openSetPositions],
      closedSetPositions: [...closedSetPositions],
      pathPositions: [],
      consideredNeighbors: [],
    },
    metrics: {
      nodesExplored: 0,
      frontierSize: openSetPositions.length,
      pathCost: 0,
      totalSteps: 0,
    },
  });

  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  while (!openSet.isEmpty()) {
    const current = openSet.pop()!;
    const currentKey = `${current.row},${current.col}`;
    const bestKnownNode = workingGrid[current.row][current.col];

    if (closedSetKey.has(currentKey) || current.gCost > bestKnownNode.gCost) {
      continue;
    }

    const currentPos = { row: current.row, col: current.col };

    const openIdx = openSetPositions.findIndex(
      (p) => p.row === current.row && p.col === current.col,
    );
    if (openIdx !== -1) {
      openSetPositions.splice(openIdx, 1);
    }

    if (current.row === goalPos.row && current.col === goalPos.col) {
      const pathPositions: Position[] = [];
      let curr: GridNode | null = bestKnownNode;
      while (curr !== null) {
        pathPositions.unshift({ row: curr.row, col: curr.col });
        if (curr.parent) {
          curr = workingGrid[curr.parent.row][curr.parent.col];
        } else {
          curr = null;
        }
      }

      const finalPathCost = current.gCost;

      steps.push({
        stepIndex: stepCounter++,
        description: `Goal reached at (${goalPos.row}, ${goalPos.col})! Path reconstructed with cost ${finalPathCost.toFixed(2)} (not guaranteed optimal).`,
        highlightedLine: 3,
        state: {
          grid: cloneGrid(workingGrid),
          startPos: { ...startPos },
          goalPos: { ...goalPos },
          currentNode: currentPos,
          openSetPositions: [...openSetPositions],
          closedSetPositions: [...closedSetPositions, currentPos],
          pathPositions,
          consideredNeighbors: [],
        },
        metrics: {
          nodesExplored: closedSetPositions.length + 1,
          frontierSize: openSetPositions.length,
          pathCost: finalPathCost,
          totalSteps: stepCounter,
        },
      });

      steps.forEach((s) => (s.metrics.totalSteps = steps.length));
      return steps;
    }

    closedSetPositions.push(currentPos);
    closedSetKey.add(currentKey);

    const consideredNeighbors: Position[] = [];

    for (const dir of directions) {
      const neighborRow = current.row + dir.row;
      const neighborCol = current.col + dir.col;

      if (
        neighborRow < 0 ||
        neighborRow >= workingGrid.length ||
        neighborCol < 0 ||
        neighborCol >= workingGrid[0].length
      ) {
        continue;
      }

      const neighbor = workingGrid[neighborRow][neighborCol];

      if (neighbor.type === "wall" || closedSetKey.has(`${neighborRow},${neighborCol}`)) {
        continue;
      }

      consideredNeighbors.push({ row: neighborRow, col: neighborCol });

      const tentativeGCost = current.gCost + 1;

      if (tentativeGCost < neighbor.gCost) {
        neighbor.parent = { row: current.row, col: current.col };
        neighbor.gCost = tentativeGCost;
        neighbor.hCost = heuristic({ row: neighborRow, col: neighborCol }, goalPos);
        neighbor.fCost = neighbor.hCost;

        openSet.push({ ...neighbor });

        const inOpenSet = openSetPositions.some(
          (p) => p.row === neighborRow && p.col === neighborCol,
        );

        if (!inOpenSet) {
          openSetPositions.push({ row: neighborRow, col: neighborCol });
        }
      }
    }

    steps.push({
      stepIndex: stepCounter++,
      description: `Evaluating node (${current.row}, ${current.col}) with greedy priority h(n)=${current.hCost.toFixed(2)}.`,
      highlightedLine: 2,
      state: {
        grid: cloneGrid(workingGrid),
        startPos: { ...startPos },
        goalPos: { ...goalPos },
        currentNode: currentPos,
        openSetPositions: [...openSetPositions],
        closedSetPositions: [...closedSetPositions],
        pathPositions: [],
        consideredNeighbors,
      },
      metrics: {
        nodesExplored: closedSetPositions.length,
        frontierSize: openSetPositions.length,
        pathCost: current.gCost,
        totalSteps: 0,
      },
    });
  }

  steps.push({
    stepIndex: stepCounter++,
    description: "Search completed. No path exists from start to goal.",
    highlightedLine: 8,
    state: {
      grid: cloneGrid(workingGrid),
      startPos: { ...startPos },
      goalPos: { ...goalPos },
      currentNode: null,
      openSetPositions: [],
      closedSetPositions: [...closedSetPositions],
      pathPositions: [],
      consideredNeighbors: [],
    },
    metrics: {
      nodesExplored: closedSetPositions.length,
      frontierSize: 0,
      pathCost: 0,
      totalSteps: stepCounter,
    },
  });

  steps.forEach((s) => (s.metrics.totalSteps = steps.length));
  return steps;
}

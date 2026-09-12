import { describe, expect, it } from "vitest";
import { createInitialGrid } from "@/lib/visualize/grid";
import { generateBfsSteps } from "@/lib/visualize/engines/bfs";
import { generateDfsSteps } from "@/lib/visualize/engines/dfs";
import { generateAStarSteps } from "@/lib/visualize/engines/aStar";

function hasStartAndGoal(
  path: { row: number; col: number }[],
  start: { row: number; col: number },
  goal: { row: number; col: number },
) {
  return (
    path.some((p) => p.row === start.row && p.col === start.col) &&
    path.some((p) => p.row === goal.row && p.col === goal.col)
  );
}

function failedToFindPath(last: {
  description: string;
  state: { pathPositions: { row: number; col: number }[] };
}) {
  return (
    last.state.pathPositions.length === 0 ||
    /no path|fail/i.test(last.description)
  );
}

describe("pathfinding engines", () => {
  const start = { row: 0, col: 0 };
  const goal = { row: 0, col: 2 };

  it("BFS finds a path including start and goal on open 3x3", () => {
    const grid = createInitialGrid(3, 3, start, goal);
    const steps = generateBfsSteps(grid, start, goal);
    const last = steps[steps.length - 1];
    expect(hasStartAndGoal(last.state.pathPositions, start, goal)).toBe(true);
  });

  it("DFS finds a path including start and goal on open 3x3", () => {
    const grid = createInitialGrid(3, 3, start, goal);
    const steps = generateDfsSteps(grid, start, goal);
    const last = steps[steps.length - 1];
    expect(hasStartAndGoal(last.state.pathPositions, start, goal)).toBe(true);
  });

  it("A* finds a path including start and goal on open 3x3", () => {
    const grid = createInitialGrid(3, 3, start, goal);
    const steps = generateAStarSteps(grid, start, goal);
    const last = steps[steps.length - 1];
    expect(hasStartAndGoal(last.state.pathPositions, start, goal)).toBe(true);
  });

  it("reports failure when the goal is fully walled off", () => {
    // Goal (0,2) neighbors are only (0,1) and (1,2) - wall both.
    const wallOff = [
      { row: 0, col: 1 },
      { row: 1, col: 2 },
    ];
    const grid = createInitialGrid(3, 3, start, goal, wallOff);

    for (const generate of [
      generateBfsSteps,
      generateDfsSteps,
      generateAStarSteps,
    ]) {
      const steps = generate(grid, start, goal);
      const last = steps[steps.length - 1];
      expect(failedToFindPath(last)).toBe(true);
    }
  });
});

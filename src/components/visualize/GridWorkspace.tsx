"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { GridCanvas } from "@/components/visualize/GridCanvas";
import { PlaybackToolbar } from "@/components/visualize/PlaybackToolbar";
import { StepExplanation } from "@/components/visualize/StepExplanation";
import { MetricsPanel } from "@/components/visualize/MetricsPanel";
import { GhostAction, PrimaryAction } from "@/components/visualize/LessonChrome";
import { WorkspaceShell } from "@/components/visualize/WorkspaceShell";
import { HeuristicPicker } from "@/components/visualize/HeuristicPicker";
import {
  Position,
  GridState,
  SavedGridData,
  createInitialGrid,
  DEFAULT_START,
  DEFAULT_GOAL,
} from "@/lib/visualize/grid";
import { generateAStarSteps } from "@/lib/visualize/engines/aStar";
import { generateBfsSteps } from "@/lib/visualize/engines/bfs";
import { generateDfsSteps } from "@/lib/visualize/engines/dfs";
import { generateUcsSteps } from "@/lib/visualize/engines/ucs";
import { generateGreedyBfsSteps } from "@/lib/visualize/engines/greedyBfs";
import {
  chebyshevDistance,
  euclideanDistance,
  HeuristicFunction,
  manhattanDistance,
} from "@/lib/visualize/heuristics";
import { useVisualizerPlayback } from "@/lib/visualize/useVisualizerPlayback";
import { usePendingPlay } from "@/lib/visualize/usePendingPlay";
import { AlgorithmStep } from "@/lib/visualize/types";
import { saveGrid } from "@/lib/visualize/client";
import { auth } from "@/lib/firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

const GRID_PSEUDOCODE = {
  bfs: [
    { line: 1, code: "1. Put Start in a queue" },
    { line: 2, code: "2. Take the oldest cell from the queue" },
    { line: 3, code: "3. If it is Goal, walk back along parents. Done." },
    { line: 4, code: "4. Else add its unseen neighbors to the queue" },
    { line: 5, code: "5. Repeat until the queue is empty" },
    { line: 6, code: "6. Empty queue and no Goal means no path" },
    { line: 7, code: "7. Search finished without a path" },
    { line: 8, code: "8. Search completed" },
  ],
  dfs: [
    { line: 1, code: "1. Put Start on a stack" },
    { line: 2, code: "2. Take the newest cell from the stack" },
    { line: 3, code: "3. If it is Goal, walk back along parents" },
    { line: 4, code: "4. Else push unseen neighbors" },
    { line: 5, code: "5. Repeat until the stack is empty" },
    { line: 6, code: "6. Empty stack and no Goal means no path" },
    { line: 7, code: "7. Search finished without a path" },
    { line: 8, code: "8. Search completed" },
  ],
  ucs: [
    { line: 1, code: "1. Put Start in a priority queue with cost 0" },
    { line: 2, code: "2. Take the cheapest cell so far" },
    { line: 3, code: "3. If it is Goal, that path is cheapest" },
    { line: 4, code: "4. Mark it finished" },
    { line: 5, code: "5. Neighbors cost = this cell + 1" },
    { line: 6, code: "6. If cheaper than known, update and reinsert" },
    { line: 7, code: "7. Repeat until the queue is empty" },
    { line: 8, code: "8. Search completed" },
  ],
  "greedy-bfs": [
    { line: 1, code: "1. Score Start by distance to Goal" },
    { line: 2, code: "2. Take the cell that looks closest to Goal" },
    { line: 3, code: "3. If it is Goal, walk back along parents" },
    { line: 4, code: "4. Mark it finished" },
    { line: 5, code: "5. Score each neighbor by distance to Goal" },
    { line: 6, code: "6. Insert unseen neighbors" },
    { line: 7, code: "7. Repeat until the queue is empty" },
    { line: 8, code: "8. Search completed (path may be long)" },
  ],
  "a-star": [
    { line: 1, code: "1. Score Start as walked 0 + guess to Goal" },
    { line: 2, code: "2. Take the cell with the best walked + guess" },
    { line: 3, code: "3. If it is Goal, that path is shortest" },
    { line: 4, code: "4. Mark it finished" },
    { line: 5, code: "5. Look at the four neighbors" },
    { line: 6, code: "6. walked = parent walked + 1" },
    { line: 7, code: "7. If cheaper, remember parent and new score" },
    { line: 8, code: "8. Repeat until Goal or nothing left" },
  ],
};

interface GridWorkspaceProps {
  algorithmId: string;
  initialGridData?: SavedGridData | null;
}

export type GridHeuristicId = "manhattan" | "euclidean" | "chebyshev";

const GRID_HEURISTICS: Record<GridHeuristicId, HeuristicFunction> = {
  manhattan: manhattanDistance,
  euclidean: euclideanDistance,
  chebyshev: chebyshevDistance,
};

const GRID_HEURISTIC_OPTIONS: { value: GridHeuristicId; label: string }[] = [
  { value: "manhattan", label: "Manhattan" },
  { value: "euclidean", label: "Euclidean" },
  { value: "chebyshev", label: "Chebyshev" },
];

export function GridWorkspace({
  algorithmId,
  initialGridData,
}: GridWorkspaceProps) {
  const rows = initialGridData?.rows || 12;
  const cols = initialGridData?.cols || 22;

  const [startPos, setStartPos] = useState<Position>(
    initialGridData?.startPos || DEFAULT_START,
  );
  const [goalPos, setGoalPos] = useState<Position>(
    initialGridData?.goalPos || DEFAULT_GOAL,
  );
  const [walls, setWalls] = useState<Position[]>(
    initialGridData?.walls ?? [],
  );
  const [steps, setSteps] = useState<AlgorithmStep<GridState>[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [gridHeuristic, setGridHeuristic] = useState<GridHeuristicId>("manhattan");

  const showGridHeuristicPicker =
    algorithmId === "a-star" || algorithmId === "greedy-bfs";

  const playback = useVisualizerPlayback(steps, algorithmId);
  const { setPendingPlay } = usePendingPlay(steps, playback);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setSignedIn(!!user));
  }, []);

  const [prevInitialGrid, setPrevInitialGrid] = useState(initialGridData);
  if (initialGridData && prevInitialGrid !== initialGridData) {
    setPrevInitialGrid(initialGridData);
    setStartPos(initialGridData.startPos);
    setGoalPos(initialGridData.goalPos);
    setWalls(initialGridData.walls);
  }

  const editableGridState = useMemo<GridState>(() => {
    const grid = createInitialGrid(rows, cols, startPos, goalPos, walls);
    return {
      grid,
      startPos,
      goalPos,
      currentNode: null,
      openSetPositions: [],
      closedSetPositions: [],
      pathPositions: [],
      consideredNeighbors: [],
    };
  }, [rows, cols, startPos, goalPos, walls]);

  const activeGridState =
    hasGenerated && playback.currentStep
      ? playback.currentStep.state
      : editableGridState;

  const generateSteps = () => {
    const initialGrid = createInitialGrid(rows, cols, startPos, goalPos, walls);
    const h = GRID_HEURISTICS[gridHeuristic];
    if (algorithmId === "bfs") {
      return generateBfsSteps(initialGrid, startPos, goalPos);
    }
    if (algorithmId === "dfs") {
      return generateDfsSteps(initialGrid, startPos, goalPos);
    }
    if (algorithmId === "ucs") {
      return generateUcsSteps(initialGrid, startPos, goalPos);
    }
    if (algorithmId === "greedy-bfs") {
      return generateGreedyBfsSteps(initialGrid, startPos, goalPos, h);
    }
    return generateAStarSteps(initialGrid, startPos, goalPos, h);
  };

  const handleWatch = () => {
    setSteps(generateSteps());
    setHasGenerated(true);
    setPendingPlay(true);
  };

  const handleResetSearch = () => {
    playback.reset();
    setSteps([]);
    setHasGenerated(false);
    setPendingPlay(false);
  };

  const handleClearWalls = () => {
    playback.reset();
    setWalls([]);
    setSteps([]);
    setHasGenerated(false);
  };

  const handleResetEntireGrid = () => {
    playback.reset();
    setStartPos(DEFAULT_START);
    setGoalPos(DEFAULT_GOAL);
    setWalls([]);
    setSteps([]);
    setHasGenerated(false);
  };

  const handleSaveMaze = async () => {
    if (!signedIn) {
      setSaveMessage("Sign in to save this maze.");
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const gridData: SavedGridData = { startPos, goalPos, walls, rows, cols };
      await saveGrid("Saved maze", gridData);
      setSaveMessage("Saved. Open it later from Visualize progress.");
    } catch {
      setSaveMessage("Could not save the maze.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWall = useCallback(
    (pos: Position) => {
      if (hasGenerated) return;
      setWalls((prevWalls) => {
        const exists = prevWalls.some(
          (w) => w.row === pos.row && w.col === pos.col,
        );
        if (exists) {
          return prevWalls.filter(
            (w) => !(w.row === pos.row && w.col === pos.col),
          );
        }
        return [...prevWalls, pos];
      });
    },
    [hasGenerated],
  );

  const handleMoveStart = useCallback(
    (pos: Position) => {
      if (hasGenerated) return;
      setStartPos(pos);
    },
    [hasGenerated],
  );

  const handleMoveGoal = useCallback(
    (pos: Position) => {
      if (hasGenerated) return;
      setGoalPos(pos);
    },
    [hasGenerated],
  );

  const currentNode = playback.currentStep?.state.currentNode;
  const activeNode = currentNode
    ? playback.currentStep?.state.grid[currentNode.row]?.[currentNode.col]
    : null;
  const hasActiveNode = Boolean(activeNode && activeNode.gCost !== Infinity);
  const pseudocode =
    GRID_PSEUDOCODE[algorithmId as keyof typeof GRID_PSEUDOCODE] ??
    GRID_PSEUDOCODE["a-star"];

  return (
    <div className="w-full space-y-6">
      {!hasGenerated && showGridHeuristicPicker && (
        <HeuristicPicker
          value={gridHeuristic}
          options={GRID_HEURISTIC_OPTIONS}
          onChange={setGridHeuristic}
        />
      )}

      <WorkspaceShell
        stageLabel="Grid"
        hasGenerated={hasGenerated}
        playback={playback}
        happeningIdle="The run will narrate each move here."
        metricsSummary="Numbers from this step"
        dock={
          !hasGenerated ? (
            <div className="flex flex-wrap items-center justify-center gap-1">
              <PrimaryAction flat onClick={handleWatch}>
                Watch it run
              </PrimaryAction>
              <GhostAction
                onClick={handleClearWalls}
                disabled={walls.length === 0}
              >
                Clear walls
              </GhostAction>
              <GhostAction onClick={handleResetEntireGrid}>
                Reset grid
              </GhostAction>
              <GhostAction onClick={handleSaveMaze} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save maze"}
              </GhostAction>
            </div>
          ) : (
            <>
              <PlaybackToolbar playback={playback} />
              <GhostAction onClick={handleResetSearch}>
                Edit the maze
              </GhostAction>
            </>
          )
        }
        dockExtra={
          saveMessage ? (
            <p className="text-sm text-muted text-center">
              {saveMessage}{" "}
              {!signedIn && (
                <Link href="/login" className="underline text-foreground">
                  Sign in
                </Link>
              )}
            </p>
          ) : null
        }
        metricsContent={
          hasGenerated ? (
            <>
              <MetricsPanel
                metrics={playback.currentStep?.metrics ?? null}
                frontierLabel="Waiting to check"
                pathLabel="Steps on path"
              />
              {hasActiveNode && activeNode ? (
                <p className="text-sm text-muted mt-4 font-mono">
                  This cell ({activeNode.row}, {activeNode.col}): walked{" "}
                  {activeNode.gCost}
                  {activeNode.hCost !== Infinity
                    ? ` · guess ${activeNode.hCost.toFixed(1)} · total ${
                        activeNode.fCost === Infinity
                          ? "∞"
                          : activeNode.fCost.toFixed(1)
                      }`
                    : ""}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">Watch it run to see counts.</p>
          )
        }
        stepsContent={
          <StepExplanation
            step={playback.currentStep}
            emptyMessage="Run the search to highlight a line."
            pseudocode={pseudocode}
          />
        }
      >
        <GridCanvas
          gridState={activeGridState}
          onToggleWall={handleToggleWall}
          onMoveStart={handleMoveStart}
          onMoveGoal={handleMoveGoal}
          isInteractive={!hasGenerated}
          showRunLegend={hasGenerated}
        />
      </WorkspaceShell>
    </div>
  );
}

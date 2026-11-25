"use client";

import { memo, useMemo } from "react";
import {
  SearchTreeState,
  layoutSearchTree,
} from "@/lib/visualize/searchTree";

export interface SearchTreeCanvasProps {
  state: SearchTreeState;
  onSelectGoal?: (nodeId: string) => void;
  isInteractive?: boolean;
  showRunLegend?: boolean;
}

function SearchTreeCanvasInner({
  state,
  onSelectGoal,
  isInteractive = true,
  showRunLegend = false,
}: SearchTreeCanvasProps) {
  const layout = useMemo(
    () => layoutSearchTree(state.graph),
    [state.graph],
  );

  const posById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout.nodes],
  );

  const frontierSet = useMemo(
    () => new Set(state.frontierIds),
    [state.frontierIds],
  );
  const visitedSet = useMemo(
    () => new Set(state.visitedIds),
    [state.visitedIds],
  );
  const pathSet = useMemo(() => new Set(state.pathIds), [state.pathIds]);
  const consideredSet = useMemo(
    () => new Set(state.consideredChildIds),
    [state.consideredChildIds],
  );

  const nodeRadius = 26;

  return (
    <div className="w-full flex flex-col items-center gap-3 select-none">
      <p className="text-xs text-muted text-center">
        {isInteractive
          ? "Click any node except S to set it as Goal."
          : showRunLegend
            ? "Soft fill = waiting. Dark fill = checked. Bold ring = current. Trail = path."
            : null}
      </p>

      <div className="w-full overflow-hidden flex justify-center">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="w-full max-w-3xl h-auto"
          role="img"
          aria-label="Search tree"
        >
          {layout.edges.map((edge) => {
            const from = posById.get(edge.fromId);
            const to = posById.get(edge.toId);
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const onPath =
              pathSet.has(edge.fromId) && pathSet.has(edge.toId);
            return (
              <g key={`${edge.fromId}-${edge.toId}`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="currentColor"
                  strokeWidth={onPath ? 2 : 1}
                  className={
                    onPath ? "text-foreground" : "text-border"
                  }
                />
                <text
                  x={midX}
                  y={midY - 4}
                  textAnchor="middle"
                  className="fill-muted text-[9px] font-mono"
                >
                  {edge.cost}
                </text>
              </g>
            );
          })}

          {layout.nodes.map(({ id, x, y }) => {
            const runtime = state.nodes[id];
            const def = state.graph.nodes[id];
            if (!runtime || !def) return null;

            const isStart = id === state.startId;
            const isGoal = id === state.goalId;
            const isCurrent = state.currentNodeId === id;
            const isPath = pathSet.has(id);
            const isFrontier = frontierSet.has(id);
            const isVisited = visitedSet.has(id);
            const isConsidered = consideredSet.has(id);

            let fill = "rgb(var(--background))";
            let stroke = "rgb(var(--border))";
            let textClass = "fill-muted";

            if (isStart) {
              fill = "rgb(var(--foreground))";
              textClass = "fill-background";
            } else if (isGoal) {
              fill = "rgb(var(--background))";
              stroke = "rgb(var(--foreground))";
              textClass = "fill-foreground";
            } else if (isPath) {
              fill = "rgb(var(--foreground) / 0.22)";
              textClass = "fill-foreground";
            } else if (isCurrent) {
              fill = "rgb(var(--foreground))";
              textClass = "fill-background";
            } else if (isConsidered) {
              fill = "rgb(var(--surface))";
              textClass = "fill-foreground";
            } else if (isFrontier) {
              fill = "rgb(var(--surface) / 0.8)";
              textClass = "fill-foreground";
            } else if (isVisited) {
              fill = "rgb(var(--surface))";
              textClass = "fill-muted";
            }

            const showScores =
              !isInteractive &&
              runtime.gCost !== Infinity &&
              (isVisited || isCurrent || isPath || isFrontier);

            const canSelectGoal = Boolean(isInteractive && !isStart && onSelectGoal);
            return (
              <g
                key={id}
                role={canSelectGoal ? "button" : undefined}
                tabIndex={canSelectGoal ? 0 : undefined}
                aria-label={canSelectGoal ? `Set ${def.label} as goal node` : undefined}
                className={canSelectGoal ? "cursor-pointer focus:outline-none" : ""}
                onClick={() => {
                  if (canSelectGoal && onSelectGoal) {
                    onSelectGoal(id);
                  }
                }}
                onKeyDown={(e) => {
                  if (!canSelectGoal || !onSelectGoal) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectGoal(id);
                  }
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={nodeRadius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isGoal ? 2 : 1}
                  className={isCurrent ? "viz-cell-current" : undefined}
                />
                <text
                  x={x}
                  y={y - (showScores ? 4 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`text-[11px] font-semibold ${textClass}`}
                >
                  {def.label}
                </text>
                {showScores && (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    className="fill-muted text-[8px] font-mono"
                  >
                    {formatNodeScores(runtime)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export const SearchTreeCanvas = memo(SearchTreeCanvasInner);

function formatNodeScores(node: {
  gCost: number;
  hCost: number;
  fCost: number;
}): string {
  if (node.gCost === Infinity) return "";
  const g = node.gCost.toFixed(0);
  if (node.hCost === Infinity) return `g=${g}`;
  const h = node.hCost.toFixed(0);
  const f = node.fCost === Infinity ? "∞" : node.fCost.toFixed(0);
  return `g${g} h${h} f${f}`;
}

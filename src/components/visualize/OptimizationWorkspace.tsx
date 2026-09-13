"use client";

import React, { useMemo, useState } from "react";
import { PlaybackToolbar } from "@/components/visualize/PlaybackToolbar";
import { MetricsPanel } from "@/components/visualize/MetricsPanel";
import { StepExplanation } from "@/components/visualize/StepExplanation";
import { GhostAction, PrimaryAction } from "@/components/visualize/LessonChrome";
import { WorkspaceShell } from "@/components/visualize/WorkspaceShell";
import { Field } from "@/components/ui";
import { useVisualizerPlayback } from "@/lib/visualize/useVisualizerPlayback";
import { usePendingPlay } from "@/lib/visualize/usePendingPlay";
import {
  getLandscapeY,
  OPTIMIZATION_DOMAIN,
  OPTIMIZATION_RESOLUTION,
  generateHillClimbingSteps,
} from "@/lib/visualize/engines/hillClimbing";
import { generateGeneticAlgorithmSteps } from "@/lib/visualize/engines/genetic";
import { OptimizationState } from "@/lib/visualize/optimization";
import { AlgorithmStep } from "@/lib/visualize/types";
import { motion } from "framer-motion";
import { easeOut } from "@/components/visualize/motion";
import { MOTION } from "@/lib/motion";

const HILL_PSEUDOCODE = [
  { line: 1, code: "1. Stand at the current x" },
  { line: 2, code: "2. Look at the neighbor just left and just right" },
  { line: 3, code: "3. If neither is higher, stop. This is a peak." },
  { line: 4, code: "4. Else step to the higher neighbor and repeat" },
];

const GA_PSEUDOCODE = [
  { line: 1, code: "1. Scatter a random swarm" },
  { line: 2, code: "2. Score every dot by height on the curve" },
  { line: 3, code: "3. Keep the best dots as parents" },
  { line: 4, code: "4. Mix parents and add a little noise" },
  { line: 5, code: "5. Repeat for a fixed number of generations" },
];

interface OptimizationWorkspaceProps {
  algorithmId: string;
}

export function OptimizationWorkspace({
  algorithmId,
}: OptimizationWorkspaceProps) {
  const [initialX, setInitialX] = useState(2);
  const [steps, setSteps] = useState<AlgorithmStep<OptimizationState>[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const playback = useVisualizerPlayback(steps, algorithmId);
  const { setPendingPlay } = usePendingPlay(steps, playback);
  const isGenetic = algorithmId === "genetic-algorithm";

  const handleWatch = () => {
    const newSteps = isGenetic
      ? generateGeneticAlgorithmSteps()
      : generateHillClimbingSteps(initialX, 0.5);
    setSteps(newSteps);
    setHasGenerated(true);
    setPendingPlay(true);
  };

  const handleReset = () => {
    setSteps([]);
    setHasGenerated(false);
    setPendingPlay(false);
    playback.reset();
  };

  const activeState = playback.currentStep
    ? (playback.currentStep.state as OptimizationState)
    : null;

  const svgWidth = 800;
  const svgHeight = 320;
  const margin = { top: 36, right: 24, bottom: 36, left: 24 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const { pathData, minY, maxY } = useMemo(() => {
    let d = "";
    let localMinY = Infinity;
    let localMaxY = -Infinity;

    for (let i = 0; i <= OPTIMIZATION_RESOLUTION; i++) {
      const x =
        OPTIMIZATION_DOMAIN.minX +
        (i / OPTIMIZATION_RESOLUTION) *
          (OPTIMIZATION_DOMAIN.maxX - OPTIMIZATION_DOMAIN.minX);
      const y = getLandscapeY(x);
      if (y < localMinY) localMinY = y;
      if (y > localMaxY) localMaxY = y;
    }

    localMinY -= 0.5;
    localMaxY += 0.5;

    for (let i = 0; i <= OPTIMIZATION_RESOLUTION; i++) {
      const mathX =
        OPTIMIZATION_DOMAIN.minX +
        (i / OPTIMIZATION_RESOLUTION) *
          (OPTIMIZATION_DOMAIN.maxX - OPTIMIZATION_DOMAIN.minX);
      const mathY = getLandscapeY(mathX);
      const svgX =
        margin.left +
        ((mathX - OPTIMIZATION_DOMAIN.minX) /
          (OPTIMIZATION_DOMAIN.maxX - OPTIMIZATION_DOMAIN.minX)) *
          innerWidth;
      const svgY =
        margin.top +
        innerHeight -
        ((mathY - localMinY) / (localMaxY - localMinY)) * innerHeight;
      if (i === 0) d += `M ${svgX},${svgY} `;
      else d += `L ${svgX},${svgY} `;
    }

    return { pathData: d, minY: localMinY, maxY: localMaxY };
  }, [innerWidth, innerHeight, margin.left, margin.top]);

  const mapXToSvg = (mathX: number) =>
    margin.left +
    ((mathX - OPTIMIZATION_DOMAIN.minX) /
      (OPTIMIZATION_DOMAIN.maxX - OPTIMIZATION_DOMAIN.minX)) *
      innerWidth;
  const mapYToSvg = (mathY: number) =>
    margin.top + innerHeight - ((mathY - minY) / (maxY - minY)) * innerHeight;

  const currentMathX = activeState ? activeState.currentX : initialX;
  const currentMathY = activeState
    ? activeState.currentY
    : getLandscapeY(initialX);

  return (
    <div className="space-y-8">
      {!hasGenerated && !isGenetic && (
        <Field label="Starting place" htmlFor="hill-start-x" className="max-w-md">
          <div className="flex items-center gap-3">
            <input
              id="hill-start-x"
              type="range"
              min={OPTIMIZATION_DOMAIN.minX}
              max={OPTIMIZATION_DOMAIN.maxX}
              step="0.5"
              value={initialX}
              onChange={(e) => setInitialX(parseFloat(e.target.value))}
              className="w-48 cursor-pointer accent-foreground"
              aria-valuetext={initialX.toFixed(1)}
            />
            <span className="font-mono text-sm text-foreground tabular-nums">
              {initialX.toFixed(1)}
            </span>
          </div>
        </Field>
      )}

      <WorkspaceShell
        stageLabel="Landscape"
        hasGenerated={hasGenerated}
        playback={playback}
        happeningIdle="The narration follows the moving mark on the curve."
        dock={
          !hasGenerated ? (
            <PrimaryAction flat onClick={handleWatch}>
              Watch it run
            </PrimaryAction>
          ) : (
            <>
              <PlaybackToolbar playback={playback} />
              <GhostAction onClick={handleReset}>
                {isGenetic ? "Run again" : "Choose a new start"}
              </GhostAction>
            </>
          )
        }
        metricsContent={
          hasGenerated ? (
            <MetricsPanel
              metrics={playback.currentStep?.metrics ?? null}
              frontierLabel={isGenetic ? "Swarm size" : "Neighbors checked"}
              pathLabel="Best height"
            />
          ) : (
            <p className="text-sm text-muted">Watch it run to see counts.</p>
          )
        }
        stepsContent={
          <StepExplanation
            step={playback.currentStep}
            emptyMessage="Run the search to highlight a line."
            pseudocode={isGenetic ? GA_PSEUDOCODE : HILL_PSEUDOCODE}
          />
        }
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto"
          role="img"
          aria-label="Height of the search landscape"
        >
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            className="text-foreground/40"
            strokeWidth="2"
          />
          {activeState && activeState.visitedX.length > 0 && (
            <path
              d={`M ${activeState.visitedX
                .map((vx) => `${mapXToSvg(vx)},${mapYToSvg(getLandscapeY(vx))}`)
                .join(" L ")}`}
              fill="none"
              stroke="currentColor"
              className="text-foreground"
              strokeWidth="1.5"
            />
          )}
          {activeState?.consideredX.map((nx, i) => (
            <circle
              key={i}
              cx={mapXToSvg(nx)}
              cy={mapYToSvg(getLandscapeY(nx))}
              r="4"
              fill="none"
              stroke="currentColor"
              className="text-muted"
              strokeWidth="1.5"
            />
          ))}
          {activeState?.population?.map((nx, i) => (
            <circle
              key={`pop-${i}`}
              cx={mapXToSvg(nx)}
              cy={mapYToSvg(getLandscapeY(nx))}
              r="4"
              fill="currentColor"
              className="text-foreground"
              opacity="0.45"
            />
          ))}
          {!activeState?.population ? (
            <motion.circle
              animate={{
                cx: mapXToSvg(currentMathX),
                cy: mapYToSvg(currentMathY),
              }}
              transition={{ duration: MOTION.duration.enter, ease: easeOut }}
              r="6"
              fill="currentColor"
              className="text-foreground"
            />
          ) : (
            <motion.circle
              animate={{
                cx: mapXToSvg(currentMathX),
                cy: mapYToSvg(currentMathY),
              }}
              transition={{ duration: MOTION.duration.enter, ease: easeOut }}
              r="8"
              fill="none"
              stroke="currentColor"
              className="text-foreground"
              strokeWidth="2"
            />
          )}
          <motion.text
            animate={{
              x: mapXToSvg(currentMathX),
              y: mapYToSvg(currentMathY) - 12,
            }}
            transition={{ duration: MOTION.duration.enter, ease: easeOut }}
            textAnchor="middle"
            className="fill-foreground text-[11px] font-mono"
          >
            {currentMathY.toFixed(2)}
          </motion.text>
        </svg>
      </WorkspaceShell>
    </div>
  );
}

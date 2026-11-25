"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { AlgorithmStep } from "@/lib/visualize/types";
import {
  logTelemetryEvent,
  markAlgorithmComplete,
} from "@/lib/visualize/client";
import { PLAYBACK_SPEED_DEFAULT_MS } from "@/lib/visualize/playbackSpeed";

export interface PlaybackControls<TState> {
  currentStep: AlgorithmStep<TState> | null;
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  speedMs: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  reset: () => void;
  jumpToStep: (index: number) => void;
  setSpeedMs: (speed: number) => void;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `viz-${Math.random().toString(36).slice(2)}`;
}

export function useVisualizerPlayback<TState>(
  steps: AlgorithmStep<TState>[],
  algorithmId: string = "unknown",
): PlaybackControls<TState> {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(PLAYBACK_SPEED_DEFAULT_MS);
  const [sessionId] = useState(createSessionId);

  const activeTimeMsRef = useRef(0);
  const isCompletedRef = useRef(false);
  const stepsRef = useRef(steps);
  const currentIndexRef = useRef(0);

  // Reset playback when the steps array identity changes (React "adjust state while rendering").
  const [trackedSteps, setTrackedSteps] = useState(steps);
  if (steps !== trackedSteps) {
    setTrackedSteps(steps);
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }

  useLayoutEffect(() => {
    stepsRef.current = steps;
    isCompletedRef.current = false;
    activeTimeMsRef.current = 0;
    currentIndexRef.current = 0;
  }, [steps]);

  useLayoutEffect(() => {
    currentIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const logAction = useCallback(
    (action: string) => {
      if (algorithmId !== "unknown") {
        logTelemetryEvent({
          sessionId,
          algorithmId,
          action,
        }).catch(() => {});
      }
    },
    [algorithmId, sessionId],
  );

  const maybeComplete = useCallback(() => {
    if (isCompletedRef.current || algorithmId === "unknown") return;
    if (stepsRef.current.length === 0) return;
    isCompletedRef.current = true;
    markAlgorithmComplete(
      algorithmId,
      Math.floor(activeTimeMsRef.current / 1000),
    ).catch(() => {});
  }, [algorithmId]);

  const stepForward = useCallback(() => {
    logAction("STEP_FORWARD");
    if (currentIndexRef.current < stepsRef.current.length - 1) {
      const next = currentIndexRef.current + 1;
      currentIndexRef.current = next;
      setCurrentStepIndex(next);
    } else {
      setIsPlaying(false);
    }
  }, [logAction]);

  const stepBackward = useCallback(() => {
    logAction("STEP_BACKWARD");
    setCurrentStepIndex((prevIndex) => Math.max(0, prevIndex - 1));
  }, [logAction]);

  const reset = useCallback(() => {
    logAction("RESET");
    setIsPlaying(false);
    setCurrentStepIndex(0);
  }, [logAction]);

  const play = useCallback(() => {
    logAction("PLAY");
    if (stepsRef.current.length === 0) return;
    if (currentStepIndex >= stepsRef.current.length - 1) {
      setCurrentStepIndex(0);
    }
    setIsPlaying(true);
  }, [currentStepIndex, logAction]);

  const pause = useCallback(() => {
    logAction("PAUSE");
    setIsPlaying(false);
  }, [logAction]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const jumpToStep = useCallback(
    (index: number) => {
      logAction(`JUMP_TO_STEP_${index}`);
      const clampedIndex = Math.max(
        0,
        Math.min(index, stepsRef.current.length - 1),
      );
      setCurrentStepIndex(clampedIndex);
    },
    [logAction],
  );

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      activeTimeMsRef.current += speedMs;
      const lastIdx = stepsRef.current.length - 1;
      const cur = currentIndexRef.current;
      if (cur >= lastIdx) {
        setIsPlaying(false);
        maybeComplete();
        return;
      }
      const next = cur + 1;
      currentIndexRef.current = next;
      setCurrentStepIndex(next);
      if (next >= lastIdx) {
        setIsPlaying(false);
        maybeComplete();
      }
    }, speedMs);

    return () => clearInterval(timer);
  }, [isPlaying, speedMs, maybeComplete]);

  const currentStep = steps[currentStepIndex] || null;

  return {
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    isPlaying,
    speedMs,
    play,
    pause,
    togglePlay,
    stepForward,
    stepBackward,
    reset,
    jumpToStep,
    setSpeedMs,
  };
}

"use client";

import { useEffect, useState } from "react";
import AppLink from "@/components/ui/AppLink";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  AlgorithmProgress,
  SavedGrid,
  deleteGrid,
  fetchProgress,
  fetchSavedGrids,
} from "@/lib/visualize/client";
import { ALGORITHMS } from "@/lib/visualize/catalog";
import { GhostAction } from "@/components/visualize/LessonChrome";
import { fadeUp, stagger } from "@/components/visualize/motion";
import { motion } from "framer-motion";

export function ProgressClient() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [grids, setGrids] = useState<SavedGrid[]>([]);
  const [progress, setProgress] = useState<AlgorithmProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setSignedIn(!!user);
      if (!user) {
        setGrids([]);
        setProgress([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [saved, done] = await Promise.all([
          fetchSavedGrids(),
          fetchProgress(),
        ]);
        setGrids(saved);
        setProgress(done);
      } catch {
        setError("Could not load progress.");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const completedIds = new Set(
    progress.filter((p) => p.completed).map((p) => p.algorithmId),
  );

  const handleDelete = async (id: string) => {
    await deleteGrid(id);
    setGrids((prev) => prev.filter((g) => g.id !== id));
  };

  const doneCount = completedIds.size;
  const showLoading = signedIn === null || loading;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto page-gutter py-8 sm:py-12 min-h-[80vh]">
      <motion.header
        variants={stagger}
        initial="hidden"
        animate="show"
        className="max-w-2xl mb-10"
      >
        <motion.div variants={fadeUp}>
          <AppLink
            href="/visualize"
            className="text-xs text-muted hover:text-foreground animated-underline"
          >
            ← Visualize
          </AppLink>
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="font-display text-3xl sm:text-5xl text-foreground tracking-tight mt-4"
        >
          Your runs
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="text-base text-foreground-subtle mt-3 leading-relaxed"
        >
          Finish a visualizer to the last step and it shows up here. Mazes you
          save from a grid search live below.
        </motion.p>
      </motion.header>

      {showLoading && (
        <div className="rounded-xl border border-border bg-card p-5 max-w-xl">
          <p className="text-sm text-muted">Loading your progress…</p>
        </div>
      )}

      {!showLoading && signedIn === false && (
        <div className="rounded-xl border border-border bg-card p-5 max-w-xl">
          <p className="text-sm font-semibold text-foreground">
            Sign in to keep your runs
          </p>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Completions and saved mazes stay on your account across devices.
          </p>
          <AppLink
            href="/login"
            className="inline-flex items-center justify-center min-h-11 px-5 mt-4 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign in
          </AppLink>
        </div>
      )}

      {error && !showLoading && <p className="text-sm text-muted mb-4">{error}</p>}

      {!showLoading && signedIn && (
        <div className="space-y-12">
          <section>
            <div className="flex items-end justify-between gap-3 mb-3">
              <p className="text-xs text-muted">
                {doneCount} of {ALGORITHMS.length} finished
              </p>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-foreground transition-[width] duration-500"
                style={{
                  width: `${(doneCount / ALGORITHMS.length) * 100}%`,
                }}
              />
            </div>
            <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
              {ALGORITHMS.map((algo) => {
                const done = completedIds.has(algo.id);
                const record = progress.find((p) => p.algorithmId === algo.id);
                return (
                  <li key={algo.id}>
                    <AppLink
                      href={`/visualize/${algo.id}`}
                      className="flex items-baseline justify-between gap-4 py-3.5 px-4 hover:bg-surface/60"
                    >
                      <span>
                        <span className="text-sm font-medium text-foreground">
                          {algo.name}
                        </span>
                        {record?.timeSpentSeconds ? (
                          <span className="ml-2 text-xs text-muted font-mono">
                            {record.timeSpentSeconds}s
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted">
                        {done ? "Done" : "Open"}
                      </span>
                    </AppLink>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Saved mazes
            </h2>
            {grids.length === 0 ? (
              <p className="text-sm text-muted">
                None yet. On any pathfinding page, press Save maze after you
                like the walls.
              </p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                {grids.map((grid) => (
                  <li
                    key={grid.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3.5 px-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {grid.name}
                      </p>
                      <p className="text-xs text-muted">
                        {grid.gridData.walls.length} walls
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <AppLink
                        href={`/visualize/a-star?grid=${grid.id}`}
                        className="min-h-11 px-3 text-sm text-foreground underline underline-offset-4"
                      >
                        Open in A*
                      </AppLink>
                      <GhostAction onClick={() => handleDelete(grid.id)}>
                        Delete
                      </GhostAction>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

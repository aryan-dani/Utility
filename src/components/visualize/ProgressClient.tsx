"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useVizMotion } from "@/components/visualize/motion";
import { motion } from "framer-motion";
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  Skeleton,
  PageShell,
} from "@/components/ui";
import { Map } from "lucide-react";

export function ProgressClient() {
  const { fadeUp, stagger } = useVizMotion();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [grids, setGrids] = useState<SavedGrid[]>([]);
  const [progress, setProgress] = useState<AlgorithmProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadForUser = useCallback(async () => {
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
  }, []);

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
      await loadForUser();
    });
  }, [loadForUser]);

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
    <PageShell>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="max-w-2xl mb-10 space-y-4"
      >
        <motion.div variants={fadeUp}>
          <AppLink
            href="/visualize"
            className="text-xs text-muted hover:text-foreground animated-underline"
          >
            ← Visualize
          </AppLink>
        </motion.div>
        <motion.div variants={fadeUp}>
          <PageHeader
            size="hero"
            title="Your runs"
            description="Finish a visualizer to the last step and it shows up here. Mazes you save from a grid search live below."
          />
        </motion.div>
      </motion.div>

      {showLoading && (
        <div className="max-w-xl space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}

      {!showLoading && signedIn === false && (
        <EmptyState
          className="max-w-xl"
          title="Sign in to keep your runs"
          description="Completions and saved mazes stay on your account across devices."
          action={
            <ButtonLink href="/login">Sign in</ButtonLink>
          }
        />
      )}

      {error && !showLoading && (
        <ErrorState
          className="mb-4 max-w-xl"
          title="Could not load progress"
          description={error}
          onRetry={() => {
            void loadForUser();
          }}
        />
      )}

      {!showLoading && signedIn && (
        <div className="space-y-12">
          <section>
            <SectionHeader
              className="mb-3"
              title="Algorithms"
              description={`${doneCount} of ${ALGORITHMS.length} finished`}
            />
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
                      className="flex items-baseline justify-between gap-4 py-3.5 px-4 hover:bg-surface/60 min-h-11"
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
            <SectionHeader className="mb-3" title="Saved mazes" />
            {grids.length === 0 ? (
              <EmptyState
                icon={<Map className="w-6 h-6" />}
                title="No mazes yet"
                description="On any pathfinding page, press Save maze after you like the walls."
                action={
                  <ButtonLink href="/visualize/a-star" variant="secondary">
                    Open A*
                  </ButtonLink>
                }
              />
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
                      <ButtonLink
                        href={`/visualize/a-star?grid=${grid.id}`}
                        variant="ghost"
                        size="sm"
                      >
                        Open in A*
                      </ButtonLink>
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
    </PageShell>
  );
}

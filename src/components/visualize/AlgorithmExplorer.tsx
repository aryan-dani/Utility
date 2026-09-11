"use client";

import AppLink from "@/components/ui/AppLink";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  ALGORITHMS,
  START_HERE_IDS,
  TOPIC_GROUPS,
} from "@/lib/visualize/catalog";
import {
  HeroMaze,
  QueenMark,
  RippleMark,
  StarMark,
} from "@/components/visualize/TopicMarks";
import { useVizMotion } from "@/components/visualize/motion";
import type { AlgorithmMeta, VisualizerType } from "@/lib/visualize/types";
import { ButtonLink, PageHeader, SectionHeader } from "@/components/ui";

const START_MARKS = [RippleMark, StarMark, QueenMark];

const TYPE_LABEL: Record<VisualizerType, string> = {
  grid: "Grid",
  "game-tree": "Game tree",
  optimization: "Curve",
  csp: "Board",
};

const BY_ID = new Map(ALGORITHMS.map((algo) => [algo.id, algo]));

function FeaturedCard({
  algo,
  index,
}: {
  algo: AlgorithmMeta;
  index: number;
}) {
  const Mark = START_MARKS[index] ?? RippleMark;
  return (
    <AppLink
      href={`/visualize/${algo.id}`}
      className="group relative bg-card hover:bg-surface p-6 sm:p-7 flex flex-col min-h-[15.5rem] transition-colors duration-300"
    >
      <div className="absolute left-0 top-4 bottom-4 w-[2px] bg-foreground scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center" />
      <div className="flex items-start justify-between mb-8">
        <span className="font-mono text-[10px] text-muted">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Mark />
      </div>
      <div className="mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xl font-semibold text-foreground">{algo.shortName}</h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
            {algo.difficulty}
          </span>
        </div>
        <p className="text-sm text-muted leading-relaxed mb-4">
          {algo.inOneSentence}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          Watch it run
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
        </span>
      </div>
    </AppLink>
  );
}

function CatalogCard({
  algo,
  structure,
}: {
  algo: AlgorithmMeta;
  structure?: "graph" | "tree";
}) {
  const href =
    structure === "tree"
      ? `/visualize/${algo.id}?structure=tree`
      : `/visualize/${algo.id}`;
  const typeLabel =
    structure === "tree" ? "Tree" : TYPE_LABEL[algo.visualizerType];

  return (
    <AppLink
      href={href}
      className="group relative bg-card hover:bg-surface p-5 sm:p-6 flex flex-col min-h-[11.5rem] transition-colors duration-300"
    >
      <div className="absolute left-0 top-3 bottom-3 w-[2px] bg-foreground scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center" />
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          {typeLabel}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          {algo.difficulty}
        </span>
      </div>
      <div className="mt-auto pt-8">
        <h3 className="text-lg font-semibold text-foreground">{algo.shortName}</h3>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">
          {algo.inOneSentence}
        </p>
        <span className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-foreground-subtle group-hover:text-foreground transition-colors">
          Open
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
        </span>
      </div>
    </AppLink>
  );
}

export function AlgorithmExplorer() {
  const { fadeUp, stagger } = useVizMotion();
  const startHere = START_HERE_IDS.map((id) => BY_ID.get(id)).filter(
    (algo): algo is AlgorithmMeta => Boolean(algo),
  );

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto page-gutter py-8 sm:py-12 min-h-[80vh]">
      <motion.header
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mb-12 sm:mb-14 pb-8 border-b border-border"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-8 lg:gap-12 items-end">
          <div>
            <motion.div variants={fadeUp}>
              <PageHeader
                size="hero"
                eyebrow="Visualize"
                title="Watch it decide"
                description="Pathfinding, game trees, and N-Queens, one step at a time. Press Watch it run. You do not need the theory first."
                actions={
                  <>
                    <ButtonLink href="/visualize/bfs">Start with BFS</ButtonLink>
                    <ButtonLink href="/visualize/progress" variant="ghost">
                      Your runs
                    </ButtonLink>
                  </>
                }
              />
            </motion.div>
          </div>

          <motion.div variants={fadeUp} className="hidden lg:block">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-surface/40">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted">
                  Preview
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  BFS
                </span>
              </div>
              <div className="p-4">
                <HeroMaze />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.header>

      <section className="mb-14 sm:mb-16">
        <div className="flex items-end justify-between gap-3 mb-4">
          <SectionHeader
            eyebrow="Start here"
            title="Three ways in"
            description={`${ALGORITHMS.length} algorithms in the catalog.`}
          />
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden shadow-sm"
        >
          {startHere.map((algo, index) => (
            <motion.div key={algo.id} variants={fadeUp}>
              <FeaturedCard algo={algo} index={index} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="space-y-10"
      >
        {TOPIC_GROUPS.map((group) => {
          const items = group.ids
            .map((id) => BY_ID.get(id))
            .filter((algo): algo is AlgorithmMeta => Boolean(algo));
          return (
            <motion.div key={group.id} variants={fadeUp}>
              <div className="flex items-end justify-between gap-3 mb-3">
                <SectionHeader title={group.title} description={group.blurb} />
                <span className="text-2xs font-mono text-muted shrink-0">
                  {items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden shadow-sm">
                {items.map((algo) => (
                  <CatalogCard
                    key={`${group.id}-${algo.id}`}
                    algo={algo}
                    structure={group.structure}
                  />
                ))}
              </div>
            </motion.div>
          );
        })}
      </motion.section>
    </div>
  );
}

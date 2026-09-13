"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function StatsCounter({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const end = value;
  const skipAnimation =
    !Number.isFinite(end) || end <= 0 || prefersReducedMotion();
  const displayCount =
    !isInView ? 0 : skipAnimation ? Math.max(0, end || 0) : count;

  useEffect(() => {
    if (!isInView || skipAnimation) return;

    let start = 0;
    const totalDuration = 1000;
    const increment = Math.max(1, Math.ceil(end / (totalDuration / 30)));

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [value, isInView, skipAnimation, end]);

  return <span ref={ref}>{displayCount}</span>;
}

export type HomeStatsProps = {
  subjects: number;
  resources: number;
  semesters: number;
  branches: number;
};

export default function HomeStats({
  subjects,
  resources,
  semesters,
  branches,
}: HomeStatsProps) {
  const stats = [
    { label: "Subjects", value: subjects },
    { label: "Resources", value: resources },
    { label: "Semesters", value: semesters },
    { label: "Branches", value: branches },
  ] as const;

  return (
    <section className="w-full border-t border-border bg-background-subtle py-14">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="bg-card border border-border card-premium-hover p-6 rounded-2xl shadow-xs text-center relative overflow-hidden"
          >
            <p className="text-4xl font-black text-foreground tracking-tight">
              <StatsCounter value={value} />
            </p>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-foreground-subtle mt-2">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

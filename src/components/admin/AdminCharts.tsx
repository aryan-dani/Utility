"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

export function pct(part: number, whole: number): number {
  if (!whole || !Number.isFinite(part)) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

/** Horizontal rank bars — used for top resources / active users. */
export function RankBars({
  items,
  empty,
  className,
}: {
  items: Array<{
    key: string;
    label: string;
    meta?: string;
    value: number;
    leading?: ReactNode;
  }>;
  empty?: string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-muted">
        {empty ?? "Nothing to show yet."}
      </div>
    );
  }
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {items.map((item, index) => {
        const width = pct(item.value, max);
        return (
          <li key={item.key} className="px-5 py-3.5 group">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted w-5 shrink-0 tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              {item.leading}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {item.label}
                  </p>
                  <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
                    {formatCompact(item.value)}
                  </span>
                </div>
                {item.meta ? (
                  <p className="text-2xs text-muted truncate mt-0.5">{item.meta}</p>
                ) : null}
                <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden border border-border/60">
                  <div
                    className="h-full rounded-full bg-foreground/80 transition-[width] duration-500 ease-out"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Stacked share list with proportional track (branch / semester). */
export function ShareBars({
  items,
  className,
}: {
  items: Array<{ key: string; label: string; value: number }>;
  className?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => {
        const share = pct(item.value, total);
        return (
          <li key={item.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground truncate">
                {item.label}
              </span>
              <span className="tabular-nums text-muted shrink-0">
                <span className="font-bold text-foreground">{item.value}</span>
                <span className="text-2xs ml-1.5">{share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden border border-border/50">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Simple donut from category shares. */
export function DonutChart({
  items,
  centerLabel,
  centerValue,
  className,
}: {
  items: Array<{ key: string; label: string; value: number }>;
  centerLabel: string;
  centerValue: string;
  className?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const size = 160;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const tones = [
    "rgb(var(--foreground))",
    "rgb(var(--foreground) / 0.72)",
    "rgb(var(--foreground) / 0.52)",
    "rgb(var(--foreground) / 0.36)",
    "rgb(var(--foreground) / 0.22)",
    "rgb(var(--muted))",
  ];

  const slices = items.map((item, i) => {
    const len = (item.value / total) * c;
    const offset = items
      .slice(0, i)
      .reduce((sum, prev) => sum + (prev.value / total) * c, 0);
    return { item, i, len, offset };
  });

  return (
    <div className={cn("flex flex-col sm:flex-row items-center gap-6", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(var(--border))"
            strokeWidth={stroke}
          />
          {slices.map(({ item, i, len, offset }) => (
            <circle
              key={item.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={tones[i % tones.length]}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
          <p className="text-2xl font-display tracking-tight text-foreground tabular-nums leading-none">
            {centerValue}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">
            {centerLabel}
          </p>
        </div>
      </div>
      <ul className="flex-1 w-full min-w-0 space-y-2">
        {items.map((item, i) => (
          <li key={item.key} className="flex items-center gap-2.5 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: tones[i % tones.length] }}
            />
            <span className="truncate font-medium text-foreground flex-1">
              {item.label}
            </span>
            <span className="tabular-nums text-muted shrink-0">
              {item.value}
              <span className="text-2xs ml-1">
                {pct(item.value, total).toFixed(0)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Activity funnel / retention strip. */
export function ActivityFunnel({
  segments,
  className,
}: {
  segments: Array<{ label: string; value: number; hint?: string }>;
  className?: string;
}) {
  const max = Math.max(1, ...segments.map((s) => s.value));
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>
      {segments.map((seg) => (
        <div
          key={seg.label}
          className="rounded-xl border border-border bg-surface/30 px-4 py-3.5 flex flex-col gap-2"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            {seg.label}
          </p>
          <p className="text-2xl font-display tracking-tight tabular-nums text-foreground leading-none">
            {formatCompact(seg.value)}
          </p>
          {seg.hint ? (
            <p className="text-2xs text-muted leading-snug">{seg.hint}</p>
          ) : null}
          <div className="mt-auto h-1 rounded-full bg-border/70 overflow-hidden">
            <div
              className="h-full bg-foreground/70 rounded-full"
              style={{ width: `${pct(seg.value, max)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-4 sm:p-5 flex flex-col gap-3 min-h-[7.5rem]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted leading-tight">
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-display tracking-tight text-foreground tabular-nums leading-none">
        {value}
      </p>
      {hint ? (
        <p className="text-2xs text-muted mt-auto leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

/** Highlight query matches without browser find chrome. */
export function HighlightText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const q = query.trim();
  if (!q || !text) {
    return <span className={className}>{text}</span>;
  }
  const escaped = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "i"));
  const qLower = q.toLowerCase();
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === qLower ? (
          <mark key={i} className="search-hit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

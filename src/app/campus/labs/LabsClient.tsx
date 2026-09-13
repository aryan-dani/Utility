"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft } from "lucide-react";
import type { LabFacility } from "@/lib/ishani";
import { PageHeader, PageShell } from "@/components/ui";

interface LabsClientProps {
  initialLabs: LabFacility[];
  configured: boolean;
}

export default function LabsClient({
  initialLabs,
  configured,
}: LabsClientProps) {
  const labs = initialLabs;
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState<string>("ALL");

  const floors = useMemo(() => {
    const set = new Set<string>();
    labs.forEach((lab) => {
      const f = String(lab.floor || "").trim();
      if (f) set.add(f);
    });
    return Array.from(set).sort();
  }, [labs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return labs.filter((lab) => {
      const floor = String(lab.floor || "").trim();
      if (floorFilter !== "ALL" && floor !== floorFilter) return false;
      if (!q) return true;
      const hay = [
        lab.labName,
        lab.roomNo,
        lab.floor,
        lab.labAssistant,
        lab.machineMake,
        lab.internet,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [labs, search, floorFilter]);

  return (
    <PageShell>
      <div className="mb-8 border-b border-border pb-6">
        <Link
          href="/campus"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Campus
        </Link>
        <PageHeader
          eyebrow="Lab registry"
          title="Campus labs"
          description={
            configured
              ? `${filtered.length} of ${labs.length} labs`
              : "Campus data unavailable. Set ISHANI_API_URL to enable the lab registry."
          }
        />
      </div>

      {!configured ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            Campus data unavailable
          </p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Configure the Ishani API URL on the server to load lab facilities.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lab, room, assistant…"
                className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:ring-0 input-premium-focus placeholder:text-muted"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFloorFilter("ALL")}
                className={`px-3 py-2 min-h-11 rounded-lg text-xs font-semibold transition-colors ${
                  floorFilter === "ALL"
                    ? "bg-foreground text-background"
                    : "bg-surface border border-border text-muted hover:text-foreground active:bg-surface-hover"
                }`}
              >
                All floors
              </button>
              {floors.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFloorFilter(f)}
                  className={`px-3 py-2 min-h-11 rounded-lg text-xs font-semibold transition-colors ${
                    floorFilter === f
                      ? "bg-foreground text-background"
                      : "bg-surface border border-border text-muted hover:text-foreground active:bg-surface-hover"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-12 text-center text-sm text-muted">
              No labs match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((lab, idx) => (
                <article
                  key={`${lab.labName}-${lab.roomNo}-${idx}`}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 active:bg-surface/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-foreground">
                        {String(lab.labName || "Untitled lab")}
                      </h2>
                      <p className="text-xs text-muted mt-1">
                        {String(lab.roomNo || "-")}
                        {lab.floor ? ` · ${lab.floor}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-surface border border-border text-muted">
                      {String(lab.internet || "-") === "Yes"
                        ? "Online"
                        : String(lab.internet || "Net n/a")}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-widest text-muted">
                        Systems
                      </dt>
                      <dd className="text-foreground font-medium mt-0.5">
                        {lab.systems ?? "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-widest text-muted">
                        Capacity
                      </dt>
                      <dd className="text-foreground font-medium mt-0.5">
                        {lab.capacity ?? "-"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs font-bold uppercase tracking-widest text-muted">
                        Assistant
                      </dt>
                      <dd className="text-foreground font-medium mt-0.5">
                        {String(lab.labAssistant || "-")}
                      </dd>
                    </div>
                    {lab.machineMake ? (
                      <div className="col-span-2">
                        <dt className="text-xs font-bold uppercase tracking-widest text-muted">
                          Machines
                        </dt>
                        <dd className="text-foreground font-medium mt-0.5">
                          {String(lab.machineMake)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

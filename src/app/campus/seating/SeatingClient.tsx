"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft } from "lucide-react";
import type { FacultySeat } from "@/lib/ishani";
import { PageHeader, PageShell } from "@/components/ui";

interface SeatingClientProps {
  initialSeating: FacultySeat[];
  configured: boolean;
}

export default function SeatingClient({
  initialSeating,
  configured,
}: SeatingClientProps) {
  const seating = initialSeating;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const types = useMemo(() => {
    const set = new Set<string>();
    seating.forEach((s) => {
      const t = String(s.Type || "").trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [seating]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return seating.filter((s) => {
      const typeOk =
        typeFilter === "ALL" ||
        String(s.Type || "").toLowerCase() === typeFilter.toLowerCase();
      if (!typeOk) return false;
      if (!q) return true;
      const hay = [
        s.Name_of_Faculty,
        s.Designation,
        s.Department,
        s.Seating_ID,
        s.Type,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [seating, search, typeFilter]);

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
          eyebrow="Faculty seating"
          title="Cabin & seating chart"
          description={
            configured
              ? `${filtered.length} of ${seating.length} entries`
              : "Campus data unavailable. Set ISHANI_API_URL to enable live seating."
          }
        />
      </div>

      {!configured ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            Campus data unavailable
          </p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Configure the Ishani API URL on the server to load faculty seating.
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
                placeholder="Search name, cabin, department…"
                className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:ring-0 input-premium-focus placeholder:text-muted"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className={`px-3 py-2 min-h-11 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === "ALL"
                    ? "bg-foreground text-background"
                    : "bg-surface border border-border text-muted hover:text-foreground active:bg-surface-hover"
                }`}
              >
                All
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-2 min-h-11 rounded-lg text-xs font-semibold transition-colors ${
                    typeFilter === t
                      ? "bg-foreground text-background"
                      : "bg-surface border border-border text-muted hover:text-foreground active:bg-surface-hover"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-12 text-center text-sm text-muted">
              No seating entries match your filters.
            </div>
          ) : (
            <>
            <div className="md:hidden space-y-3">
              {filtered.map((row, idx) => (
                <article
                  key={`${row.Seating_ID}-${row.Name_of_Faculty}-${idx}`}
                  className="rounded-xl border border-border bg-card p-4 active:bg-surface/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-foreground">
                        {String(row.Name_of_Faculty || "-")}
                      </h2>
                      <p className="text-xs text-muted mt-1">
                        {String(row.Designation || "-")}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {String(row.Department || "-")}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-surface border border-border text-muted">
                      {String(row.Type || "-")}
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-sm text-foreground">
                    {String(row.Seating_ID || "-")}
                  </p>
                </article>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface/60 border-b border-border text-left">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                      Name
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                      Designation
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                      Department
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                      Seating ID
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((row, idx) => (
                    <tr
                      key={`${row.Seating_ID}-${row.Name_of_Faculty}-${idx}`}
                      className="bg-card hover:bg-surface/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {String(row.Name_of_Faculty || "-")}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {String(row.Designation || "-")}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {String(row.Department || "-")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {String(row.Seating_ID || "-")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-surface border border-border text-muted">
                          {String(row.Type || "-")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

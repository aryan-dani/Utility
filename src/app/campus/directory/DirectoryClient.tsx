"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  Mail,
  ExternalLink,
  X,
} from "lucide-react";
import type { StaffMember } from "@/lib/ishani";
import { PageHeader, PageShell } from "@/components/ui";

const FACULTY_GROUP_ORDER = [
  "B.Tech Computer Science & Engineering",
  "B.Tech Computer Science & Engineering - Artificial Intelligence & Data Science",
  "B.Tech Computer Science & Engineering - Cyber Security & Forensics",
  "B.Tech Computer Science & Engineering (CSBS & Cloud Computing)",
];

interface DirectoryClientProps {
  initialStaff: StaffMember[];
  configured: boolean;
}

function shortGroupLabel(group: string) {
  if (group.includes("Artificial Intelligence")) return "AIDS";
  if (group.includes("Cyber Security")) return "CSF";
  if (group.includes("CSBS") || group.includes("Cloud")) return "CSBS / Cloud";
  if (group.includes("Computer Science")) return "CSE";
  return group;
}

export default function DirectoryClient({
  initialStaff,
  configured,
}: DirectoryClientProps) {
  const staff = initialStaff;
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<StaffMember | null>(null);

  const groups = useMemo(() => {
    const present = new Set(
      staff.map((s) => String(s.facultyGroup || "").trim()).filter(Boolean),
    );
    const ordered = FACULTY_GROUP_ORDER.filter((g) => present.has(g));
    const extras = Array.from(present)
      .filter((g) => !FACULTY_GROUP_ORDER.includes(g))
      .sort();
    return [...ordered, ...extras];
  }, [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      const group = String(s.facultyGroup || "").trim();
      if (groupFilter !== "ALL" && group !== groupFilter) return false;
      if (!q) return true;
      const hay = [
        s.name,
        s.designation,
        s.email,
        s.specialization,
        s.qualification,
        group,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [staff, search, groupFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, StaffMember[]>();
    for (const member of filtered) {
      const key = String(member.facultyGroup || "Other").trim() || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(member);
    }
    const keys = [
      ...FACULTY_GROUP_ORDER.filter((g) => map.has(g)),
      ...Array.from(map.keys())
        .filter((g) => !FACULTY_GROUP_ORDER.includes(g))
        .sort(),
    ];
    return keys.map((key) => ({ key, members: map.get(key)! }));
  }, [filtered]);

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
          eyebrow="Faculty directory"
          title="Staff directory"
          description={
            configured
              ? `${filtered.length} of ${staff.length} people`
              : "Campus data unavailable. Set ISHANI_API_URL to enable the directory."
          }
        />
      </div>

      {!configured ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            Campus data unavailable
          </p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Configure the Ishani API URL on the server to load the faculty
            directory.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, designation, email…"
                className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:ring-0 input-premium-focus placeholder:text-muted"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setGroupFilter("ALL")}
                className={`px-3 py-2 min-h-11 rounded-lg text-xs font-semibold transition-colors ${
                  groupFilter === "ALL"
                    ? "bg-foreground text-background"
                    : "bg-surface border border-border text-muted hover:text-foreground active:bg-surface-hover"
                }`}
              >
                All tracks
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupFilter(g)}
                  className={`px-3 py-2 min-h-11 rounded-lg text-xs font-semibold transition-colors ${
                    groupFilter === g
                      ? "bg-foreground text-background"
                      : "bg-surface border border-border text-muted hover:text-foreground active:bg-surface-hover"
                  }`}
                  title={g}
                >
                  {shortGroupLabel(g)}
                </button>
              ))}
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-12 text-center text-sm text-muted">
              No staff match your filters.
            </div>
          ) : (
            <div className="space-y-10">
              {grouped.map(({ key, members }) => (
                <section key={key}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
                    {key}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {members.map((member, idx) => (
                      <button
                        key={`${member.name}-${member.email}-${idx}`}
                        type="button"
                        onClick={() => setSelected(member)}
                        className="text-left rounded-xl border border-border bg-card p-4 hover:bg-surface/50 active:bg-surface hover:border-border-strong transition-colors focus-visible:outline-offset-2"
                      >
                        <p className="text-sm font-bold text-foreground line-clamp-1">
                          {String(member.name || "Unknown")}
                        </p>
                        <p className="text-xs text-muted mt-1 line-clamp-1">
                          {String(member.designation || "-")}
                        </p>
                        {member.email ? (
                          <p className="text-xs text-muted mt-3 flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {String(member.email)}
                            </span>
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close details"
            className="absolute inset-0 bg-background/80"
            onClick={() => setSelected(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-detail-title"
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-popover overflow-hidden z-10 max-h-[85vh] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id="staff-detail-title"
                  className="text-base font-bold text-foreground"
                >
                  {String(selected.name || "Staff")}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {String(selected.designation || "-")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="tap-target rounded-xl text-muted hover:text-foreground hover:bg-surface transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 text-sm">
              {[
                ["Program", selected.facultyGroup],
                ["Qualification", selected.qualification],
                ["Specialization", selected.specialization],
                ["Experience", selected.experience],
                ["Email", selected.email],
                ["Mobile", selected.mobile],
              ].map(([label, value]) =>
                value ? (
                  <div key={String(label)}>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted mb-0.5">
                      {label}
                    </p>
                    <p className="text-foreground break-words">
                      {String(value)}
                    </p>
                  </div>
                ) : null,
              )}
              {typeof selected.profileLink === "string" &&
              /^https?:\/\//i.test(selected.profileLink) ? (
                <a
                  href={selected.profileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground underline underline-offset-4 hover:text-muted"
                >
                  Open profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

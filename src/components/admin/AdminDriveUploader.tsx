"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Folder,
  File as FileIcon,
  Loader2,
  RefreshCw,
  Upload,
  HardDrive,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import {
  ADMIN_UPLOAD_CATEGORIES,
  ADMIN_UPLOAD_MAX_BYTES,
  allowedExtensionsFor,
  normalizeExtension,
  normalizeSubjectCode,
  previewAdminUpload,
  type AdminUploadCategory,
} from "@/lib/adminDriveUpload";
import type { AcademicYear, Branch, Semester } from "@/lib/academic/scope";
import {
  ACADEMIC_YEAR_OPTIONS,
  BRANCH_OPTIONS,
  SEMESTER_OPTIONS,
} from "@/lib/academic/scope";
import { Button, Card, Input, Select } from "@/components/ui";
import { notify } from "@/lib/toast";

type DriveItem = {
  id: string;
  name: string;
  isFolder: boolean;
  modifiedTime: string | null;
  size: number | null;
  path: string;
};

type SubjectOption = { value: string; label: string };

const KNOWN_SUBJECTS: Record<string, string[]> = {
  "AIDS:5": ["AISA", "DVP", "GML", "MCPT", "ML", "OS", "PBL_III", "SEM", "UIUX"],
  "CSE:5": ["CN", "DBMS", "FLAT", "OS", "PBL_III", "SE"],
};

function extensionFromFile(file: File): string | null {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop() || ""
    : "";
  return normalizeExtension(fromName);
}

async function putToSession(
  sessionUrl: string,
  file: File,
): Promise<{ id: string; modifiedTime?: string }> {
  const res = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(file.size),
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Drive upload failed (${res.status})`);
  }
  const json = (await res.json()) as { id?: string; modifiedTime?: string };
  if (!json.id) throw new Error("Drive did not return a file id.");
  return { id: json.id, modifiedTime: json.modifiedTime };
}

export function AdminDriveUploader({
  defaultYear = "2026-2027",
  defaultBranch = "AIDS",
  defaultSemester = 5,
}: {
  defaultYear?: AcademicYear;
  defaultBranch?: Branch;
  defaultSemester?: Semester;
}) {
  const [year, setYear] = useState<AcademicYear>(defaultYear);
  const [branch, setBranch] = useState<Branch>(defaultBranch);
  const [semester, setSemester] = useState<Semester>(defaultSemester);
  const [category, setCategory] = useState<AdminUploadCategory>("notes");
  const [subject, setSubject] = useState("GML");
  const [customSubject, setCustomSubject] = useState("");
  const [unit, setUnit] = useState("1");
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [examTerm, setExamTerm] = useState<"Mid" | "End" | "">("End");
  const [writeupNumber, setWriteupNumber] = useState("1");
  const [assignmentNumber, setAssignmentNumber] = useState("1");
  const [qbYear, setQbYear] = useState("");
  const [qbSolved, setQbSolved] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [browsePath, setBrowsePath] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [listing, setListing] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const subjectKey = `${branch}:${semester}`;
  const subjectOptions = useMemo<SubjectOption[]>(() => {
    const known = KNOWN_SUBJECTS[subjectKey] || [];
    const values = [...known];
    if (customSubject.trim()) {
      const code = normalizeSubjectCode(customSubject);
      if (code && !values.includes(code)) values.push(code);
    }
    if (subject && !values.includes(subject)) values.unshift(subject);
    return [
      ...values.map((value) => ({ value, label: value })),
      { value: "__custom", label: "Other subject…" },
    ];
  }, [subjectKey, customSubject, subject]);

  const activeSubject =
    subject === "__custom"
      ? normalizeSubjectCode(customSubject) || ""
      : subject;

  const extension = file ? extensionFromFile(file) : "pdf";
  const preview = useMemo(() => {
    if (!activeSubject || !extension) return null;
    try {
      return previewAdminUpload({
        year,
        branch,
        semester,
        subject: activeSubject,
        category,
        extension,
        unit,
        examYear: examYear ? Number(examYear) : undefined,
        examTerm: examTerm || undefined,
        writeupNumber,
        assignmentNumber,
        qbYear: qbYear ? Number(qbYear) : undefined,
        qbSolved,
      });
    } catch {
      return null;
    }
  }, [
    activeSubject,
    extension,
    year,
    branch,
    semester,
    category,
    unit,
    examYear,
    examTerm,
    writeupNumber,
    assignmentNumber,
    qbYear,
    qbSolved,
  ]);

  const refreshList = useCallback(async (path = browsePath) => {
    setListError(null);
    setListing(true);
    try {
      const res = await authFetch(
        `/api/admin/drive/list?path=${encodeURIComponent(path)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to list folder");
      setItems((json.items || []) as DriveItem[]);
      setBrowsePath(json.path || "");
    } catch (error: unknown) {
      setListError(
        error instanceof Error ? error.message : "Failed to list Drive",
      );
      setItems([]);
    } finally {
      setListing(false);
    }
  }, [browsePath]);

  useEffect(() => {
    let cancelled = false;
    void authFetch("/api/admin/drive/list?path=")
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "Failed to list folder");
        setItems((json.items || []) as DriveItem[]);
        setBrowsePath(json.path || "");
        setListError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListError(
          error instanceof Error ? error.message : "Failed to list Drive",
        );
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setListing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const crumbs = browsePath ? browsePath.split("/").filter(Boolean) : [];

  const openFolder = (path: string) => {
    void refreshList(path);
  };

  const startUpload = async (overwrite = false) => {
    if (!file || !preview || !activeSubject || !extension) {
      notify.error("Pick a valid subject and file first.");
      return;
    }
    if (file.size > ADMIN_UPLOAD_MAX_BYTES) {
      notify.error("File must be 80 MB or smaller.");
      return;
    }
    if (!allowedExtensionsFor(category).has(extension)) {
      notify.error(`.${extension} is not allowed for ${category}.`);
      return;
    }

    setUploading(true);
    setStatus("Creating Drive session…");
    try {
      const sessionRes = await authFetch("/api/admin/drive/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          branch,
          semester,
          subject: activeSubject,
          category,
          extension,
          unit,
          examYear: examYear ? Number(examYear) : undefined,
          examTerm: examTerm || undefined,
          writeupNumber,
          assignmentNumber,
          qbYear: qbYear ? Number(qbYear) : undefined,
          qbSolved,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          destPath: preview.destPath,
          overwrite,
        }),
      });
      const sessionJson = await sessionRes.json();
      if (sessionRes.status === 409 && sessionJson.code === "exists") {
        const ok = window.confirm(
          `${sessionJson.remoteName} already exists in Drive. Replace it?`,
        );
        if (ok) {
          setUploading(false);
          await startUpload(true);
          return;
        }
        throw new Error("Upload cancelled — file already exists.");
      }
      if (!sessionRes.ok) {
        throw new Error(sessionJson.error || "Could not start upload");
      }

      setStatus("Uploading to Google Drive…");
      const uploaded = await putToSession(sessionJson.sessionUrl as string, file);

      setStatus("Publishing to the vault…");
      const commitRes = await authFetch("/api/admin/drive/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: uploaded.id,
          remoteName: sessionJson.remoteName,
          destPath: sessionJson.destPath,
          updatedAt: uploaded.modifiedTime,
          year,
          branch,
          semester,
          subject: activeSubject,
          category,
        }),
      });
      const commitJson = await commitRes.json();
      if (!commitRes.ok) {
        throw new Error(commitJson.error || "Catalog commit failed");
      }

      notify.success(`${sessionJson.remoteName} is in the vault.`);
      setStatus(`Uploaded ${sessionJson.fullPath}`);
      setFile(null);
      await refreshList(browsePath || sessionJson.destPath);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Upload failed";
      notify.error(message);
      setStatus(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl" padding="lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
            <Upload className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Upload notes
            </h3>
            <p className="text-sm text-muted mt-0.5">
              Pick the semester folder fields. The site names the file and
              writes it into Utility Drive, then publishes it to the vault.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <div>
            <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
              Year
            </label>
            <Select
              value={year}
              options={ACADEMIC_YEAR_OPTIONS}
              onChange={setYear}
            />
          </div>
          <div>
            <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
              Branch
            </label>
            <Select
              value={branch}
              options={BRANCH_OPTIONS}
              onChange={setBranch}
            />
          </div>
          <div>
            <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
              Semester
            </label>
            <Select
              value={semester}
              options={SEMESTER_OPTIONS}
              onChange={setSemester}
            />
          </div>
          <div>
            <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
              Category
            </label>
            <Select
              value={category}
              options={ADMIN_UPLOAD_CATEGORIES.map((c) => ({
                value: c.value,
                label: c.label,
              }))}
              onChange={setCategory}
            />
          </div>
          <div>
            <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
              Subject
            </label>
            <Select
              value={
                subjectOptions.some((o) => o.value === subject)
                  ? subject
                  : "__custom"
              }
              options={subjectOptions}
              onChange={(value) => {
                setSubject(value);
                if (value !== "__custom") setCustomSubject("");
              }}
            />
          </div>
          {(subject === "__custom" ||
            !KNOWN_SUBJECTS[subjectKey]?.includes(subject)) && (
            <div>
              <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                Subject code
              </label>
              <Input
                value={customSubject || (subject === "__custom" ? "" : subject)}
                onChange={(e) => {
                  setSubject("__custom");
                  setCustomSubject(e.target.value.toUpperCase());
                }}
                placeholder="GML"
              />
            </div>
          )}

          {(category === "notes" || category === "ppt") && (
            <div>
              <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                Unit
              </label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          )}
          {category === "pyq" && (
            <>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                  Exam year
                </label>
                <Input
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                  Term
                </label>
                <Select
                  value={examTerm || "End"}
                  options={[
                    { value: "End", label: "End" },
                    { value: "Mid", label: "Mid" },
                  ]}
                  onChange={(v) => setExamTerm(v)}
                />
              </div>
            </>
          )}
          {category === "qb" && (
            <>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                  QB year (optional)
                </label>
                <Input
                  value={qbYear}
                  onChange={(e) => setQbYear(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={qbSolved}
                    onChange={(e) => setQbSolved(e.target.checked)}
                    className="rounded border-border"
                  />
                  Solved
                </label>
              </div>
            </>
          )}
          {category === "writeups" && (
            <div>
              <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                Writeup number
              </label>
              <Input
                value={writeupNumber}
                onChange={(e) => setWriteupNumber(e.target.value)}
              />
            </div>
          )}
          {category === "codes" && (
            <div>
              <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                Assignment number
              </label>
              <Input
                value={assignmentNumber}
                onChange={(e) => setAssignmentNumber(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-5">
          <label className="block text-2xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">
            File
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-xs file:font-semibold file:text-background"
          />
          <p className="text-xs text-muted mt-2">
            Original filename is ignored. Max 80 MB.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-surface/50 px-4 py-3">
          <p className="text-2xs font-bold uppercase tracking-widest text-muted mb-1">
            Destination
          </p>
          <p className="text-sm font-mono text-foreground break-all">
            {preview?.fullPath ||
              "Fill the fields above to preview the Drive path."}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void startUpload(false)}
            disabled={uploading || !file || !preview}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{uploading ? "Uploading…" : "Upload to Drive"}</span>
          </Button>
          {status ? (
            <p className="text-sm text-muted self-center">{status}</p>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-2xl" padding="lg">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Utility Drive
              </h3>
              <p className="text-xs text-muted">
                One folder level at a time. Refresh after uploads.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void refreshList(browsePath)}
            disabled={listing}
          >
            {listing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>

        <nav className="flex flex-wrap items-center gap-1 text-xs mb-4">
          <button
            type="button"
            className="text-primary font-semibold hover:underline"
            onClick={() => openFolder("")}
          >
            Root
          </button>
          {crumbs.map((crumb, i) => {
            const path = crumbs.slice(0, i + 1).join("/");
            return (
              <span key={path} className="inline-flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-muted" />
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline"
                  onClick={() => openFolder(path)}
                >
                  {crumb}
                </button>
              </span>
            );
          })}
        </nav>

        {listError ? (
          <p className="text-sm text-destructive">{listError}</p>
        ) : listing && items.length === 0 ? (
          <p className="text-sm text-muted flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">This folder is empty.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {items.map((item) => (
              <li key={item.id}>
                {item.isFolder ? (
                  <button
                    type="button"
                    onClick={() => openFolder(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
                  >
                    <Folder className="w-4 h-4 text-muted shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </span>
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-3 px-4 py-3">
                    <FileIcon className="w-4 h-4 text-muted shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">
                      {item.name}
                    </span>
                    {item.size != null ? (
                      <span className="text-2xs text-muted shrink-0">
                        {Math.round(item.size / 1024)} KB
                      </span>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

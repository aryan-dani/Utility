"use client";

import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Trash,
  Edit2,
  Check,
  X,
  File as FileIcon,
  LogOut,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  ChevronDown,
  CheckCircle2,
  CloudFog,
  ExternalLink,
  HardDrive,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Subject {
  id: string;
  name: string;
  branch: string;
  semester: number;
}

interface Resource {
  id: string;
  title: string;
  file_url: string;
  subject_id: string;
  is_indexed?: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unknown error occurred.";
}

export default function AdminClient() {
  const router = useRouter();
  const [tab, setTab] = useState<"drive" | "manage">("drive");
  const [branch, setBranch] = useState("AIDS");
  const [semester, setSemester] = useState("4");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Manage State
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");

  const [message, setMessage] = useState("");
  const [syncingDrive, setSyncingDrive] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email ?? null);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    setMessage("");
    try {
      const response = await fetch("/api/webhooks/storage-sync", {
        method: "POST",
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(
          `Server returned status ${response.status} (Not JSON). Response snippet: ${text.substring(0, 300)}`
        );
      }
      if (response.ok && data.success) {
        setMessage(
          "✓ Google Drive sync and indexing triggered in the background. It will take a few minutes to process.",
        );
      } else {
        setMessage(`Error syncing: ${data.error || "Failed to trigger sync"}`);
      }
    } catch (err) {
      setMessage(`Error syncing: ${getErrorMessage(err)}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  const fetchAdminData = useCallback(async () => {
    setLoadingResources(true);
    try {
      const res = await fetch(
        `/api/admin/resources?branch=${branch}&semester=${semester}`
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setSubjects(data.subjects || []);
      setResources(data.resources || []);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoadingResources(false);
    }
  }, [branch, semester]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Warning: If this file still exists in Google Drive, it will be recreated on the next sync. Make sure to delete it from Drive first. Continue with local db deletion?",
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/resources?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }

      setResources((prev) => prev.filter((r) => r.id !== id));
      setMessage("✓ File deleted successfully from local database.");
    } catch (error: unknown) {
      alert(`Error deleting: ${getErrorMessage(error)}`);
    }
  };

  const startEdit = (resource: Resource) => {
    setEditingId(resource.id);
    setEditTitle(resource.title);
    setEditSubjectId(resource.subject_id);
  };

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch("/api/admin/resources", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          title: editTitle,
          subject_id: editSubjectId,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }

      setResources((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, title: editTitle, subject_id: editSubjectId }
            : r,
        ),
      );
      setEditingId(null);
      setMessage("✓ Resource updated.");
    } catch (error: unknown) {
      alert(`Error updating: ${getErrorMessage(error)}`);
    }
  };

  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim()) ?? [];
  const isAdmin = userEmail && adminEmails.includes(userEmail);

  if (loadingAuth) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] w-full bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
          <p className="text-xs text-muted font-semibold">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen w-full p-6 text-center bg-background">
        <div className="max-w-md w-full bg-card border border-border p-8 rounded-2xl shadow-sm flex flex-col items-center">
          <ShieldAlert className="w-12 h-12 text-destructive mb-4 animate-pulse" />
          <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-2">Access Denied</h2>
          <p className="text-xs text-muted mb-6 leading-relaxed">
            You do not have permissions to access the admin dashboard. Please sign in with an authorized administrator account.
          </p>
          <Link
            href="/"
            className="px-4 py-2 bg-foreground text-background font-semibold text-xs rounded-xl hover:opacity-90 transition-all shadow-xs"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card p-6 flex-col hidden md:flex h-screen sticky top-0 justify-between">
        <div className="flex flex-col flex-1 min-h-0">
          <Link
            href="/"
            className="flex items-center gap-2 mb-8 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-semibold tracking-tight">
              Return Home
            </span>
          </Link>
          <div className="flex items-center gap-2 mb-8">
            <ShieldCheck className="w-5 h-5 text-foreground" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Admin
            </h2>
          </div>

          <nav className="flex-1 space-y-2">
            <button
              onClick={() => setTab("drive")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === "drive"
                  ? "bg-surface text-foreground border border-border-strong shadow-xs"
                  : "text-muted hover:text-foreground hover:bg-surface border border-transparent"
              }`}
            >
              <CloudFog className="w-4 h-4" />
              Drive Manager
            </button>

            <button
              onClick={() => setTab("manage")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === "manage"
                  ? "bg-surface text-foreground border border-border-strong shadow-xs"
                  : "text-muted hover:text-foreground hover:bg-surface border border-transparent"
              }`}
            >
              <HardDrive className="w-4 h-4" />
              File Manager
            </button>
          </nav>
        </div>

        <div className="mt-auto pt-6 border-t border-border">
          {userEmail && (
            <p className="text-xs text-muted font-medium mb-3 truncate px-1">
              {userEmail}
            </p>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted hover:text-destructive border border-transparent hover:border-destructive/20 rounded-xl hover:bg-destructive/5 transition-all mb-4"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
          <p className="text-[10px] text-muted/50 text-center tracking-tight font-semibold pt-3 border-t border-border/20">
            Crafted by{" "}
            <a
              href="https://www.aryandani.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold hover:underline hover:text-foreground text-muted/80 transition-colors"
            >
              Aryan Dani
            </a>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6 sm:p-10 w-full">
        <div className="md:hidden flex items-center gap-3 mb-6 pb-6 border-b border-border">
          <Link
            href="/"
            className="p-2 rounded-lg bg-surface border border-border text-muted"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-foreground" /> Admin
          </h2>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTab("drive")}
              className={`p-2 rounded-lg ${tab === "drive" ? "bg-surface text-foreground border border-border-strong shadow-xs" : "text-muted"} `}
            >
              <CloudFog className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTab("manage")}
              className={`p-2 rounded-lg ${tab === "manage" ? "bg-surface text-foreground border border-border-strong shadow-xs" : "text-muted"} `}
            >
              <HardDrive className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Message */}
        {message && (
          <div className="mb-6 p-4 rounded-xl text-sm font-medium border bg-surface border-border-strong text-foreground flex items-start gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>{message}</p>
          </div>
        )}

        {tab === "drive" && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <CloudFog className="w-6 h-6 text-foreground" />
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Google Drive Integration
                </h3>
              </div>
              <p className="text-sm text-muted mb-8 max-w-2xl leading-relaxed">
                Utility uses Google Drive as the single source of truth. Do not
                upload files here. Instead, upload your PDFs, DOCs, and PPTs
                into the Google Drive folder. Once uploaded, click "Sync Now" to
                ingest them into Firebase and start AI indexing.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://drive.google.com" // Provide a proper URL in env var later if needed
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-foreground text-background font-semibold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <span>Open Google Drive</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={handleSyncDrive}
                  disabled={syncingDrive}
                  className="flex items-center justify-center gap-2 bg-surface text-foreground border border-border font-semibold text-sm px-6 py-3 rounded-xl hover:bg-surface-hover hover:border-border-strong transition-all disabled:opacity-50"
                >
                  {syncingDrive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <HardDrive className="w-4 h-4" />
                  )}
                  <span>{syncingDrive ? "Syncing..." : "Sync Now"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "manage" && (
          <div className="flex flex-col gap-6 animate-fade-in flex-1 min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface/50 p-5 rounded-2xl border border-border shadow-sm shrink-0">
              <div className="relative">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                  Branch
                </label>
                <div className="relative group">
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="appearance-none w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                  >
                    <option value="AIDS">AIDS</option>
                    <option value="CSE">CSE</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-muted pointer-events-none" />
                </div>
              </div>
              <div className="relative">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2 ml-1">
                  Semester
                </label>
                <div className="relative group">
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="appearance-none w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
              {loadingResources ? (
                <div className="p-12 flex items-center justify-center flex-1">
                  <Loader2 className="w-5 h-5 animate-spin text-muted" />
                </div>
              ) : resources.length === 0 ? (
                <div className="p-12 text-center text-muted text-sm flex-1">
                  No files found for this branch and semester.
                </div>
              ) : (
                <div className="divide-y divide-border overflow-y-auto flex-1 min-h-0">
                  {resources.map((resource) => {
                    const subject = subjects.find(
                      (s) => s.id === resource.subject_id,
                    );
                    const isEditing = editingId === resource.id;
                    return (
                      <div
                        key={resource.id}
                        className="p-4 flex items-center justify-between hover:bg-surface/30 transition-all"
                      >
                        <div className="flex-1 mr-4 min-w-0">
                          {isEditing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-primary text-foreground"
                                placeholder="Resource Title"
                              />
                              <div className="relative">
                                <select
                                  value={editSubjectId}
                                  onChange={(e) =>
                                    setEditSubjectId(e.target.value)
                                  }
                                  className="appearance-none w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-primary text-foreground pr-8"
                                >
                                  {subjects.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                      {sub.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-muted pointer-events-none" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <FileIcon className="w-4 h-4 text-foreground shrink-0" />
                              <div className="min-w-0">
                                <h3 className="font-bold text-foreground text-sm tracking-tight truncate">
                                  {resource.title}
                                </h3>
                                <div className="flex items-center flex-wrap gap-2 mt-1">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                                    {subject?.name || "Uncategorized"}
                                  </span>
                                  {(() => {
                                    const indexableExts = ['.pdf', '.docx', '.pptx', '.doc', '.ppt'];
                                    const isIndexable = indexableExts.some(ext => 
                                      resource.title.toLowerCase().endsWith(ext)
                                    );
                                    if (resource.is_indexed) {
                                      return (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                                          <span className="w-1 h-1 rounded-full bg-foreground"></span>
                                          Indexed
                                        </span>
                                      );
                                    } else if (isIndexable) {
                                      return (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted flex items-center gap-1 animate-pulse">
                                          <span className="w-1 h-1 rounded-full bg-muted"></span>
                                          Indexing...
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted/70 flex items-center gap-1">
                                          <span className="w-1 h-1 rounded-full bg-muted/50"></span>
                                          Static / Non-Indexable
                                        </span>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(resource.id)}
                                className="p-1.5 bg-foreground text-background rounded-lg hover:opacity-90"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 bg-surface border border-border text-muted hover:text-foreground rounded-lg"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <a
                                href={resource.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-lg"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => startEdit(resource)}
                                className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-lg"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(resource.id)}
                                className="p-1.5 text-muted hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

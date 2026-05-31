"use client";

import { useState, useEffect, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
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
      const data = await response.json();
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

  const fetchSubjects = useCallback(async () => {
    try {
      const q = query(
        collection(db, "subjects"),
        where("branch", "==", branch),
        where("semester", "==", parseInt(semester)),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "",
        branch: doc.data().branch || "",
        semester: Number(doc.data().semester || 0),
      }));

      data.sort((a, b) => a.name.localeCompare(b.name));
      setSubjects(data);
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  }, [branch, semester]);

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    try {
      const subjectsSnapshot = await getDocs(
        query(
          collection(db, "subjects"),
          where("branch", "==", branch),
          where("semester", "==", parseInt(semester)),
        ),
      );

      if (subjectsSnapshot.empty) {
        setResources([]);
        setLoadingResources(false);
        return;
      }

      const subjectIds: string[] = [];
      subjectsSnapshot.docs.forEach((doc) => {
        subjectIds.push(doc.id);
      });

      const resourcesList: Resource[] = [];
      const chunkSize = 30;

      for (let i = 0; i < subjectIds.length; i += chunkSize) {
        const chunk = subjectIds.slice(i, i + chunkSize);
        const q = query(
          collection(db, "resources"),
          where("subject_id", "in", chunk),
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) continue;

        const resourceDocIds = snapshot.docs.map((d) => d.id);
        const rcSnapshot = await getDocs(
          query(
            collection(db, "resource_content"),
            where("resource_id", "in", resourceDocIds.slice(0, 30)),
          ),
        );
        const indexedResourceIds = new Set(
          rcSnapshot.docs.map((doc) => doc.data().resource_id),
        );

        snapshot.docs.forEach((doc) => {
          const d = doc.data();
          resourcesList.push({
            id: doc.id,
            title: d.title || "",
            file_url: d.file_url || "",
            subject_id: d.subject_id || "",
            is_indexed: indexedResourceIds.has(doc.id),
          });
        });
      }

      setResources(resourcesList);
    } catch (err) {
      console.error("Error fetching resources:", err);
    }
    setLoadingResources(false);
  }, [branch, semester]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    if (tab === "manage") fetchResources();
  }, [tab, fetchResources]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Warning: If this file still exists in Google Drive, it will be recreated on the next sync. Make sure to delete it from Drive first. Continue with local db deletion?",
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "resources", id));

      const rcSnapshot = await getDocs(
        query(
          collection(db, "resource_content"),
          where("resource_id", "==", id),
        ),
      );
      for (const docSnap of rcSnapshot.docs) {
        await deleteDoc(docSnap.ref);
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
      await updateDoc(doc(db, "resources", id), {
        title: editTitle,
        subject_id: editSubjectId,
      });
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

  return (
    <div className="flex w-full min-h-[85vh] bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card p-6 flex-col hidden md:flex">
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
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Admin
          </h2>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setTab("drive")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              tab === "drive"
                ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
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
                ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                : "text-muted hover:text-foreground hover:bg-surface border border-transparent"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            File Manager
          </button>
        </nav>

        <div className="mt-8 pt-6 border-t border-border">
          {userEmail && (
            <p className="text-xs text-muted font-medium mb-3 truncate px-1">
              {userEmail}
            </p>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted hover:text-destructive border border-transparent hover:border-destructive/20 rounded-xl hover:bg-destructive/5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6 sm:p-10 max-w-5xl mx-auto w-full">
        <div className="md:hidden flex items-center gap-3 mb-6 pb-6 border-b border-border">
          <Link
            href="/"
            className="p-2 rounded-lg bg-surface border border-border text-muted"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" /> Admin
          </h2>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTab("drive")}
              className={`p-2 rounded-lg ${tab === "drive" ? "bg-indigo-500/10 text-indigo-500" : "text-muted"} `}
            >
              <CloudFog className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTab("manage")}
              className={`p-2 rounded-lg ${tab === "manage" ? "bg-indigo-500/10 text-indigo-500" : "text-muted"} `}
            >
              <HardDrive className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Message */}
        {message && (
          <div className="mb-6 p-4 rounded-xl text-sm font-medium border bg-indigo-500/10 border-indigo-500/30 text-indigo-500 flex items-start gap-3">
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
                  className="flex items-center justify-center gap-2 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-indigo-500/20 transition-all disabled:opacity-50"
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
          <div className="flex flex-col gap-6 animate-fade-in flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface/50 p-5 rounded-2xl border border-border shadow-sm">
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

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex-1 flex flex-col">
              {loadingResources ? (
                <div className="p-12 flex items-center justify-center flex-1">
                  <Loader2 className="w-5 h-5 animate-spin text-muted" />
                </div>
              ) : resources.length === 0 ? (
                <div className="p-12 text-center text-muted text-sm flex-1">
                  No files found for this branch and semester.
                </div>
              ) : (
                <div className="divide-y divide-border overflow-y-auto max-h-[500px]">
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
                              <FileIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                              <div className="min-w-0">
                                <h3 className="font-bold text-foreground text-sm tracking-tight truncate">
                                  {resource.title}
                                </h3>
                                <div className="flex items-center flex-wrap gap-2 mt-1">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                                    {subject?.name || "Uncategorized"}
                                  </span>
                                  {resource.is_indexed ? (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
                                      <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                      Indexed
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1 animate-pulse">
                                      <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                      Indexing...
                                    </span>
                                  )}
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

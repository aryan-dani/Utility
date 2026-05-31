'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Trash, Edit2, Check, X, File as FileIcon, LogOut, ShieldCheck, ArrowLeft, Loader2, ChevronDown, Plus, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

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
  return 'An unknown error occurred.';
}

export default function AdminClient() {
  const [tab, setTab] = useState<'upload' | 'manage'>('upload');
  const [branch, setBranch] = useState('AIDS');
  const [semester, setSemester] = useState('4');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Upload State
  const [selectedSubject, setSelectedSubject] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage State
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubjectId, setEditSubjectId] = useState('');

  const [message, setMessage] = useState('');
  const [syncingDrive, setSyncingDrive] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email ?? null);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  const handleSyncDrive = async () => {
    setSyncingDrive(true);
    setMessage('');
    try {
      const response = await fetch('/api/webhooks/storage-sync', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage('✓ Google Drive sync and indexing triggered in the background. It will take a few minutes to process.');
      } else {
        setMessage(`Error syncing: ${data.error || 'Failed to trigger sync'}`);
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
        collection(db, 'subjects'),
        where('branch', '==', branch),
        where('semester', '==', parseInt(semester))
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        branch: doc.data().branch || '',
        semester: Number(doc.data().semester || 0)
      }));

      // Sort alphabetically by name
      data.sort((a, b) => a.name.localeCompare(b.name));

      const filtered = data.filter(
        (sub) => !(branch === 'AIDS' && sub.name.toUpperCase() === 'DBMS'),
      );
      setSubjects(filtered);
      setSelectedSubject(filtered.length > 0 ? filtered[0].id : '');
    } catch (err) {
      console.error("Error fetching subjects in admin:", err);
    }
  }, [branch, semester]);

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    try {
      // 1. Fetch matching subjects to get their IDs and Names
      const subjectsSnapshot = await getDocs(query(
        collection(db, 'subjects'),
        where('branch', '==', branch),
        where('semester', '==', parseInt(semester))
      ));

      if (subjectsSnapshot.empty) {
        setResources([]);
        setLoadingResources(false);
        return;
      }

      const subjectsMap = new Map<string, string>();
      const subjectIds: string[] = [];

      subjectsSnapshot.docs.forEach(doc => {
        subjectsMap.set(doc.id, doc.data().name || "");
        subjectIds.push(doc.id);
      });

      // 2. Fetch resources for these subjects
      const resourcesList: Resource[] = [];
      const chunkSize = 30;

      for (let i = 0; i < subjectIds.length; i += chunkSize) {
        const chunk = subjectIds.slice(i, i + chunkSize);
        const q = query(collection(db, 'resources'), where('subject_id', 'in', chunk));
        const snapshot = await getDocs(q);

        if (snapshot.empty) continue;

        // Query indexed content check (limit array filter to matching resources)
        const resourceDocIds = snapshot.docs.map(d => d.id);
        const rcSnapshot = await getDocs(query(
          collection(db, 'resource_content'),
          where('resource_id', 'in', resourceDocIds.slice(0, 30)) // Firestore limit is 30 for 'in'
        ));
        const indexedResourceIds = new Set(rcSnapshot.docs.map(doc => doc.data().resource_id));

        snapshot.docs.forEach(doc => {
          const d = doc.data();
          resourcesList.push({
            id: doc.id,
            title: d.title || "",
            file_url: d.file_url || "",
            subject_id: d.subject_id || "",
            is_indexed: indexedResourceIds.has(doc.id)
          });
        });
      }

      setResources(resourcesList);
    } catch (err) {
      console.error("Error fetching resources in admin:", err);
    }
    setLoadingResources(false);
  }, [branch, semester]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    if (tab === 'manage') fetchResources();
  }, [tab, fetchResources]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile && !title) {
      setTitle(selectedFile.name.split('.').slice(0, -1).join('.'));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedSubject || !title) return;
    setUploading(true);
    setMessage('');

    try {
      const subj = subjects.find((s) => s.id === selectedSubject);
      const subjectName = subj ? subj.name : 'Uncategorized';
      const fileExt = file.name.split('.').pop();
      const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
      const filePath = `${branch}/Sem_${semester}/${subjectName}/${cleanTitle}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

      // Firebase Storage upload
      const storageRef = ref(storage, `course-content/${filePath}`);
      await uploadBytes(storageRef, file);
      const publicUrl = await getDownloadURL(storageRef);

      // Firestore insert
      const newResourceRef = doc(collection(db, 'resources'));
      await setDoc(newResourceRef, {
        subject_id: selectedSubject,
        title,
        file_url: publicUrl,
        created_at: new Date().toISOString()
      });

      // Trigger RAG indexing webhook in the background
      fetch('/api/webhooks/storage-sync', { method: 'POST' }).catch((err) => {
        console.warn('Failed to auto-trigger indexing pipeline:', err);
      });

      setMessage('✓ File uploaded, linked and queued for AI indexing.');
      setTitle('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: unknown) {
      setMessage(`Error: ${getErrorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm('Permanently delete this file?')) return;
    try {
      // Firebase Storage delete
      if (fileUrl.includes('/course-content/')) {
        const decodedUrl = decodeURIComponent(fileUrl);
        const pathStartIdx = decodedUrl.indexOf('/o/');
        if (pathStartIdx !== -1) {
          const pathEndIdx = decodedUrl.indexOf('?');
          const storagePath = decodedUrl.substring(pathStartIdx + 3, pathEndIdx !== -1 ? pathEndIdx : undefined);
          const fileRef = ref(storage, storagePath);
          await deleteObject(fileRef).catch(err => {
            console.warn("Storage object delete failed (might not exist):", err);
          });
        }
      }

      // Firestore delete
      await deleteDoc(doc(db, 'resources', id));

      // Also delete matching resource_content documents if any
      const rcSnapshot = await getDocs(query(
        collection(db, 'resource_content'),
        where('resource_id', '==', id)
      ));
      for (const docSnap of rcSnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }

      setResources((prev) => prev.filter((r) => r.id !== id));
      setMessage('✓ File deleted successfully.');
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
      await updateDoc(doc(db, 'resources', id), {
        title: editTitle,
        subject_id: editSubjectId
      });
      setResources((prev) =>
        prev.map((r) => (r.id === id ? { ...r, title: editTitle, subject_id: editSubjectId } : r)),
      );
      setEditingId(null);
      setMessage('✓ Resource updated.');
    } catch (error: unknown) {
      alert(`Error updating: ${getErrorMessage(error)}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6 pb-8 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link 
              href="/" 
              className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-all hover:bg-surface-hover"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              <span>Admin Access</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          {userEmail && <p className="text-sm text-muted mt-1 font-medium">{userEmail}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Tab switcher */}
          <div className="flex p-1 bg-surface border border-border rounded-xl text-sm shadow-sm">
            {(['upload', 'manage'] as const).map((t) => (
              <button
                key={t}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                  tab === t 
                    ? 'bg-foreground text-background shadow-md scale-[1.02]' 
                    : 'text-muted hover:text-foreground hover:bg-surface-hover'
                }`}
                onClick={() => {
                  setTab(t);
                  setMessage('');
                  setEditingId(null);
                }}
              >
                {t === 'upload' ? <Plus className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                {t === 'upload' ? 'Upload' : 'Manage'}
              </button>
            ))}
          </div>

          <button
            onClick={handleSyncDrive}
            disabled={syncingDrive}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted hover:text-foreground border border-border rounded-xl hover:bg-surface-hover transition-all disabled:opacity-50"
          >
            {syncingDrive ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Sync Drive</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted hover:text-red-500 border border-border rounded-xl hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-surface-hover/50 p-5 rounded-2xl border border-border shadow-sm">
        <div className="relative">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2 ml-1">Branch</label>
          <div className="relative group">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="appearance-none w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all group-hover:border-border-strong"
            >
              <option value="AIDS">AIDS</option>
              <option value="CSE">CSE</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="relative">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2 ml-1">Semester</label>
          <div className="relative group">
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="appearance-none w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all group-hover:border-border-strong"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-5 p-3.5 rounded-lg text-sm border bg-surface border-border text-foreground`}
        >
          {message}
        </div>
      )}

      {/* Upload Tab */}
      {tab === 'upload' && (
        <form onSubmit={handleUpload} className="space-y-5 bg-card p-6 rounded-xl border border-border">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">Resource File</label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                isDragActive
                  ? 'border-primary bg-primary/5 text-primary scale-[1.01]'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5 text-foreground'
                  : 'border-border bg-surface hover:bg-surface-hover hover:border-border-strong text-muted'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              
              {file ? (
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2">
                    <FileIcon className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground max-w-[280px] truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full mt-3">
                    Ready to Upload
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center animate-fade-in">
                  <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-muted-foreground mb-2">
                    <Plus className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Drag and drop file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
                  <p className="text-[10px] text-muted-foreground mt-3 font-mono">Supports PDF, PPT, DOC, etc.</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-filled from filename"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-2 ml-1">Subject</label>
            <div className="relative group">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="appearance-none w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all group-hover:border-border-strong disabled:opacity-50"
                required
                disabled={subjects.length === 0}
              >
                {subjects.length === 0 ? (
                  <option value="">No subjects found</option>
                ) : (
                  subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))
                )}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading || !selectedSubject}
            className="w-full bg-foreground text-background py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              'Upload & Publish'
            )}
          </button>
        </form>
      )}

      {/* Manage Tab */}
      {tab === 'manage' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loadingResources ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            </div>
          ) : resources.length === 0 ? (
            <div className="p-12 text-center text-muted text-sm">
              No files found for this branch and semester.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {resources.map((resource) => {
                const subject = subjects.find((s) => s.id === resource.subject_id);
                const isEditing = editingId === resource.id;
                return (
                  <div
                    key={resource.id}
                    className="p-5 flex items-center justify-between hover:bg-surface/50 transition-all border-b border-border/50 last:border-0"
                  >
                    <div className="flex-1 mr-6 min-w-0">
                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface p-3 rounded-xl border border-border">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                            placeholder="Resource Title"
                          />
                          <div className="relative group">
                            <select
                               value={editSubjectId}
                               onChange={(e) => setEditSubjectId(e.target.value)}
                               className="appearance-none w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all"
                            >
                              {subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-sm">
                            <FileIcon className="w-5 h-5 text-muted" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-sm tracking-tight truncate">
                              {resource.title}
                            </h3>
                            <div className="flex items-center flex-wrap gap-2 mt-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {subject?.name || 'Uncategorized'}
                              </span>
                              <span className="text-[10px] text-muted font-mono uppercase tracking-tighter">
                                ID: {resource.id.slice(0, 8)}
                              </span>
                              {resource.is_indexed ? (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                  Indexed
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                  <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                  Indexing...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => saveEdit(resource.id)}
                            className="w-9 h-9 flex items-center justify-center bg-foreground text-background rounded-xl hover:opacity-90 transition-all shadow-sm"
                            title="Save Changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-9 h-9 flex items-center justify-center bg-surface border border-border text-muted hover:text-foreground rounded-xl transition-all"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <a
                            href={resource.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase bg-surface border border-border rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-all"
                          >
                            View File
                          </a>
                          <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
                            <button
                              onClick={() => startEdit(resource)}
                              className="p-2 text-muted hover:text-foreground hover:bg-surface rounded-lg transition-all"
                              title="Edit Resource"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(resource.id, resource.file_url)}
                              className="p-2 text-muted hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                              title="Delete Resource"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

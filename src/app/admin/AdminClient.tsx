'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase';
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
  const supabase = useMemo(() => createClient(), []);

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase
      .from('subjects')
      .select('*')
      .eq('branch', branch)
      .eq('semester', parseInt(semester));
    const filtered = (data || []).filter(
      (sub: Subject) => !(branch === 'AIDS' && sub.name.toUpperCase() === 'DBMS'),
    );
    setSubjects(filtered);
    setSelectedSubject(filtered.length > 0 ? filtered[0].id : '');
  }, [supabase, branch, semester]);

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    const { data, error } = await supabase
      .from('resources')
      .select(`
        id, 
        title, 
        file_url, 
        subject_id, 
        subjects!inner(branch, semester),
        resource_content(id)
      `)
      .eq('subjects.branch', branch)
      .eq('subjects.semester', parseInt(semester));

    if (!error) {
      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        file_url: r.file_url,
        subject_id: r.subject_id,
        is_indexed: Array.isArray(r.resource_content) ? r.resource_content.length > 0 : false
      }));
      setResources(mapped);
    }
    setLoadingResources(false);
  }, [supabase, branch, semester]);

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

      const { error: uploadError } = await supabase.storage.from('course-content').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('course-content').getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('resources')
        .insert({ subject_id: selectedSubject, title, file_url: publicUrl });
      if (dbError) throw dbError;

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
      if (fileUrl.includes('/course-content/')) {
        const storagePath = fileUrl.split('/course-content/')[1];
        await supabase.storage.from('course-content').remove([storagePath]);
      }
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
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
      const { error } = await supabase
        .from('resources')
        .update({ title: editTitle, subject_id: editSubjectId })
        .eq('id', id);
      if (error) throw error;
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
          className={`mb-5 p-3.5 rounded-lg text-sm border ${
            message.startsWith('Error')
              ? 'bg-surface border-border text-foreground'
              : 'bg-surface border-border text-foreground'
          }`}
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

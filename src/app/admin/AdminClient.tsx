'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Trash, Edit2, Check, X, File as FileIcon, LogOut, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
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
      .select(`id, title, file_url, subject_id, subjects!inner(branch, semester)`)
      .eq('subjects.branch', branch)
      .eq('subjects.semester', parseInt(semester));

    if (!error) setResources(data || []);
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

      setMessage('✓ File uploaded and linked successfully.');
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-muted hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          {userEmail && <p className="text-xs text-muted mt-0.5">{userEmail}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex border border-border rounded-lg overflow-hidden bg-surface text-sm">
            {(['upload', 'manage'] as const).map((t) => (
              <button
                key={t}
                className={`px-4 py-2 font-medium capitalize transition-colors ${
                  tab === t ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
                }`}
                onClick={() => {
                  setTab(t);
                  setMessage('');
                  setEditingId(null);
                }}
              >
                {t === 'upload' ? 'Upload' : 'Manage'}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-foreground border border-border rounded-lg hover:bg-surface transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4 mb-6 bg-surface p-4 rounded-xl border border-border">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Branch</label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
          >
            <option value="AIDS">AIDS</option>
            <option value="CSE">CSE</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
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
            <label className="block text-xs font-medium text-foreground mb-1.5">File</label>
            <input
              ref={fileInputRef}
              type="file"
              required
              onChange={handleFileChange}
              className="w-full text-sm bg-background border border-border rounded-lg p-2.5 text-foreground file:mr-3 file:text-xs file:font-medium file:bg-surface file:border file:border-border file:rounded-md file:px-2.5 file:py-1 file:text-foreground"
            />
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
            <label className="block text-xs font-medium text-foreground mb-1.5">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
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
                    className="p-4 flex items-center justify-between hover:bg-surface transition-colors"
                  >
                    <div className="flex-1 mr-4 min-w-0">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
                          />
                          <select
                            value={editSubjectId}
                            onChange={(e) => setEditSubjectId(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
                          >
                            {subjects.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-sm flex items-center gap-2 truncate">
                            <FileIcon className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                            {resource.title}
                          </span>
                          <span className="text-xs text-muted mt-0.5">{subject?.name || 'Unknown'}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(resource.id)}
                            className="p-1.5 text-foreground hover:bg-surface rounded-lg transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-muted hover:bg-surface rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <a
                            href={resource.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-lg transition-colors text-xs font-semibold"
                          >
                            VIEW
                          </a>
                          <button
                            onClick={() => startEdit(resource)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(resource.id, resource.file_url)}
                            className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash className="w-4 h-4" />
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
      )}
    </div>
  );
}

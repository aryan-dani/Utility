"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Trash, Edit2, Check, X, File as FileIcon } from "lucide-react";

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

export default function AdminPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"upload" | "manage">("upload");
  const [branch, setBranch] = useState("AIDS");
  const [semester, setSemester] = useState("4");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Upload State
  const [selectedSubject, setSelectedSubject] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Manage State
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");

  const [message, setMessage] = useState("");

  // Fetch subjects whenever branch/semester changes
  useEffect(() => {
    async function fetchSubjects() {
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .eq("branch", branch)
        .eq("semester", parseInt(semester));
      setSubjects(data || []);
      if (data && data.length > 0) {
        setSelectedSubject(data[0].id);
      } else {
        setSelectedSubject("");
      }
    }
    fetchSubjects();
  }, [branch, semester, supabase]);

  // Fetch resources when entering manage tab
  useEffect(() => {
    if (tab === "manage") {
      fetchResources();
    }
  }, [tab, branch, semester]);

  async function fetchResources() {
    setLoadingResources(true);
    const { data, error } = await supabase
      .from("resources")
      .select(`
        id,
        title,
        file_url,
        subject_id,
        subjects!inner(branch, semester)
      `)
      .eq("subjects.branch", branch)
      .eq("subjects.semester", parseInt(semester));
      
    if (!error) {
      setResources(data || []);
    }
    setLoadingResources(false);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile && !title) { // Auto-fill title
      const nameWithoutExt = selectedFile.name.split(".").slice(0, -1).join(".");
      setTitle(nameWithoutExt);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedSubject || !title) return;

    setUploading(true);
    setMessage("");

    try {
      // Find subject name to build clean folder structure
      const subj = subjects.find(s => s.id === selectedSubject);
      const subjectName = subj ? subj.name : "Uncategorized";
      
      const fileExt = file.name.split(".").pop();
      const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
      // Clean path: AIDS/Sem_4/AIES/Title_Random.pdf
      const filePath = `${branch}/Sem_${semester}/${subjectName}/${cleanTitle}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("course-content")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("course-content").getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("resources").insert({
        subject_id: selectedSubject,
        title: title,
        file_url: publicUrl,
      });

      if (dbError) throw dbError;

      setMessage("✅ File uploaded and linked successfully!");
      setTitle("");
      setFile(null);
      (document.getElementById("file-upload") as HTMLInputElement).value = "";
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm("Are you sure you want to permanently delete this file?")) return;
    try {
      // Attempt to delete from storage if we can parse the path
      if (fileUrl.includes("/course-content/")) {
        // file_url looks like: .../storage/v1/object/public/course-content/AIDS/Sem_4/something.pdf
        const storagePath = fileUrl.split("/course-content/")[1];
        await supabase.storage.from("course-content").remove([storagePath]);
      }
      
      // Delete from db
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
      
      setResources(resources.filter(r => r.id !== id));
      setMessage("✅ File deleted successfully!");
    } catch (error: any) {
      alert(`Error deleting file: ${error.message}`);
    }
  };

  const startEdit = (resource: Resource) => {
    setEditingId(resource.id);
    setEditTitle(resource.title);
    setEditSubjectId(resource.subject_id);
  };

  const saveEdit = async (id: string) => {
    try {
      const { error } = await supabase.from("resources").update({
        title: editTitle,
        subject_id: editSubjectId
      }).eq("id", id);

      if (error) throw error;

      setResources(resources.map(r => 
        r.id === id ? { ...r, title: editTitle, subject_id: editSubjectId } : r
      ));
      setEditingId(null);
      setMessage("✅ Resource updated successfully!");
    } catch(error: any) {
      alert(`Error updating file: ${error.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 min-h-[80vh]">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex border border-border rounded-lg overflow-hidden bg-surface">
          <button 
            className={`px-4 py-2 font-medium ${tab === "upload" ? "bg-primary text-white" : "hover:bg-muted/10 text-foreground"}`}
            onClick={() => { setTab("upload"); setMessage(""); setEditingId(null); }}
          >
            Upload New
          </button>
          <button 
            className={`px-4 py-2 font-medium ${tab === "manage" ? "bg-primary text-white" : "hover:bg-muted/10 text-foreground"}`}
            onClick={() => { setTab("manage"); setMessage(""); setEditingId(null); }}
          >
            Manage Files
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 bg-surface p-4 rounded-lg border border-border shadow-sm">
        <div>
          <label className="block text-sm font-medium mb-1">Target Branch</label>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
          >
            <option value="AIDS">AIDS</option>
            <option value="CSE">CSE</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Target Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded ${message.includes("❌") ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
          {message}
        </div>
      )}

      {tab === "upload" && (
        <form onSubmit={handleUpload} className="space-y-6 bg-surface p-6 rounded-lg border border-border shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1">File</label>
            <input
              id="file-upload"
              type="file"
              required
              onChange={handleFileChange}
              className="w-full text-sm bg-background border border-border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Resource Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Will auto-fill when you select a file"
              className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject / Directory</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
              required
              disabled={subjects.length === 0}
            >
              {subjects.length === 0 && <option value="">No subjects found. Create them in DB first.</option>}
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={uploading || !selectedSubject} className="w-full bg-primary text-white py-2 rounded hover:bg-primary-hover disabled:opacity-50 transition">
            {uploading ? "Uploading safely to cloud..." : "Upload & Publish"}
          </button>
        </form>
      )}

      {tab === "manage" && (
        <div className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
          {loadingResources ? (
            <div className="p-8 text-center text-muted">Loading files...</div>
          ) : resources.length === 0 ? (
            <div className="p-8 text-center text-muted">No files found for this branch and semester.</div>
          ) : (
            <div className="divide-y divide-border">
              {resources.map(resource => {
                const subject = subjects.find(s => s.id === resource.subject_id);
                const isEditing = editingId === resource.id;

                return (
                  <div key={resource.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                    <div className="flex-1 mr-4">
                      {isEditing ? (
                         <div className="flex flex-col gap-2">
                           <input 
                             type="text" 
                             value={editTitle}
                             onChange={e => setEditTitle(e.target.value)}
                             className="w-full bg-background border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary"
                           />
                           <select
                             value={editSubjectId}
                             onChange={e => setEditSubjectId(e.target.value)}
                             className="w-full bg-background border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary"
                           >
                             {subjects.map(sub => (
                               <option key={sub.id} value={sub.id}>{sub.name}</option>
                             ))}
                           </select>
                         </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-sm flex items-center gap-2">
                            <FileIcon className="w-4 h-4 text-primary" /> {resource.title}
                          </span>
                          <span className="text-xs text-muted mt-1 uppercase font-medium">Folder: {subject?.name || "Unknown"}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(resource.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-2 text-muted hover:bg-muted/10 rounded" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <a href={resource.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-primary hover:bg-primary/10 rounded text-xs font-semibold">VIEW</a>
                          <button onClick={() => startEdit(resource)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Edit/Move">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(resource.id, resource.file_url)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Delete">
                            <Trash className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

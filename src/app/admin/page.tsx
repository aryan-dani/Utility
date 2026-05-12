"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

interface Subject {
  id: string;
  name: string;
  branch: string;
  semester: number;
}

export default function AdminPage() {
  const supabase = createClient();
  const [branch, setBranch] = useState("AIDS");
  const [semester, setSemester] = useState("4");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedSubject || !title) return;

    setUploading(true);
    setMessage("");

    try {
      // 1. Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${branch}/Sem_${semester}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("course-content")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("course-content").getPublicUrl(filePath);

      // 3. Insert record into database
      const { error: dbError } = await supabase.from("resources").insert({
        subject_id: selectedSubject,
        title: title,
        file_url: publicUrl,
      });

      if (dbError) throw dbError;

      setMessage("File uploaded successfully!");
      setTitle("");
      setFile(null);
      // Reset file input
      (document.getElementById("file-upload") as HTMLInputElement).value = "";
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">
        Admin Dashboard - Upload Resources
      </h1>

      <form
        onSubmit={handleUpload}
        className="space-y-6 bg-surface p-6 rounded-lg border border-border shadow-sm"
      >
        {message && (
          <div
            className={`p-4 rounded ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
          >
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Branch</label>
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
            <label className="block text-sm font-medium mb-1">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
            required
            disabled={subjects.length === 0}
          >
            {subjects.length === 0 && (
              <option value="">
                No subjects found. Create them in DB first.
              </option>
            )}
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Resource Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Module 1 Notes (PDF)"
            className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">File</label>
          <input
            id="file-upload"
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={uploading || !selectedSubject}
          className="w-full bg-primary text-white py-2 rounded hover:bg-primary-hover disabled:opacity-50 transition"
        >
          {uploading ? "Uploading..." : "Upload Resource"}
        </button>
      </form>
    </div>
  );
}

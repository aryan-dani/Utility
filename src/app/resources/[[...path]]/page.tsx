"use client";

import { useEffect, useState } from "react";
import { getResourcesFromDB, ResourceItem } from "@/lib/dataFetcher";
import { useAcademicStore } from "@/store/academicStore";
import {
  HardDrive,
  FileText,
  FileSpreadsheet,
  Loader2,
  Folder,
} from "lucide-react";

export default function ResourcesPage() {
  const { branch, semester } = useAcademicStore();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    async function loadResources() {
      setLoading(true);
      const data = await getResourcesFromDB(branch, semester);
      setResources(data);
      setLoading(false);
    }
    loadResources();
  }, [branch, semester]);

  // Group resources by subject
  const subjectsMap = resources.reduce(
    (acc, resource) => {
      if (!acc[resource.subject_name]) acc[resource.subject_name] = [];
      acc[resource.subject_name].push(resource);
      return acc;
    },
    {} as Record<string, ResourceItem[]>,
  );

  const subjectNames = Object.keys(subjectsMap);

  // Auto-select the first subject if none is selected and data is available
  useEffect(() => {
    if (
      !loading &&
      subjectNames.length > 0 &&
      (!selectedSubject || !subjectNames.includes(selectedSubject))
    ) {
      setSelectedSubject(subjectNames[0]);
    }
  }, [loading, subjectNames, selectedSubject]);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Resource Vault - {branch} Sem {semester}
          </h1>
          <p className="text-muted text-sm mt-1">
            Access your academic files stored securely in the cloud.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-surface">
          <Folder className="w-10 h-10 text-muted mb-3" />
          <p className="text-lg font-semibold text-foreground mb-1">
            No Files Found
          </p>
          <p className="text-sm text-muted">
            No resources uploaded for {branch} Semester {semester} yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Sidebar / Folder Explorer */}
          <div className="w-full md:w-64 shrink-0 border border-border rounded-lg bg-surface shadow-sm overflow-hidden">
            <div className="bg-muted/10 p-4 border-b border-border">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted">
                Folders
              </h3>
            </div>
            <div className="flex flex-col">
              {subjectNames.map((subjectName) => (
                <button
                  key={subjectName}
                  onClick={() => setSelectedSubject(subjectName)}
                  className={`flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-0 ${
                    selectedSubject === subjectName
                      ? "bg-primary/10 text-primary border-r-2 border-r-primary font-medium"
                      : "text-foreground hover:bg-muted/5 hover:text-primary"
                  }`}
                >
                  <Folder
                    className={`w-4 h-4 ${selectedSubject === subjectName ? "text-primary" : "text-muted"}`}
                  />
                  <span className="flex-1 truncate text-sm">{subjectName}</span>
                  <span className="text-xs bg-background border border-border px-1.5 py-0.5 rounded text-muted">
                    {subjectsMap[subjectName].length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 w-full bg-surface border border-border rounded-lg p-6 shadow-sm min-h-[400px]">
            {selectedSubject && subjectsMap[selectedSubject] ? (
              <>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                  <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    {selectedSubject}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjectsMap[selectedSubject].map((item) => {
                    const fileUpper = item.file_url.toUpperCase();
                    const isPdf = fileUpper.endsWith(".PDF");
                    const isPpt =
                      fileUpper.endsWith(".PPT") || fileUpper.endsWith(".PPTX");

                    return (
                      <a
                        key={item.id}
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="bg-background p-4 rounded-lg flex flex-col gap-3 group cursor-pointer border border-border hover:border-primary/50 hover:shadow-md transition-all h-full relative overflow-hidden">
                          <div className="flex items-start justify-between">
                            <div
                              className={`w-10 h-10 rounded shrink-0 flex items-center justify-center border transition-colors ${
                                isPdf
                                  ? "bg-red-50 border-red-100 group-hover:bg-red-100"
                                  : isPpt
                                    ? "bg-orange-50 border-orange-100 group-hover:bg-orange-100"
                                    : "bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100"
                              }`}
                            >
                              {isPdf ? (
                                <FileText className="w-5 h-5 text-red-600" />
                              ) : isPpt ? (
                                <FileSpreadsheet className="w-5 h-5 text-orange-600" />
                              ) : (
                                <HardDrive className="w-5 h-5 text-emerald-600" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 mt-1">
                            <p
                              className="text-sm font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors"
                              title={item.title}
                            >
                              {item.title}
                            </p>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12">
                <Folder className="w-12 h-12 text-muted/30 mb-4" />
                <p className="text-lg font-medium text-muted">
                  Select a folder to view its contents
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

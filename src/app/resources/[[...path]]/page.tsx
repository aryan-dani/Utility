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

  useEffect(() => {
    async function loadResources() {
      setLoading(true);
      const data = await getResourcesFromDB(branch, semester);
      setResources(data);
      setLoading(false);
    }
    loadResources();
  }, [branch, semester]);

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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {resources.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-surface">
              <Folder className="w-10 h-10 text-muted mb-3" />
              <p className="text-lg font-semibold text-foreground mb-1">
                No Files Found
              </p>
              <p className="text-sm text-muted">
                No resources uploaded for {branch} Semester {semester} yet.
              </p>
            </div>
          )}

          {/* Render Files */}
          {resources.map((item) => {
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
                <div className="bg-white p-3.5 rounded-lg flex items-center gap-3 group cursor-pointer border border-border hover:border-primary/50 hover:shadow-sm transition-all h-full">
                  <div
                    className={`w-8 h-8 rounded shrink-0 flex items-center justify-center border transition-colors ${
                      isPdf
                        ? "bg-red-50 border-red-100 group-hover:bg-red-100"
                        : isPpt
                          ? "bg-orange-50 border-orange-100 group-hover:bg-orange-100"
                          : "bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100"
                    }`}
                  >
                    {isPdf ? (
                      <FileText className="w-4 h-4 text-red-600" />
                    ) : isPpt ? (
                      <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                    ) : (
                      <HardDrive className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted uppercase">
                      {item.subject_name}
                    </p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

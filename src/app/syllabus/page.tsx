import {
  getSubjectsFromDB,
  getSyllabusFile,
  getResourcesFromDB,
} from "@/lib/dataFetcher";
import { createClient } from "@/lib/supabaseServer";
import SyllabusClient from "@/components/SyllabusClient";
import { Branch, Semester } from "@/store/academicStore";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{
    branch?: string;
    semester?: string;
  }>;
}

export default async function SyllabusPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const branch = (params.branch as Branch) || "AIDS";
  const semester = Number(params.semester || "4") as Semester;

  const supabase = await createClient();
  const [subjects, syllabusUrl, resources] = await Promise.all([
    getSubjectsFromDB(branch, semester, supabase),
    getSyllabusFile(branch, semester, supabase),
    getResourcesFromDB(branch, semester, supabase),
  ]);

  return (
    <Suspense fallback={<SyllabusLoading />}>
      <SyllabusClient
        subjects={subjects}
        branch={branch}
        semester={semester}
        syllabusUrl={syllabusUrl}
        initialResources={resources}
      />
    </Suspense>
  );
}

function SyllabusLoading() {
  return (
    <div className="flex justify-center items-center py-40 min-h-[80vh] w-full">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

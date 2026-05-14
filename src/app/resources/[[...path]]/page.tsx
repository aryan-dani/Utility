import { getResourcesFromDB } from "@/lib/dataFetcher";
import { createClient } from "@/lib/supabaseServer";
import ResourcesClient from "@/components/ResourcesClient";
import { Branch, Semester } from "@/store/academicStore";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    branch?: string;
    semester?: string;
  }>;
}

export default async function ResourcesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const branch = (params.branch as Branch) || "AIDS";
  const semester = Number(params.semester || "4") as Semester;

  const supabase = await createClient();
  const resources = await getResourcesFromDB(branch, semester, supabase);

  return (
    <Suspense fallback={<ResourcesLoading branch={branch} semester={semester} />}>
      <ResourcesClient initialResources={resources} branch={branch} semester={semester} />
    </Suspense>
  );
}

function ResourcesLoading({ branch, semester }: { branch: string; semester: number }) {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Resource Vault — {branch} Sem {semester}
          </h1>
          <p className="text-muted text-sm mt-1">
            Access your academic files stored securely in the cloud.
          </p>
        </div>
      </div>
      <div className="flex justify-center items-center py-20 w-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    </div>
  );
}

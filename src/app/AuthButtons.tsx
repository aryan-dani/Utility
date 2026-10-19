"use client";

import { useEffect, useState } from "react";
import AppLink from "@/components/ui/AppLink";
import { ArrowRight } from "lucide-react";
import { useAcademicStore } from "@/store/academicStore";
import {
  readStoredWorkspace,
  resolveWorkspace,
  workspaceQuery,
} from "@/lib/workspace";

export default function AuthButtons() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const storeAcademicYear = useAcademicStore((s) => s.academicYear);
  const storeBranch = useAcademicStore((s) => s.branch);
  const storeSemester = useAcademicStore((s) => s.semester);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    void import("@/lib/firebase/auth").then(({ auth }) => {
      if (cancelled) return;
      unsubscribe = auth.onAuthStateChanged((user) => {
        setIsLoggedIn(!!user);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const { academicYear, branch, semester } = resolveWorkspace(
    {
      year: storeAcademicYear,
      branch: storeBranch,
      semester: String(storeSemester),
    },
    readStoredWorkspace(),
  );
  const qs = workspaceQuery(academicYear, branch, semester);

  const primary =
    "inline-flex items-center justify-center min-h-11 gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90";

  // Signed-in home already has the cockpit — keep CTAs quiet so they don't float as a second hero.
  return isLoggedIn ? (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
      <AppLink
        href={`/planner?${qs}`}
        className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline underline-offset-4"
      >
        Open planner <ArrowRight className="w-3.5 h-3.5" />
      </AppLink>
      <AppLink
        href={`/resources?${qs}`}
        className="font-medium text-muted hover:text-foreground hover:underline underline-offset-4"
      >
        Browse resources
      </AppLink>
    </div>
  ) : (
    <AppLink href="/signup" className={primary}>
      Get Started <ArrowRight className="w-4 h-4" />
    </AppLink>
  );
}

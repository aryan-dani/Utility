"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import AppLink from "@/components/ui/AppLink";
import { ChevronDown, LogOut, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { signOut, onIdTokenChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { AcademicYear, Branch, Semester } from "@/store/academicStore";
import { isAcademicYear } from "@/lib/academic/scope";

type NavUser = {
  email: string | undefined;
  displayName: string | undefined;
  photoURL: string | undefined;
};

export default function NavUserMenu({
  collapsed,
  academicYear,
  branch,
  semester,
  setAcademicYear,
  setBranch,
  setSemester,
  onWorkspaceFromPrefs,
  onUserChange,
}: {
  collapsed: boolean;
  academicYear: AcademicYear;
  branch: Branch;
  semester: Semester;
  setAcademicYear: (y: AcademicYear) => void;
  setBranch: (b: Branch) => void;
  setSemester: (s: Semester) => void;
  onWorkspaceFromPrefs?: (
    year: AcademicYear,
    branch: Branch,
    semester: Semester,
  ) => void;
  onUserChange?: (user: NavUser | null) => void;
}) {
  const [user, setUser] = useState<NavUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef({ academicYear, branch, semester });

  useEffect(() => {
    workspaceRef.current = { academicYear, branch, semester };
  }, [academicYear, branch, semester]);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const next = {
          email: firebaseUser.email || undefined,
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
        };
        setUser(next);
        onUserChange?.(next);

        const userPrefsRef = doc(db, "users", firebaseUser.uid);
        getDoc(userPrefsRef)
          .then(async (snap) => {
            const isGoogle = firebaseUser.providerData.some(
              (p) => p.providerId === "google.com",
            );
            const isGithub = firebaseUser.providerData.some(
              (p) => p.providerId === "github.com",
            );
            const provider = isGoogle
              ? "Google Account"
              : isGithub
                ? "GitHub Account"
                : "Email Account";

            const updateData: Record<string, unknown> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              photoURL: firebaseUser.photoURL || "",
              displayName:
                firebaseUser.displayName ||
                firebaseUser.email?.split("@")[0] ||
                "Student",
              provider,
            };

            const existingLastActive =
              snap.exists() && typeof snap.data()?.lastActive === "string"
                ? snap.data()!.lastActive
                : null;
            const lastActiveMs = existingLastActive
              ? new Date(existingLastActive).getTime()
              : 0;
            const DAY_MS = 24 * 60 * 60 * 1000;
            if (
              !Number.isFinite(lastActiveMs) ||
              Date.now() - lastActiveMs >= DAY_MS
            ) {
              updateData.lastActive = new Date().toISOString();
            }

            if (snap.exists()) {
              const data = snap.data();
              const rawYear = data.academic_year as string | undefined;
              const prefYear =
                rawYear && isAcademicYear(rawYear)
                  ? rawYear
                  : workspaceRef.current.academicYear;
              const prefBranch =
                (data.branch as Branch) || workspaceRef.current.branch;
              const prefSemester =
                (data.semester as Semester) || workspaceRef.current.semester;
              if (onWorkspaceFromPrefs) {
                onWorkspaceFromPrefs(prefYear, prefBranch, prefSemester);
              } else {
                if (rawYear && isAcademicYear(rawYear)) {
                  setAcademicYear(rawYear);
                }
                if (data.branch) setBranch(data.branch as Branch);
                if (data.semester) setSemester(data.semester as Semester);
              }

              const existing = data;
              const profileUnchanged =
                existing.uid === updateData.uid &&
                existing.email === updateData.email &&
                existing.photoURL === updateData.photoURL &&
                existing.displayName === updateData.displayName &&
                existing.provider === updateData.provider &&
                !("lastActive" in updateData);
              if (!profileUnchanged) {
                await setDoc(userPrefsRef, updateData, { merge: true });
              }
            } else {
              updateData.academic_year = workspaceRef.current.academicYear;
              updateData.branch = workspaceRef.current.branch;
              updateData.semester = workspaceRef.current.semester;
              updateData.lastActive = new Date().toISOString();
              await setDoc(userPrefsRef, updateData, { merge: true });
            }
          })
          .catch((err) => {
            console.error("Error syncing user preferences:", err);
          });

        try {
          const token = await firebaseUser.getIdToken();
          document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax; Secure`;
        } catch (e) {
          console.error("Error getting Firebase ID token:", e);
        }
      } else {
        setUser(null);
        onUserChange?.(null);
        document.cookie =
          "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync prefs once per auth session
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUserMenuOpen(false);
    window.location.href = "/";
  };

  if (!user) {
    return (
      <AppLink
        href="/login"
        aria-label="Sign In"
        className={`flex items-center justify-center ${collapsed ? "w-8 h-8 rounded-lg" : "w-full py-2 rounded-xl"} bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-all shadow-xs`}
        title={collapsed ? "Sign In" : undefined}
      >
        {collapsed ? <LogOut className="w-3.5 h-3.5 rotate-180" /> : "Sign in"}
      </AppLink>
    );
  }

  return (
    <div ref={userMenuRef} className="relative w-full flex justify-center">
      <button
        onClick={() => setUserMenuOpen((o) => !o)}
        aria-label="User Menu"
        className={`flex items-center ${collapsed ? "justify-center w-8 h-8" : "justify-between w-full p-1.5"} rounded-xl border border-transparent hover:border-border/80 hover:bg-surface/50 transition-all group`}
        title={collapsed ? user.email : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center text-xs font-extrabold uppercase shadow-xs shrink-0 overflow-hidden">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt=""
                width={28}
                height={28}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                unoptimized
              />
            ) : (
              user.displayName?.[0] ?? user.email?.[0] ?? "?"
            )}
          </div>
          {!collapsed && (
            <div className="text-left min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {user.displayName ?? user.email?.split("@")[0] ?? "User"}
              </p>
              <p className="text-[10px] text-muted truncate">
                {user.email ?? "No email shared"}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <ChevronDown className="w-3.5 h-3.5 text-muted group-hover:text-foreground transition-colors shrink-0 mr-1" />
        )}
      </button>

      <AnimatePresence>
        {userMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className={`absolute bottom-full mb-2 bg-card border border-border rounded-xl shadow-popover overflow-hidden z-50 p-1 flex flex-col gap-0.5 ${collapsed ? "w-32 left-1/2 -translate-x-1/2" : "left-0 right-0"}`}
          >
            <AppLink
              href="/profile"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-surface rounded-lg transition-colors text-left"
            >
              <User className="w-3.5 h-3.5 shrink-0 text-muted" />
              <span>Profile Settings</span>
            </AppLink>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

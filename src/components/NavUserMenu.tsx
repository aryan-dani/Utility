"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import AppLink from "@/components/ui/AppLink";
import { ChevronDown, LogOut, User, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { signOut, onIdTokenChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { AcademicYear, Branch, Semester } from "@/store/academicStore";
import { isAcademicYear } from "@/lib/academic/scope";
import { clearLocalUserData } from "@/lib/localUserData";
import { useAcademicStore } from "@/store/academicStore";
import { useMotionSafe } from "@/lib/motion";

type NavUser = {
  email: string | undefined;
  displayName: string | undefined;
  photoURL: string | undefined;
};

type MenuCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function NavUserMenu({
  collapsed,
  academicYear: _academicYear,
  branch: _branch,
  semester: _semester,
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
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  const isClient = useIsClient();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const motionSafe = useMotionSafe();

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
                rawYear && isAcademicYear(rawYear) ? rawYear : null;
              const prefBranch = (data.branch as Branch | undefined) || null;
              const prefSemester =
                typeof data.semester === "number"
                  ? (data.semester as Semester)
                  : null;
              if (prefYear && prefBranch && prefSemester) {
                if (onWorkspaceFromPrefs) {
                  onWorkspaceFromPrefs(prefYear, prefBranch, prefSemester);
                } else {
                  setAcademicYear(prefYear);
                  setBranch(prefBranch);
                  setSemester(prefSemester);
                }
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

  const updateMenuCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    if (collapsed) {
      setMenuCoords({
        left: rect.right + 12,
        top: Math.max(8, rect.bottom - 96),
        width: 176,
      });
      return;
    }
    setMenuCoords({
      left: rect.left,
      width: rect.width,
      bottom: window.innerHeight - rect.top + gap,
    });
  };

  useLayoutEffect(() => {
    if (!userMenuOpen) return;
    updateMenuCoords();
    const onReposition = () => updateMenuCoords();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- collapsed + open gate reposition
  }, [userMenuOpen, collapsed]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (userMenuRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    clearLocalUserData();
    useAcademicStore.getState().resetWorkspace();
    setUserMenuOpen(false);
    window.location.href = "/";
  };

  if (!user) {
    if (collapsed) {
      return (
        <AppLink
          href="/signup"
          aria-label="Create account"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-all shadow-xs active:scale-95"
          title="Create account"
        >
          <UserPlus className="w-4 h-4" />
        </AppLink>
      );
    }
    return (
      <div className="flex w-full flex-col gap-2">
        <AppLink
          href="/signup"
          aria-label="Create account"
          className="flex w-full items-center justify-center py-2.5 rounded-xl bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-all shadow-xs active:scale-95"
        >
          Create account
        </AppLink>
        <AppLink
          href="/login"
          aria-label="Sign in"
          className="flex w-full items-center justify-center py-2 rounded-xl border border-border text-foreground font-semibold text-xs hover:bg-surface transition-all active:scale-95"
        >
          Sign in
        </AppLink>
      </div>
    );
  }

  const menu = (
    <AnimatePresence>
      {userMenuOpen && menuCoords && (
        <motion.div
          ref={menuPanelRef}
          initial={
            motionSafe.reduce
              ? false
              : {
                  opacity: 0,
                  y: collapsed ? 0 : 4,
                  x: collapsed ? -6 : 0,
                  scale: 0.96,
                }
          }
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={
            motionSafe.reduce
              ? undefined
              : {
                  opacity: 0,
                  y: collapsed ? 0 : 4,
                  x: collapsed ? -6 : 0,
                  scale: 0.96,
                }
          }
          transition={{
            duration: motionSafe.durations.fast,
            ease: motionSafe.ease,
          }}
          style={{
            position: "fixed",
            left: menuCoords.left,
            width: menuCoords.width,
            top: menuCoords.top,
            bottom: menuCoords.bottom,
            zIndex: 150,
          }}
          className="bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden p-1.5 flex flex-col gap-0.5"
        >
          <AppLink
            href="/profile"
            onClick={() => setUserMenuOpen(false)}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-surface rounded-xl transition-colors text-left"
          >
            <User className="w-3.5 h-3.5 shrink-0 text-muted" />
            <span>Profile Settings</span>
          </AppLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Sign out</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={userMenuRef} className="relative w-full flex justify-center">
      <button
        ref={triggerRef}
        onClick={() => setUserMenuOpen((o) => !o)}
        aria-label="User Menu"
        aria-expanded={userMenuOpen}
        className={`flex items-center ${collapsed ? "justify-center w-10 h-10" : "justify-between w-full p-2"} rounded-xl border border-transparent hover:border-border/80 hover:bg-surface/60 transition-all group active:scale-95`}
        title={collapsed ? user.email : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center text-xs font-extrabold uppercase shadow-xs shrink-0 overflow-hidden ring-1 ring-border/50 group-hover:ring-foreground/20 transition-all">
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
          <ChevronDown className="w-3.5 h-3.5 text-muted group-hover:text-foreground transition-colors shrink-0 mr-0.5" />
        )}
      </button>

      {isClient ? createPortal(menu, document.body) : null}
    </div>
  );
}

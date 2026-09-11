"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { updateProfile, type User as FirebaseUser, type UserInfo } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  startProviderLink,
  confirmMergeWithGithub,
  confirmMergeWithGoogle,
  consumeRedirectResult,
  getPendingMergeStep,
} from "@/lib/firebaseAuth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useAcademicStore, AcademicYear, Branch, Semester } from "@/store/academicStore";
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER, workspaceQuery } from "@/lib/workspace";
import { BRANCH_OPTIONS_LONG, isAcademicYear } from "@/lib/academic/scope";
import { notify } from "@/lib/toast";
import AppLink from "@/components/ui/AppLink";
import { useTheme } from "next-themes";
import { useIsClient } from "@/lib/clientHooks";
import {
  ArrowLeft,
  Loader2,
  User,
  GraduationCap,
  Link as LinkIcon,
  Save,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Palette,
  BookOpen,
  FileText,
  Brain,
  CalendarCheck,
  ExternalLink,
  CheckCircle2,
  HardDrive,
} from "lucide-react";
import { clearDriveFileCache } from "@/lib/driveFileCache";
import { ScopeSelector } from "@/components/academic/ScopeSelector";
import { PageHeader } from "@/components/ui";

// Helper to generate self-contained SVG base64 Data URLs for monochrome avatars
function generateAvatarDataUrl(emoji: string, gradientStart: string, gradientEnd: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="30" fill="url(#grad)" />
      <text x="50%" y="62%" font-size="52" text-anchor="middle" dominant-baseline="middle" filter="grayscale(100%) brightness(0.95) contrast(1.05)">${emoji}</text>
    </svg>
  `.trim();
  // Safe base64 encoding for client-side rendering
  if (typeof window !== "undefined") {
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
  }
  return "";
}

interface AvatarPreset {
  emoji: string;
  label: string;
  start: string;
  end: string;
}

// 12 Premium Greyscale / Monochrome Presets
const AVATAR_PRESETS: AvatarPreset[] = [
  { emoji: "🎓", label: "Scholar", start: "#1c1c1e", end: "#3a3a3c" },
  { emoji: "💻", label: "Developer", start: "#2c2c2e", end: "#48484a" },
  { emoji: "🧠", label: "Thinker", start: "#3a3a3c", end: "#636366" },
  { emoji: "🎒", label: "Learner", start: "#48484a", end: "#8e8e93" },
  { emoji: "⚡", label: "Spark", start: "#636366", end: "#aeaeb2" },
  { emoji: "🎯", label: "Focus", start: "#8e8e93", end: "#c7c7cc" },
  { emoji: "📚", label: "Books", start: "#aeaeb2", end: "#e5e5ea" },
  { emoji: "♟️", label: "Pawn", start: "#c7c7cc", end: "#f2f2f7" },
  { emoji: "👥", label: "Collab", start: "#111111", end: "#444444" },
  { emoji: "🛡️", label: "Guard", start: "#000000", end: "#333333" },
  { emoji: "⚙️", label: "Builder", start: "#212121", end: "#424242" },
  { emoji: "🐼", label: "Panda", start: "#1a1a1a", end: "#2a2a2a" },
];

function ProfileThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();

  if (!mounted) {
    return <div className="skeleton h-10 rounded-xl border border-border/80 w-full" aria-hidden />;
  }

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;

  return (
    <div className="flex bg-background/70 border border-border/80 p-0.5 rounded-xl w-full">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
              active
                ? "bg-card border border-border/80 text-foreground shadow-xs font-semibold"
                : "text-muted hover:text-foreground hover:bg-surface/30"
            }`}
            title={opt.label}
            aria-label={`Switch to ${opt.label} theme`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ProfileClientComponent() {
  const router = useRouter();
  const { academicYear, branch, semester, setAcademicYear, setBranch, setSemester } = useAcademicStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [mergeStep, setMergeStep] = useState<"github" | "google" | null>(null);
  const [redirectBusy, setRedirectBusy] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [tempPhotoUrl, setTempPhotoUrl] = useState(""); // Holds manual text inputs
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<AcademicYear>(DEFAULT_ACADEMIC_YEAR);
  const [selectedBranch, setSelectedBranch] = useState<Branch>("AIDS");
  const [selectedSemester, setSelectedSemester] = useState<Semester>(DEFAULT_SEMESTER);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const mergingRef = useRef(false);
  const workspaceRef = useRef({ academicYear, branch, semester });

  useEffect(() => {
    workspaceRef.current = { academicYear, branch, semester };
  }, [academicYear, branch, semester]);

  // Authentication & Initial data loading
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        if (mergingRef.current) return;
        notify.error("Please sign in to access your profile settings.");
        router.push("/login?redirectTo=/profile");
        return;
      }
      setCurrentUser(user);
      setDisplayName(user.displayName || "");
      setPhotoURL(user.photoURL || "");
      setTempPhotoUrl(user.photoURL || "");

      // Fetch academic preferences from Firestore (or fallback to Zustand store)
      try {
        const userPrefsRef = doc(db, "users", user.uid);
        const snap = await getDoc(userPrefsRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.academic_year && isAcademicYear(data.academic_year)) {
            setSelectedAcademicYear(data.academic_year);
          } else {
            setSelectedAcademicYear(workspaceRef.current.academicYear);
          }
          if (data.branch) {
            setSelectedBranch(data.branch as Branch);
          } else {
            setSelectedBranch(workspaceRef.current.branch);
          }
          if (data.semester) {
            setSelectedSemester(data.semester as Semester);
          } else {
            setSelectedSemester(workspaceRef.current.semester);
          }
          if (typeof data.updatedAt === "string") {
            setLastSavedAt(data.updatedAt);
          }
        } else {
          // If no doc, match the current store settings
          setSelectedAcademicYear(workspaceRef.current.academicYear);
          setSelectedBranch(workspaceRef.current.branch);
          setSelectedSemester(workspaceRef.current.semester);
        }
      } catch (err) {
        console.error("Error fetching academic preferences:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    mergingRef.current = true;
    (async () => {
      try {
        const outcome = await consumeRedirectResult(auth);
        if (cancelled) return;
        if (outcome.status === "linked") {
          setCurrentUser(outcome.user);
          setDisplayName(outcome.user.displayName || "");
          setPhotoURL(outcome.user.photoURL || "");
          setTempPhotoUrl(outcome.user.photoURL || "");
          setMergeStep(null);
          notify.success("Google and GitHub are now one account.");
        } else if (outcome.status === "needs-github-confirm") {
          setMergeStep("github");
        } else if (outcome.status === "needs-google-confirm") {
          setMergeStep("google");
        } else if (outcome.status === "error") {
          notify.error("Could not finish account linking. Please try again.");
        } else {
          setMergeStep(getPendingMergeStep());
        }
      } finally {
        mergingRef.current = false;
        if (!cancelled) setRedirectBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSaving(true);
    try {
      await notify.promise(
        (async () => {
          await updateProfile(currentUser, {
            displayName: displayName.trim() || null,
            photoURL: photoURL.trim() || null,
          });

          const userPrefsRef = doc(db, "users", currentUser.uid);
          await setDoc(
            userPrefsRef,
            {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: displayName.trim() || currentUser.email?.split("@")[0] || "Student",
              photoURL: photoURL.trim() || "",
              provider: providerLabel,
              academic_year: selectedAcademicYear,
              branch: selectedBranch,
              semester: Number(selectedSemester),
              updatedAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
            },
            { merge: true }
          );

          setAcademicYear(selectedAcademicYear);
          setBranch(selectedBranch);
          setSemester(selectedSemester);
        })(),
        {
          loading: "Saving profile…",
          success: "Profile and preferences updated",
          error: "Could not update profile",
          id: "profile-save",
        }
      );
      setLastSavedAt(new Date().toISOString());
    } catch {
      // notify.promise already surfaced the error
    } finally {
      setSaving(false);
    }
  };

  const selectPresetAvatar = (preset: AvatarPreset) => {
    const dataUrl = generateAvatarDataUrl(preset.emoji, preset.start, preset.end);
    setPhotoURL(dataUrl);
    setTempPhotoUrl(dataUrl);
  };

  const handleCustomPhotoUrlSubmit = () => {
    if (tempPhotoUrl.trim()) {
      setPhotoURL(tempPhotoUrl.trim());
      notify.success("Custom avatar image link applied");
    } else {
      setPhotoURL("");
      setTempPhotoUrl("");
    }
  };

  const applyLinkedUser = (user: FirebaseUser) => {
    setCurrentUser(user);
    setDisplayName(user.displayName || "");
    setPhotoURL(user.photoURL || "");
    setTempPhotoUrl(user.photoURL || "");
  };

  const handleLinkGithub = async () => {
    if (!auth.currentUser) return;
    setLinking(true);
    mergingRef.current = true;
    try {
      const outcome = await startProviderLink(auth, "github");
      if (outcome.status === "linked") {
        applyLinkedUser(outcome.user);
        setMergeStep(null);
        notify.success("GitHub is now linked. You can sign in with either provider.");
      } else if (outcome.status === "needs-google-confirm") {
        setMergeStep("google");
        notify.message("Confirm Google to finish merging into one profile.");
      }
    } catch (err: unknown) {
      const code = err instanceof FirebaseError ? err.code : undefined;
      if (code === "auth/popup-closed-by-user") {
        notify.error("Linking was cancelled. Please try again.");
      } else {
        notify.error(err, "Could not link GitHub.");
      }
    } finally {
      mergingRef.current = false;
      if (!auth.currentUser) {
        router.push("/login?redirectTo=/profile");
      }
      setLinking(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (!auth.currentUser) return;
    setLinking(true);
    mergingRef.current = true;
    try {
      const outcome = await startProviderLink(auth, "google");
      if (outcome.status === "linked") {
        applyLinkedUser(outcome.user);
        setMergeStep(null);
        notify.success("Google is now linked. You can sign in with either provider.");
      } else if (outcome.status === "needs-github-confirm") {
        setMergeStep("github");
        notify.message("Confirm GitHub to finish merging into one profile.");
      }
    } catch (err: unknown) {
      const code = err instanceof FirebaseError ? err.code : undefined;
      if (code === "auth/popup-closed-by-user") {
        notify.error("Linking was cancelled. Please try again.");
      } else {
        notify.error(err, "Could not link Google.");
      }
    } finally {
      mergingRef.current = false;
      if (!auth.currentUser) {
        router.push("/login?redirectTo=/profile");
      }
      setLinking(false);
    }
  };

  const handleConfirmGithubMerge = async () => {
    if (!auth.currentUser) return;
    setLinking(true);
    mergingRef.current = true;
    try {
      const outcome = await confirmMergeWithGithub(auth);
      if (outcome.status === "linked") {
        applyLinkedUser(outcome.user);
        setMergeStep(null);
        notify.success("Google and GitHub are now one account.");
      }
    } catch (err: unknown) {
      notify.error(err, "Could not finish merging GitHub.");
    } finally {
      mergingRef.current = false;
      if (!auth.currentUser) {
        router.push("/login?redirectTo=/profile");
      }
      setLinking(false);
    }
  };

  const handleConfirmGoogleMerge = async () => {
    if (!auth.currentUser) return;
    setLinking(true);
    mergingRef.current = true;
    try {
      const outcome = await confirmMergeWithGoogle(auth);
      if (outcome.status === "linked") {
        applyLinkedUser(outcome.user);
        setMergeStep(null);
        notify.success("Google and GitHub are now one account.");
      }
    } catch (err: unknown) {
      notify.error(err, "Could not finish merging Google.");
    } finally {
      mergingRef.current = false;
      if (!auth.currentUser) {
        router.push("/login?redirectTo=/profile");
      }
      setLinking(false);
    }
  };

  if (loading || redirectBusy) {
    return (
      <div
        className="flex flex-col min-h-screen items-center justify-center bg-background gap-3"
        role="status"
        aria-live="polite"
      >
        <span className="loading-orb" aria-hidden />
        <p className="text-xs font-semibold text-muted">Loading your preferences...</p>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  // Determine provider type
  const isGoogle = currentUser?.providerData?.some(
    (p: UserInfo) => p.providerId === "google.com"
  );
  const isGithub = currentUser?.providerData?.some(
    (p: UserInfo) => p.providerId === "github.com"
  );
  const providerLabel = isGoogle
    ? "Google Account"
    : isGithub
      ? "GitHub Account"
      : "Email Account";

  const workspaceQs = workspaceQuery(selectedAcademicYear, selectedBranch, selectedSemester);
  const branchLabel =
    BRANCH_OPTIONS_LONG.find((b) => b.value === selectedBranch)?.label ?? selectedBranch;
  const memberSince = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  const quickLinks = [
    {
      href: `/resources?${workspaceQs}`,
      label: "Resources",
      desc: "Subject files & notes",
      icon: FileText,
    },
    {
      href: `/syllabus?${workspaceQs}`,
      label: "Syllabus",
      desc: "Track your courses",
      icon: BookOpen,
    },
    {
      href: `/planner?${workspaceQs}`,
      label: "Planner",
      desc: "Schedules & study logs",
      icon: CalendarCheck,
    },
    {
      href: `/ask?${workspaceQs}`,
      label: "Ask AI",
      desc: "RAG study assistant",
      icon: Brain,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background relative page-gutter py-6 md:py-12 overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[10%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-primary/3 blur-[90px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-foreground/3 blur-[90px]" />
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Navigation Link */}
        <AppLink
          href="/planner"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workspace
        </AppLink>

        <PageHeader
          className="mb-8"
          eyebrow="Your account"
          title="Profile Settings"
          description="Personalize your avatar, set your academic workspace, and manage how you sign in across Utility."
        />

        {/* Main Content Grid */}
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/30 to-foreground/20" />

              <div className="w-28 h-28 rounded-2xl bg-foreground text-background flex items-center justify-center text-4xl font-black shadow-md border border-border/70 overflow-hidden mb-4 shrink-0 ring-4 ring-background">
                {photoURL ? (
                  <Image
                    src={photoURL}
                    alt="Avatar"
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                ) : (
                  displayName?.[0] ?? currentUser.email?.[0] ?? "?"
                )}
              </div>

              <h2 className="text-base font-bold text-foreground truncate max-w-full">
                {displayName || currentUser.email?.split("@")[0] || "Student"}
              </h2>
              <p className="text-[11px] text-muted font-mono mt-0.5 truncate max-w-full">
                {currentUser.email || "Private email"}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-hover/80 border border-border text-muted">
                  {providerLabel}
                </span>
                {memberSince && (
                  <span className="inline-flex items-center text-[9px] font-semibold px-2 py-0.5 rounded-full bg-surface/80 border border-border text-muted">
                    Since {memberSince}
                  </span>
                )}
              </div>
            </div>

            {/* Workspace preview */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-muted" />
                Active workspace
              </h3>
              <div className="rounded-xl border border-border/80 bg-surface/40 p-3.5 space-y-2">
                <p className="text-sm font-bold text-foreground">{selectedAcademicYear}</p>
                <p className="text-xs text-muted leading-relaxed">{branchLabel}</p>
                <p className="text-xs font-semibold text-foreground">Semester {selectedSemester}</p>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
                Resources, syllabus, and AI answers follow this scope after you save.
              </p>
              <AppLink
                href={`/resources?${workspaceQs}`}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-foreground hover:text-foreground/80 border border-border rounded-xl px-3 py-2.5 bg-background hover:bg-surface/50 transition-colors"
              >
                Open resources
                <ExternalLink className="w-3 h-3" />
              </AppLink>
            </div>

            {/* Appearance */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-muted" />
                Appearance
              </h3>
              <ProfileThemeToggle />
              <p className="text-[10px] text-muted leading-relaxed">
                Choose light, dark, or match your system preference.
              </p>
            </div>

            {/* Custom Image Link Input */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-muted" />
                Custom Image Link
              </h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={tempPhotoUrl}
                  onChange={(e) => setTempPhotoUrl(e.target.value)}
                  className="flex-1 min-w-0 w-full bg-surface/50 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-foreground/45 text-foreground placeholder:text-muted truncate transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={handleCustomPhotoUrlSubmit}
                  className="bg-surface hover:bg-surface-hover border border-border text-foreground font-bold text-xs px-4 py-2.5 rounded-xl transition-colors duration-200 shrink-0"
                >
                  Apply
                </button>
              </div>
              <p className="text-[10px] text-muted-hover leading-relaxed">
                Paste any public image URL (JPEG, PNG, SVG) to set it as your profile avatar.
              </p>
            </div>
          </div>

          {/* Right Side: Settings Forms */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* General Information Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col gap-6">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 pb-3 border-b border-border/50">
                <User className="w-4 h-4 text-muted" />
                General Information
              </h3>

              {/* Display Name Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.g., John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-background border border-border/95 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-foreground focus:border-foreground text-foreground placeholder:text-muted transition-all"
                />
              </div>

              {/* Preset Avatars Selection */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-foreground">
                  Choose Preset Avatar (Monochrome)
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectPresetAvatar(preset)}
                      className="aspect-square rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-2xl relative shadow-xs group border border-border/50 hover:border-foreground/30 overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${preset.start} 0%, ${preset.end} 100%)`,
                      }}
                      title={preset.label}
                    >
                      <span className="filter grayscale brightness-90">{preset.emoji}</span>
                      {/* Selection dot */}
                      {photoURL.includes(preset.emoji) && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-foreground border border-background rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Academic Settings Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/50">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-muted" />
                  Academic workspace
                </h3>
                <span className="text-[10px] font-semibold text-muted bg-surface border border-border rounded-full px-2 py-0.5 shrink-0">
                  Syncs app-wide
                </span>
              </div>

              <ScopeSelector
                variant="settings"
                academicYear={selectedAcademicYear}
                branch={selectedBranch}
                semester={selectedSemester}
                onAcademicYearChange={setSelectedAcademicYear}
                onBranchChange={setSelectedBranch}
                onSemesterChange={setSelectedSemester}
              />
              <p className="text-[10px] text-muted leading-relaxed">
                Pick your year, branch, and semester. Saving updates the sidebar, resources, syllabus tracker, and AI context.
              </p>
            </div>

            {/* Quick links */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border/50">
                Quick shortcuts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <AppLink
                      key={item.href}
                      href={item.href}
                      className="group flex items-start gap-3 rounded-xl border border-border/80 bg-background/60 p-3.5 hover:border-border-strong hover:bg-surface/40 transition-colors"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground group-hover:border-border-strong">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-foreground">{item.label}</span>
                        <span className="block text-[10px] text-muted mt-0.5">{item.desc}</span>
                      </span>
                    </AppLink>
                  );
                })}
              </div>
            </div>

            {/* Offline cache */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border/50 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted" />
                Offline files
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                PDFs saved with “Save offline” are stored in this browser only. Clearing frees storage and requires re-download.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await notify.promise(clearDriveFileCache(), {
                      loading: "Clearing offline files…",
                      success: "Offline files cleared",
                      error: "Could not clear offline cache",
                      id: "offline-cache-clear",
                    });
                  } catch {
                    // notify.promise already surfaced the error
                  }
                }}
                className="self-start inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors"
              >
                Clear offline files
              </button>
            </div>

            {/* Connected accounts */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border/50">
                Connected accounts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 px-3.5 py-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Google</p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {isGoogle ? "Linked to this profile" : "Not linked"}
                    </p>
                  </div>
                  {isGoogle ? (
                    <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-muted">Off</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 px-3.5 py-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">GitHub</p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {isGithub ? "Linked to this profile" : "Not linked"}
                    </p>
                  </div>
                  {isGithub ? (
                    <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-muted">Off</span>
                  )}
                </div>
              </div>
              {(!isGoogle || !isGithub || mergeStep) && (
                <>
                  <p className="text-xs text-muted leading-relaxed">
                    {mergeStep === "github"
                      ? "Google is on another Utility account. Confirm GitHub in this tab so both logins share one profile and photo."
                      : mergeStep === "google"
                        ? "GitHub is on another Utility account. Confirm Google in this tab so both logins share one profile and photo."
                        : "Link the other provider so Google and GitHub use the same profile and photo. If a popup is blocked, continue in this tab."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mergeStep === "github" ? (
                      <button
                        type="button"
                        onClick={handleConfirmGithubMerge}
                        disabled={linking}
                        className="bg-foreground text-background text-xs font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {linking ? "Linking…" : "Confirm GitHub"}
                      </button>
                    ) : mergeStep === "google" ? (
                      <button
                        type="button"
                        onClick={handleConfirmGoogleMerge}
                        disabled={linking}
                        className="bg-foreground text-background text-xs font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {linking ? "Linking…" : "Confirm Google"}
                      </button>
                    ) : (
                      <>
                        {!isGithub && (
                          <button
                            type="button"
                            onClick={handleLinkGithub}
                            disabled={linking}
                            className="bg-foreground text-background text-xs font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {linking ? "Linking…" : "Link GitHub"}
                          </button>
                        )}
                        {!isGoogle && (
                          <button
                            type="button"
                            onClick={handleLinkGoogle}
                            disabled={linking}
                            className="bg-foreground text-background text-xs font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {linking ? "Linking…" : "Link Google"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Save Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1 rounded-2xl border border-border/80 bg-card/80 p-4">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await auth.signOut();
                    router.push("/");
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-transparent px-4 py-2.5 rounded-xl transition-all w-fit"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
                {lastSavedAt && (
                  <p className="text-[10px] text-muted">
                    Last saved {new Date(lastSavedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 bg-foreground text-background font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-95 duration-150 shadow-md sm:ml-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving changes...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

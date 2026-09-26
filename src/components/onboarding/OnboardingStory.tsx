"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  BookOpen,
  Brain,
  CalendarRange,
  ClipboardCopy,
  ExternalLink,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAcademicStore } from "@/store/academicStore";
import {
  isAcademicYear,
  isBranch,
  isSemester,
  type AcademicYear,
  type Branch,
  type Semester,
} from "@/lib/academic/scope";
import { ScopeSelector } from "@/components/academic/ScopeSelector";
import { Button, ButtonLink, Modal } from "@/components/ui";
import { isAuthPage } from "@/lib/authRoutes";
import { onboardingKindFromCreatedAt, type OnboardingKind } from "@/lib/onboarding";
import { WHATSAPP_COMMUNITY_URL } from "@/lib/communityLinks";
import { usePathname } from "next/navigation";
import { notify } from "@/lib/toast";

const NEW_STEPS = [
  {
    title: "Your semester",
    heading: "Set your workspace",
    body: "Year, branch, and semester pick the right notes and let us see what the campus actually uses.",
  },
  {
    title: "Vault",
    heading: "Notes live in the Vault",
    body: "Open Resources for PYQs, slides, and writeups for your branch. Syllabus sits next to it, unit by unit.",
    items: [
      { title: "Vault", blurb: "Browse by subject. Files stay on Drive — we never proxy the PDF.", Icon: BookOpen },
    ],
  },
  {
    title: "Ask & doubts",
    heading: "Get unstuck without leaving the course",
    body: "Ask AI answers from your files. The Doubt Board is for paper-format questions and handwritten solutions.",
    items: [
      { title: "Ask AI", blurb: "Grounded in your semester catalog, not a generic cutoff.", Icon: Brain },
      { title: "Doubt Board", blurb: "Ask, vote, and share solutions with people in the same course.", Icon: HelpCircle },
    ],
  },
  {
    title: "Day to day",
    heading: "Planner and a lab clipboard",
    body: "Deadlines stay on your account. Clipboard syncs a pad — and a Drive PDF as a link — to a 24-hour code.",
    items: [
      { title: "Planner", blurb: "Week view and natural-language tasks that follow you across devices.", Icon: CalendarRange },
      { title: "Clipboard", blurb: "Paste notes or a Drive share link. Hand someone a short code on a lab PC.", Icon: ClipboardCopy },
    ],
  },
  {
    title: "Feedback",
    heading: "Tell us when something is off",
    body: "Join the WhatsApp community and open Feedback & Bugs. Feature requests and broken previews both go there.",
  },
] as const;

const RETURNING_NOTES = [
  {
    title: "Sign-in is now required",
    blurb: "Vault, Ask AI, Planner, and the Doubt Board need an account so notes match your semester and we can see usage.",
  },
  {
    title: "Clipboard can carry a Drive PDF",
    blurb: "Paste a Google Drive share link on your pad. The file stays on Drive; the other person just opens the link.",
  },
  {
    title: "Feedback & Bugs",
    blurb: "Something broken, or a quality-of-life fix you want? That WhatsApp room is the fastest path.",
  },
] as const;

export function OnboardingStory() {
  const pathname = usePathname() || "/";
  const academicYear = useAcademicStore((s) => s.academicYear);
  const branch = useAcademicStore((s) => s.branch);
  const semester = useAcademicStore((s) => s.semester);
  const setWorkspace = useAcademicStore((s) => s.setWorkspace);

  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<OnboardingKind>("new");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState<AcademicYear>(academicYear);
  const [br, setBr] = useState<Branch>(branch);
  const [sem, setSem] = useState<Semester>(semester);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setOpen(false);
        setReady(true);
        return;
      }
      setUid(user.uid);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        if (data?.academic_year && isAcademicYear(data.academic_year)) {
          setYear(data.academic_year);
        }
        if (typeof data?.branch === "string" && isBranch(data.branch)) {
          setBr(data.branch);
        }
        if (typeof data?.semester === "number" && isSemester(data.semester)) {
          setSem(data.semester);
        }
        if (data?.onboarding_completed_at) {
          setOpen(false);
        } else {
          setKind(onboardingKindFromCreatedAt(user.metadata.creationTime));
          setStep(0);
          setOpen(true);
        }
      } catch {
        setKind(onboardingKindFromCreatedAt(user.metadata.creationTime));
        setOpen(true);
      } finally {
        setReady(true);
      }
    });
  }, []);

  const hideOnThisPage = isAuthPage(pathname) || pathname.startsWith("/clipboard/s/");
  const visible = ready && !!uid && open && !hideOnThisPage;
  const lastNewStep = NEW_STEPS.length - 1;
  const current = NEW_STEPS[step] ?? NEW_STEPS[0];

  const persistWorkspace = async () => {
    if (!uid) return;
    const user = auth.currentUser;
    await setDoc(
      doc(db, "users", uid),
      {
        uid,
        email: user?.email || "",
        academic_year: year,
        branch: br,
        semester: Number(sem),
        updatedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      },
      { merge: true },
    );
    setWorkspace(year, br, sem);
  };

  const finish = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await persistWorkspace();
      await setDoc(
        doc(db, "users", uid),
        { onboarding_completed_at: new Date().toISOString() },
        { merge: true },
      );
      setOpen(false);
    } catch {
      notify.error("Could not save your workspace. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (kind === "returning") {
      await finish();
      return;
    }
    if (step === 0) {
      setSaving(true);
      try {
        await persistWorkspace();
        setStep(1);
      } catch {
        notify.error("Could not save your semester. Try again.");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step >= lastNewStep) {
      await finish();
      return;
    }
    setStep((s) => s + 1);
  };

  const canClose = kind === "returning" || step === lastNewStep;

  return (
    <Modal
      open={visible}
      onClose={() => {
        if (canClose) void finish();
      }}
      showClose={canClose}
      size="md"
      title={kind === "returning" ? "Still here. Thank you." : current.title}
    >
      {kind === "returning" ? (
        <ReturningBody
          year={year}
          br={br}
          sem={sem}
          setYear={setYear}
          setBr={setBr}
          setSem={setSem}
          saving={saving}
          onFinish={() => void finish()}
        />
      ) : (
        <NewUserBody
          step={step}
          lastStep={lastNewStep}
          year={year}
          br={br}
          sem={sem}
          setYear={setYear}
          setBr={setBr}
          setSem={setSem}
          saving={saving}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onNext={() => void next()}
        />
      )}
    </Modal>
  );
}

function ReturningBody({
  year,
  br,
  sem,
  setYear,
  setBr,
  setSem,
  saving,
  onFinish,
}: {
  year: AcademicYear;
  br: Branch;
  sem: Semester;
  setYear: (v: AcademicYear) => void;
  setBr: (v: Branch) => void;
  setSem: (v: Semester) => void;
  saving: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        Thanks for using Utility. A few things changed so the tools stay useful
        on campus Wi-Fi and we can see what each semester actually needs.
      </p>
      <ul className="space-y-2.5">
        {RETURNING_NOTES.map((note) => (
          <li
            key={note.title}
            className="rounded-xl border border-border bg-surface/40 p-3"
          >
            <p className="text-sm font-semibold text-foreground">{note.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{note.blurb}</p>
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Confirm your semester
        </p>
        <ScopeSelector
          variant="settings"
          academicYear={year}
          branch={br}
          semester={sem}
          onAcademicYearChange={setYear}
          onBranchChange={setBr}
          onSemesterChange={setSem}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            window.open(WHATSAPP_COMMUNITY_URL, "_blank", "noopener,noreferrer")
          }
          variant="secondary"
        >
          Feedback & Bugs
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <ButtonLink href="/community" variant="ghost" size="sm">
          Community
        </ButtonLink>
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={saving} onClick={onFinish}>
          {saving ? "Saving…" : "Got it"}
        </Button>
      </div>
    </div>
  );
}

function NewUserBody({
  step,
  lastStep,
  year,
  br,
  sem,
  setYear,
  setBr,
  setSem,
  saving,
  onBack,
  onNext,
}: {
  step: number;
  lastStep: number;
  year: AcademicYear;
  br: Branch;
  sem: Semester;
  setYear: (v: AcademicYear) => void;
  setBr: (v: Branch) => void;
  setSem: (v: Semester) => void;
  saving: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const current = NEW_STEPS[step] ?? NEW_STEPS[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-1" aria-hidden>
        {NEW_STEPS.map((s, i) => (
          <span
            key={s.title}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-foreground" : "bg-border"
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {step + 1} / {NEW_STEPS.length}
      </p>
      <div>
        <p className="text-base font-semibold tracking-tight text-foreground">
          {current.heading}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{current.body}</p>
      </div>

      {step === 0 && (
        <ScopeSelector
          variant="settings"
          academicYear={year}
          branch={br}
          semester={sem}
          onAcademicYearChange={setYear}
          onBranchChange={setBr}
          onSemesterChange={setSem}
        />
      )}

      {"items" in current && current.items && (
        <ul className="space-y-2.5">
          {current.items.map(({ title, blurb, Icon }) => (
            <li
              key={title}
              className="flex gap-3 rounded-xl border border-border bg-surface/40 p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs leading-relaxed text-muted">{blurb}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {step === lastStep && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              window.open(WHATSAPP_COMMUNITY_URL, "_blank", "noopener,noreferrer")
            }
          >
            Open Feedback & Bugs
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <ButtonLink href="/community" variant="secondary" size="sm">
            Community page
          </ButtonLink>
        </div>
      )}

      {step === 1 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Sign-in keeps Vault, Ask, and the Doubt Board on your semester so the
          catalog — and campus stats — stay accurate.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" disabled={step === 0 || saving} onClick={onBack}>
          Back
        </Button>
        <Button size="sm" disabled={saving} onClick={onNext}>
          {step === 0
            ? "Save and continue"
            : step === lastStep
              ? saving
                ? "Saving…"
                : "Start using Utility"
              : "Next"}
        </Button>
      </div>
    </div>
  );
}

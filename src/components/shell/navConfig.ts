import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  CalendarCheck,
  Brain,
  Users,
  Layers,
  Download,
  Timer,
  GraduationCap,
  Heart,
  Building2,
  Waypoints,
  Home,
  HelpCircle,
  ClipboardCopy,
} from "lucide-react";

export interface NavLinkItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  featured?: boolean;
  desc: string;
}

export const HOME_LINK: NavLinkItem = {
  href: "/",
  label: "Home",
  Icon: Home,
  desc: "Workspace home",
};

export const CLIPBOARD_LINK: NavLinkItem = {
  href: "/clipboard",
  label: "Clipboard",
  Icon: ClipboardCopy,
  desc: "Synced notes across devices",
};

export const PINNED_LINKS: NavLinkItem[] = [
  HOME_LINK,
  { href: "/resources", label: "Resources", Icon: FileText, featured: true, desc: "Subject files. Notes are reference-only" },
  { href: "/ask", label: "Ask AI", Icon: Brain, desc: "RAG-powered academic assistant" },
  { href: "/planner", label: "Study Planner", Icon: CalendarCheck, desc: "Collaborative schedule & logs" },
];

export const ACADEMIC_LINKS: NavLinkItem[] = [
  { href: "/syllabus", label: "Syllabus", Icon: BookOpen, desc: "Course syllabus tracker" },
  { href: "/qa", label: "Doubt Board", Icon: HelpCircle, desc: "Paper doubts & syllabus scope" },
  { href: "/visualize", label: "Visualize", Icon: Waypoints, desc: "AI algorithm visualizers" },
];

export const CAMPUS_LINKS: NavLinkItem[] = [
  { href: "/campus", label: "Campus", Icon: Building2, desc: "Seating, directory, and labs" },
];

export const TOOL_LINKS: NavLinkItem[] = [
  { href: "/timer", label: "Focus Timer", Icon: Timer, desc: "Pomodoro study sessions" },
  { href: "/gpa", label: "GPA Calculator", Icon: GraduationCap, desc: "Track and project your grades" },
  { href: "/srs", label: "SRS Flashcards", Icon: Layers, desc: "Spaced repetition reviewer" },
  CLIPBOARD_LINK,
];

/** @deprecated Prefer PINNED_LINKS + TOOL_LINKS */
export const PRODUCTIVITY_LINKS: NavLinkItem[] = [
  PINNED_LINKS[3],
  ...TOOL_LINKS.filter((l) => l.href !== "/clipboard"),
];

export const SOCIAL_LINKS: NavLinkItem[] = [
  { href: "/community", label: "Community", Icon: Users, desc: "Decks & WhatsApp" },
];

export const SYSTEM_LINKS: NavLinkItem[] = [
  { href: "/install", label: "Install App", Icon: Download, desc: "PWA desktop application" },
  { href: "/support", label: "Support", Icon: Heart, desc: "Optional contribution" },
];

export const MORE_GROUP_LINKS: NavLinkItem[] = [
  ...CAMPUS_LINKS,
  ...SOCIAL_LINKS,
  ...SYSTEM_LINKS,
];

export const MORE_LINKS: NavLinkItem[] = [
  ...ACADEMIC_LINKS,
  ...TOOL_LINKS,
  ...MORE_GROUP_LINKS,
];

export const PHONE_TABS: Array<Pick<NavLinkItem, "href" | "label" | "Icon">> = [
  HOME_LINK,
  { href: "/resources", label: "Vault", Icon: FileText },
  { href: "/ask", label: "Ask", Icon: Brain },
  { href: "/planner", label: "Planner", Icon: CalendarCheck },
];

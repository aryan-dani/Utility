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

export const ACADEMIC_LINKS: NavLinkItem[] = [
  { href: "/resources", label: "Resources", Icon: FileText, featured: true, desc: "Subject files. Notes are reference-only" },
  { href: "/ask", label: "Ask AI", Icon: Brain, desc: "RAG-powered academic assistant" },
  { href: "/qa", label: "Doubt Board", Icon: HelpCircle, desc: "Paper doubts & syllabus scope" },
  { href: "/syllabus", label: "Syllabus", Icon: BookOpen, desc: "Course syllabus tracker" },
  { href: "/visualize", label: "Visualize", Icon: Waypoints, desc: "AI algorithm visualizers" },
];

export const CAMPUS_LINKS: NavLinkItem[] = [
  { href: "/campus", label: "Campus", Icon: Building2, desc: "Seating, directory, and labs" },
];

export const PRODUCTIVITY_LINKS: NavLinkItem[] = [
  { href: "/planner", label: "Study Planner", Icon: CalendarCheck, desc: "Collaborative schedule & logs" },
  { href: "/timer", label: "Focus Timer", Icon: Timer, desc: "Pomodoro study sessions" },
  { href: "/gpa", label: "GPA Calculator", Icon: GraduationCap, desc: "Track and project your grades" },
  { href: "/srs", label: "SRS Flashcards", Icon: Layers, desc: "Spaced repetition reviewer" },
];

export const SOCIAL_LINKS: NavLinkItem[] = [
  { href: "/community", label: "Community", Icon: Users, desc: "Decks & WhatsApp" },
];

export const SYSTEM_LINKS: NavLinkItem[] = [
  { href: "/install", label: "Install App", Icon: Download, desc: "PWA desktop application" },
  { href: "/support", label: "Support", Icon: Heart, desc: "Optional contribution" },
];

export const MORE_LINKS: NavLinkItem[] = [
  ...ACADEMIC_LINKS.filter((l) => l.href !== "/resources" && l.href !== "/ask"),
  ...CAMPUS_LINKS,
  ...PRODUCTIVITY_LINKS.filter((l) => l.href !== "/planner"),
  ...SOCIAL_LINKS,
  ...SYSTEM_LINKS,
];

export const PHONE_TABS: Array<Pick<NavLinkItem, "href" | "label" | "Icon">> = [
  HOME_LINK,
  { href: "/resources", label: "Vault", Icon: FileText },
  { href: "/ask", label: "Ask", Icon: Brain },
  { href: "/planner", label: "Planner", Icon: CalendarCheck },
];

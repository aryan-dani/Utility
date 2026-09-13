import AppLink from "@/components/ui/AppLink";
import {
  MapPin,
  BookUser,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import { PageHeader, PageShell } from "@/components/ui";

const CAMPUS_LINKS = [
  {
    href: "/campus/seating",
    label: "Faculty Seating",
    description:
      "Find cabin and seating assignments for faculty across departments.",
    Icon: MapPin,
  },
  {
    href: "/campus/directory",
    label: "Faculty Directory",
    description:
      "Browse staff by program track: designation, contact, and specialization.",
    Icon: BookUser,
  },
  {
    href: "/campus/labs",
    label: "Labs",
    description:
      "Lab rooms with floor, systems, capacity, and assistant details.",
    Icon: FlaskConical,
  },
] as const;

export default function CampusHubPage() {
  return (
    <PageShell>
      <PageHeader
        className="mb-10 pb-6 border-b border-border"
        eyebrow="Campus"
        title="MIT-WPU campus data"
        description="Faculty seating, directory, and lab registry. Live from the same campus backend. Updates there show up here without a Utility redeploy."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CAMPUS_LINKS.map(({ href, label, description, Icon }) => (
          <AppLink
            key={href}
            href={href}
            className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:p-6 text-left transition-colors hover:bg-surface/60 active:bg-surface hover:border-border-strong focus-visible:outline-offset-2"
          >
            <div className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center text-foreground group-hover:border-foreground/30 transition-colors">
              <Icon className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h2 className="text-sm font-bold text-foreground">{label}</h2>
                <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-foreground transition-colors shrink-0" />
              </div>
              <p className="text-xs text-muted leading-relaxed">{description}</p>
            </div>
          </AppLink>
        ))}
      </div>
    </PageShell>
  );
}

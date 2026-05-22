import Link from 'next/link';
import { CalendarCheck, BookOpen, FileText, ArrowRight, Brain, ShieldCheck, Layers } from 'lucide-react';
import { FadeIn, ScaleButton } from '@/components/Animations';
import { createClient } from '@/lib/supabaseServer';

const FEATURES = [
  {
    href: '/planner',
    label: 'Weekly Planner',
    number: '01',
    Icon: CalendarCheck,
    description:
      'Organize your week with a private, local-first task board. Syncs to the cloud.',
  },
  {
    href: '/ask',
    label: 'Ask AI',
    number: '02',
    Icon: Brain,
    description:
      'Get instant explanations, flashcards, and study help powered by Llama 3.3.',
  },
  {
    href: '/syllabus',
    label: 'Syllabus',
    number: '03',
    Icon: BookOpen,
    description:
      'Clear breakdown of every subject, unit by unit. Download full PDFs instantly.',
  },
  {
    href: '/resources',
    label: 'Resources',
    number: '04',
    Icon: FileText,
    description:
      'All your notes, PPTs, question banks, and PYQs organized by subject.',
  },
  {
    href: '/gpa',
    label: 'GPA Calc',
    number: '05',
    Icon: ShieldCheck,
    description:
      'Calculate your SGPA and CGPA with auto-populated subjects from the database.',
  },
  {
    href: '/srs',
    label: 'SRS Cards',
    number: '06',
    Icon: Layers,
    description:
      'Active Leitner spacing system. Review cards to lock them in long-term memory.',
  },
];

import ActivityHeatmap from '@/components/ActivityHeatmap';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  return (
    <div className="flex-1 w-full flex flex-col">
      {/* Hero */}
      <section className="w-full max-w-7xl mx-auto px-6 pt-20 pb-28 flex flex-col items-center justify-center text-center">
        <FadeIn>


          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6 text-foreground max-w-4xl mx-auto">
            Everything for your
            <br />
            <span className="text-muted">semester. One place.</span>
          </h1>

          <p className="text-base md:text-lg text-muted mb-10 max-w-xl mx-auto leading-relaxed">
            A structured, premium workspace for accessing syllabi, course materials, and managing your weekly schedule.
          </p>

          {isLoggedIn ? (
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/planner">
                <ScaleButton className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-card">
                  Open Planner <ArrowRight className="w-4 h-4" />
                </ScaleButton>
              </Link>
              <Link href="/resources">
                <ScaleButton className="inline-flex items-center gap-2 px-6 py-2.5 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
                  Browse Resources
                </ScaleButton>
              </Link>
            </div>
          ) : (
            <div className="flex justify-center">
              <Link href="/login">
                <ScaleButton className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-card">
                  Get Started <ArrowRight className="w-4 h-4" />
                </ScaleButton>
              </Link>
            </div>
          )}
        </FadeIn>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-border" />

      {/* Features */}
      <section className="w-full max-w-[90rem] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border shadow-card">
          {FEATURES.map(({ href, label, number, Icon, description }, i) => (
            <Link key={href} href={href} className="group block bg-background hover:bg-surface transition-colors duration-200">
              <FadeIn delay={i * 0.07} y={8}>
                <div className="p-6 h-full flex flex-col gap-6">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:bg-surface-hover transition-colors">
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="text-xs font-mono text-muted">{number}</span>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-foreground mb-2 group-hover:text-foreground transition-colors">
                      {label}
                    </h2>
                    <p className="text-sm text-muted leading-relaxed">{description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted group-hover:text-foreground transition-colors">
                    <span>Open {label}</span>
                    <ArrowRight className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </FadeIn>
            </Link>
          ))}
        </div>
      </section>

      {/* Activity Heatmap */}
      <section className="w-full max-w-7xl mx-auto px-6 py-10">
        <ActivityHeatmap />
      </section>

      {/* Stats Strip */}
      <div className="w-full border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: 'Subjects', value: '10+' },
            { label: 'Resources', value: '50+' },
            { label: 'Semesters', value: '8' },
            { label: 'Branches', value: '2' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

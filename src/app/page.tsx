"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  BookOpen,
  FileText,
  ArrowRight,
  Brain,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { FadeIn, ScaleButton } from "@/components/Animations";
import AuthButtons from "./AuthButtons";
import { motion, useInView } from "framer-motion";
import dynamic from "next/dynamic";
import { useRef } from "react";

const ActivityHeatmap = dynamic(() => import("@/components/ActivityHeatmap"), { 
  ssr: false,
  loading: () => <div className="w-full h-48 skeleton rounded-2xl" />
});

const FEATURES = [
  {
    href: "/planner",
    label: "Study Planner",
    number: "01",
    Icon: CalendarCheck,
    description:
      "Organize your month with natural-language prompts. Share & collaborate with peers.",
  },
  {
    href: "/ask",
    label: "Ask AI",
    number: "02",
    Icon: Brain,
    description:
      "Get instant explanations, flashcards, and study help powered by Llama 3.3.",
  },
  {
    href: "/syllabus",
    label: "Syllabus",
    number: "03",
    Icon: BookOpen,
    description:
      "Clear breakdown of every subject, unit by unit. Download full PDFs instantly.",
  },
  {
    href: "/resources",
    label: "Resources",
    number: "04",
    Icon: FileText,
    description:
      "All your notes, PPTs, question banks, and PYQs organized by subject.",
  },
  {
    href: "/gpa",
    label: "GPA Calc",
    number: "05",
    Icon: ShieldCheck,
    description:
      "Calculate your SGPA and CGPA with auto-populated subjects from the database.",
  },
  {
    href: "/srs",
    label: "SRS Cards",
    number: "06",
    Icon: Layers,
    description:
      "Active Leitner spacing system. Review cards to lock them in long-term memory.",
  },
];

function StatsCounter({ value }: { value: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const numericVal = parseInt(value.replace(/\D/g, ""), 10);
  const hasPlus = value.includes("+");

  useEffect(() => {
    if (!isInView) return;
    
    let start = 0;
    const end = numericVal;
    if (isNaN(end) || end === 0) {
      setCount(end);
      return;
    }

    const totalDuration = 1000;
    const increment = Math.ceil(end / (totalDuration / 30));
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [numericVal, isInView]);

  return <span ref={ref}>{count}{hasPlus && "+"}</span>;
}

export default function Home() {
  return (
    <div className="flex-1 w-full flex flex-col relative overflow-hidden page-fade-in">
      {/* Subtle Dot Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--foreground)/0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--foreground)/0.08)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-20" />
      <div className="noise-overlay" />



      {/* Hero */}
      <section className="w-full max-w-7xl mx-auto px-6 pt-28 pb-36 flex flex-col items-center justify-center text-center relative min-h-[82vh]">
        <FadeIn>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 text-foreground max-w-4xl mx-auto">
            Everything for your
            <br />
            <span className="text-gradient-mono font-black">semester. One place.</span>
          </h1>

          <p className="text-base md:text-lg text-foreground-subtle mb-10 max-w-xl mx-auto leading-relaxed">
            A structured, premium workspace for accessing syllabi, course
            materials, and managing your weekly schedule.
          </p>

          <AuthButtons />
        </FadeIn>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none"
        >
          <span className="text-[9px] font-mono tracking-widest text-muted uppercase">Scroll to Explore</span>
          <div className="w-5 h-8 rounded-full border border-border-strong flex justify-center p-1 bg-background shadow-sm">
            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-2 rounded-full bg-foreground"
            />
          </div>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="w-full border-t border-border" />

      {/* Features */}
      <section className="w-full max-w-[90rem] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/70 shadow-sm">
          {FEATURES.map(({ href, label, number, Icon, description }, i) => (
            <Link
              key={href}
              href={href}
              className="group block bg-card hover:bg-surface/50 transition-colors duration-200"
            >
              <FadeIn delay={i * 0.07} y={8}>
                <div className="p-6 h-full flex flex-col gap-6 relative">
                  {/* Hover Left Accent Line */}
                  <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center" />
 
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-surface/50 border border-border/70 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300">
                      <Icon className="w-5 h-5 text-foreground transition-colors" />
                    </div>
                    <span className="text-xs font-mono text-muted group-hover:text-foreground/70 transition-colors">
                      {number}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-foreground mb-2 transition-colors duration-200">
                      {label}
                    </h2>
                    <p className="text-sm text-foreground-subtle leading-relaxed">
                      {description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted group-hover:text-foreground transition-colors">
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
      <section className="w-full border-t border-border bg-surface/5 py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Subjects", value: "10+" },
            { label: "Resources", value: "50+" },
            { label: "Semesters", value: "8" },
            { label: "Branches", value: "2" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border/60 p-5 rounded-2xl shadow-xs hover:border-border-strong/30 transition-all text-center">
              <p className="text-3xl font-black text-foreground tracking-tight">
                <StatsCounter value={value} />
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

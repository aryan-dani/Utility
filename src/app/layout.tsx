import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import Link from 'next/link';
import './globals.css';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';
import { BookOpen } from 'lucide-react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Utility',
    template: '%s — Utility',
  },
  description: 'A premium academic workspace. Access your syllabus, resources, and weekly planner in one place.',
  keywords: ['academic', 'syllabus', 'resources', 'planner', 'university'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
        <Providers>
          <Suspense fallback={<div className="h-16 border-b border-border bg-background" />}>
            <Navbar />
          </Suspense>
          <main className="flex-1 w-full flex flex-col pt-16">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                  <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
                </div>
              }
            >
              {children}
            </Suspense>
          </main>

          <footer className="w-full border-t border-border/50 bg-background-subtle/50 backdrop-blur-sm mt-auto">
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
                <div className="max-w-xs">
                  <Link href="/" className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
                      <BookOpen className="w-3 h-3 text-background" />
                    </div>
                    Utility
                  </Link>
                  <p className="text-sm text-muted leading-relaxed">
                    A premium academic workspace designed to streamline your university experience. 
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Workspace</h4>
                    <nav className="flex flex-col gap-2.5">
                      <Link href="/syllabus" className="text-sm text-muted hover:text-foreground transition-colors">Syllabus</Link>
                      <Link href="/resources" className="text-sm text-muted hover:text-foreground transition-colors">Resources</Link>
                      <Link href="/ask" className="text-sm text-muted hover:text-foreground transition-colors">Ask AI</Link>
                    </nav>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Tools</h4>
                    <nav className="flex flex-col gap-2.5">
                      <Link href="/gpa" className="text-sm text-muted hover:text-foreground transition-colors">GPA Calculator</Link>
                      <Link href="/planner" className="text-sm text-muted hover:text-foreground transition-colors">Weekly Planner</Link>
                      <Link href="/timer" className="text-sm text-muted hover:text-foreground transition-colors">Focus Timer</Link>
                    </nav>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">Company</h4>
                    <nav className="flex flex-col gap-2.5">
                      <Link href="/admin" className="text-sm text-muted hover:text-foreground transition-colors">Admin</Link>
                      <a href="https://www.aryandani.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-foreground transition-colors">Portfolio</a>
                    </nav>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-border/30 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-xs text-muted/60">
                  © {new Date().getFullYear()} Utility. Built for efficiency.
                </p>
                <div className="flex items-center gap-6">
                  <a
                    href="https://www.aryandani.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted/60 hover:text-foreground transition-colors flex items-center gap-1.5"
                  >
                    <span>Crafted by</span>
                    <span className="font-semibold text-foreground">Aryan Dani</span>
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

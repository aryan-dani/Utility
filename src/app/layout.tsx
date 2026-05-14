import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import Link from 'next/link';
import './globals.css';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';

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

          <footer className="w-full border-t border-border bg-background-subtle mt-auto">
            <div className="max-w-7xl mx-auto px-6 py-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                {/* Brand */}
                <div className="col-span-2 md:col-span-1">
                  <p className="font-bold text-foreground tracking-tight mb-2">Utility</p>
                  <p className="text-xs text-muted leading-relaxed">
                    A premium academic workspace for students.
                  </p>
                </div>

                {/* Tools */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Tools</p>
                  <div className="flex flex-col gap-2">
                    <Link href="/ask" className="text-sm text-muted hover:text-foreground">Ask AI</Link>
                    <Link href="/planner" className="text-sm text-muted hover:text-foreground">Weekly Planner</Link>
                    <Link href="/gpa" className="text-sm text-muted hover:text-foreground">GPA Calculator</Link>
                    <Link href="/timer" className="text-sm text-muted hover:text-foreground">Focus Timer</Link>
                    <Link href="/syllabus" className="text-sm text-muted hover:text-foreground">Syllabus</Link>
                    <Link href="/resources" className="text-sm text-muted hover:text-foreground">Resources</Link>
                  </div>
                </div>

                {/* More */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">More</p>
                  <div className="flex flex-col gap-2">
                    <Link href="/admin" className="text-sm text-muted hover:text-foreground">Admin</Link>
                    <a href="https://www.aryandani.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-foreground">Portfolio</a>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                <p className="text-xs text-muted">
                  © {new Date().getFullYear()} Utility. All rights reserved.
                </p>
                <p className="text-xs text-muted">
                  Made by{' '}
                  <a
                    href="https://www.aryandani.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline underline-offset-4 font-medium"
                  >
                    Aryan Dani
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import Navbar from '@/components/Navbar';
import ConditionalFooter from '@/components/ConditionalFooter';
import { Providers } from '@/components/Providers';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Academic OS',
    template: '%s — Academic OS',
  },
  description: 'A premium academic workspace. Access your syllabus, resources, AI assistant, and planner in one place.',
  keywords: ['academic', 'syllabus', 'resources', 'planner', 'university', 'student', 'AI'],
  openGraph: {
    title: 'Academic OS',
    description: 'A premium academic workspace. Access your syllabus, resources, AI assistant, and planner in one place.',
    type: 'website',
    url: 'https://academic-os.vercel.app', // placeholder
  },
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

          <ConditionalFooter />
          <Toaster 
            position="bottom-right" 
            toastOptions={{ 
              className: 'bg-surface border-border text-foreground shadow-popover',
            }} 
          />
        </Providers>
      </body>
    </html>
  );
}

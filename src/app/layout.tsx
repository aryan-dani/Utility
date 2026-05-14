import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Utility',
  description: 'A premium, modern utility application.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} antialiased min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden selection:bg-primary/10 selection:text-primary`}>
        <Suspense fallback={<div className="h-16 border-b border-border bg-background" />}>
          <Navbar />
        </Suspense>
        <main className="flex-1 w-full flex flex-col pt-20 pb-12">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            {children}
          </Suspense>
        </main>
      </body>
    </html>
  );
}

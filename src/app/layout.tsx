import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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
        <Navbar />
        <main className="flex-1 w-full flex flex-col pt-20 pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}

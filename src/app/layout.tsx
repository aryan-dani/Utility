import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

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
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden selection:bg-primary/10 selection:text-primary">
        <Navbar />
        <main className="flex-1 w-full flex flex-col pt-20 pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}

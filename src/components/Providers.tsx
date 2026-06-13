'use client';

import { ThemeProvider } from 'next-themes';
import dynamic from 'next/dynamic';
import { PWAProvider } from '@/contexts/PWAContext';

const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="utility-theme"
    >
      <PWAProvider>
        {children}
        <CommandPalette />
      </PWAProvider>
    </ThemeProvider>
  );
}

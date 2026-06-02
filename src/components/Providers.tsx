'use client';

import { ThemeProvider } from 'next-themes';
import CommandPalette from './CommandPalette';
import { PWAProvider } from '@/contexts/PWAContext';

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

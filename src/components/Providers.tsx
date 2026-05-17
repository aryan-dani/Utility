'use client';

import { ThemeProvider } from 'next-themes';
import CommandPalette from './CommandPalette';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="utility-theme"
    >
      {children}
      <CommandPalette />
    </ThemeProvider>
  );
}

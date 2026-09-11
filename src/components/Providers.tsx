'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import { PWAProvider } from '@/contexts/PWAContext';
import { Toaster } from 'sonner';
import NavigationProgress from './NavigationProgress';
import { ThemeColorSync } from '@/components/shell/ThemeColorSync';

const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });
const PwaUpdater = dynamic(() => import('./pwa/PwaUpdater'), { ssr: false });


function ToasterProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme as 'light' | 'dark' | 'system'}
      position="bottom-right"
      closeButton={false}
      richColors={false}
      expand={false}
      visibleToasts={4}
      duration={4000}
      offset="max(1rem, env(safe-area-inset-bottom))"
      gap={12}
      toastOptions={{
        unstyled: true,
        className: 'app-toast-host',
      }}
    />
  );
}

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
        <ThemeColorSync />
        <NavigationProgress />
        {children}
        <CommandPalette />
        <PwaUpdater />
        <ToasterProvider />
      </PWAProvider>
    </ThemeProvider>
  );
}

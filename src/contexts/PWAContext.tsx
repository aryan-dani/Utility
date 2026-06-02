'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface PWAContextType {
  deferredPrompt: any | null;
  setDeferredPrompt: (prompt: any | null) => void;
  isInstallable: boolean;
}

const PWAContext = createContext<PWAContextType>({
  deferredPrompt: null,
  setDeferredPrompt: () => {},
  isInstallable: false,
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <PWAContext.Provider value={{ deferredPrompt, setDeferredPrompt, isInstallable: !!deferredPrompt }}>
      {children}
    </PWAContext.Provider>
  );
}

export const usePWA = () => useContext(PWAContext);

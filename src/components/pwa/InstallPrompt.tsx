'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWA } from '@/contexts/PWAContext';

export default function InstallPrompt() {
  const { deferredPrompt, setDeferredPrompt, isInstallable } = usePWA();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isInstallable && !localStorage.getItem('pwa-prompt-dismissed')) {
      setIsVisible(true);
    }
  }, [isInstallable]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!isVisible || !isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:w-96 flex flex-col gap-3 p-4 bg-surface border border-border shadow-popover rounded-xl animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Install Utility</h3>
          <p className="text-xs text-muted mt-1">Get the app for offline access, faster loading, and a better experience.</p>
        </div>
        <button onClick={handleDismiss} className="text-muted hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="w-full flex items-center justify-center gap-2 bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-lg text-sm font-bold transition-all"
      >
        <Download className="w-4 h-4" />
        Install App
      </button>
    </div>
  );
}

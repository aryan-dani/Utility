'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('pwa-prompt-dismissed')) {
        setIsVisible(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

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

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:w-96 flex flex-col gap-3 p-4 bg-surface border border-border shadow-popover rounded-xl animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Install Utility</h3>
          <p className="text-xs text-muted mt-1">Get the app for offline access, faster loading, and a better experience.</p>
        </div>
        <button onClick={handleDismiss} className="text-muted hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary-hover px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
        Install App
      </button>
    </div>
  );
}

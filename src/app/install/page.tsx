'use client';

import { Download, Smartphone, Laptop, CheckCircle2 } from 'lucide-react';
import { usePWA } from '@/contexts/PWAContext';
import Link from 'next/link';

export default function InstallPage() {
  const { isInstallable, deferredPrompt, setDeferredPrompt } = usePWA();

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-24 text-center">
      <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mb-8 shadow-sm">
        <Download className="w-8 h-8 text-foreground" />
      </div>
      
      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">
        Install Utility
      </h1>
      
      <p className="text-muted text-lg mb-12 max-w-lg">
        Get the full Utility experience on your device. Faster loading, offline access, and an app-like feel.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-12">
        <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col items-center text-center gap-3">
          <Smartphone className="w-6 h-6 text-foreground" />
          <h3 className="font-semibold text-foreground">Mobile</h3>
          <p className="text-sm text-muted">Add to your home screen for quick access on the go.</p>
        </div>
        <div className="p-6 rounded-2xl bg-surface border border-border flex flex-col items-center text-center gap-3">
          <Laptop className="w-6 h-6 text-foreground" />
          <h3 className="font-semibold text-foreground">Desktop</h3>
          <p className="text-sm text-muted">Install as a standalone window on Mac or Windows.</p>
        </div>
      </div>

      {isInstallable ? (
        <button
          onClick={handleInstall}
          className="w-full md:w-auto px-12 py-4 bg-foreground text-background hover:opacity-90 rounded-xl font-bold text-lg shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Install Now
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-surface border border-border-strong flex flex-col items-center justify-center gap-2 text-foreground w-full md:w-auto px-8 py-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold">Ready or Unsupported</span>
          </div>
          <p className="text-xs text-muted max-w-[250px]">
            The app is either already installed, or your current browser doesn't support automatic installation.
          </p>
        </div>
      )}
      
      <div className="mt-8">
        <Link href="/" className="text-sm text-muted hover:text-foreground font-medium underline underline-offset-4">
          Return to home
        </Link>
      </div>
    </div>
  );
}

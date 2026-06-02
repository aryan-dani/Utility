'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

export default function PwaUpdater() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      // Check if there is already an update waiting
      if (reg.waiting) {
        setUpdateAvailable(true);
        triggerToast(reg.waiting);
      }

      // Listen for new service workers installing
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
            triggerToast(newWorker);
          }
        });
      });
    });

    // Listen for controllerchange (refresh page once active service worker updates)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const triggerToast = (worker: ServiceWorker) => {
    toast.info('A new version of Utility is available.', {
      description: 'Click reload to update the app and see the latest improvements.',
      action: {
        label: 'Update Now',
        onClick: () => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        },
      },
      duration: 10000,
    });
  };

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[999] max-w-sm bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div>
          <h4 className="font-semibold text-sm">Update Available</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            A new version of Utility is available. Refresh now to apply updates.
          </p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setUpdateAvailable(false)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Now
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

export default function PwaUpdater() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

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
          // Fallback reload in case controllerchange doesn't fire or SW is broken
          setTimeout(() => window.location.reload(), 500);
        },
      },
      duration: 10000,
    });
  };

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return null;
}

'use client';

import { useEffect } from 'react';
import { notify } from '@/lib/toast';

const TOAST_ID = 'utility-sw-update';
const CONTROLLER_FALLBACK_MS = 1500;
/** Focus/visibility SW checks - keep mount + hourly interval uncapped. */
const VISIBILITY_UPDATE_DEBOUNCE_MS = 20 * 60 * 1000;

/** Clear SW/runtime caches on update; never touch utility-pdf-v2 (Drive PDF Cache API). */
async function clearWorkboxCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key !== 'utility-pdf-v2' && !key.startsWith('utility-pdf'))
      .map((key) => caches.delete(key)),
  );
}

function isOfflineShellWhileOnline() {
  if (!navigator.onLine) return false;
  const h1 = document.querySelector('h1')?.textContent?.trim();
  return h1 === "You're Offline";
}

function activateWorker(worker: ServiceWorker) {
  worker.postMessage({ type: 'SKIP_WAITING' });
}

async function hardRecoverAndReload() {
  try {
    await clearWorkboxCaches();
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch (e) {
    console.error('Failed to recover service worker:', e);
  }
  window.location.reload();
}

export default function PwaUpdater() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'development') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
      return;
    }

    let toastShown = false;
    let updateInFlight = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshing = false;
    let lastVisibilityUpdateAt = 0;

    const applyWaiting = (worker: ServiceWorker, { force }: { force: boolean }) => {
      if (force || isOfflineShellWhileOnline()) {
        activateWorker(worker);
        return;
      }
      if (toastShown || updateInFlight) return;
      toastShown = true;

      notify.update({
        id: TOAST_ID,
        action: {
          label: 'Reload',
          onClick: () => {
            if (updateInFlight) return;
            updateInFlight = true;
            notify.dismiss(TOAST_ID);
            notify.message('Updating Utility…', {
              id: TOAST_ID,
              duration: CONTROLLER_FALLBACK_MS + 500,
            });
            activateWorker(worker);
            // If SKIP_WAITING was a no-op (old SW without listener), recover hard.
            fallbackTimer = setTimeout(() => {
              if (refreshing) return;
              void hardRecoverAndReload();
            }, CONTROLLER_FALLBACK_MS);
          },
        },
      });
    };

    const checkForUpdates = async ({ force = false }: { force?: boolean } = {}) => {
      const now = Date.now();
      if (
        !force &&
        lastVisibilityUpdateAt > 0 &&
        now - lastVisibilityUpdateAt < VISIBILITY_UPDATE_DEBOUNCE_MS
      ) {
        return;
      }
      lastVisibilityUpdateAt = now;
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.update();
        if (reg.waiting) {
          applyWaiting(reg.waiting, { force: isOfflineShellWhileOnline() });
        }
      } catch (err) {
        console.error('Failed to update service worker:', err);
      }
    };

    navigator.serviceWorker.ready.then(async (reg) => {
      if (reg.waiting) {
        applyWaiting(reg.waiting, { force: isOfflineShellWhileOnline() });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            applyWaiting(newWorker, { force: isOfflineShellWhileOnline() });
          }
        });
      });

      // Stuck clients: old App Shell SW serves /~offline while online → force recovery.
      if (isOfflineShellWhileOnline()) {
        await reg.update();
        if (reg.waiting) {
          activateWorker(reg.waiting);
        } else {
          await hardRecoverAndReload();
        }
      }
    });

    const intervalId = setInterval(() => {
      void checkForUpdates({ force: true });
    }, 3600000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    // Catch the deploy soon after open (icon/SW revision change).
    void checkForUpdates({ force: true });

    const handleControllerChange = async () => {
      if (refreshing) return;
      refreshing = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      try {
        await clearWorkboxCaches();
      } catch (e) {
        console.error('Failed to clear caches:', e);
      }
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      clearInterval(intervalId);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}

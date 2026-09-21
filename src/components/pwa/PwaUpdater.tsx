'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { notify } from '@/lib/toast';
import { isOfflineShellTitle } from '@/lib/pwa/offlineShell';
import {
  decideWaitingWorkerAction,
  SW_UPDATE_SESSION,
} from '@/lib/pwa/updatePolicy';

const TOAST_ID = 'utility-sw-update';
const CONTROLLER_FALLBACK_MS = 1500;
/** Focus/visibility SW checks — keep mount + hourly interval uncapped. */
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
  const h1 = document.querySelector('h1')?.textContent;
  return isOfflineShellTitle(h1);
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

function sessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setSessionFlag(key: string, value: boolean) {
  try {
    if (value) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function ApplyingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-foreground" strokeWidth={2} />
      <div className="text-center px-6">
        <p className="font-display text-xl tracking-tight text-foreground">
          Applying update…
        </p>
        <p className="mt-1 text-sm text-muted">
          Utility OS is refreshing to the latest version.
        </p>
      </div>
    </div>
  );
}

export default function PwaUpdater() {
  const [showOverlay, setShowOverlay] = useState(false);

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

    // One-shot confirmation after silent or Apply update reload.
    if (sessionFlag(SW_UPDATE_SESSION.justUpdated)) {
      setSessionFlag(SW_UPDATE_SESSION.justUpdated, false);
      setSessionFlag(SW_UPDATE_SESSION.applying, false);
      notify.success("You're on the latest version", {
        id: 'utility-sw-updated',
        description: 'Utility OS finished updating in this window.',
        duration: 4500,
      });
    }

    let toastShown = false;
    let updateInFlight = sessionFlag(SW_UPDATE_SESSION.applying);
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshing = false;
    let lastVisibilityUpdateAt = 0;
    /** Workers already waiting when this page mounted — silent apply, no toast. */
    const waitingOnLoad = new WeakSet<ServiceWorker>();

    const beginApply = (worker: ServiceWorker) => {
      if (updateInFlight) return;
      updateInFlight = true;
      setSessionFlag(SW_UPDATE_SESSION.applying, true);
      setShowOverlay(true);
      notify.dismiss(TOAST_ID);
      activateWorker(worker);
      fallbackTimer = setTimeout(() => {
        if (refreshing) return;
        void hardRecoverAndReload();
      }, CONTROLLER_FALLBACK_MS);
    };

    const applyWaiting = (
      worker: ServiceWorker,
      { wasWaitingOnLoad }: { wasWaitingOnLoad: boolean },
    ) => {
      const decision = decideWaitingWorkerAction({
        hasController: Boolean(navigator.serviceWorker.controller),
        isVisible: document.visibilityState === 'visible',
        wasWaitingOnLoad,
        dismissedThisSession: sessionFlag(SW_UPDATE_SESSION.dismissed),
        updateInFlight,
        forceRecovery: isOfflineShellWhileOnline(),
      });

      if (decision === 'skip') return;
      if (decision === 'silent') {
        beginApply(worker);
        return;
      }

      if (toastShown || updateInFlight) return;
      toastShown = true;

      notify.update({
        id: TOAST_ID,
        title: 'New version ready',
        description:
          'This window will refresh to load the latest Utility OS.',
        action: {
          label: 'Apply update',
          onClick: () => {
            beginApply(worker);
          },
        },
        secondaryAction: {
          label: 'Later',
          onClick: () => {
            setSessionFlag(SW_UPDATE_SESSION.dismissed, true);
            toastShown = false;
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
          applyWaiting(reg.waiting, {
            wasWaitingOnLoad: waitingOnLoad.has(reg.waiting),
          });
        }
      } catch (err) {
        console.error('Failed to update service worker:', err);
      }
    };

    navigator.serviceWorker.ready.then(async (reg) => {
      if (reg.waiting) {
        waitingOnLoad.add(reg.waiting);
        applyWaiting(reg.waiting, { wasWaitingOnLoad: true });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            applyWaiting(newWorker, { wasWaitingOnLoad: false });
          }
        });
      });

      if (isOfflineShellWhileOnline()) {
        await reg.update();
        if (reg.waiting) {
          beginApply(reg.waiting);
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
    void checkForUpdates({ force: true });

    const handleControllerChange = async () => {
      if (refreshing) return;
      refreshing = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      // Guard against controllerchange loops across reloads.
      if (sessionFlag(SW_UPDATE_SESSION.applying)) {
        setSessionFlag(SW_UPDATE_SESSION.justUpdated, true);
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
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );
    };
  }, []);

  return showOverlay ? <ApplyingOverlay /> : null;
}

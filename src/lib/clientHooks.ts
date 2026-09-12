import { useSyncExternalStore } from "react";

/**
 * Becomes true after the hydration commit (timeout 0), not during the first
 * client render - so getSnapshot matches getServerSnapshot and React #418
 * is avoided. Shared across hooks that must wait for the client.
 */
let clientReady = false;
const readyListeners = new Set<() => void>();
let readyScheduled = false;

function subscribeClientReady(onStoreChange: () => void) {
  readyListeners.add(onStoreChange);
  if (typeof window !== "undefined" && !clientReady && !readyScheduled) {
    readyScheduled = true;
    window.setTimeout(() => {
      clientReady = true;
      readyListeners.forEach((listener) => listener());
    }, 0);
  }
  return () => {
    readyListeners.delete(onStoreChange);
  };
}

function getClientReady() {
  return clientReady;
}

function getClientNotReady() {
  return false;
}

/** True after hydration; false during SSR and the first client paint. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeClientReady,
    getClientReady,
    getClientNotReady,
  );
}

/** macOS vs other platforms for shortcut labels. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeClientReady,
    () =>
      clientReady &&
      (navigator.userAgent.includes("Mac") ||
        navigator.platform.includes("Mac")),
    getClientNotReady,
  );
}

export function readLocalStorageBoolean(
  key: string,
  defaultValue = false,
): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    return saved === "true";
  } catch {
    return defaultValue;
  }
}

const localStorageListeners = new Map<string, Set<() => void>>();

function subscribeLocalStorageKey(key: string, onStoreChange: () => void) {
  let set = localStorageListeners.get(key);
  if (!set) {
    set = new Set();
    localStorageListeners.set(key, set);
  }
  set.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyLocalStorageKey(key: string) {
  localStorageListeners.get(key)?.forEach((cb) => cb());
}

/** Persist a boolean and notify same-tab `useLocalStorageBoolean` subscribers. */
export function writeLocalStorageBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota / private mode */
  }
  notifyLocalStorageKey(key);
}

/**
 * SSR-safe localStorage boolean. Server and the first client paint use
 * `defaultValue`; the stored value is applied after hydration.
 */
export function useLocalStorageBoolean(
  key: string,
  defaultValue = false,
): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const unsubReady = subscribeClientReady(onStoreChange);
      const unsubStore = subscribeLocalStorageKey(key, onStoreChange);
      return () => {
        unsubReady();
        unsubStore();
      };
    },
    () =>
      clientReady
        ? readLocalStorageBoolean(key, defaultValue)
        : defaultValue,
    () => defaultValue,
  );
}

function subscribeMatchMedia(query: string, callback: () => void): () => void {
  const mq = window.matchMedia(query);
  const handler = () => callback();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

/** Responsive boolean from a `matchMedia` query (SSR-safe default). */
export function useMediaQuery(query: string, serverDefault = false): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const unsubReady = subscribeClientReady(onStoreChange);
      const unsubMq = subscribeMatchMedia(query, onStoreChange);
      return () => {
        unsubReady();
        unsubMq();
      };
    },
    () =>
      clientReady ? window.matchMedia(query).matches : serverDefault,
    () => serverDefault,
  );
}

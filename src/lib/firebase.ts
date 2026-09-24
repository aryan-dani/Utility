import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function cleanEnvValue(val: string | undefined): string | undefined {
  if (!val) return undefined;
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
}

/**
 * Prefer same-origin authDomain on production hosts so /__/auth is proxied
 * (see next.config.mjs rewrites). Falls back to NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.
 */
function resolveAuthDomain(): string {
  const fromEnv =
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) ||
    "placeholder-auth-domain";

  if (typeof window === "undefined") {
    // SSR / build: honor env. Production should set utilityos.tech.
    return fromEnv;
  }

  const host = window.location.hostname;
  if (host === "utilityos.tech" || host === "www.utilityos.tech") {
    return host;
  }
  return fromEnv;
}

const firebaseConfig = {
  apiKey: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || "placeholder-api-key",
  authDomain: resolveAuthDomain(),
  projectId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || "placeholder-project-id",
  storageBucket: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || "placeholder-storage-bucket",
  messagingSenderId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || "placeholder-sender-id",
  appId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) || "placeholder-app-id",
};

// Initialize Firebase for client side
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

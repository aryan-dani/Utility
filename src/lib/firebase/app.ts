import { initializeApp, getApps, getApp } from "firebase/app";
import { preferRedirectAuth } from "@/lib/firebaseAuth";
import { resolveClientAuthDomain } from "@/lib/siteOrigins";

function cleanEnvValue(val: string | undefined): string | undefined {
  if (!val) return undefined;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
}

/**
 * Same-origin authDomain (proxied /__/auth) only for Store / installed PWA.
 * Desktop browsers use firebaseapp.com so helper scripts skip the Vercel rewrite.
 */
function resolveAuthDomain(): string {
  const fromEnv =
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) ||
    "placeholder-auth-domain";
  const projectId = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const firebaseAppAuth =
    projectId && !projectId.includes("placeholder")
      ? `${projectId}.firebaseapp.com`
      : undefined;

  if (typeof window === "undefined") {
    return resolveClientAuthDomain("ssr", fromEnv, false, firebaseAppAuth);
  }

  return resolveClientAuthDomain(
    window.location.hostname,
    fromEnv,
    preferRedirectAuth(),
    firebaseAppAuth,
  );
}

const firebaseConfig = {
  apiKey:
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) ||
    "placeholder-api-key",
  authDomain: resolveAuthDomain(),
  projectId:
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ||
    "placeholder-project-id",
  storageBucket:
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) ||
    "placeholder-storage-bucket",
  messagingSenderId:
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ||
    "placeholder-sender-id",
  appId:
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) ||
    "placeholder-app-id",
};

export function getFirebaseApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

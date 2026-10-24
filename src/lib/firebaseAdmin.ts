import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function cleanPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let cleaned = key.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\\n/g, "\n");
}

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

export function hasFirebaseCredentials() {
  const pid =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  return !!(
    pid &&
    email &&
    key &&
    !key.includes("YOUR_PRIVATE_KEY_HERE")
  );
}

let app: App | null = null;

export function getFirebaseAdmin(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  // If environment variables are missing or placeholders (e.g. during build),
  // initialize with application default credentials or placeholder.
  if (hasFirebaseCredentials()) {
    app = initializeApp({
      credential: cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey: privateKey!,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    try {
      app = initializeApp({
        credential: applicationDefault(),
        projectId: projectId || "placeholder-project-id",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch {
      app = initializeApp({
        projectId: projectId || "placeholder-project-id",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    }
  }

  return app;
}

export const adminDb = () => getFirestore(getFirebaseAdmin());
export const adminAuth = () => getAuth(getFirebaseAdmin());
export const adminStorage = () => getStorage(getFirebaseAdmin());

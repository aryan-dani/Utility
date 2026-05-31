import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function cleanEnvValue(val: string | undefined): string | undefined {
  if (!val) return undefined;
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
}

const firebaseConfig = {
  apiKey: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || "placeholder-api-key",
  authDomain: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || "placeholder-auth-domain",
  projectId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || "placeholder-project-id",
  storageBucket: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || "placeholder-storage-bucket",
  messagingSenderId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || "placeholder-sender-id",
  appId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) || "placeholder-app-id",
};

// Initialize Firebase for client side
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

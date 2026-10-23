import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env.js";

let app: App | null = null;

function getApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  const e = env();
  const privateKey = e.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  app = initializeApp({
    credential: cert({
      projectId: e.FIREBASE_PROJECT_ID,
      clientEmail: e.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
  return app;
}

export function adminAuth() {
  return getAuth(getApp());
}

export function adminDb() {
  return getFirestore(getApp());
}

export type AuthedUser = {
  uid: string;
  email: string | null;
  authTime: number;
};

export async function verifyIdToken(
  token: string,
): Promise<AuthedUser | null> {
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      authTime: typeof decoded.auth_time === "number" ? decoded.auth_time : 0,
    };
  } catch {
    return null;
  }
}

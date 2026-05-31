import * as admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

export function hasFirebaseCredentials() {
  return !!(projectId && clientEmail && privateKey && !privateKey.includes("YOUR_PRIVATE_KEY_HERE"));
}

export function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  // If environment variables are missing or placeholders (e.g. during build),
  // initialize with application default credentials or placeholder.
  if (hasFirebaseCredentials()) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Fallback/development initialization or placeholder
    admin.initializeApp({
      projectId: projectId || "placeholder-project-id",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  return admin;
}

export const adminDb = () => getFirebaseAdmin().firestore();
export const adminAuth = () => getFirebaseAdmin().auth();
export const adminStorage = () => getFirebaseAdmin().storage();

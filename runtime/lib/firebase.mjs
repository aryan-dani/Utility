import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getEnv, cleanPrivateKey } from "./env.mjs";

function resolveFirebaseConfig() {
  const projectId =
    getEnv("FIREBASE_PROJECT_ID") || getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const clientEmail = getEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = cleanPrivateKey(getEnv("FIREBASE_PRIVATE_KEY"));
  const storageBucket = getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  return { projectId, clientEmail, privateKey, storageBucket };
}

const { projectId, clientEmail, privateKey, storageBucket } =
  resolveFirebaseConfig();

if (getApps().length === 0) {
  if (
    projectId &&
    clientEmail &&
    privateKey &&
    !privateKey.includes("YOUR_PRIVATE_KEY_HERE")
  ) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  } else {
    initializeApp({
      projectId: projectId || "placeholder-project-id",
      storageBucket,
    });
  }
}

export const db = getFirestore();
export const bucket = storageBucket ? getStorage().bucket() : null;

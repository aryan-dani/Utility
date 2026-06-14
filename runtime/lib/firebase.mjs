import admin from "firebase-admin";
import { env, cleanPrivateKey } from "./env.mjs";

const projectId = env["FIREBASE_PROJECT_ID"] || env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"];
const clientEmail = env["FIREBASE_CLIENT_EMAIL"];
const privateKey = cleanPrivateKey(env["FIREBASE_PRIVATE_KEY"]);
const storageBucket = env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"];

if (admin.apps.length === 0) {
  if (projectId && clientEmail && privateKey && !privateKey.includes("YOUR_PRIVATE_KEY_HERE")) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  } else {
    admin.initializeApp({
      projectId: projectId || "placeholder-project-id",
      storageBucket,
    });
  }
}

export const db = admin.firestore();
export const bucket = storageBucket ? admin.storage().bucket() : null;
export { admin };

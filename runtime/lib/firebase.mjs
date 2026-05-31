import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", "..", ".env.local");
  if (!existsSync(envPath)) {
    return process.env;
  }

  const content = readFileSync(envPath, "utf-8");
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return { ...process.env, ...parsed };
}

const env = loadEnv();

const projectId = env["FIREBASE_PROJECT_ID"] || env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"];
const clientEmail = env["FIREBASE_CLIENT_EMAIL"];
const privateKey = env["FIREBASE_PRIVATE_KEY"]
  ? env["FIREBASE_PRIVATE_KEY"].replace(/\\n/g, "\n")
  : undefined;
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
export const bucket = admin.storage().bucket();
export { admin };

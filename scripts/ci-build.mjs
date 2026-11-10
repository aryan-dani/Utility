#!/usr/bin/env node
/**
 * Production build that mirrors GitHub Actions: public Firebase placeholders only,
 * no Admin / ADC credentials. Local .env.local keys are overridden so prerender
 * cannot silently use a developer service account and greenwash CI.
 */
import { spawnSync } from "node:child_process";

const publicPlaceholders = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "placeholder",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "placeholder.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "placeholder",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "placeholder.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:0",
};

/** Forces hasFirebaseCredentials() false even if .env.local would load later. */
const adminPlaceholders = {
  FIREBASE_PROJECT_ID: "placeholder",
  FIREBASE_CLIENT_EMAIL: "ci@placeholder.local",
  // firebaseAdmin treats this sentinel as "no real key".
  FIREBASE_PRIVATE_KEY: "YOUR_PRIVATE_KEY_HERE",
};

const strip = [
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON",
  "FIREBASE_SERVICE_ACCOUNT",
  "FIREBASE_SERVICE_ACCOUNT_KEY",
  "GCLOUD_PROJECT",
  "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
];

const env = { ...process.env, ...publicPlaceholders, ...adminPlaceholders };
for (const key of strip) {
  delete env[key];
}

const result = spawnSync("npm", ["run", "build"], {
  env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);

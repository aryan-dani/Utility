import { google } from "googleapis";
import { env, cleanPrivateKey } from "./env.mjs";

let driveInstance = null;

export function getDrive(scopes = ["https://www.googleapis.com/auth/drive.readonly"]) {
  if (driveInstance) return driveInstance;

  const clientEmail = env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = cleanPrivateKey(env["FIREBASE_PRIVATE_KEY"]);

  if (!clientEmail || !privateKey) {
    throw new Error(
      "❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in environment variables.",
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: scopes,
  });
  driveInstance = google.drive({ version: "v3", auth });
  return driveInstance;
}

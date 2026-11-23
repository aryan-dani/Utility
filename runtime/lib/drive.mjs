import { google } from "googleapis";
import { getEnv, cleanPrivateKey } from "./env.mjs";

let driveInstance = null;
let writableDriveInstance = null;

export const DRIVE_SHARED_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
};

export function getDrive(scopes = ["https://www.googleapis.com/auth/drive.readonly"]) {
  if (driveInstance) return driveInstance;

  const clientEmail = getEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = cleanPrivateKey(getEnv("FIREBASE_PRIVATE_KEY"));

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

function createWritableOAuthClient() {
  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = getEnv("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/** True when Drive OAuth (user quota) is configured for uploads. */
export function hasWritableDriveOAuth() {
  return !!createWritableOAuthClient();
}

/**
 * Access token for browser resumable uploads. Never falls back to the
 * service account — Shared Drive uploads need the OAuth user’s quota.
 */
export async function getWritableDriveAccessToken() {
  const oauth2Client = createWritableOAuthClient();
  if (!oauth2Client) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN.",
    );
  }
  const { token } = await oauth2Client.getAccessToken();
  if (!token) throw new Error("Failed to refresh Google Drive access token.");
  return token;
}

/** Writable Drive client — prefers OAuth user quota for copy/upload operations. */
export function getWritableDrive() {
  if (writableDriveInstance) return writableDriveInstance;

  const oauth2Client = createWritableOAuthClient();
  if (oauth2Client) {
    writableDriveInstance = google.drive({ version: "v3", auth: oauth2Client });
    return writableDriveInstance;
  }

  return getDrive(["https://www.googleapis.com/auth/drive"]);
}

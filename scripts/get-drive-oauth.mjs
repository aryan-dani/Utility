/**
 * scripts/get-drive-oauth.mjs
 * 
 * Helper script to guide the user through OAuth2 authorization for Google Drive.
 * This runs a local server to intercept the redirect and automatically prints
 * and appends the GOOGLE_REFRESH_TOKEN to your .env.local file.
 * 
 * Usage:
 *   node scripts/get-drive-oauth.mjs
 */

import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

// Load existing env file
function loadEnv() {
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf-8");
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

const env = loadEnv();

const GOOGLE_CLIENT_ID = env["GOOGLE_CLIENT_ID"];
const GOOGLE_CLIENT_SECRET = env["GOOGLE_CLIENT_SECRET"];

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.log(`
❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local

To authenticate as yourself (which bypasses the Service Account 0 GB quota limit):
1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials?project=286356684455
2. Click "+ CREATE CREDENTIALS" -> "OAuth client ID".
3. If prompted to configure consent screen, choose "External", set User Type, and add "Google Drive API" scope (../auth/drive). Add your own email as a test user.
4. Set Application Type to "Web application".
5. Name it "Drive Backup Sync".
6. Add an Authorized redirect URI:
   - http://localhost:3000/oauth2callback
7. Click Create. Copy the Client ID and Client Secret.
8. Add them to your .env.local file:
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here

Then, run this script again!
`);
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/oauth2callback"
);

const scopes = [
  "https://www.googleapis.com/auth/drive"
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline", // Request refresh token
  scope: scopes,
  prompt: "consent" // Force showing consent screen to get refresh token
});

console.log("\n==================================================");
console.log("🔑 GOOGLE DRIVE OAUTH2 AUTHENTICATION");
console.log("==================================================");
console.log("\n1. Open the following URL in your web browser:\n");
console.log(authUrl);
console.log("\n2. Sign in and grant permissions.");
console.log("3. Once complete, you will be redirected, and this script will capture the token.\n");

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/oauth2callback")) {
    const urlObj = new URL(req.url, "http://localhost:3000");
    const code = urlObj.searchParams.get("code");
    
    if (code) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h2 style="color: #2e7d32;">✅ Authorization Successful!</h2>
          <p>You can close this tab now and return to your terminal.</p>
        </div>
      `);
      
      console.log("📥 Authorization code received. Exchanging for tokens...");
      server.close();
      
      try {
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;
        
        if (!refreshToken) {
          console.warn("\n⚠️ Warning: No refresh token was returned. If you have authenticated before, go to your Google Account permissions, remove 'Drive Backup Sync', and run this script again to force consent.\n");
        } else {
          console.log(`\n✅ Refresh Token obtained successfully!`);
          
          // Append/Update in .env.local
          let envContent = "";
          if (existsSync(envPath)) {
            envContent = readFileSync(envPath, "utf-8");
          }
          
          if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
            // Replace existing
            envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
          } else {
            // Append new
            envContent += `\n\n# Google Drive OAuth2 Refresh Token\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
          }
          
          writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
          console.log("💾 GOOGLE_REFRESH_TOKEN has been saved to your .env.local file!");
          console.log("🚀 You can now run node scripts/sync-supabase-to-drive.mjs to sync without quota errors!\n");
        }
      } catch (err) {
        console.error("❌ Failed to exchange code for tokens:", err.message);
      }
      process.exit(0);
    } else {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h2>❌ Authorization code missing in request.</h2>");
      process.exit(1);
    }
  }
});

server.listen(3000, () => {
  console.log("🎧 Listening on http://localhost:3000 for redirect callback...");
});

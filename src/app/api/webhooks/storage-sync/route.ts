import { NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import syncDrive from "../../../../../runtime/tools/sync-drive.mjs";
import { adminAuth, hasFirebaseCredentials } from "@/lib/firebaseAdmin";
import { getAdminEmails } from "@/lib/apiAuth";
import { safeEqualSecret } from "@/lib/safeEqual";
import { devLog } from "@/lib/devLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function getGithubToken(): string | null {
  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  return token?.trim() || null;
}

function canDispatchActions(): boolean {
  return !!getGithubToken();
}

function canRunInProcess(): boolean {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  return !!(folderId && hasFirebaseCredentials());
}

async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (cronSecret && bearer && safeEqualSecret(bearer, cronSecret)) {
    return true;
  }

  if (bearer) {
    try {
      const decoded = await adminAuth().verifyIdToken(bearer);
      const email = decoded.email?.toLowerCase();
      if (email && getAdminEmails().includes(email)) {
        return true;
      }
    } catch {
      // fall through
    }
  }

  // Fail closed when CRON_SECRET is missing (including local hosts).
  return false;
}

/** Kick GitHub Actions for full sync+index (pdf parsing is too heavy for Vercel). */
async function triggerGithubSyncWorkflow() {
  const token = getGithubToken();
  if (!token) {
    throw new Error("GH_PAT (or GITHUB_TOKEN) is not configured.");
  }

  const repo = process.env.GITHUB_REPO || "aryan-dani/Utility";
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/storage-sync.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub workflow dispatch failed (${res.status}): ${body}`);
  }
}

function queueInProcessDriveSync() {
  after(async () => {
    try {
      devLog("🚀 Starting background Drive sync...");
      await syncDrive();
      devLog("✅ Drive sync completed.");
      revalidateTag("subjects", "max");
      revalidateTag("resources", "max");
      revalidateTag("syllabus", "max");
      revalidateTag("drive-allowlist", "max");
    } catch (err) {
      console.error("❌ Background sync failed:", err);
    }
  });
}

async function handleSync(request: Request) {
  try {
    if (!(await isAuthorized(request))) {
      console.warn("⚠️  Webhook unauthorized attempt.");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Prefer home-server worker when configured (UTILITY_API_URL + UTILITY_API_SECRET).
    try {
      const { triggerServerSync } = await import("@/lib/utilityServer.server");
      if (process.env.UTILITY_API_SECRET && process.env.UTILITY_API_URL) {
        const ok = await triggerServerSync("incremental");
        if (ok) {
          return NextResponse.json({
            success: true,
            mode: "home-server",
            message:
              "Home-server Drive sync+index queued. Catalog snapshot will revalidate Vercel after it finishes.",
          });
        }
      }
    } catch {
      /* fall through to Actions / in-process */
    }

    const dispatchActions = canDispatchActions();
    const runInProcess = canRunInProcess();

    if (!dispatchActions && !runInProcess) {
      const missing: string[] = [];
      if (!process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()) {
        missing.push("GOOGLE_DRIVE_FOLDER_ID");
      }
      if (!hasFirebaseCredentials()) {
        missing.push(
          "FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY",
        );
      }
      if (!getGithubToken()) {
        missing.push("GH_PAT");
      }

      console.error(
        "❌ Storage sync unavailable. Missing env:",
        missing.join(", "),
      );
      return NextResponse.json(
        {
          success: false,
          error:
            `Sync is not configured on this host. Set ${missing.join(" and ")} ` +
            "in Vercel Production (GH_PAT preferred for full sync+index via GitHub Actions).",
        },
        { status: 503 },
      );
    }

    // Prefer GitHub Actions (Drive sync + indexing with CI secrets).
    if (dispatchActions) {
      try {
        devLog(
          "🔔 Dispatching GitHub Actions workflow storage-sync.yml...",
        );
        await triggerGithubSyncWorkflow();
        devLog("✅ GitHub Actions sync+index dispatched.");
        return NextResponse.json({
          success: true,
          mode: "github-actions",
          message:
            "GitHub Actions sync+index queued. Drive sync and content indexing will run in CI. Check the Actions tab in a few minutes.",
        });
      } catch (err) {
        console.error("❌ GitHub Actions dispatch failed:", err);
        if (!runInProcess) {
          return NextResponse.json(
            { success: false, error: "Failed to dispatch sync workflow" },
            { status: 502 },
          );
        }
        console.warn(
          "⚠️  Falling back to in-process Drive sync after Actions failure.",
        );
        queueInProcessDriveSync();
        return NextResponse.json({
          success: true,
          mode: "in-process-fallback",
          message:
            "GitHub Actions dispatch failed. In-process Drive sync queued instead (indexing requires a working GH_PAT).",
        });
      }
    }

    // In-process fallback when Actions token is not configured.
    devLog("🔔 Queuing in-process Drive→Firestore sync...");
    queueInProcessDriveSync();
    return NextResponse.json({
      success: true,
      mode: "in-process",
      message:
        "In-process Google Drive sync queued. Set GH_PAT on Vercel for full sync+index via GitHub Actions.",
    });
  } catch (error: unknown) {
    console.error("❌ Webhook handler failed:", error);
    return NextResponse.json(
      { success: false, error: "Sync request failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

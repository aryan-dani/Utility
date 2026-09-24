# Utility OS

A premium, monochrome academic workspace for university students. Built with Next.js, Firebase, and Google Drive sync so course materials, planning, and AI study tools live in one place.

**Live:** [utilityos.tech](https://utilityos.tech) · **Microsoft Store:** [Utility OS](https://apps.microsoft.com/detail/9PPFG0G5R0MG)

## Core Features

- **Document Intelligence (Hybrid RAG)**: Slide-level chunk retrieval with BM25 + vector search, grounded citations (Slide 14 · DBMS.pptx), and scoped answers by branch/semester.
- **Drive Sync Runtime**: Node scripts that sync a shared Google Drive folder into Firestore and index document text for search.
- **Resource Vault**: Notes, presentations, question banks, and PYQs organized by branch and semester.
- **Doubt Board**: Peer Q&A for paper-format doubts and syllabus scope.
- **Study Planner**: Collaborative weekly/monthly planning with natural-language prompts.
- **GPA Calculator**: SGPA/CGPA with auto-populated subjects.
- **SRS Flashcards**: Leitner-style spaced repetition.
- **Focus Timer**: Pomodoro sessions with activity tracking.
- **PWA / Store**: Installable offline-capable client; Windows listing on the Microsoft Store.

## How updates work

Utility is one live site (`https://utilityos.tech`). The Microsoft Store app is a PWABuilder shell of that URL, so **website deploys update the Store window automatically**.

1. Push / Vercel production deploy publishes a new service worker and HTML.
2. **Next open** (browser, installed PWA, or Store): the waiting worker activates silently — you land on the new version without a toast.
3. **Already using Utility when a deploy lands**: a **New version ready** toast offers **Apply update** (full-screen refresh) or **Later**. Dismissing only skips the prompt for this session; the next open still applies.
4. Rebuild / re-upload the MSIX only when package identity or native Store metadata changes — not for normal site features.

Keep PWA precache small (see Hosting budget). Do not proxy Drive file bytes through Vercel Functions.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS + custom monochrome design tokens
- **Database / Auth**: Firebase (Firestore + Auth) via `firebase` / `firebase-admin`
- **Storage**: Google Drive (shared folder sync)
- **AI**: Groq (`GROQ_API_KEY`) for chat/study/summarize; Gemini (`GEMINI_API_KEY`) for search embeddings only
- **Icons / Motion**: Lucide React, Framer Motion

## Deployment & Setup

### 1. Environment Variables

Create a `.env.local` file in the project root:

```env
# Firebase client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
# Production: set AUTH_DOMAIN to utilityos.tech so Store OAuth uses same-origin /__/auth proxy
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server / sync scripts)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Google Drive shared folder to sync
GOOGLE_DRIVE_FOLDER_ID=

# App config
# Server-only admin allowlist (used by /api/admin/* and Sync Now)
ADMIN_EMAILS=you@example.com
GROQ_API_KEY=

# Hybrid RAG embeddings (Google AI Studio — NOT a replacement for Groq)
GEMINI_API_KEY=

# Protect /api/webhooks/* (required in production)
CRON_SECRET=

# Upstash Redis REST (required in Vercel production for AI rate limits)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional: URL GitHub Actions POSTs after sync+index (e.g. https://utilityos.tech/api/webhooks/revalidate-content)
VERCEL_REVALIDATE_URL=

# Google Drive OAuth (writable uploads / renames — SA is read-only for Shared Drives)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Ishani campus API (faculty seating, directory, labs) — server-only
# Local: http://127.0.0.1:8001
# Production (Vercel): https://api.aryandani.com  — same host as Ishani Pages (VITE_API_URL)
ISHANI_API_URL=

# Preferred for hosted Sync Now: dispatch GitHub Actions (workflow + repo secrets)
GH_PAT=
```

### Vercel Production (required for hosted Sync Drive)

Set these on the Vercel project for **Production**, then redeploy:

| Variable | Why |
|----------|-----|
| `GOOGLE_DRIVE_FOLDER_ID` | In-process Drive→Firestore sync / cron fallback |
| `GROQ_API_KEY` | Chat, study, summarize (unchanged) |
| `GEMINI_API_KEY` | Chunk embeddings during `index-content` + semantic search cache |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Admin token verify + Drive JWT |
| `ADMIN_EMAILS` | Server-only admin allowlist (Sync Now, admin APIs) |
| `GH_PAT` (workflow scope) | **Recommended** — Sync Now dispatches `storage-sync.yml` (sync + index) |
| `CRON_SECRET` | Authorizes webhook revalidate / manual sync |
| `UPSTASH_REDIS_REST_URL` | Distributed AI rate limits (required in Production) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST auth token (required in Production) |
| `VERCEL_REVALIDATE_URL` | GitHub Actions POSTs here after sync+index |
| `ISHANI_API_URL` | Campus seating / directory / labs — set to `https://api.aryandani.com` (Ishani’s public FastAPI) |

Without `GOOGLE_DRIVE_FOLDER_ID` **and** without `GH_PAT`, Sync Now returns **503** instead of a fake success.

For GitHub Actions daily sync (00:00 UTC via `storage-sync.yml` only — there is no duplicate Vercel cron), add the same `FIREBASE_*`, `GOOGLE_DRIVE_FOLDER_ID`, `GEMINI_API_KEY`, `CRON_SECRET`, and `VERCEL_REVALIDATE_URL` values as repository secrets.

### 2. Hybrid RAG setup (one-time)

Groq still powers answers. Gemini only embeds text for better search.

```bash
# See what's configured (never prints secret values)
npm run check-rag-env

# Deploy Firestore vector indexes (requires: firebase login once)
npm run deploy:indexes

# Re-index: slide-level chunks + optional Gemini embeddings
npm run index-content

# Measure retrieval quality after indexing
npm run eval-rag
```

**You must do manually:**
1. Create `GEMINI_API_KEY` at [Google AI Studio](https://aistudio.google.com/apikey) → add to `.env.local`, Vercel, GitHub Secrets
2. Run `firebase login` once, then `npm run deploy:indexes`
3. Trigger **Scheduled Storage Sync** in GitHub Actions (or `npm run index-content` locally)

Without `GEMINI_API_KEY`, search falls back to keyword/BM25 (still scoped by semester). Without deployed indexes, vector search is skipped until indexes finish building in Firebase Console.

### 3. Drive Sync & Indexing

Prefer the unified **drive** CLI. Uploading one notes/PPT file only upserts that resource — it does **not** rebuild the full catalog.

```bash
# One-file put (recommended) — upload + catalog upsert only
npm run drive -- put "C:\path\to\GML_Unit_1_Notes.pdf" \
  --year=2026-2027 --branch=AIDS --semester=5 --subject=GML --category=notes \
  --as=GML_Unit_1_Notes.pdf --revalidate

# Same via explicit Drive path
npm run drive -- put ./file.pdf --to=2026-2027/AIDS/Sem_5_AIDS/Sem_5_PPT/GML --as=GML_Unit_2.pdf

# Optional: index just that file after put
npm run drive -- put ./file.pdf --year=2026-2027 --branch=AIDS --semester=5 --subject=GML --index

# Path-scoped sync (walk one subtree, prune only inside it)
npm run drive -- sync --path=2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML
npm run drive -- sync --year=2026-2027 --branch=AIDS --semester=5 --subject=GML --category=notes

# Full catalog sync (nightly / after bulk moves). Also: npm run sync-drive
npm run drive -- sync --full
npm run drive -- sync --full --dry-run --verbose

# Incremental changes (after a --full has saved a page token)
npm run drive -- sync --incremental

# List / find / move / trash
npm run drive -- ls 2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML
npm run drive -- find GML_Unit
npm run drive -- rm 2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML/old.pdf --dry-run
npm run drive -- mv <from-path> <to-folder> --apply

# Targeted index
npm run drive -- index --subject=GML
npm run drive -- index --title=GML_Unit_1
npm run index-content

# Legacy directory upload (path-scoped sync afterward, not full rebuild)
npm run upload-drive -- "C:\path\to\2026-2027"
npm run upload-drive:overwrite -- "C:\path\to\2026-2027"

# Both full sync + index
npm run sync-all

# Read-only: compare Drive vs Firestore
npm run audit-drive-site
# Optional: --branch=AIDS --semester=3
```

Nightly sync is scheduled **only** in GitHub Actions (`.github/workflows/storage-sync.yml` at 00:00 UTC) and runs incremental by default (full on weekly cron). Use `put` for day-to-day notes.

Resources are cached ~10 minutes (`unstable_cache` / `revalidate: 600`). After `put --revalidate` (or CI), tags refresh immediately; otherwise wait for revalidate, redeploy, or use **Sync Now**.

Drive folder naming convention:

```text
<root>/<YYYY-YYYY>/<BRANCH>/Sem_<N>_<BRANCH>/Sem_<N>_{Notes|PPT|PYQ|QB|WriteUps|Codes}/<Subject>/<File>
```

Example: `2026-2027/AIDS/Sem_5_AIDS/Sem_5_PPT/ML/ML_Unit_1.pptx`

Syllabus at semester root: `Sem_<N>_Syllabus.pdf`

**File naming (underscores only; no spaces; `Unit` not `UNIT`):**

| Category | Pattern | Example |
|----------|---------|---------|
| Notes | `<SUBJECT>_Unit_<N>_Notes.ext` | `DAA_Unit_1_Notes.pdf` |
| PPT | `<SUBJECT>_Unit_<N>[_Topic].ext` | `DAA_Unit_5_Hashing.pptx` |
| WriteUps | `Sem_<N>_<LabCode>_WriteUp_<K>[_Topic].ext` | `Sem_4_AIESL_WriteUp_1_A_Star.docx` |
| Codes | `Sem_<N>_<LabCode>_Assignment_<K>[_Topic].ext` | `Sem_5_OSL_Assignment_3_FCFS_SRTF.c` |
| PYQ | `<SUBJECT>_PYQ_<Year>[_Mid\|End][_K].ext` | `DAA_PYQ_2024_End_1.pdf` |
| QB | `<SUBJECT>_QB[_Year][_Solved][_K].ext` | `PS_QB_1_Solved.pdf` |

Normalize category folders (default is dry-run; pass `--apply` to write):

```bash
node runtime/tools/normalize-drive.mjs
node runtime/tools/normalize-drive.mjs --apply
```

Audit / rename files + trash junk:

```bash
npm run rename-drive-files          # dry-run (default)
npm run rename-drive-files:apply    # apply trash + mechanical renames
```

### 4. Run Locally

```bash
npm install
npm run dev
```

### 5. Store packaging

See [`store/README.md`](store/README.md) for Google Play (TWA) and Microsoft Store (PWABuilder MSIX). Live listing: [apps.microsoft.com/detail/9PPFG0G5R0MG](https://apps.microsoft.com/detail/9PPFG0G5R0MG).

## Hosting budget (Vercel Hobby)

Stay inside the free allotments or the project pauses. Three meters matter:

| Meter | Hobby included | What counts here | Rule |
|-------|----------------|------------------|------|
| **Fast Origin Transfer** | 10 GB / month | Bytes between CDN and Vercel Functions | Never stream PDFs/files through API routes. Browsers download from Google Drive directly (`src/lib/driveFileCache.ts`). |
| **Fast Data Transfer** | 100 GB / month | Bytes CDN → visitors (HTML, JS, images) | Keep PWA precache small; icons optimized; no hover-prefetch of large files. |
| **Edge / CDN Requests** | 1M / month | Every request hitting the CDN | No polling; no SW StaleWhileRevalidate on multi-MB bodies; prefer ISR HTML. |

After deploy, watch **Usage → Fast Origin Transfer** for 48 hours — it should stay at KB-scale JSON/HTML only. CI enforces the no-proxy rule via `src/lib/__guards__/noFileProxy.test.ts`.

## License

Proprietary License - All Rights Reserved. See [LICENSE](LICENSE) for details.

Made with love by [Aryan Dani](https://www.aryandani.com).

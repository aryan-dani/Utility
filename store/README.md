# Store packaging

Utility ships to Google Play as a Trusted Web Activity and to the Microsoft Store as a PWABuilder MSIX. The live site at `https://utilityos.tech` is the app. Do not add Capacitor, a second origin, or a Drive file proxy.

**Microsoft Store (live):** [https://apps.microsoft.com/detail/9PPFG0G5R0MG](https://apps.microsoft.com/detail/9PPFG0G5R0MG)

## Names

- Play listing title (max 30): `Utility OS: Study Workspace`
- Android package: `tech.utilityos.app`
- Microsoft reservation: `Utility OS`
- Contact in the privacy policy: `daniaryan212@gmail.com` (from `CONTACT_EMAIL` in `src/lib/legal.ts`)

## Assets already in the repo

- Listing screenshots: [`store/screenshots/README.md`](screenshots/README.md)
- Feature graphic + logos: `store/assets/`
- Privacy: `https://utilityos.tech/privacy`
- Account deletion: `https://utilityos.tech/account/delete`

Never commit `*.keystore` or `store/android/app/build/`.

## Google Play (you)

Do these in order. You cannot skip the closed-test wait on a new personal account.

### 1. Account

1. Open [Google Play Console](https://play.google.com/console) and create a **personal** developer account.
2. Pay **USD 25** (one-time).
3. Finish identity verification (government ID). Production is blocked until this clears.

### 2. Testers

1. Collect **16–20 Gmail addresses** (friends, classmates). You need **12 people opted in** for **14 continuous days**.
2. Ask them to join when you send the closed-test link, then actually **open the app at least once**. Opt-in without install does not always count.

### 3. Mailbox

Support / privacy contact is `daniaryan212@gmail.com` (`CONTACT_EMAIL` in `src/lib/legal.ts`). Redeploy after changing it so Play Data safety and the live privacy page match.

### 4. JDK + TWA package

JDK is not on this Windows machine yet. Install **JDK 17+**, then from the repo root:

```bash
npx @bubblewrap/cli update --directory store/android
npx @bubblewrap/cli build --directory store/android
```

If `store/android` is empty, init first:

```bash
npx @bubblewrap/cli init --manifest=https://utilityos.tech/manifest.webmanifest --directory store/android
```

Then in `store/android/app/build.gradle` set `compileSdkVersion 36` and `targetSdkVersion 36` (Bubblewrap still templates 35). Build the **AAB**.

### 5. Play Console app

1. Create app → name `Utility OS: Study Workspace` → app → free → education / productivity.
2. Upload the AAB to **internal testing** first (you only).
3. Fill **App content**: privacy policy URL, ads = no, target age 18+, Data safety (account, Firestore prefs/plans/SRS/viz, Drive files fetched in the browser, Groq for Ask AI, Vercel analytics).
4. Store listing: short/full description, `store/assets/play-feature-graphic-1024x500.jpg`, phone screenshots `store/screenshots/play-phone-0*.jpg`, tablet shots if asked.
5. Promote to **closed testing**. Add the Gmail list. Share the opt-in URL. Wait until 12 testers have been in for 14 days.
6. Apply for **production**, then ship a production release.

### 6. Digital Asset Links

After Play App Signing is on, copy **both** SHA-256 fingerprints (upload key + Play App Signing) into `public/.well-known/assetlinks.json`, replacing `PLACEHOLDER_*`. Deploy, then confirm:

`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://utilityos.tech&relation=delegate_permission/common.handle_all_urls`

## Microsoft Store

Identity values live in [`store/microsoft/product-identity.md`](microsoft/product-identity.md).

**Live listing:** [https://apps.microsoft.com/detail/9PPFG0G5R0MG](https://apps.microsoft.com/detail/9PPFG0G5R0MG)

### How website updates reach the Store app

The MSIX is a PWABuilder shell of `https://utilityos.tech`. A normal Vercel deploy updates the Store window on the **next open** via the same service worker as the website. Users already sitting in the app may see **Apply update**; otherwise there is no toast.

The live site 308s apex → `www`. Edge treats that as a different origin and draws a **tab + URL bar** unless `scope_extensions` and `/.well-known/web-app-origin-association` are live. After those deploy, fully quit and reopen the Store app. If the bar is still there, it is Edge’s **Open as tabbed window** (app menu / `...`) — the last-tab X cannot hide it.

**Rebuild / re-upload the MSIX only when** package identity, publisher, display name, or other Partner Center package metadata must change — not for ordinary site features.

### Packaging (when you need a new MSIX)

1. Register at [Partner Center](https://partner.microsoft.com/dashboard) if needed.
2. At [pwabuilder.com](https://www.pwabuilder.com) package `https://www.utilityos.tech` (canonical host; apex redirects here). Paste values from `product-identity.md`.
3. Submit in Partner Center: IARC rating, privacy URL, screenshots, logos as documented below.

### Certification: account creation (10.1.2.10)

Reviewers often fail OAuth **popups** (and Google may still block OAuth inside Store WebViews). The app:

- Puts **Create account** in the sidebar and as the primary CTA on Sign in / Sign up
- Keeps **email/password** as the certifiable, reliable path
- Shows Google/GitHub in the Store shell using **full-page redirect** (same-origin `/__/auth` proxy), not popups
- If OAuth fails in WebView2, the UI tells reviewers to use email instead

### Same-origin auth proxy (Store OAuth experiment)

`next.config.mjs` rewrites `/__/auth/*` → `https://<project>.firebaseapp.com/__/auth/*` (transparent proxy). On `utilityos.tech`, `www.utilityos.tech`, and `planner-flax-six.vercel.app`, the client uses that host as `authDomain`.

**One-time console setup (required for Google/GitHub in Store):**

1. Vercel Production: set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to `utilityos.tech` (or `www.utilityos.tech` if that is the canonical host), then redeploy.
2. Firebase Console → Authentication → Settings → **Authorized domains**: include `utilityos.tech`, `www.utilityos.tech`, and `planner-flax-six.vercel.app` (campus Wi-Fi fallback).
3. Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web client → **Authorized redirect URIs**: add  
   `https://utilityos.tech/__/auth/handler`, `https://www.utilityos.tech/__/auth/handler`, and `https://planner-flax-six.vercel.app/__/auth/handler` (keep the existing `*.firebaseapp.com/__/auth/handler` URI).
4. GitHub OAuth App → **Authorization callback URL**: same `https://utilityos.tech/__/auth/handler` (and www if needed). Campus-host GitHub sign-in can keep using that callback; Google needs the extra `planner-flax-six.vercel.app` redirect URI above.
5. Smoke-test in the **installed Store app**: Google, GitHub, and email. Google may still show `disallowed_useragent` in some WebView builds — that is a Google policy limit, not a broken button.

**Before every Store submission**, from the **installed Store/MSIX build** (not only Chrome):

1. Sidebar → **Create account** (or Sign in → Create account).
2. Enter email + password (6+ chars) → **Create account** → must land signed in.
3. Sign out → Sign in with the same email/password → must work.
4. Confirm Firebase Console → Authentication → Sign-in method has **Email/Password** enabled.
5. Confirm Authorized domains includes `utilityos.tech`, `www.utilityos.tech`, and `planner-flax-six.vercel.app`.

**Notes to certification** (paste in Partner Center when resubmitting):

> Account creation: open Utility OS → tap "Create account" in the sidebar (or, on the Sign in page, tap the prominent "Create account" button) → enter any email address and a password of 6 or more characters → tap "Create account." Email/password is the supported path for certification. Google and GitHub are also available via full-page redirect in the Windows app; if an OAuth provider fails inside the packaged browser, use email/password. To verify: after creating an account, you will be redirected to the home screen and your email/avatar will appear in the sidebar footer. You can sign out from the sidebar user menu and sign back in with the same credentials. Generative AI: The "Ask AI" feature uses a large language model to answer academic questions. This is declared under Product Declarations.

Also in the same submission → **Properties** → **Product declarations**: check  
**"This product incorporates generative AI features…"** (required for policy 11.16).

After a production deploy of auth fixes that must ship inside a new package binary, rebuild the PWABuilder package from `https://utilityos.tech`, then upload and resubmit.

## After Play is live

Add to `src/app/manifest.ts`:

```ts
related_applications: [{ platform: 'play', url: 'https://play.google.com/store/apps/details?id=tech.utilityos.app', id: 'tech.utilityos.app' }],
prefer_related_applications: false,
```

# Store packaging

Utility ships to Google Play as a Trusted Web Activity and to the Microsoft Store as a PWABuilder MSIX. The live site at `https://utilityos.tech` is the app. Do not add Capacitor, a second origin, or a Drive file proxy.

## Names

- Play listing title (max 30): `Utility OS: Study Workspace`
- Android package: `tech.utilityos.app`
- Microsoft reservation: `Utility OS`
- Contact in the privacy policy: `hello@utilityos.tech` (create this mailbox, or change `CONTACT_EMAIL` in `src/lib/legal.ts` before you submit)

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

Create `hello@utilityos.tech` (or update `src/lib/legal.ts` and redeploy) so Play Data safety / support email matches the privacy policy.

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

## Microsoft Store (you)

Identity values live in [`store/microsoft/product-identity.md`](microsoft/product-identity.md) (do not lose this file).

1. Register for free at [Partner Center](https://partner.microsoft.com/dashboard) (Individual). ID check is slower than Play; start it the same day.
2. Reserve the name **Utility OS** as **MSIX or PWA app** — done.
3. At [pwabuilder.com](https://www.pwabuilder.com) package `https://utilityos.tech`. Paste the values from `product-identity.md` when PWABuilder asks.
4. Submit in Partner Center: IARC rating, same privacy URL, screenshots `microsoft-01-home-1920.jpg` plus desktop timer/visualize, logos `microsoft-logo-300.png` and `microsoft-logo-1080.png`.

## After Play is live

Add to `src/app/manifest.ts`:

```ts
related_applications: [{ platform: 'play', url: 'https://play.google.com/store/apps/details?id=tech.utilityos.app', id: 'tech.utilityos.app' }],
prefer_related_applications: false,
```

# Store screenshots and listing assets

Captured from the local app (dark theme). PWA copies under 200 KB are in `public/screenshots/` and wired into `src/app/manifest.ts`.

## Folders

| Path | Use |
| --- | --- |
| `public/screenshots/` | PWA install UI (narrow + wide, already in the web manifest) |
| `store/screenshots/` | Play / Microsoft listing uploads |
| `store/assets/` | Feature graphic and store logos |

## Upload to Google Play

Phone (9:16, 1080×1920, letterboxed from the phone captures):

- `play-phone-01-home.jpg`
- `play-phone-02-timer.jpg`
- `play-phone-03-visualize.jpg`
- `play-phone-04-ask.jpg`
- `play-phone-05-planner.jpg`

Tablet:

- 7-inch: `play-tablet-7-home.jpg` (1200×1920)
- 10-inch: `play-tablet-10-home.jpg` (1920×1200)

Feature graphic (required): `store/assets/play-feature-graphic-1024x500.jpg`

If Play rejects letterboxing, recapture on a real 1080×1920 phone (Chrome → three dots → Cast / screenshot, or Android emulator). The `phone-0*.jpg` files are the true UI at 360×780 CSS pixels.

## Upload to Microsoft Store

- `microsoft-01-home-1920.jpg` (1920×1080)
- `desktop-02-visualize.jpg` and `desktop-03-timer.jpg` (1280×800; upscale if Partner Center asks for 1920×1080)
- Logos: `store/assets/microsoft-logo-300.png` and `microsoft-logo-1080.png` (generated from the existing 512 icon)

## Recapture later

1. `npm run dev`
2. Dark theme, hide the Next.js issues badge
3. Phone CSS viewport 360×780, desktop 1280×800, Microsoft 1920×1080
4. JPEG quality ~80 so PWA files stay under 200 KB

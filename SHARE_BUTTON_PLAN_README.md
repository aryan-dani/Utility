# Resource Viewer Share Button Plan

## Goal

Add a Share button to the built-in PDF/PPT viewer. When clicked, it should prompt the user to choose WhatsApp or Gmail. Choosing WhatsApp should open WhatsApp Web or the installed WhatsApp Windows app, with a message prefilled and ready to send.

No source-code changes should be made until this plan is approved.

## Current Viewer State

- The in-app viewer is implemented in `src/components/ResourceViewer.tsx`.
- The viewer toolbar currently has:
  - Open original
  - Download
  - Close
- The viewer receives a `ResourceItem`, which includes:
  - `title`
  - `file_url`
  - `subject_name`
  - `category`

## Proposed User Experience

1. User opens a PDF/PPT resource in the built-in viewer.
2. User clicks a Share icon button in the viewer toolbar.
3. A small dropdown/popover opens below the Share button.
4. The popover shows:
   - WhatsApp
   - Gmail
   - Optional: Copy link
5. Clicking WhatsApp opens a share URL with the resource title and file URL prefilled.
6. Clicking Gmail opens a Gmail compose window with the subject and body prefilled.
7. The user manually chooses the recipient and sends the message.

## Share Message Format

Use a simple message:

```txt
<resource title>

Open this resource:
<resource file_url>
```

Optional app context:

```txt
Shared from Utility
```

## WhatsApp Strategy

Use WhatsApp’s official web share URL:

```txt
https://wa.me/?text=<encoded-message>
```

Alternative:

```txt
https://api.whatsapp.com/send?text=<encoded-message>
```

Recommended first version:

```ts
const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
```

Expected behavior:

- On desktop, the browser usually opens WhatsApp Web.
- If the WhatsApp Windows app is installed and the user/browser has associated WhatsApp links with the app, it may open the app.
- The app cannot force WhatsApp Windows to open in all environments. That choice is controlled by the user’s OS/browser/app link settings.

Important limitation:

- WhatsApp share URLs can prefill the message, but they cannot automatically select a recipient or send the message.

## Gmail Strategy

Use Gmail compose URL:

```txt
https://mail.google.com/mail/?view=cm&fs=1&su=<encoded-subject>&body=<encoded-body>
```

Recommended first version:

```ts
const gmailUrl =
  `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
window.open(gmailUrl, '_blank', 'noopener,noreferrer');
```

Expected behavior:

- Opens Gmail in a new browser tab.
- Requires the user to be signed in to Gmail.
- The user manually fills recipients and sends.

## Optional Copy Link Action

Add a Copy Link option as a reliable fallback:

```ts
await navigator.clipboard.writeText(resource.file_url);
```

Show a short copied state, such as changing the menu item text to `Copied`.

Reason:

- WhatsApp/Gmail may be blocked by popup settings, login state, or app availability.
- Copy link gives the user a guaranteed manual share path.

## Component Changes After Approval

### `src/components/ResourceViewer.tsx`

Add imports:

```ts
import { Copy, Mail, MessageCircle, Share2 } from 'lucide-react';
import { useRef, useState } from 'react';
```

Add local state:

```ts
const [shareOpen, setShareOpen] = useState(false);
const [copied, setCopied] = useState(false);
const shareMenuRef = useRef<HTMLDivElement>(null);
```

Add helper functions:

- `getShareMessage(resource)`
- `openWhatsAppShare(resource)`
- `openGmailShare(resource)`
- `copyResourceLink(resource)`

Add outside-click handling for the share menu.

Add a Share icon button to the toolbar before Open original:

```tsx
<button type="button" aria-label="Share resource">
  <Share2 />
</button>
```

When clicked, render a dropdown with WhatsApp, Gmail, and optionally Copy link.

## Accessibility and Interaction Details

- Share button should have:
  - `title="Share"`
  - `aria-label="Share resource"`
  - `aria-expanded={shareOpen}`
- Dropdown buttons should be keyboard-focusable.
- Escape should continue closing the viewer.
- Optional improvement: if share menu is open and Escape is pressed, close the menu first, then close viewer on a second Escape.
- Clicking outside the share dropdown should close it.

## UI Placement

Recommended toolbar order:

1. Share
2. Open original
3. Download
4. Close

Share dropdown should use existing app styling:

- `bg-card`
- `border border-border`
- `rounded-lg`
- `shadow-popover`
- `text-muted hover:text-foreground hover:bg-surface`

## Risks and Constraints

- Browser popup blockers can block `window.open` if called asynchronously. Keep `window.open` directly inside the click handler.
- WhatsApp app opening cannot be guaranteed from a website.
- Gmail compose requires the user to be logged in.
- If the resource URL is private, expired, or inaccessible to the recipient, sharing the raw `file_url` may not work for them.

## Validation After Implementation

1. Open a PDF in the viewer.
2. Click Share.
3. Verify the dropdown opens and does not overlap awkwardly on mobile or desktop.
4. Click WhatsApp.
5. Verify WhatsApp Web or the installed WhatsApp app opens with the message prefilled.
6. Click Gmail.
7. Verify Gmail compose opens with subject and body prefilled.
8. Test Copy link if included.
9. Verify viewer close, download, and open-original buttons still work.
10. Run:

```bash
npm run build
```

## Recommended First Version

Implement Share inside `ResourceViewer.tsx` only:

- Add toolbar Share button.
- Add dropdown with WhatsApp and Gmail.
- Include Copy link as a fallback if acceptable.
- Use encoded URLs and `window.open`.
- Do not add new dependencies.

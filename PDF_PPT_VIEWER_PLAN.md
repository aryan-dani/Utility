# Built-In PDF and PPT Viewer Plan

## Goal

When a user clicks a PDF or PowerPoint resource card on the Resources page, keep them inside the Utility app and open the file in an in-app viewer instead of navigating to the raw file URL in a new tab.

No implementation changes should be made until this plan is approved.

## Current Behavior

- Resource cards are rendered in `src/components/ResourcesClient.tsx`.
- `ResourceCard` currently renders an anchor:
  - `href={item.file_url}`
  - `target="_blank"`
  - `rel="noopener noreferrer"`
- File type detection is already present:
  - PDF: URL ends with `.PDF`
  - PPT/PPTX: URL ends with `.PPT` or `.PPTX`
- Resource data comes from `src/lib/dataFetcher.ts` as `ResourceItem`, including `id`, `title`, `file_url`, `subject_name`, and `category`.

## Proposed User Experience

1. User opens `/resources`.
2. User clicks a PDF or PPT/PPTX resource card.
3. The Resources page stays open.
4. A large viewer opens over the page as a modal or full-page overlay.
5. The viewer shows:
   - File title.
   - File type label.
   - Close button.
   - Open in new tab button.
   - Download/open original fallback button.
6. Pressing `Esc`, clicking the close button, or using browser Back closes the viewer.
7. Non-PDF/PPT resources can continue opening externally unless we later add support for more file types.

## Recommended Architecture

### 1. Add Viewer State to `ResourcesClient`

Add local state:

```ts
const [viewerResource, setViewerResource] = useState<ResourceItem | null>(null);
```

Pass an `onOpen` handler from `ResourcesClient` to `ResourceSection`, then to `ResourceCard`.

For PDF/PPT/PPTX cards:

- Prevent normal link navigation.
- Set `viewerResource`.

For unsupported files:

- Keep current external link behavior.

### 2. Add a Reusable Viewer Component

Create:

```txt
src/components/ResourceViewer.tsx
```

Responsibilities:

- Render an overlay/modal.
- Detect file type from `resource.file_url`.
- Render the correct iframe source.
- Handle close interaction.
- Provide fallback actions.

Suggested props:

```ts
interface ResourceViewerProps {
  resource: ResourceItem;
  onClose: () => void;
}
```

### 3. PDF Rendering Strategy

Use the browser’s native PDF viewer first:

```tsx
<iframe src={resource.file_url} />
```

Reason:

- No extra dependency required.
- Good enough for viewing, scrolling, zooming, and printing in modern browsers.
- Avoids adding `react-pdf` and `pdfjs-dist` unless we need custom page controls later.

Fallback:

- Show an “Open original” button if the iframe cannot display the PDF due to headers, browser settings, or storage restrictions.

### 4. PPT/PPTX Rendering Strategy

Browsers do not natively render PowerPoint files. Use Microsoft Office’s embedded viewer inside an iframe:

```txt
https://view.officeapps.live.com/op/embed.aspx?src=<encoded-public-file-url>
```

Reason:

- Avoids redirecting the user away from Utility.
- Avoids server-side conversion complexity.
- Works well when the file URL is publicly accessible.

Important limitation:

- Office embed requires the PPT/PPTX URL to be reachable by Microsoft’s servers. If Supabase URLs are private, signed, expired, or blocked by headers, the viewer may fail.

Fallback:

- Show “Open original” and “Download” actions.

### 5. Optional URL State for Back Button Support

Use a query parameter to make closing predictable with browser Back:

```txt
/resources?branch=AIDS&semester=4&viewer=<resource-id>
```

Implementation approach:

- On card click, update the URL with `viewer=item.id`.
- Resolve the selected resource from `initialResources`.
- On close, remove the `viewer` param.
- Do not trust arbitrary file URLs from query params. Only use the `viewer` id if it matches a resource already loaded from the database.

This is recommended, but local state-only modal is simpler if deep linking is not needed.

## Files To Change After Approval

- `src/components/ResourcesClient.tsx`
  - Replace direct external behavior for PDF/PPT/PPTX resources.
  - Add viewer state and open/close handlers.
  - Pass click handler through `ResourceSection` to `ResourceCard`.

- `src/components/ResourceViewer.tsx`
  - New client component for PDF/PPT iframe viewer.
  - Handles overlay UI, close button, file type rendering, and fallback buttons.

- Optional:
  - `src/lib/resourceViewer.ts`
  - Add small helper functions for file type detection and Office viewer URL generation if the logic becomes noisy in the component.

## UI Details

- Use a fixed overlay below/over the navbar with darkened backdrop.
- Use a full-width viewer surface on mobile.
- Use a large centered viewer on desktop.
- Keep controls compact:
  - Close icon button.
  - External/open icon button.
  - Download/open original button.
- Preserve current visual style:
  - `bg-card`
  - `border-border`
  - `text-foreground`
  - `text-muted`
  - `rounded-xl` or existing app radius patterns.

## Risks and Constraints

- PDF viewing depends on browser support and the response headers sent by Supabase/storage.
- PPT/PPTX viewing depends on Microsoft Office embed being able to access the file URL.
- If resource URLs are private or signed for short durations, PPT preview may fail.
- Fully native PPT rendering would require conversion to PDF/images, usually with a backend worker or LibreOffice-style conversion, which is much larger than this feature.

## Validation After Implementation

After approval and implementation:

1. Click a PDF resource card and verify it opens in the in-app viewer.
2. Click a PPT/PPTX resource card and verify it opens in the in-app viewer.
3. Verify unsupported file types still open externally or show a clear fallback.
4. Verify close button works.
5. Verify `Esc` closes the viewer.
6. Verify mobile layout does not overflow.
7. Run:

```bash
npm run build
```

## Recommended First Version

Build the modal viewer with:

- Native iframe for PDFs.
- Microsoft Office embed iframe for PPT/PPTX.
- Fallback open/download actions.
- Optional `viewer=<resource-id>` URL state if you want browser Back support from the first version.

Avoid adding PDF rendering libraries until there is a real need for custom page thumbnails, annotations, search inside PDFs, or page-level controls.

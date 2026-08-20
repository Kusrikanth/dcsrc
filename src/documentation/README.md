# Documentation module

Copy this entire folder into your React project. It contains the documentation management screen, authoring/viewer portal, access configuration, storage helpers, launch overlay, and styles.

## Dependencies

- React 19 or compatible
- `lucide-react`

## Route integration

```jsx
import {
  DocumentationManagement,
  DocumentationPortal,
} from './documentation/index.js';

if (path === '/documentation') return <DocumentationPortal />;
if (path === '/documentation-management') return <DocumentationManagement />;
```

## Add a view-only icon to another screen

```jsx
import { DocumentationLauncher } from './documentation/index.js';

<DocumentationLauncher
  code="KB-HR-POLICIES-A4F2C"
  label="View HR Policies"
/>
```

The launcher opens an iframe overlay on the current screen. Closing it leaves the underlying screen unchanged.

## Configuration

Set `VITE_DELETE_PASSWORD` for protected deletion. The current prototype persists configuration and document metadata in `localStorage`, and file blobs in IndexedDB. Replace the functions in `documentation-store.js` with authenticated API calls when integrating with a production backend.

Viewer URLs follow this format:

```text
/documentation?code=KB-HR-POLICIES-A4F2C&mode=viewer
```

## View-only document library

`SecureFileLibrary` (route `/document-library`) lets an owner upload PDF, Word,
Excel and PowerPoint files and decide, per file, who may open them. Recipients
read the document inside the app: there is no download link, no attachment and
no print path.

```jsx
import { SecureFileLibrary, SecureFileViewer } from './documentation/index.js';

if (path === '/document-library') return <SecureFileLibrary />;

// Or drop a single locked document into any screen:
<SecureFileViewer fileId={id} onClose={close} />
```

### Supported formats

| Upload | Rendered by |
| --- | --- |
| `.pdf` | pdf.js, painted page-by-page onto `<canvas>` |
| `.docx` | mammoth, converted to HTML and passed through an allowlist sanitiser |
| `.xlsx` `.xlsm` `.xlsb` `.xls` `.csv` | SheetJS, shown as a read-only grid with one tab per sheet |
| `.pptx` | a bundled OOXML parser that rebuilds each slide from its shape offsets |

`.doc` and `.ppt` are refused at upload. Neither has a dependable in-browser
renderer, and falling back to a download link would defeat the feature — the
error asks the author to save as `.docx` / `.pptx` instead.

### Per-file access

Each upload starts locked: **specific people**, with nobody on the list. The
access panel controls the view rule (`anyone` / `specific` / `no-one`), the
granted email addresses, an optional expiry date, an **Allow download** override
that is off by default, and identity watermarking. Revoking cuts off every
recipient at once while the owner keeps their own file. Uploads, access changes
and every open are written to an audit trail.

Use the **Previewing as** box to borrow another person's identity and confirm
what they can actually open before you share anything.

### What "view-only" does and does not mean

The app removes every download, print and copy path it offers, encrypts payloads
at rest with AES-GCM, checks the grant before decrypting a single byte, and logs
each open. A browser must still receive the bytes in order to draw them, so this
**deters** copying rather than making it impossible — it is not DRM. Anyone with
devtools, or a phone camera, can still get the content.

For real guarantees, render pages server-side and stream images to the client.
The code is shaped for that swap: `resolveFileBytes` in `secure-files-store.js`
is the single gate that turns a stored file back into readable bytes. Replace its
body with an authenticated fetch, keep the key server-side, and run the same
`evaluateAccess` check there. Nothing else in the module needs to change.

### Documentation attachments

Attachments added to a documentation page now route through the same store. An
attachment of a supported type renders as a view-only card that opens the secure
viewer, and inherits the knowledge base's view access. Files attached before this
change still show as plain downloads and are flagged in the editor for replacing.

### Build note

pdf.js fetches its character maps, base-14 font data and image-decoder wasm at
runtime. `scripts/sync-pdfjs-assets.mjs` mirrors those folders into
`public/pdfjs/` and runs automatically from the `predev` / `prebuild` npm
scripts, so the assets come from your own origin rather than a CDN. The copies
are generated output and are git-ignored.

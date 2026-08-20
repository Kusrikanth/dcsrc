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

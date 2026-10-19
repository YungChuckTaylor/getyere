# Reminder images and details discovery

The existing shared PWA/Capacitor implementation is extended, not replaced.

## Images and private storage

- Saved PNG, JPEG, WebP and GIF attachments appear as clickable image thumbnails in reminder details and the existing editor. Missing legacy MIME metadata can fall back to a recognized image extension. PDFs, Word documents, SVG and other non-image MIME types retain file-name buttons rather than being embedded as images.
- Clicking a thumbnail opens a larger, fit-to-screen image in the app. A separate dialog preserves the reminder and any unsaved editor fields underneath. Close, Escape, backdrop, or Android Back returns to the previous view. Keyboard focus stays inside the image dialog and returns to the source thumbnail.
- The existing private `yere-attachments` bucket and its owner-scoped access policies are unchanged. The existing signed-in Supabase client issues 120-second signed URLs. Expansion requests a fresh URL rather than reusing a potentially expired thumbnail URL. URLs are not written to reminder state, local storage or analytics. This feature does not make the bucket public or introduce a new upload path.
- Previews reserve their space while loading, expose a safe failure state, and offer a fresh-URL retry in the expanded viewer. Late responses cannot reopen a closed image or populate a detached thumbnail. Signing out or changing accounts clears displayed image URLs. No images load automatically on Home.
- Thumbnails are client-sized originals, not a paid/server-side image transformation service. Existing upload limits and supported file types are unchanged. Newly selected files still follow the existing save/upload flow; these previews are for saved attachments.

## Discovery outside the tour

Home has a persistent, visually highlighted **Keep notes, photos & files with every reminder** card before the workspace metrics:

- **Create with details** opens the existing reminder editor. An in-progress quick capture is preserved and parsed; an empty capture opens an empty, unsaved draft. The initial due time is the next configured default time, and can be edited as usual.
- **Add to an existing reminder** lets users select an existing reminder (including completed reminders) and focuses its notes in the same editor. Rejected reminders are excluded. An account with no reminders does not display this shortcut.
- Each reminder popup also has an explicit **Add/Edit notes, photos & files** shortcut, and the editor has a labelled details section.
- The fourth tour heading is now **Add notes, photos & files to reminders.** Its text explains Home/editor access and tapping an image to expand it.

There is no new backend schema, telemetry, seeded user data, public storage or change to delegated-attachment permissions. Native apps require rebuilding; an installed PWA can use the deployed web update after refreshing.

## Implementation and verification

- `src/attachments.js`: supported-image detection, signed-URL lifecycle, async/account guards, viewer controls and focus behavior.
- `src/bootstrap.js`: exposes the helper to the existing shared interface.
- `index.html`: thumbnail markup, Storage signing, viewer structure, existing modal integration, Home shortcuts and tour wording.
- `src/style.css`: responsive discovery card, thumbnail and expanded-image styles.
- `tests/attachments.test.js` and `tests/details-discovery.test.js`: regression tests for rendering, privacy/races, failures, controls and real editor entry points.

Run `npm test`, `npm run build`, and `git diff --check`. Browser smoke checks used synthetic reminder metadata and a mocked signed-URL service (no production invitations, accounts or attachments were created). Checked 320/390/768/1440px layouts, Home create/select/edit, loaded thumbnails and expansion, Escape/Tab/native-Back handling, preserving unsaved notes, the fourth tour slide, and sign-out cleanup. These checks do not replace physical-device or hosted Storage end-to-end testing.

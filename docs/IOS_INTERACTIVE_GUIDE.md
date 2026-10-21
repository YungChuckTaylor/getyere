# Interactive iOS owner handoff

Open `https://getyere.com/ios-guide.html` on the deployed website (the `/ios-release-guide` alias also works), or at the same path during local Vite development. The explicit `.html` URL also works.

This standalone static page does not modify the shared reminder app. It is copied to the build output
by Vite from `public/`. A build plugin excludes its three assets from native builds so the
owner documentation is not packaged in the installed apps and native credential guards stay strict. Vercel supplies the extensionless rewrite. It is not linked in the customer
navigation and includes a noindex directive; this is **not access control**, so do not add private
information. There are no account connections, credential forms, analytics or backend calls.

- Eight stages: preparation, code/configuration, Apple signing, authentication/APNs/links, archive,
  TestFlight acceptance, listing/compliance, and submission.
- Checklist ticks and selected stage are saved in this browser's localStorage only. No cross-device
  synchronization. Restricted storage falls back to an in-memory session with a visible warning.
- Progress is self-reported, not proof of signing, provider delivery or App Store submission.
- All stages can be browsed without completing previous checklists. Final review returns to the first
  stage with unchecked tasks. Reset asks for confirmation and only resets this handbook.
- Copy buttons use the Clipboard API; denied access selects text for manual copying.
- Print / save PDF includes all eight stages, troubleshooting and glossary, not just the current page. Use the browser print dialog.
- Source content lives in `public/ios-guide.js`; update instructions there. Maintain stable task IDs
  when editing copy so saved progress survives. Change the storage version if semantics change.
- Styling: `public/ios-guide.css`; shell: `public/ios-release-guide.html`.

Based on `docs/NATIVE_NOTIFICATIONS.md`, `docs/MOBILE_RELEASE.md`, `DEPLOYMENT.md`, and the client handoff
provided in the conversation. Apple UI labels and upload SDK requirements may change: the guide links
to official Apple resources and tells the owner to verify current requirements.

Test with `npm test` and `npm run build`. For a local preview run `npm run dev`, then open
`/ios-release-guide.html`. No Apple credentials, secret values or production deployment are needed.

For a downloadable, self-contained handoff, run `node scripts/export-ios-guide.mjs`.
It writes `artifacts/Yere-iOS-Launch-Guide.html` (ignored by Git) with CSS, JavaScript and
branding embedded. The client can open that file directly in a browser without a web server.
Browser policies for local-file storage vary; the same storage warning/fallback applies.
External Apple/GitHub links still require internet access.

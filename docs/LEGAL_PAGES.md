# Public legal pages

- `/privacy-policy` → static `public/privacy.html`
- `/termsofuse` → static `public/terms.html`
- Shared stylesheet: `public/legal.css`

Vite copies these files to `dist` without authentication, application JavaScript, or Supabase configuration. Vercel rewrites the requested clean URLs to the files. Existing `/privacy.html` links permanently redirect to `/privacy-policy`; `/terms.html` redirects to `/termsofuse`. Vite dev/preview middleware mirrors the clean paths locally. The service worker intentionally does not return the app shell when a legal page is unavailable offline.

Sign-up/sign-in, app settings, support, and the legal pages link to the clean URLs. The pages support small screens, system light/dark preferences, keyboard navigation, section anchors, and printing.

## Before/after production deployment

1. Review the documents with the service operator/legal adviser. Confirm the operator identification, the existing `support@getyere.com` inbox, applicable law, provider disclosures, and actual retention practices. The documents are not a compliance certification.
2. Deploy this branch with the existing Vercel project. A branch Preview deployment does not by itself update the production domain. Promote an appropriate deployment or merge the reviewed PR into the configured production branch.
3. Verify unauthenticated GET requests to `https://getyere.com/privacy-policy` and `https://getyere.com/termsofuse` return the respective documents. An existing apex-to-www redirect is fine if it preserves the path and ends at HTTP 200. Check from a private browser window with no Yere session.
4. Use the live privacy-policy URL in Google Auth Platform branding and the live terms URL in Terms of Service settings. Public policies do not replace Google's client configuration or verification requirements.

Tests: `npm test` includes `tests/legal.test.js`. Build: `npm run build`. Local preview: `npm run preview`, then visit `/privacy-policy` and `/termsofuse` on the preview host.

# Shared workspace UI update

The PWA and Capacitor apps use the same `index.html` implementation.

- Sign-in heading is **Welcome**; other auth modes keep their specific headings.
- The top-right profile button offers Settings, Trusted contacts, Activity log, theme, tour and authenticated logout. The existing drawer account block/sign-out remains. The menu closes on outside interaction, navigation, Escape, Tab and native Back, and supports arrow-key navigation.
- Every user-facing app logout entry point goes through `signOut()` and asks for confirmation before removing device push registration, signing out, or clearing the current workspace. Cancellation does nothing. Pending sync is mentioned in the confirmation. Failed logout shows an error and allows retry.
- The initial `today` route is now labelled **Home**. Open reminders are grouped by day like Next 7 days, but include overdue items and dates arbitrarily far ahead. Approvals are shown separately and completed reminders are in an expandable section. Search filters these lists; workspace totals remain unfiltered and are labelled accordingly. The existing Next 7 days route is unchanged.
- `src/dashboard.js` computes totals and a seven-calendar-day completion chart from currently retained workspace records; these are not lifetime analytics. Recent activity reuses existing account audit records. No telemetry SDK or backend schema change was added.
- Settings labels the holiday option **Skip public holidays by default**. This is a copy change only, not a change to the existing holiday dataset or scheduling rules.
- Settings → Trusted-contact reminders offers **Add trusted contact**, opening the existing secure invitation flow and respecting its suspension/permission checks.

Verification: `npm ci`, `npm test` (including `tests/workspace-ui.test.js`), and `npm run build`. Browser smoke checks covered 320/390/768/1440px widths, menu keyboard/outside interactions, Settings → invitation, the Welcome heading, and cancelling/confirming logout. A newly built native binary is needed for APK/iOS users; web changes alone cannot update packaged app assets.

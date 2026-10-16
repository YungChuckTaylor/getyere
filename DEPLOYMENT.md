# Yere deployment and service setup

Yere is a Vite-built, installable PWA. The browser uses the Supabase **publishable/anon key only**; authentication, RLS, private Storage, invitation delivery, web push, and minute-based reminder dispatch are backed by Supabase. When no Supabase browser variables are provided, the app opens in an explicitly labelled local demo mode.

## 1. Run locally

1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env.local` and fill the four browser variables described below. Leave the `VITE_*` Supabase values blank to use the local demo.
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the Vite URL shown in the terminal (normally `http://localhost:5173`). A localhost origin is considered secure for service workers, PWA install prompts, microphone access, and local notifications.
5. Verify a production build with `npm run build`. The deployable static files are written to `dist/`.

## 2. Create and configure Supabase

1. Create a Supabase project and keep its project URL, project reference, publishable/anon key, and service-role key in a secure password manager.
2. In **Authentication → Providers → Email**, enable email/password sign-up. For production, enable email confirmation and configure a verified custom SMTP provider; the built-in test mail service is not intended for production traffic.
3. In **Authentication → URL Configuration**, set the production Site URL (for example `https://www.getyere.com`) and add redirect URLs for local development, the production domain, and Vercel preview URLs. Keep the list limited to domains you control.
4. Apply the versioned schema in `supabase/migrations/`:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   The migration creates profiles, reminders, contacts, custom lists, audit events, private attachment metadata, push subscriptions, rate-limit/security tables, RLS policies, the private `yere-attachments` bucket, and helper RPCs. Do not replace the migration with client-side table creation.
5. Confirm **Database → Tables** has the Yere tables and that RLS is enabled. The service-only invite hashes, rate-limit buckets, and reminder-fire ledger intentionally have no browser policies. The public storage bucket must remain private.
6. Deploy the Edge Functions:

   ```bash
   npx supabase functions deploy create-contact-invite
   npx supabase functions deploy redeem-contact-invite
   npx supabase functions deploy revoke-contact-invite
   npx supabase functions deploy create-delegated-reminder
   npx supabase functions deploy test-notification
   npx supabase functions deploy delete-account
   npx supabase functions deploy dispatch-reminders
   ```

   `dispatch-reminders` intentionally has JWT verification disabled in `supabase/config.toml`; it verifies a separate high-entropy cron secret on every request. All other functions verify the caller’s Supabase JWT and re-check the user server-side.

### Supabase Edge Function secrets

Set server-side secrets in **Supabase → Edge Functions → Secrets** (or with `npx supabase secrets set NAME=value`). Never prefix a secret with `VITE_`, and never add the service-role key to Vercel or the browser bundle.

| Secret | Required? | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase-provided | Supabase project URL for Edge Functions. |
| `SUPABASE_ANON_KEY` | Supabase-provided | Validates caller sessions inside the functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase-provided, server only | Admin access used only after Edge Function authorization checks. |
| `PUBLIC_APP_URL` | Yes | Canonical HTTPS app origin used in secure invite and reminder links, e.g. `https://www.getyere.com`. |
| `YERE_CRON_SECRET` | Yes for scheduled delivery | Random secret shared with the pg_cron Vault entry. Generate with `openssl rand -hex 32`. |
| `RESEND_API_KEY` | For email invites/reminders | Resend API key for sending messages. |
| `RESEND_FROM_EMAIL` | For email invites/reminders | A sender identity verified with Resend, e.g. `Yere <reminders@your-domain.ng>`. |
| `TWILIO_ACCOUNT_SID` | For SMS invitations | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | For SMS invitations | Twilio auth token. |
| `TWILIO_FROM_NUMBER` | For SMS invitations | Twilio-enabled number in E.164 format. |
| `VAPID_PUBLIC_KEY` | For background web push | Public Web Push application-server key. It must match the browser value below. |
| `VAPID_PRIVATE_KEY` | For background web push | Private Web Push key; server only. |
| `VAPID_SUBJECT` | Recommended for web push | Contact URI, e.g. `mailto:hello@getyere.com`. |

Supabase automatically provides its project URL and keys to Edge Functions in hosted projects. Check **Edge Functions → Secrets** before adding duplicate values. The service-role key bypasses RLS; restrict it to these functions and rotate it if it is ever exposed.

### Generate Web Push keys

Generate a VAPID pair once and keep it stable for this app installation:

```bash
npx --yes web-push generate-vapid-keys
```

Store the private key as the Supabase secret `VAPID_PRIVATE_KEY`, the public key as the Supabase secret `VAPID_PUBLIC_KEY`, and also set the **same public key** as `VITE_VAPID_PUBLIC_KEY` in the browser build environment. A key mismatch prevents subscriptions or delivery. Never expose the private key.

### Per-minute reminder dispatch

The migration creates the idempotent `reminder_fires` ledger; the pg_cron job calls the Edge Function once per minute. After deploying the function and setting `YERE_CRON_SECRET`:

1. Open `supabase/schedule-reminders.sql.example` and replace `YOUR_PROJECT_REF` and the placeholder secret.
2. Run the SQL in the Supabase SQL editor. It stores the endpoint and cron secret in Vault, enables `pg_cron`/`pg_net`, and registers `yere-reminder-dispatch`.
3. Verify the job in **Database → Cron Jobs** and inspect **Edge Functions → dispatch-reminders → Logs** after its next minute tick.
4. Keep the cron secret in sync: changing the Edge Function secret requires updating the matching Vault secret. Do not put either value in a browser variable.

If your project does not expose Vault or the `pg_cron`/`pg_net` extensions, enable them in **Database → Extensions** first, then rerun the example SQL.

## 3. Environment variables

### Browser build (local and Vercel)

Set these in `.env.local` for local work and in **Vercel → Project → Settings → Environment Variables** for Production, Preview, and Development as appropriate:

| Variable | Exposure | Example |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public | Supabase publishable/anon key (never the service-role key). |
| `VITE_VAPID_PUBLIC_KEY` | Public, optional | Matching VAPID public key for push subscriptions. |
| `VITE_PUBLIC_APP_URL` | Public, optional | `https://www.getyere.com`; used as the displayed canonical origin. |

The browser variables are embedded at build time. A change requires a new Vercel deployment. If Supabase variables are missing, the **web** build deliberately starts in local-demo mode and clearly warns that demo invitations are not safe to share. **Native (Android/iOS) builds never fall back to demo data**: `npm run build:native` (and `vite build --mode native`) refuses to finish without a valid `VITE_SUPABASE_URL` and publishable/anon key, and an installed app without valid configuration shows a blocking “Yere can’t connect yet” screen instead of sample reminders. Nigeria holiday skipping includes fixed-date holidays and calculated Easter dates; Islamic-calendar dates are estimates and may differ from the Federal Government’s moon-sighting announcement, so adjust a recurrence when an official date is published.

### Server-only values

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `YERE_CRON_SECRET`, and `PUBLIC_APP_URL` belong in Supabase Edge Function secrets only. Do **not** put them in `.env.local` with a `VITE_` prefix, Vercel browser variables, checked-in files, or client-side source.

## 4. Vercel and automatic GitHub deployment

1. In Vercel, choose **Add New → Project**, authorize the connected GitHub account, and import `YungChuckTaylor/getyere`.
2. Set the project root to the repository root. Use the **Vite** framework preset (or **Other** if the dashboard does not detect it).
3. Use the checked-in build settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Development command: `npm run dev`
4. Add the four browser variables from the table above. Put the VAPID public key in the build environment if push will be enabled. Do not add a Supabase service-role key to Vercel.
5. In **Settings → Git**, set `main` as the Production Branch and leave Preview Deployments enabled. Vercel’s Git integration will create preview deployments for pull requests and production deployments for pushes/merges to `main`.
6. Verify **Deployments** shows a successful build after the first import. Push a harmless documentation change to a PR to confirm a preview deployment; merge it to the production branch to confirm an automatic production build. No GitHub Actions secret or manually copied deployment token is required.
7. To roll back, open **Deployments**, select the last known-good production deployment, and choose **Promote to Production** or use Vercel’s instant rollback control. Fix the branch and redeploy after the rollback.
8. Optional: add `www.getyere.com` (or the domain you control) under **Settings → Domains**, configure the DNS records Vercel provides, then update Supabase Auth URLs and `PUBLIC_APP_URL` to the final HTTPS origin.

`vercel.json` serves the Vite output with service-worker/manifest cache headers. Vercel redeploys only after Git integration is configured in the project dashboard; this repository file alone cannot authorize a Vercel project.

## 5. PWA and notification verification

Run the deployed app over HTTPS (or localhost for development), then verify:

1. `/manifest.webmanifest`, `/sw.js`, `/yere-mark.svg`, and the three PNG icons return successfully. The manifest starts in standalone mode with the dark theme color.
2. In Chrome/Edge DevTools → **Application**, confirm the manifest is installable and the service worker is activated. Use **Offline** in the Network panel and reload after the first visit; the app shell and compiled styles/scripts should still load.
3. On Android, install from the browser install prompt or browser menu. On iPhone/iPad, open the site in Safari, tap **Share → Add to Home Screen**, then open the installed icon. iOS web push requires a supported iOS/iPadOS version and an installed Home Screen web app.
4. Toggle the theme in the header and Settings. The first visit is dark; your explicit choice persists in local storage and the signed-in profile.
5. Enable push from Settings. Confirm browser permission, a row in `push_subscriptions`, and use **Send a test notification**. For server push, verify the VAPID public key is configured in both the Vercel build and Supabase secrets.
6. Create a test reminder due in the next few minutes with Push or Email selected. Confirm a `reminder_fires` row is created once, then inspect Edge Function logs and delivery status. Re-running cron must not duplicate the same reminder fire.
7. Test offline behavior, keyboard search (`/`), quick capture (`n`), swipe-to-snooze/complete on touch, and mobile bottom navigation at phone and tablet widths.

## 6. Troubleshooting

- **Auth fails or redirects to the wrong place:** verify the project URL/key, email provider settings, Site URL, and exact allowed redirect URLs in Supabase Auth. Vercel preview domains must be allowed if you test sign-up there.
- **Cloud setup warning or empty signed-in workspace:** run `npx supabase db push`, confirm migrations are applied and RLS is enabled, then sign out/in. Check the browser console and Supabase API logs for table/RPC errors.
- **RLS/permission errors:** do not disable RLS as a workaround. Check that the matching `owner_id` policy and migration are present. Invite hashes, rate-limit buckets, and fire ledgers should remain inaccessible to anon/authenticated table queries.
- **Email invites do not send:** verify Resend API key, verified sender, domain DNS, and `RESEND_FROM_EMAIL` in Edge Function secrets. Review the `create-contact-invite` logs.
- **SMS invites do not send:** verify Twilio account SID, auth token, enabled sender number, recipient E.164 format, and account country/number permissions.
- **Push is permission-granted but no notification arrives:** install the PWA where required, check the browser subscription and `push_subscriptions` row, confirm public/private VAPID keys are a pair, confirm `VAPID_SUBJECT`, and inspect `test-notification`/`dispatch-reminders` logs. iOS push does not behave like a normal Safari tab.
- **Scheduled reminders do not fire:** check the cron job is enabled, Vault values match the `YERE_CRON_SECRET` Edge Function secret, `pg_net` is enabled, and reminders have an approved status and a Push/Email channel.
- **Vercel build fails:** check the Node version (20+), lockfile, `npm run build`, output directory `dist`, and that environment variables are set for the target environment. Public `VITE_*` changes require a new build.
- **PWA does not refresh after deployment:** check `/sw.js` is not cached, confirm the service worker activates, close existing installed windows once, and redeploy. Vite assets are content-hashed and safe to cache.
- **GitHub push does not deploy:** confirm the right GitHub repository is connected under Vercel → Settings → Git, `main` is the Production Branch, the commit reached the selected branch, and GitHub/Vercel integration has repository access.
- **Attachment upload fails:** confirm the private `yere-attachments` bucket and Storage RLS policies were created. Files are limited to 10 MB and accepted image/PDF/Word types.

## 7. Security checklist

- [ ] Supabase email confirmation and a production SMTP sender are configured.
- [ ] Every application table has RLS enabled; service-role access exists only inside Edge Functions.
- [ ] Invite codes and link tokens are hashed in Postgres, single-use, expire after 24 hours, and are rate-limited server-side.
- [ ] `contact_blocks` and workspace auto-suspension remain server-enforced.
- [ ] Attachments are in a private bucket with user-scoped object paths and signed download URLs.
- [ ] `YERE_CRON_SECRET` and Web Push private key are stored in Supabase secrets/Vault only.
- [ ] Vercel contains only public browser values; no service-role, provider, or VAPID private key.
- [ ] Production and preview Auth redirect URLs and `PUBLIC_APP_URL` match the intended HTTPS origins.
- [ ] Cron, Edge Function logs, and delivery failures are reviewed before enabling real reminders.

## 8. Capacitor mobile project

The checked-in `capacitor.config.ts`, `android/`, and `ios/` projects wrap the same Vite application; there is no second mobile UI to keep in sync. Capacitor 8 requires Node 22, Java 21 for Android, Android SDK 36, and iOS 15 or later.

Install and sync from the repository root:

```bash
npm ci
npm run build:native   # fails unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
npx cap sync
```

Never use plain `npm run build` for an artifact you will install on a phone; it is the browser build and may contain the demo fallback.

Useful scripts:

```bash
npm run cap:sync       # native web build (cloud-validated) + both native projects
npm run cap:android    # sync and open Android Studio
npm run cap:ios        # sync and open Xcode (macOS only)
npm run android:debug  # build a debug APK
npm run android:bundle # build a release AAB (signing must be configured)
```

Always run `npx cap sync` after changing a plugin, `capacitor.config.ts`, or web assets. Generated copies under `android/app/src/main/assets/public` and `ios/App/App/public` are ignored; do not edit those copies. Edit `index.html`, `src/`, or `public/`, then sync.

The native bridge in `src/native.js` provides:

- native Supabase email/password auth and Sign in with Apple initiation through `@capgo/capacitor-supabase`, with its JWT mirrored into `supabase-js` for Realtime, Storage, and Edge Functions;
- APNs/FCM registration, foreground delivery, notification taps, and reminder intents;
- native speech recognition for voice capture (see below);
- Android system-back handling, app/universal links, haptics, status-bar styling, and splash control;
- connectivity monitoring with `@capacitor/network`; and
- a private no-cloud Filesystem snapshot. Existing `cloudPending` state is the offline write queue, and Supabase remains authoritative after reconnect.

Only the Supabase publishable/anon key is embedded. Never place a service-role key, Firebase service-account private key, APNs `.p8` key, release keystore, or signing password in the app bundle.

### Native voice capture

`window.SpeechRecognition` does not exist in Android WebView, so the old browser-only code always
failed in the APK with a generic microphone error even when `RECORD_AUDIO` was granted. The
installed apps now use [`@capgo/capacitor-speech-recognition`](https://github.com/Cap-go/capacitor-speech-recognition)
(Capacitor 8 compatible, `^8.4.4`) and the browser Web Speech API remains only as the PWA fallback.

- `src/speech.js` owns the session: availability check, on-demand permissions, streaming partials,
  exactly one terminal outcome (final transcript or one specific error), stop/cancel, and listener
  cleanup. It has no DOM or Capacitor imports, so `tests/speech.test.js` drives it with a fake plugin.
- `src/native.js` exposes it as `window.YERE_NATIVE.speech`; `toggleVoice()` in `index.html` picks the
  native path first and only falls back to `window.SpeechRecognition` when there is no native
  recognizer. Partials stream into `#quickInput` through the existing live parser, and the final
  transcript goes through the existing `openConfirmFromInput()` confirmation sheet. The mic animation
  (`#micBtn.listening`, `#micWave`) is unchanged, and tapping the mic again stops the session.
- Permissions are checked and requested **only** inside `start()`, i.e. after the user taps the mic.
  Nothing asks for the microphone at launch, which keeps the store privacy declarations honest.
- Android needs the `<queries>` block in `android/app/src/main/AndroidManifest.xml`:

  ```xml
  <queries>
      <intent>
          <action android:name="android.speech.RecognitionService" />
      </intent>
  </queries>
  ```

  Without it, Android 11+ package visibility hides the recognition service,
  `SpeechRecognizer.isRecognitionAvailable()` returns false, and the plugin rejects every session as
  unavailable. `RECORD_AUDIO` stays in the manifest; iOS keeps `NSMicrophoneUsageDescription` and
  `NSSpeechRecognitionUsageDescription` in `ios/App/App/Info.plist`.
- **No audio is retained.** Only transcript text reaches the app; nothing is written to the offline
  snapshot, Storage, or Supabase. Recognition runs through the OS recognizer (Google on Android,
  `SFSpeechRecognizer` on iOS), so device-level speech settings apply.
- Devices without Google speech services (some AOSP/China-market builds, emulators without Google
  APIs) have no recognizer at all. The app says so explicitly instead of failing silently.

`npm test` covers routing, permissions, partial/final transcripts, stopping, listener cleanup, and
error wording; CI additionally proves the plugin and manifest entries reached the APK
(`scripts/verify-native-voice.mjs`).

### Native Supabase auth and links

1. Apply every migration, including `202610150001_native_mobile.sql`, and deploy the `delete-account` Edge Function as well as the functions listed above.
2. Add these exact Supabase Auth redirect URLs (adjust preview hosts as needed):
   - `https://www.getyere.com/**`
   - `yere://**`
   - local and controlled Vercel preview URLs
3. In Supabase Auth, enable Apple only after creating the Apple service identifier/key and adding Supabase's callback URL in Apple Developer. Email/password remains available on both platforms.
4. For universal/app links, host the production `apple-app-site-association` and `assetlinks.json` files described in `docs/MOBILE_RELEASE.md`. Their team ID, certificate fingerprint, and package values cannot be placeholders.
5. The account-deletion control is under **Settings → Account & data**. App Store and Play submissions should not remove or hide it.

## 9. Native push setup

The `push_subscriptions` table supports three providers: Web Push, FCM on Android, and APNs on iOS. The official Capacitor push plugin returns an FCM registration token on Android and an APNs device token on iOS, so the shared `sendPush` server path selects the correct transport. Do not send an APNs token to FCM.

### Android / Firebase Cloud Messaging

1. Create a Firebase project and Android app whose package is exactly `com.getyere.app`.
2. Download `google-services.json` and put it at `android/app/google-services.json`. It is intentionally ignored by Git; provide it to CI through an encrypted secret if CI must produce a push-enabled build.
3. In Firebase **Project settings → Service accounts**, create a least-privilege service account that can send Firebase Cloud Messaging messages. Store these values as Supabase Edge Function secrets:

   ```bash
   npx supabase secrets set \
     FIREBASE_PROJECT_ID='your-project-id' \
     FIREBASE_CLIENT_EMAIL='firebase-adminsdk-...@your-project.iam.gserviceaccount.com' \
     FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
   ```

4. Keep the Android notification channel ID `yere_reminders`. `YereMessagingService` displays data-only high-priority messages with **Snooze 10 min**, **Done**, and **View** actions and forwards token/message events to the official Capacitor plugin.
5. Test on a physical device with Google Play services. An emulator without Play services cannot obtain an FCM token.

### iOS / Apple Push Notification service

1. In Apple Developer, create the `com.getyere.app` App ID and enable **Push Notifications**, **Associated Domains**, and **Sign in with Apple**.
2. Create an APNs `.p8` key and retain its key ID and your Apple team ID. Store the following as Supabase Edge Function secrets (never in Xcode source):

   ```bash
   npx supabase secrets set \
     APNS_KEY_ID='ABC123DEFG' \
     APNS_TEAM_ID='TEAMID1234' \
     APNS_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n' \
     APNS_BUNDLE_ID='com.getyere.app' \
     APNS_USE_SANDBOX='false'
   ```

3. Set `APNS_USE_SANDBOX=true` while testing a development-signed build. Set it to `false` for TestFlight/App Store device tokens. Do not mix sandbox and production tokens.
4. In Xcode, select the App target and your developer team. Confirm Push Notifications, Associated Domains, and Sign in with Apple appear under **Signing & Capabilities**. The checked-in entitlements use `development` for Debug and `production` for Release.
5. The `YERE_REMINDER` iOS category supplies Snooze, Done, and View actions. A normal notification tap opens the relevant reminder/snooze flow.

After changing native push secrets, redeploy both push-sending functions:

```bash
npx supabase functions deploy test-notification
npx supabase functions deploy dispatch-reminders --no-verify-jwt
```

Then sign in on a device, turn on push in Settings, confirm the native row in `push_subscriptions`, and use **Send a test notification**.

## 10. Android APK and Play release

### Debug APK

Prerequisites are Java 21 and an Android SDK containing API 36. From the repository root:

```bash
npm ci
npm run android:debug
```

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it with:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The GitHub workflow `.github/workflows/build-android.yml` runs tests, syncs Capacitor, builds the APK, creates a SHA-256 checksum, and uploads both as a 14-day Actions artifact on pushes, pull requests, and manual dispatches.

### Cloud-configured debug APK in GitHub Actions

The workflow `.github/workflows/build-android.yml` builds the APK that testers should install. Configure these **Repository variables** (Settings → Secrets and variables → Actions → **Variables** tab; they are public, browser-safe values):

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | **Yes** | `https://<project-ref>.supabase.co`. The job fails before building if it is missing or invalid. |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | The Supabase **publishable** (or legacy anon) key. The job rejects service-role and `sb_secret_` keys. |
| `VITE_PUBLIC_APP_URL` | Recommended | `https://www.getyere.com`. Defaults to that origin for native links. |
| `VITE_VAPID_PUBLIC_KEY` | Recommended | Same value as the Supabase `VAPID_PUBLIC_KEY` secret. Used for web push only. |

Optional **Repository secret** for Android push:

| Secret | Notes |
| --- | --- |
| `GOOGLE_SERVICES_JSON_B64` | Base64 of the Firebase **Android client** `google-services.json` for `com.getyere.app`. Create it locally and store it without printing it: `base64 -w0 android/app/google-services.json \| gh secret set GOOGLE_SERVICES_JSON_B64 --repo YungChuckTaylor/getyere`. Without it the APK still builds, the run summary says push is disabled, and Android push will not work. |

The pipeline runs in this order: validate configuration → tests → optional Firebase config (validated; service-account JSON is rejected) → `npm run build:native` → verify the built web assets contain the Supabase URL and no placeholder or server-only values → `cap sync` → verify synced assets → Gradle `assembleDebug` → verify the APK's bundled assets → SHA-256 → upload. A failed gate stops the run, so no APK is uploaded unless it is cloud-configured.

Never commit `google-services.json`, a Firebase service-account key, a signing keystore, or `keystore.properties`. The ignore rules block these files, and the workflow never uploads them.

### Signed Play bundle

Do not commit a keystore or `keystore.properties`. Generate and back up the release key outside Git, configure a local/CI Gradle signing config, then run:

```bash
npm run android:bundle
```

The bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`. Before upload, confirm the target SDK, 64-bit support, Data safety answers, privacy/support URLs, content rating, account-deletion URL/control, screenshots, and current Google Play testing requirements. New personal developer accounts may be required to complete a closed test (commonly 12 opted-in testers for 14 continuous days); use the exact requirement shown in that Play Console account.

## 11. iOS archive and App Store submission

A signed iOS archive requires macOS, the current App Store-supported Xcode (Xcode 26 or later for the current submission window), an Apple Developer membership, and access to the `com.getyere.app` identifier.

```bash
npm ci
npm run build:native   # cloud-configured native bundle (requires VITE_SUPABASE_* variables)
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select the **App** target, select the correct Team, keep bundle ID `com.getyere.app`, and confirm version `1.0` / build `1` (increment build for every upload).
2. Resolve Swift packages and test on a physical iPhone: sign-in, microphone prompt, offline launch/write/reconnect, attachment access, push registration/test/tap/actions, account deletion, and all safe-area layouts.
3. Confirm the 1024×1024 icon is opaque, the branded dark splash appears, `PrivacyInfo.xcprivacy` is in the target, privacy permission text is accurate, and Release uses the production APNs entitlement.
4. Choose **Any iOS Device (arm64)**, then **Product → Archive → Distribute App → App Store Connect → Upload**.
5. Use TestFlight for internal/external testing before submitting. Complete export-compliance, age-rating, App Privacy, and content-rights questions accurately.
6. Use `docs/MOBILE_RELEASE.md` for listing copy, review notes, screenshot plan, privacy-label guidance, and the final release checklist. Replace review-account placeholders with a functioning review account or an approved no-login review path.

The native app includes more than a web wrapper: native auth/token storage, push and actions, durable offline storage/sync, device connectivity, deep links, haptics, status/splash integration, and system back navigation. List these in App Review notes to address Guideline 4.2.

## 12. Mobile troubleshooting

- **Workflow fails at “Validate cloud configuration”:** add the missing repository variable(s) named in the log, then re-run. The log names the variable, never its value.
- **Installed app says “Yere can’t connect yet”:** this build was produced without a valid Supabase configuration. Install the APK from a successful cloud-configured run.
- **The app shows sample people such as Tunde or Amina:** that APK was built before this fix (it was a demo build). Uninstall it, then install the new artifact. The app now removes legacy demo storage on launch.
- **Sign-in works but reminders do not sync:** confirm the Supabase migrations and Edge Functions in the backend checklist below are deployed to the same project as `VITE_SUPABASE_URL`. Run `npm run verify:backend` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exported to get an itemised report.
- **Voice capture says the device has no speech recognition service:** on Android, confirm the `<queries>` block for `android.speech.RecognitionService` is still in the merged manifest (`npx cap sync android`, then rebuild) and that the device has Google speech services installed. Emulators without Google APIs have no recognizer.
- **Voice capture asks for the microphone every time or is blocked:** Android keeps `RECORD_AUDIO` denied after “Don’t ask again”; enable it under Settings → Apps → Yere → Permissions. iOS needs both the microphone and Speech Recognition prompts accepted, which requires the two usage strings in `Info.plist`.
- **Voice capture hears nothing or stops immediately:** check the connection (the default recognizers are network-backed), the device language model (`MODEL_DOWNLOAD_SCHEDULED` means the language pack is still downloading), and that no other app holds the microphone. Each case now reports its own message; none of them is a generic mic failure.

- **`Could not find installation of TypeScript`:** run `npm ci`; TypeScript is a checked-in development dependency required to read `capacitor.config.ts`.
- **Capacitor major-version mismatch:** all `@capacitor/*` and `@capgo/capacitor-supabase` packages must use major version 8. Run `npx cap doctor`, then `npx cap sync`.
- **Android asks for Java 21 or fails at `compileSdk`:** select JDK 21 and install Android SDK Platform 36 plus matching build tools. Do not lower SDK values to hide the error.
- **`google-services.json not found`:** debug compilation can succeed without it, but FCM registration cannot. Put the file at `android/app/google-services.json` and sync/rebuild.
- **Android token exists but messages do not arrive:** verify package/project alignment, FCM API/service-account permissions, all three Firebase secrets, notification permission, battery restrictions, and Edge Function logs.
- **iOS registration fails:** use a physical device, a profile with Push capability, matching bundle ID/team, and the correct APNs environment. Simulators are not a substitute for the final device test.
- **APNs `BadDeviceToken` or `DeviceTokenNotForTopic`:** verify sandbox vs production, bundle/topic, team/key IDs, and rebuild after changing signing. Invalid tokens are removed by the dispatch function.
- **Native auth works but database calls return 401:** inspect the native session and its mirrored `supabase-js` session, verify anon URL/key point to the same project, and do not disable RLS.
- **Everything returns 401 and `verify:backend` cannot confirm anything:** the public key itself is being rejected. `npm run build:native` and the Android workflow warn when `VITE_SUPABASE_ANON_KEY` is a legacy anon JWT whose `exp` claim has passed, and the backend report says so as a `MISSING` item. Copy the current publishable (or anon) key from Supabase → Project Settings → API into the GitHub repository variable, then re-run the workflow. A publishable `sb_publishable_...` key does not expire.
- **Offline edits do not sync:** leave the app open after connectivity returns, inspect `cloudPending` in the device WebView, verify `@capacitor/network` events, and check Supabase/RLS errors. Do not clear app data before recovering the private offline snapshot.
- **Deep/universal link opens a browser:** validate the hosted AASA/asset-links files over HTTPS with no redirect, signing team/fingerprint, entitlements/manifest, and Supabase redirect allowlist. The `yere://` custom scheme remains a fallback.
- **Xcode archive lacks capabilities:** select the real team and App ID, refresh profiles, ensure `App/App.entitlements` is the Code Signing Entitlements file, and verify the profile includes Push, Associated Domains, and Sign in with Apple.
- **Store review says “repackaged website”:** include the native functionality above in review notes and give the reviewer working steps for push actions, offline editing, deep links, account deletion, and native authentication.

## 13. Backend deployment checklist for the native apps

The native app uses the same Supabase project as the web app. Before testing a new APK against production, confirm each item in **Supabase → project for `VITE_SUPABASE_URL`**:

Run the automated read-only check first — it names exactly what is still missing:

```bash
export VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
export VITE_SUPABASE_ANON_KEY="<publishable/anon key>"
npm run verify:backend            # add --strict to exit non-zero on a confirmed gap
```

It reads each Yere table anonymously (`select=*&limit=1`: RLS returns zero rows, and PostgREST
answers `PGRST205`/`PGRST204` when a table or a column does not exist), which is how it confirms both
migrations — the native one through the `device_token`, `platform`, and `provider` columns it adds to
`push_subscriptions`. It probes each Edge Function with an empty unauthenticated POST that every
function rejects before touching data, reads `/auth/v1/settings`, and checks the attachment bucket.
The PostgREST root spec is not used: Supabase now restricts that endpoint to secret keys, which this
check never touches. It uses only the two public values
that are already in the client bundle, never writes, never prints the key, and reports anything it
could not confirm as *unknown* rather than guessing. Read-only GETs are sent with `apikey` plus a
bearer token and retried with `apikey` alone, because Supabase's gateway rejects a new
`sb_publishable_...` key presented as a JWT. An Edge Function that answers `404` is genuinely
undeployed, while its own `401` (`Sign in to ...`) means deployed and correctly refusing an anonymous
caller; a gateway `401` (`Missing JWT`, `JWT expired`) is reported as *unconfirmed* rather than as
either. Because `yere-attachments` is a private bucket, Storage answers `Bucket not found` to an
anonymous caller, so that one line always needs a signed-in confirmation. The Android workflow runs the same check on every
build and publishes the result in the run summary (non-blocking, so a backend gap never stops an
otherwise valid APK). Set `YERE_SKIP_BACKEND_CHECK=1` to skip it.

1. **Migrations applied, in order:** `202610120001_yere_core.sql`, then `202610150001_native_mobile.sql` (`npx supabase db push` or the SQL editor). The native migration adds the native push-token RPC `register_native_push_token`, the `detach_deleted_yere_user` account cleanup, and the provider constraint for `webpush`, `fcm`, and `apns`.
2. **Edge Functions deployed:** `create-contact-invite`, `redeem-contact-invite`, `revoke-contact-invite`, `create-delegated-reminder`, `test-notification`, `delete-account` (required by Settings → Account & data), and `dispatch-reminders` (`--no-verify-jwt`).
3. **Auth settings:** email/password enabled; Site URL `https://www.getyere.com`; redirect URLs include `yere://**` and `https://www.getyere.com/**`.
4. **Cron:** run `supabase/schedule-reminders.sql.example` after replacing its placeholders, so reminders are dispatched every minute.
5. **Edge Function secrets:** `PUBLIC_APP_URL`, `YERE_CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and for Android push `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. For iOS push, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_USE_SANDBOX`.
6. **Smoke test on a device:** create an account from the APK, confirm the email if required, create a reminder, toggle airplane mode, edit a reminder, reconnect, and confirm the change appears on the web app.
7. **Voice capture on a device:** tap the mic, allow the microphone prompt, say “Call Aunty tomorrow at 4pm”, watch the words stream into the field, and confirm the reminder sheet opens. Tap the mic mid-sentence to stop and confirm the captured text is offered. Then test one failure path (airplane mode, or a denied permission) and check the message names the real cause.
8. **Re-run `npm run verify:backend` after deploying anything.** A report with no `MISSING` lines means the project matches what the APK expects.

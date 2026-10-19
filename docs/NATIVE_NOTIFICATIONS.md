# Native notification activation and verification

Package/bundle: **`com.getyere.app`**. Reuse the existing Firebase project, Apple Developer account,
Supabase project and shared Capacitor application. No new backend or demo build is needed.

## Code changes and limits

- iOS AppDelegate forwards APNs registration success/failure to Capacitor. Done/Snooze/View
  foreground the app; mutations run only after authentication and account reminder restoration.
  These are **not silent background mutations**.
- Notification actions are queued, account-bound, deduplicated and dismissals ignored. A button
  from an older occurrence cannot mutate a reminder that has since been rescheduled. Snooze
  continues to add to the reminder's **scheduled time**, not the phone's current time.
- Device opt-out and logout serialize server token removal against token refresh. Logout also
  clears delivered notifications where the OS permits; in-flight provider deliveries cannot be recalled.
- Tests target **this device's token/browser endpoint**, never every device on the account.
  `accepted=true` means FCM/APNs/Web Push accepted the request, **not** observed phone delivery.
- Dispatcher claims are atomic, service-only and leased for five minutes. It catches up up to
  **one hour**, with at most **three attempts** (one minute then five minute backoff).
  Each accepted target/email is checkpointed, so routine partial retries skip successes.
  Existing pre-migration fires are not automatically replayed.
- Delivery is **at least once**, not exactly once: if a provider accepts a request and a worker
  dies before the checkpoint, a retry can repeat it. Stable notification tags replace duplicates
  where supported; reminder emails use a stable Resend idempotency key. All deliveries still
  depend on network, provider/OS restrictions, Focus settings and notification permission.
- APNs uses an explicit HTTP/2 client. Push text is shortened to fit provider payload limits;
  full notes remain in the reminder. Provider queue TTL is one hour.
- Only explicit Web Push 404/410, FCM `UNREGISTERED`, and APNs 410 `Unregistered` retire a target.
  `BadDeviceToken`, topic/environment mismatch, OAuth and expired-provider-token errors do not
  delete registrations.

## Backend rollout (maintainer)

Apply **only** `supabase/migrations/20261019180536_notification_delivery_retries.sql`, then deploy
both functions from the same tested revision:

```sh
npx supabase functions deploy test-notification --project-ref nttspzlszckaxjsjdlqi
npx supabase functions deploy dispatch-reminders --project-ref nttspzlszckaxjsjdlqi --no-verify-jwt
```

`test-notification` retains user JWT verification. `dispatch-reminders` retains its constant-time
`x-yere-cron-secret` check. Do not create another scheduler: the existing
`yere-reminder-dispatch` job already runs every minute. Never paste its command or secret into
chat/logs. Do not broadly replay historical migrations to reconcile unrelated migration-history gaps.
Deploy the matching web client, and rebuild both native apps: older clients send untargeted test
requests, which are deliberately rejected with a request to enable/update this device's registration.

The new claim RPC must be executable by `service_role` only. No token column should be exposed
through an anonymous browser query. The native registration RPC now upserts a stable target ID on token refresh/account reassignment;
its authenticated-only access and owner RLS stay in place.
After rollout, confirm recent cron executions **and** dispatcher HTTP status/function logs; a successful
cron SQL command alone is not proof that its HTTP request or downstream push succeeded.

## 1. Android activation — account owner

### A. Android client configuration → GitHub

1. Firebase Console → existing Yere project → **Project settings → General → Your apps**.
2. Select Android app **`com.getyere.app`**, download **`google-services.json`**.
   Do not download a service-account key for this step.
3. On your own computer, base64-encode the file without line wrapping. This produces an encoded
   client configuration; base64 is **not encryption**. Paste it only into GitHub's encrypted secret UI.
   Do not paste it in chat or commit it. Example on macOS/Linux:

   ```sh
   base64 < google-services.json | tr -d '\n'
   ```

4. Repository **YungChuckTaylor/getyere → Settings → Secrets and variables → Actions → Secrets →
   New repository secret**. Name: **`GOOGLE_SERVICES_JSON_B64`**. Paste the encoded value and save.
5. Keep the existing public `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` Actions variables.
   Do not substitute a Supabase service-role key or put sender credentials in any `VITE_*` value.

Local Android builds may use the ignored `android/app/google-services.json`. CI validates that this
is an Android client file for the right package and rejects private service-account keys.

### B. Sender configuration → Supabase only

1. Ensure the **Firebase Cloud Messaging API (HTTP v1)** is enabled for the same Firebase project.
2. Use a dedicated service account permitted to send FCM messages (for example, the Firebase Cloud
   Messaging API Admin role; do not grant Owner/Editor merely to make delivery work).
3. Obtain a service-account JSON key through your authorized Google Cloud/Firebase account.
   Store it securely on your computer, never in GitHub source, app assets or chat.
4. Supabase Dashboard → existing production **getyere** project
   (`nttspzlszckaxjsjdlqi`) → **Edge Functions → Secrets**. Add:

   | Secret | Value from service-account JSON |
   |---|---|
   | `FIREBASE_PROJECT_ID` | `project_id` — must match the Android client project |
   | `FIREBASE_CLIENT_EMAIL` | `client_email` |
   | `FIREBASE_PRIVATE_KEY` | complete `private_key`, including PEM header/footer/newlines |

5. The sender accepts actual PEM newlines or literal `\n` escapes. Never remove the PEM header/footer.
   Redeploy the two functions after changing sender secrets so their cached credentials are refreshed.

### C. Produce the activation APK

1. GitHub → **Actions → Build Android APK → Run workflow**.
2. Select **`arena/52983cf7-getyere`** and leave **`require_android_push` checked**.
   This explicitly fails if the client config secret is missing; do not bypass it for push verification.
   Ordinary push/PR builds may still compile with a prominent push-disabled warning before activation.
3. Confirm the run summary says **Firebase / Android push config: installed**, all tests pass,
   and the APK/cloud/native-voice checks pass. Download the APK artifact for this exact revision.
4. Install/update on a real Android phone with Google Play services. If an earlier APK was signed
   with a different debug key, Android may require uninstall/reinstall; save/sync changes first.
   This debug artifact is for testing, not a signed Play Store release.
5. Sign in → Settings → enable push → allow Android notification permission → send a test.
   The toast reports provider acceptance; **confirm an actual notification appeared**.
6. The backend should now contain an `android` / `fcm` registration for that signed-in account.
   Check by platform/count, not by copying device tokens into screenshots/chat.
7. Complete the acceptance matrix below before declaring Android activation finished.

## 2. iOS / TestFlight — account owner

### A. Apple/APNs configuration

1. Apple Developer → Identifiers → existing **`com.getyere.app`** → enable/confirm **Push Notifications**.
2. Use an APNs authentication key authorized for this app/topic and **production** environment.
   Record its **Key ID** and your **Team ID**. Keep the downloaded `.p8` key securely; do not
   commit it, place it in the app bundle, or paste it into chat.
3. Supabase production → Edge Functions → Secrets:

   | Secret | Value |
   |---|---|
   | `APNS_KEY_ID` | APNs authentication key ID |
   | `APNS_TEAM_ID` | Apple Developer Team ID |
   | `APNS_PRIVATE_KEY` | complete contents of the `.p8` PEM key |
   | `APNS_BUNDLE_ID` | `com.getyere.app` |
   | `APNS_USE_SANDBOX` | `false` for TestFlight/App Store |

4. Redeploy both sender functions after changing secrets. **TestFlight uses production APNs even
   for internal testers.** Do not toggle production to sandbox for an Xcode Debug build: use the
   existing staging backend with sandbox secrets (`APNS_USE_SANDBOX=true`) for development-signed
   devices, or test production using TestFlight. This implementation uses one APNs environment per
   backend; mixing development and production tokens in that backend is unsupported.

### B. Build/archive on your Mac

From this exact branch/revision, with the existing browser-safe production `VITE_*` configuration
loaded securely into the shell or an ignored local environment file:

```sh
npm ci
npm test
npm run build:native
npx cap sync ios
npx cap open ios
```

1. Use your current App Store-supported Xcode. Select **App** target → your Team → bundle ID
   **`com.getyere.app`**. Keep the existing shared UI/auth/speech implementation.
2. In **Signing & Capabilities**, verify **Push Notifications** and the existing **Background Modes →
   Remote notifications**, plus the existing associated-domain/sign-in entitlements as appropriate.
3. Refresh signing/provisioning after enabling Push. Confirm Release signing contains the
   **production `aps-environment`** entitlement, not only that the source plist mentions it.
4. Increment the build number for every App Store Connect upload; select a Release archive scheme.
5. **Product → Archive → Distribute App → App Store Connect → Upload**.
6. App Store Connect → Yere → TestFlight: wait for processing, answer export-compliance prompts,
   add internal testers, and install using the TestFlight app on a physical iPhone.
   External testing may require Apple's beta review.

### C. Verify on the TestFlight iPhone

1. Sign in, enable push and grant notification permission.
2. Confirm an `ios` / `apns` registration now exists on the intended backend.
3. Send a test from **that iPhone**; confirm its actual banner/Notification Center entry.
4. Create a reminder due in 3–5 minutes with push enabled. Leave the app in the background/lock
   the phone and confirm the scheduled notification. The minutely scheduler is not an exact alarm.
5. Tap View, Done and Snooze on separate reminder occurrences. Done/Snooze **open Yere** and
   wait for sign-in/data restoration. Confirm the resulting change syncs to the web account.
   A 10-minute snooze adds ten minutes to the occurrence's scheduled time, not tap time.
6. Complete the matrix below. Record build number, OS version, app state and observation,
   without private tokens/keys or reminder contents in shared diagnostics.

## Acceptance matrix (both platforms)

| Check | Pass condition |
|---|---|
| Foreground | Notification appears once; no duplicate reminder mutation |
| Background + locked | Alert appears; tap restores the correct reminder |
| Normally terminated | Alert/tap/actions work after cold launch and account restoration |
| Done | Correct occurrence completed once; repeat tap does not undo completion |
| Snooze 10 min | Scheduled time + 10 minutes, once, synced to web |
| Stale notification | Old buttons cannot mutate a rescheduled occurrence |
| Dismiss | No reminder opened or changed |
| Permission denied/off | Clear UI; no false success; no token re-enrollment from refresh after opt-out |
| Sign-out/account switch | Old registration removed/reassigned safely; old account action cannot affect new account |
| Reinstall/token rotation | Re-enable push; refreshed token reaches correct account |
| Multiple devices | Each device test tests only itself; successful targets not routinely retried |
| Temporary provider/network failure | Bounded retry/backoff; failures visible with attempt number |
| Browser/PWA regression | Current browser-targeted test and normal Web Push still work |

Android Force Stop, vendor battery restrictions, iOS Focus/notification summaries, an offline phone,
and provider outages can delay/prevent alerts. This work does not implement offline exact local alarms.
Do not mark the module verified solely from passing tests, a green APK build, a cron heartbeat or a
provider-acceptance response. Physical-device observations are the release gate.

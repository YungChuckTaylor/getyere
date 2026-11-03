# Yere native notification follow-up — 3 November 2026

## Release status — not yet certified on store-installed devices

Source changes are implemented and pushed on `arena/8b4b1ec0-getyere`. The production **test-notification** endpoint was updated to **ACTIVE v19**, retaining JWT verification, owner/device scoping and the five-per-minute rate limit. It now distinguishes missing sender configuration, unusable signing credentials and unavailable APNs transport without returning private values. **This diagnostic deployment does not supply the missing credentials or prove delivery.**

The Android/iOS native changes and default-on behavior require replacement signed store builds. No APK/AAB/IPA was generated or uploaded. No database migration, credential change, dispatcher deployment, cron change, Yere website deployment or Maple change was made in this follow-up. The dispatcher remains on its existing v18.

## Current evidence

- The supplied iOS screenshot shows the old generic configuration/network failure and an enabled preference. That old UI inferred “granted” from its preference, so the label alone was not reliable evidence of OS permission or delivery.
- The expected production backend (`nttspzlszckaxjsjdlqi`) now has **one iOS/APNs registration**, latest `2026-10-30 23:40:40.387219+00`, in addition to one Android/FCM and three web/Web Push registrations. This supersedes the zero-iOS count in the 29 October audit; it does not identify a particular installed build/token.
- Production still has **none** of `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`. Their absence is a definite sender blocker on this backend. Firebase sender names exist, but their values/project authorization were not inspected.
- The exact Play/TestFlight build numbers, signed artifacts, embedded backend targets and Android crash stack have not been supplied. The Android Firebase initialization vulnerability identified earlier is still a source-supported candidate, **not a device-confirmed crash diagnosis**.

## What changed

1. **Default on, consent-aware:** native devices/accounts without a saved choice now start with push enabled and automatically prepare registration after sign-in, including offline-cache startup. The OS permission dialog remains mandatory when required. Every existing saved off choice, including legacy `0` values, is preserved. Browser/PWA permission behavior is unchanged.
2. **No permission fiction:** the UI separately reports the preference, measured OS permission, and whether device registration was saved. Registration and provider acceptance are never described as verified phone delivery. Server failures stay visible in Settings instead of only disappearing in a toast.
3. **No repeated automatic prompting:** automatic setup asks once; a dismissed/denied/rationale prompt requires an explicit retry. Resume/reconnect can refresh registration after permission is granted but cannot override an off choice.
4. **Safe setup/testing:** registration is single-flight. A test waits for a fresh device registration rather than sending a cached token; rapid taps issue only one request. Native/registration/network/server failures are caught. Setup, test results, slow error-body parsing and opt-out cleanup are guarded against logout/account changes. A transient setup failure does not silently store an off preference. Token-refresh events re-check actual OS permission before saving; a default-on preference alone cannot authorize registration.
5. **Respect off during failures:** opting out cancels pending setup, saves off immediately and attempts both server removal and native token deletion. Failed cleanup does not re-enable push; it warns the user to disable OS notifications while cleanup is incomplete. No software can recall an already in-flight delivery.
6. **Android native guards:** the app-owned plugin retains the previous guarded Firebase register/unregister paths and now also guards synchronous permission/channel failures. On pre-Android-13 devices, permission checks reflect the app's OS notification setting rather than always claiming granted. The previous fail-closed Firebase release checks remain required.
7. **Release-only validation:** the manual Android workflow has a `release_check_only=true` path that compiles Release Java/resources, runs release unit tests and negatively checks the missing-Firebase release gate. All APK assembly/verification/checksum/upload steps are excluded in this mode. It is now the manual default; no workflow runs automatically on push.

## Checks actually completed

- **326 automated tests passed**, zero failed/skipped. This includes real shared-controller/UI functions with mocked native/backend adapters and the prior account-isolation, notification action, retry, legal, browser and configuration regressions.
- Browser production build and full inline-script syntax check passed.
- Local Chromium visual/layout checks at **320, 390, 768 and 1440 px** passed without horizontal overflow or runtime exceptions. The persistent server-error UI was visually inspected at 390 px. This used a synthetic local browser/native-status simulation, not an actual iPhone or live user account.
- The exact compiled single-file test-endpoint bundle passed isolated smoke checks for anonymous rejection and missing-APNs classification, with zero provider sends and no token/private-value leakage in responses. Real HTTP v1/APNs delivery was not tested.
- Java grammar check passed. **Android API compilation was not performed locally:** JDK/SDK/Xcode/device tools are absent.
- Attempted the release-only CI dispatch with `gh workflow run build-android.yml --ref arena/8b4b1ec0-getyere -f release_check_only=true`. GitHub rejected it with **HTTP 403, Resource not accessible by integration**. No run was created and no APK was built. The GitHub connection needs Actions-write access/reconnection, or an authorized build operator must run the check. Do not describe this as a successful release compile.

## Required secure iOS setup — account owner

In the existing production Supabase project's **Edge Functions → Secrets**, add:

| Name | Value / requirement |
|---|---|
| `APNS_TEAM_ID` | Apple Developer Team ID, not App Store Connect Issuer ID |
| `APNS_KEY_ID` | ID of an authorized Apple Push Notifications authentication key |
| `APNS_PRIVATE_KEY` | Complete `.p8` PEM contents, including header/footer and newlines |
| `APNS_BUNDLE_ID` | `com.getyere.app` |
| `APNS_USE_SANDBOX` | `false` for TestFlight and App Store |

Use an **APNs authentication key** authorized for production and this topic, not an App Store Connect API/upload key merely because it also has a `.p8` extension. Obtain/configure it through the client's own Apple account. **Do not paste private keys in chat, commit them, put them in `VITE_*` values or package them into the app. No Apple account access is requested.**

After securely installing the settings, redeploy/restart the two notification functions through the existing maintainer path so cached credentials are refreshed. Preserve `test-notification` JWT verification and the dispatcher's existing cron-secret authentication; do not create another scheduler or replay migrations. Existing deployment instructions are in `NATIVE_NOTIFICATIONS.md`.

A correctly signed, already-registered TestFlight build may deliver after this server setup, but actual receipt must be observed. The default-on/UI/native-hardening changes still need a new native build.

## Required Android/store release work — build operator

1. Use the updated fixed branch (native-default source commit `20bd631` plus its follow-up race fixes), record the exact final SHA and next unused Play versionCode / TestFlight build number. Do not reuse the currently installed old binary or assume a website update changes its Java/Swift code.
2. Install the ignored Android **client** `google-services.json` for `com.getyere.app` via the protected `GOOGLE_SERVICES_JSON_B64` path before Gradle runs. It must match the same Firebase project/sender as production. Never substitute a Firebase service-account key.
3. With an authorized GitHub connection, run the release-only check using the explicit command above. Confirm the selected branch/input and that the summary says **no APK built/uploaded**. If the input is unavailable, update/review the workflow definition through the normal process; do not fall back to producing another debug APK.
4. Use the client's existing private signing pipeline to build/sync/sign Release AAB and iOS archive. Keep client-owned signing identities/keys private. Validate Android compiled Firebase resources and the actual signed iOS `aps-environment=production` entitlement, bundle/topic and provisioning.
5. Verify the final AAB/IPA embedded public backend configuration against the intended production environment with `scripts/verify-bundle.mjs`. This static check does not validate native signatures, provider authorization or delivery.
6. Upload to the existing Play test track/TestFlight, install from the stores, sign in, allow the OS permission and confirm device registration. Observe a device-targeted test notification and a new scheduled reminder in foreground/background/locked/ordinary cold-launch states. Verify Done/Snooze, off/denial, sign-out/account switch and token rotation using `NATIVE_NOTIFICATIONS.md`.

## Needed to finish diagnosis and acceptance

- Play version/build number, phone model/Android version and the affected release's crash stack (Play Console Android vitals or package-filtered Logcat), including the exception and `Caused by` lines. Redact personal data/tokens.
- TestFlight version/build number and iPhone/iOS version; confirmation that APNs setup is complete in the intended backend.
- Observed delivery from the replacement signed store builds. Provider acceptance, green JavaScript tests, Java grammar parsing and cron presence are not substitutes.

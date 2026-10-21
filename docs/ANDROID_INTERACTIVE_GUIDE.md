# Android owner handoff and status review

Public URL: **https://getyere.com/android-guide.html**. This is a real static file in
`public/`, served directly by Vite/Vercel; no account connections or new backend are involved.

## Evidence reviewed on 21 October 2026

- Owner reports that the downloaded debug Android app worked perfectly on their phone.
  Exact installed build, phone/OS and a per-scenario test matrix have not been supplied.
  Record this as user-reported debug success, not independently observed release acceptance.
- Previously delivered run **39315019610**, source **4d48c3562541f0f1eaf9fd8bd7c56c44cef1af5d**,
  succeeded with Firebase configuration. Latest reviewed run **39682296145**, source
  **1b5dcff8fcb67053adf454f419baf438f2fe3c3b**, succeeded including cloud/native-voice/APK checks.
  Its debug artifact **12384707917** was unexpired at review. No new APK was dispatched for this guide.
- `android/app/src/main/java/com/getyere/app/YereMessagingService.java` implements FCM alerts
  and foregrounding actions; `src/notification-intents.js` gates mutations on restored account data.
- Android package `com.getyere.app`; SDK min 26 / compile and target 36; Java 21;
  checked-in versionName 1.0 / versionCode 1. Inspect the actual source before the next upload.
- `android/app/build.gradle` has **no release signingConfig**. The existing Actions workflow
  assembles **debug APKs**, not signed Play AABs. The guide uses Android Studio's signed-bundle
  wizard or an engineer-configured protected signing path; it does not claim to add that pipeline.
- Signed Play release, Play app-signing certificate integrations, Play-installed testing,
  Console production access, listing, deletion resource, review and publication remain unverified.
- No fresh Supabase secret values or device tokens were read. Current GitHub secret inventory
  could not be independently listed (integration permission); do not infer credentials from that.
  Existing CI evidence / owner report is not a fresh credential audit.

## Structure and behavior

`public/android-guide.js` contains eight stages / 36 checks: status, accounts/tools, source +
Firebase, signing, signed AAB, Play testing, listing/privacy/reviewer access, review/publication.
The standalone page follows the iOS guide's behavior and reuses `public/ios-guide.css` for visual
consistency, without changing the iOS guide or shared application UI.

- Separate localStorage key `yere.android-launch-guide.v1`; no cross-device sync or credential data.
- Validated task IDs, empty initial checklist, deep links, reversible checkboxes, progress and reset confirmation.
- Blocked/corrupt storage fallback, clipboard copy/manual selection, troubleshooting and glossary.
- Print / PDF includes every stage, expanded troubleshooting and glossary; it is not just a screenshot
  of the current stage. Final checklist review returns to the first incomplete stage.
- Both handbooks are excluded from native output by `webOnlyHandbook` in `vite.config.js`.
  Native credential guards remain strict; no release-documentation assets or secret-name prose
  are shipped inside the mobile applications.
- `noindex` is not access control. Do not add private release notes, account data or credentials.
- Public page and build instructions never ask to create another Firebase/Supabase project,
  replay migrations, or produce a demo APK. Keep the existing working configuration.

## Verification / maintenance

Run `npm test`, `npm run build` and `git diff --check`. Browser-check desktop/mobile navigation,
progress persistence, platform storage isolation, reset, copy/fallback, deep links, all-stage print,
and blocked storage. Keep stage/task IDs stable or version storage when semantics change.
The native cloud build test also asserts that Android/iOS handbook assets are absent.

Source references: `docs/NATIVE_NOTIFICATIONS.md`, `docs/MOBILE_RELEASE.md`, `DEPLOYMENT.md`,
Android Gradle/manifest/native notification source, and the reviewed GitHub runs. Older narrative
rollout notes (missing Firebase / older branch names) are historical, not instructions to undo the
working deployment. Google policy links are provided inline. Testing requirements can vary by
account and date: follow the current Play Console dashboard and linked official help. The page
never guarantees approval or independently verifies completion.

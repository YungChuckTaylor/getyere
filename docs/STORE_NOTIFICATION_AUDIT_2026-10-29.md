# Store-test notification investigation — 29 October 2026

## Status: source hardening complete; store-device verification still blocked

The reported Android crash has **not** been reproduced on a physical device. No submitted APK/AAB/IPA, Android crash trace, store version/build numbers, or exact submitted source revision were available. No Android SDK/JDK/Xcode/device tooling is installed in this workspace. Neither the actual store Firebase resources nor the signed iOS entitlements have been inspected. Do not call the store issue resolved until the gates below pass.

No new debug APK, signed store build, CI run, production deployment, database change or credential change was made during this investigation. Existing Maple Dominion and Yere hosting are unchanged. All production investigation was read-only and used counts/redacted classifications, not raw user tokens or reminder contents.

## Evidence and confidence

| Finding | Evidence / interpretation |
|---|---|
| Android release could omit Firebase setup | The previous `android/app/build.gradle` applied Google Services only if its file existed, and swallowed plugin exceptions. A successful native build therefore did not prove Firebase resources were present. **Confirmed source defect.** |
| Enabling push could throw out of Capacitor | The installed official plugin calls `FirebaseMessaging.getInstance()` during register/unregister without a native guard. Capacitor rethrows plugin invocation exceptions as `RuntimeException` on its worker. Missing default Firebase initialization can therefore terminate the process rather than return a catchable JavaScript error. **Confirmed source vulnerability; missing configuration in the submitted app remains a hypothesis.** |
| Debug success does not validate a store build | Different source revisions, ignored client configuration files, public backend environment values, signing/provisioning and fresh device tokens can differ. Release minification is currently disabled, so R8 removal is not the leading source-based explanation. **Actual build inputs need comparison.** |
| iOS sender configuration is incomplete | Existing production project `nttspzlszckaxjsjdlqi` lists no `APNS_TEAM_ID`, `APNS_KEY_ID` or `APNS_PRIVATE_KEY`. The repository APNs sender requires all three. **Confirmed for this backend, conditional on the store app actually targeting it.** |
| iOS registration is also missing | Production has zero `ios` registrations. Missing APNs server credentials prevents sending, but does **not** explain why a phone has not registered a token; signing, permissions, initialization and the actual embedded backend must be checked separately. |
| Existing subscription counts | One Android/FCM registration and three web/Web Push registrations; zero iOS. Latest Android registration: `2026-10-29 05:52:34.802684+00`. This does not identify the Android registration as the store installation rather than debug. |
| Most recent failed pushes never reached a provider | In the queried preceding seven days: 12 failed push records were `No active push subscription`; one additional failed push was an FCM provider error, previously classified as `UNREGISTERED`. A retired token can require re-registration; these aggregates are not proof of delivery on a particular phone. |
| Scheduler is not absent | Production is healthy; `yere-reminder-dispatch` is active every minute. `test-notification` and `dispatch-reminders` report ACTIVE v18. Cron presence and provider acceptance are not proof of phone delivery. |
| Firebase sender secret names exist | The three Firebase sender names are present. Their values, API permissions and project match were **not** inspected or verified. |
| iOS source entitlement/environment is appropriate | Source uses Debug `development` / Release `production`, `com.getyere.app`, and forwards APNs registration success/failure to Capacitor. Sender defaults to production APNs. **Signed distribution entitlements remain unverified. TestFlight requires production APNs.** |

## Changes made

1. **Native Android guard:** `YerePushNotificationsPlugin` subclasses the official plugin under its existing `PushNotifications` ID. It retains the permission alias and inherited permission/channel/action APIs. Registration checks Firebase options and Google Play services, catches synchronous Firebase runtime failures and returns a rejected bridge call instead of an uncaught Java exception. Asynchronous token failures emit a registration error. Unregister handles missing Firebase safely and waits for token deletion success/failure. Error messages do not expose tokens or provider exception contents.
2. **Bridge integration:** `MainActivity.load()` adds the same-ID subclass after discovered plugins and before bridge creation. Registration order, inherited permission callback lookup and inherited public plugin methods were reviewed against the installed Capacitor 8 source. This still needs a real Android compile/device test; Java grammar validation is not Android API type checking.
3. **Fail-closed release configuration:** Gradle release pre-build tasks require the client file and check the application package, project ID/number, Android mobile app ID/sender consistency and API key presence. Google Services plugin exceptions are no longer swallowed. `google-services.json` remains ignored; it must never be committed.
4. **Stronger client JSON validation:** the Node validator checks those FCM initialization fields as well as rejecting service-account/private-key material. These checks validate structure/consistency, **not** API key validity or sender authorization.
5. **Registration lifecycle:** the shared bridge installs push listeners before registration even if full native startup is incomplete. Setup is single-flight, cleans up partial installation and can retry. A valid live token resolves the registration handshake before preference caching; a failed/hung cache cannot force a timeout. Empty tokens reject registration.
6. **CI safety:** the existing debug APK workflow is manual-only. It now stops when Firebase configuration is absent rather than uploading a push-disabled APK. No workflow was dispatched and no new APK was produced.
7. **Submitted artifact checks:** `verify-bundle.mjs` now accepts AAB/IPA as well as APK/directory inputs, so the actual release's embedded web configuration can be checked against expected public production values. This is not a check of compiled Firebase resources, signatures, iOS entitlements, live connectivity or push delivery.

## Checks executed

- `npm test`: **301 tests passed**, zero failed/skipped, after the final workflow syntax regression check was added.
- `npm run build`: browser production compilation passed. This is **not** a signed native build or a production-configured native release validation.
- Missing-cloud negative check: `npm run build:native` with both required public values blank exited **1**, with the expected refusal before Vite/native packaging.
- Java grammar parsing passed for `MainActivity.java` and `YerePushNotificationsPlugin.java` using a temporary parser outside the repository. **No native compilation was performed.**
- Tests cover Firebase client schema/sender mismatch; release gate source wiring; native plugin registration/permission source contracts; real shared-bridge registration with mocked Capacitor calls; early/concurrent setup; partial listener cleanup/retry; token-cache failure/hang; native/provider rejection cleanup; empty tokens; permission denial; APNs production default/missing credentials; and synthetic APK/AAB/IPA ZIP web-asset verification. Synthetic archive fixtures are not actual app builds and are removed after each test.
- All workflow multiline shell blocks pass `bash -n`; Firebase setup cannot continue when configuration is absent.
- Existing notification/account isolation/action/retry/browser regression suites pass. No physical notification delivery is implied by these results.

## Needed from the account owner/build operator

1. **Both store version/build numbers** and exact build source SHA/build service/procedure. Also identify the working debug build for comparison. Do not send signing keys or account access.
2. **Android phone model and Android version**, plus the crash block from Android Studio Logcat filtered to `package:com.getyere.app`, or Play Console Android Vitals for the affected release. Include the exception and `Caused by` lines; redact personal data/tokens. Record whether the crash occurred before/after granting permission. An APK/AAB for private inspection is useful; no keystore is needed.
3. **iPhone model/iOS version** and whether enabling notifications grants permission, shows an error or times out. A Release archive/IPA or locally checked signed entitlement report is useful. On the client's Mac, inspect the signed `.app` with `codesign -d --entitlements :- /path/to/App.app`: confirm production `aps-environment`, correct application identifier and Push-enabled distribution signing.
4. Configure the missing APNs values **directly in the existing production Supabase secret UI**, using the client's existing authorized production APNs key. Keep `.p8`/PEM content, keys and signing credentials out of chat, source and client bundles. Full secure instructions are in [NATIVE_NOTIFICATIONS.md](NATIVE_NOTIFICATIONS.md). No Apple account access is requested. Do not change production to sandbox because the app is in TestFlight.
5. Compare the Android release Firebase **project ID, project number, mobile app ID and package** locally against Firebase Console and the production sender's project. Ensure FCM HTTP v1 is enabled and the sender is authorized. API-key restrictions/App Check/Play signing certificates should be checked if a token-registration trace points there; changing SHA fingerprints is not a universal FCM fix.

## Replacement-store-build and acceptance gates

- Commit/push this source to the fixed working branch before the client's release pipeline consumes it; record the exact SHA. Do not build from a stale remote revision.
- Use the existing client-owned signing/upload paths and next unused store build numbers. Do not change signing identity, expose keys, create another backend or substitute a demo APK.
- Build native web assets with the expected public production `VITE_*` values, synchronize the relevant Capacitor platform, compile and sign Release. Android must include the validated ignored Firebase client file before Gradle runs. The client's Mac must refresh iOS provisioning after enabling Push if needed.
- With the same expected public environment loaded securely, run `node scripts/verify-bundle.mjs path/to/release.aab` / `path/to/release.ipa`. Separately inspect Android generated release Firebase resources and signed iOS production entitlements. Require actual release compilation, not only Java grammar/source assertions.
- Upload corrected builds to the existing Play test track/TestFlight and install from those stores. An older installed native binary is not fixed by a website deployment. A backend credential change can help an otherwise correct registered iOS app, but is not a substitute for verifying the existing binary.
- On each signed-in device: enable notifications, confirm the correct platform/provider registration on the intended backend without sharing token values, send a device-targeted test, and **observe the notification**. If registration fails, capture that error before chasing scheduled delivery.
- Test foreground, background/locked, ordinary terminated/cold launch, View/Done/Snooze, permission denial, opt-out, logout/account switch, reinstall/token rotation and multiple devices using the matrix in `NATIVE_NOTIFICATIONS.md`.
- Schedule a new reminder 3–5 minutes ahead with push enabled. Confirm the actual alert and action result. The minutely cloud scheduler is not an exact alarm; Android Force Stop, Focus modes, battery/network restrictions and OS delivery policy can suppress/delay delivery.

**Release decision:** pending crash evidence, actual release compilation/artifact inspection, client-owned APNs setup and observed store-installed device tests. Source/static/mock tests cannot certify either store binary.

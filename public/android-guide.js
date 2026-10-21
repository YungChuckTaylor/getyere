/* Standalone handbook. No account connections, credential inputs, analytics or backend calls. */
export const STORAGE_KEY = 'yere.android-launch-guide.v1';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const external = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
const publicEnvironment = 'set -a\nsource .env.local\nset +a\n';
const command = text => `<div class="command"><pre><code>${escape(text)}</code></pre><button class="copy-button" type="button" aria-label="Copy command">Copy</button></div>`;
const note = (title, text, kind = '') => `<div class="callout ${kind}"><strong>${title}</strong>${text}</div>`;
export const stages = [
  {
    id: 'status', short: 'Know the status', title: 'Start from what already works', owner: 'App owner',
    description: 'Your debug-phone test passed. The next milestone is a Google Play release—not a rebuild.',
    content: `<p><strong>You reported that the downloaded debug Android app worked perfectly on your phone.</strong> That is a successful user-reported debug test. The phone model, Android version, exact installed build and individual test results have not yet been recorded here.</p>
      <h3>Android status review · 21 October 2026</h3><table class="status-table"><thead><tr><th>Part</th><th>Evidence / next step</th></tr></thead><tbody>
      <tr><td>Existing Android app</td><td>Capacitor project, native voice recognition, FCM notification service and View / Done / Snooze actions are present in the source.</td></tr>
      <tr><td>Debug build</td><td>${external('https://github.com/YungChuckTaylor/getyere/actions/runs/39315019610', 'Previously delivered Firebase-configured run')} succeeded. The later ${external('https://github.com/YungChuckTaylor/getyere/actions/runs/39682296145', 'run for revision 1b5dcff')} also passed the cloud/native-voice build checks. These are debug APKs, not Play releases.</td></tr>
      <tr><td>Phone test</td><td>Owner-reported success. Do not treat this as proof of every notification state, device or release certificate.</td></tr>
      <tr><td>Release signing</td><td>The checked-in Gradle release block has no signing configuration. The workflow runs <code>assembleDebug</code>; it does not create a signed Play bundle.</td></tr>
      <tr><td>Google Play</td><td>Signed release AAB, Play-installed acceptance tests, listing/compliance and production review are not verified in this handoff.</td></tr></tbody></table>
      ${note('Debug success ≠ store readiness', 'Keep the working app and existing Supabase/Firebase projects. You do not need another starter app or demo APK. The release build uses different signing credentials and must be tested after installation through Google Play.', 'success')}
      <p>Record the tested APK/build, phone model, Android version and what you tried in your own release notes. Do not include passwords, private keys, full device tokens or real reminder content.</p>
      <p>Need the Apple process instead? ${external('https://getyere.com/ios-guide.html', 'Open the separate iOS guide')}. Android success does not verify iOS.</p>`,
    checks: [['evidence', 'I recorded which debug build and phone I tested.'], ['scope', 'I recorded the features I actually tested, not just “it works”.'], ['gap', 'I understand that Play signing and Play-installed testing are still required.'], ['owner', 'I know who owns the Google Play, Firebase and existing backend accounts.']],
    help: `<p><strong>Can I upload the debug APK to publish?</strong> No. Follow this guide to create a signed release Android App Bundle (.aab). The existing GitHub workflow is a debug-testing workflow.</p><p><strong>Why are my checklist ticks empty?</strong> They are your own release checklist, not imported test results. Nothing is pre-ticked or independently verified by this page.</p>`
  },
  {
    id: 'prepare', short: 'Get accounts ready', title: 'Prepare your accounts and computer', owner: 'Owner + engineer',
    description: 'Windows, macOS or Linux can build Android. You do not need a Mac or an Apple account.',
    content: `<ol><li>Open ${external('https://play.google.com/console/', 'Google Play Console')} with the client’s Google account. Complete the account type, identity, contact, payment and device-verification steps requested by that account. Accept outstanding agreements.</li>
      <li>Give your engineer only the permissions they need. The client keeps control of the account, upload key and recovery details. Never send Google passwords or verification codes in chat.</li>
      <li>Accept access to <code>YungChuckTaylor/getyere</code>. Arrange access to the <strong>existing</strong> Firebase project and Supabase backend, or have an authorized operator handle their settings. GitHub access alone is not backend access.</li>
      <li>Install Git, <strong>Node.js 22 or later</strong>, and ${external('https://developer.android.com/studio', 'Android Studio')}. In Android Studio’s SDK Manager install <strong>Android SDK Platform 36</strong> and the required SDK Build Tools. Configure Gradle to use <strong>JDK 21</strong>; check your selected Java/Gradle JDK rather than assuming the bundled version matches.</li>
      <li>Keep a real Android phone with Google Play services and Play Store access available for release testing.</li></ol>
      <h3>Project facts—not a new configuration to invent</h3><p>Package: <code>com.getyere.app</code>. The checked-in project uses <strong>minimum SDK 26 (Android 8.0)</strong>, compile/target SDK <strong>36</strong>, and currently <strong>versionName 1.0 / versionCode 1</strong>. Confirm the current source and Play Console requirements before uploading.</p>
      ${note('No private values belong on this webpage', 'The guide has no account connections or credential inputs. Enter sensitive settings only in their official console or an approved secret store.', 'warning')}`,
    checks: [['console', 'The client can use Play Console and has completed its account verification tasks.'], ['access', 'Repository, Firebase and existing backend access are arranged.'], ['tools', 'Git, Node 22+, Android Studio, SDK 36 and JDK 21 are ready.'], ['device', 'A real Android phone with Play services is available.']],
    help: `<p><strong>“SDK location not found”?</strong> Open the existing <code>android/</code> folder in Android Studio and set the SDK path. Local SDK paths belong in ignored <code>android/local.properties</code>, not Git.</p><p><strong>Play Console requests additional checks?</strong> Finish the exact tasks shown for the client’s account. Do not open a second account or change the app identity to bypass a restriction.</p>`
  },
  {
    id: 'configure', short: 'Check code & push', title: 'Keep the real backend and Firebase setup', owner: 'Technical help',
    description: 'Android notifications use Firebase Cloud Messaging (FCM), not Apple APNs.',
    content: `<h3>A. Get the agreed release source</h3><p>In your computer’s terminal, choose a folder and run:</p>
      ${command('git clone https://github.com/YungChuckTaylor/getyere.git\ncd getyere\ngit pull --ff-only\ngit log -1 --oneline')}
      <p>If the project already exists, open that folder and update it; do not clone inside it. Ask the maintainer to confirm the merged release commit contains the approved fixes. A guide-only deployment branch is not automatically the merged release branch. Record the exact commit; do not select a stale branch from an old document.</p>
      <h3>B. Prepare the public build configuration</h3><p>Create an ignored plain-text <code>.env.local</code> in the project root. Replace these placeholders with the existing project’s public settings:</p>
      ${command('VITE_SUPABASE_URL=<existing-production-Supabase-URL>\nVITE_SUPABASE_ANON_KEY=<existing-publishable-or-anon-key>\nVITE_PUBLIC_APP_URL=https://getyere.com\nVITE_VAPID_PUBLIC_KEY=<existing-public-web-push-key>')}
      <p>The publishable/anon key is not a service-role key. VAPID is for browser push; it does not enable Android FCM.</p>
      <h3>C. Keep the two Firebase configurations separate</h3><ol><li><strong>Android client:</strong> Firebase Console → Project settings → General → Android app <code>com.getyere.app</code> → download <code>google-services.json</code>. For a local release, place it at the ignored path <code>android/app/google-services.json</code>. Download the Android client file, <strong>not a service-account JSON key</strong>.</li>
      <li><strong>CI:</strong> the existing workflow uses the encrypted <code>GOOGLE_SERVICES_JSON_B64</code> secret. Keep it; do not commit or print its contents. Base64 encoding is not encryption. If a future build is needed, the maintainer must confirm Firebase config is installed and no push-disabled warning is present. No new debug APK is required just to follow this guide.</li>
      <li><strong>Server sender:</strong> the authorized operator checks <code>FIREBASE_PROJECT_ID</code>, <code>FIREBASE_CLIENT_EMAIL</code> and <code>FIREBASE_PRIVATE_KEY</code> in the existing Supabase Edge Function secrets. The client and sender must refer to the same Firebase project and the sender must have FCM HTTP v1 permission. Never put a private service-account key in the app, GitHub source or a <code>VITE_*</code> variable.</li>
      <li>Keep <code>test-notification</code> and <code>dispatch-reminders</code> active with their existing security settings. If credentials change, have the operator redeploy the matching sender functions. Reuse the existing scheduler; do not replay old migrations or create another backend/cron.</li></ol>
      <h3>D. Run the safety checks</h3><p>From the project root, use these commands on Windows, macOS or Linux. Node’s <code>--env-file</code> loads the public values without printing them:</p>
      ${command('npm ci\nnpm test\nnode scripts/validate-google-services.mjs android/app/google-services.json\nnode --env-file=.env.local --run build:native\nnode --env-file=.env.local --run verify:bundle')}
      ${note('Stop on any error', 'Do not bypass the native cloud guard, accept demo content, or ignore a missing Firebase configuration. These checks are preparation—not evidence that a phone received a notification.', 'warning')}`,
    checks: [['revision', 'The maintainer confirmed the release source and I recorded its commit.'], ['public-config', 'The ignored local env file contains the existing public production settings.'], ['firebase-client', 'The local Firebase Android client file validates for com.getyere.app.'], ['sender', 'An authorized operator confirmed the existing FCM sender and function settings.'], ['checks', 'Dependencies, tests, native build and bundle verification pass.']],
    help: `<p><strong>Where do I paste private values?</strong> Not here. The backend operator uses Supabase’s secret settings; the client keeps signing material private. Never post a service-account JSON or keystore in chat.</p><p><strong>Old documentation says Firebase was missing?</strong> That was an earlier rollout snapshot, not the later configured debug build. Use current build evidence and verify the release setup instead of undoing the working configuration.</p>`
  },
  {
    id: 'signing', short: 'Protect signing', title: 'Set up the release identity and keys', owner: 'Owner + engineer',
    description: 'The debug key, upload key and Google Play app-signing key have different jobs.',
    content: `<ol><li>Open the existing Yere app in ${external('https://play.google.com/console/', 'Play Console')}. If none exists, create an app under the client’s account with the intended name, default language and app type. Choose free/paid deliberately and follow the declarations shown.</li>
      <li>Keep the package <code>com.getyere.app</code>. If Google says it is owned by another account, resolve ownership or transfer with the owner. Do not rename it as a shortcut.</li>
      <li>Check <strong>App integrity / App signing</strong> (menu wording may vary). Follow ${external('https://support.google.com/googleplay/android-developer/answer/9842756?hl=en', 'Google’s Play App Signing instructions [4]')}. For an existing app, preserve its established signing setup; do not generate replacement keys blindly.</li>
      <li>If a new upload key is needed, the client creates it using Android Studio’s signed-bundle wizard in the next stage. Store the keystore <strong>outside the repository</strong>. Keep the alias and passwords in a password manager and a secure backup. Never commit <code>.jks</code>, <code>.keystore</code> or <code>keystore.properties</code>.</li></ol>
      <h3>Know which certificate reaches users</h3><ul><li><strong>Debug key:</strong> signs the testing APK you installed. It is not the Play upload credential.</li><li><strong>Upload key:</strong> signs the AAB you send to Google.</li><li><strong>Play app-signing key:</strong> signs the APKs Google delivers to users. Copy its <strong>certificate fingerprints</strong> from Play Console for release integrations. Certificate fingerprints are public identifiers, not private keys.</li></ul>
      <p>Have the operator add the Play app-signing SHA-256 fingerprint to <code>/.well-known/assetlinks.json</code> on <strong>both getyere.com and www.getyere.com</strong>. Each declared host must serve valid JSON directly over HTTPS without redirecting to the other host. Use the actual package and certificate, not placeholders. Register release fingerprints / OAuth clients in Firebase or Google settings wherever the chosen sign-in flow requires them, and test Google login on the Play-installed build.</p>
      ${note('A debug test does not test the Play certificate', 'App links or sign-in can behave differently after Google signs the installed app. An upload-key fingerprint alone is not sufficient for Play-installed app links.', 'warning')}`,
    checks: [['app', 'The client owns the Play record for the intended package.'], ['signing-plan', 'The app’s Play App Signing / upload-key setup is understood and preserved.'], ['backup', 'The client controls and securely backs up the upload keystore and recovery details.'], ['links', 'Both app-link hosts use the Play app-signing certificate, with no placeholder or redirect.'], ['oauth', 'Release Google authentication configuration has been checked for the actual flow.']],
    help: `<p><strong>I lost the upload key?</strong> Use the official Play upload-key reset process if eligible; involve the owner. Do not confuse that with replacing the app-signing key.</p><p><strong>The debug APK won’t update to the Play build?</strong> Different signing certificates can prevent an in-place update. Sync/export important data first. Only then remove the debug installation if needed and install through the Play test track. Uninstalling can lose unsynced local data.</p>`
  },
  {
    id: 'bundle', short: 'Build the release', title: 'Create a signed Android App Bundle', owner: 'Technical help',
    description: 'An APK is for installation. An AAB is the release package you upload to Play.',
    content: `<h3>Refresh the shared app first</h3><p>From the project root, after the previous checks pass:</p>
      ${command('npm test\nnode --env-file=.env.local --run build:native\nnode --env-file=.env.local --run verify:bundle\nnpx cap sync android\nnpx cap open android')}
      <ol><li>Wait for Android Studio’s Gradle sync. Keep the existing microphone permission, speech-recognition visibility query, notification permission and <code>YereMessagingService</code>. Do not replace the native project with a template.</li>
      <li>In <code>android/app/build.gradle</code>, confirm <code>applicationId "com.getyere.app"</code>. Set <code>versionName</code> to the intended user-facing version, and <code>versionCode</code> to a positive integer not previously uploaded. <strong>Increase versionCode for every subsequent Play upload.</strong> The checked-in values are 1.0 / 1, not a promise those numbers are still unused.</li>
      <li>Choose <strong>Build → Generate Signed App Bundle / APK → Android App Bundle</strong>. Select the app module, the client’s existing upload keystore and alias. For a genuinely new signing setup, use <strong>Create new</strong>, select a private location outside Git, and record/backup the credentials securely.</li>
      <li>Choose the <strong>release</strong> variant and a private output location, then generate the bundle. Record the exact file the wizard creates. Android Studio may place it in <code>android/app/release/</code>; a configured Gradle <code>bundleRelease</code> output is typically <code>android/app/build/outputs/bundle/release/app-release.aab</code>.</li>
      <li>Have the engineer verify the AAB is signed with the intended upload certificate, contains the real cloud configuration, includes validated Firebase client config, and contains no server private credentials or demo-only configuration. Record commit, version, versionCode and SHA-256 checksum privately.</li></ol>
      ${note('The existing CLI is not a signing setup', '<code>npm run android:bundle</code> builds a release bundle, but the checked-in release block has no signingConfig. Do not assume its output is signed. Use the signed-bundle wizard above, or an engineer-configured protected Gradle/CI release-signing path.', 'warning')}
      <p>Check the current target-API requirement in Play Console and resolve its bundle validation issues, including supported architectures and native-library / 16 KB page-size compatibility where applicable. A source setting alone is not proof that the uploaded AAB complies.</p>`,
    checks: [['version', 'The intended versionName and a new versionCode are set.'], ['sync', 'Tests, native build, verification and Capacitor sync pass.'], ['signed', 'The actual release AAB is signed with the correct upload certificate.'], ['artifact', 'The release artifact’s source, configuration, checksum and compliance were checked.']],
    help: `<p><strong>“Wrong signing key”?</strong> Check the upload certificate registered for this Play app and the keystore selected in the wizard. Never resolve it by exposing a key in source.</p><p><strong>My CI only gives an APK?</strong> That is expected: the current workflow produces debug APKs. This guide does not add or claim a signed-release CI pipeline.</p><p><strong>SDK/Java or dependency error?</strong> Confirm SDK 36, JDK 21 and the project’s Gradle wrapper. Send sanitized errors to the engineer, not credentials.</p>`
  },
  {
    id: 'testing', short: 'Test through Play', title: 'Test the build Google actually installs', owner: 'Owner + testers',
    description: 'Your debug test is useful evidence. Now check the release-signed, Play-delivered app.',
    content: `<ol><li>In Play Console → Yere → <strong>Testing → Internal testing</strong>, create a release, configure Play App Signing if prompted, upload the signed AAB and read all validation messages.</li><li>Add eligible testers, save the release notes, resolve blockers and roll out the internal test. Share the test opt-in link. On the phone, use the invited Google account to join and install from Google Play—not by downloading the old debug APK.</li><li>Check the installed version/versionCode. If a different debug certificate blocks installation, sync/export pending data before removing the debug app.</li></ol>
      <h3>Record a release acceptance checklist</h3><ul><li><strong>Notifications:</strong> sign in → Yere Settings → enable push → allow Android’s notification permission when requested → send a test. See the actual banner / notification entry on <em>that phone</em>. Ask the operator to confirm an <code>android / fcm</code> registration without sharing its token.</li>
      <li><strong>Scheduling and actions:</strong> create reminders due in 3–5 minutes. Test foreground, background/locked and app normally dismissed from Recents. Try View, Done and Snooze on separate occurrences. Done/Snooze open the app and wait for authentication/data restore. Ten-minute snooze adds to the <strong>scheduled time</strong>, not tap time. Dismissal must not mutate a reminder; stale actions must not alter a rescheduled occurrence.</li>
      <li><strong>Permissions / lifecycle:</strong> test notification denial, re-enable, app opt-out, account switch, logout, reinstall and token refresh. A previous account’s action must not affect the new account. Test Android 13+ permission handling and at least the supported device/OS range you intend to release.</li>
      <li><strong>Core journeys:</strong> email/Google login, confirmation/recovery, logout confirmation, account deletion, native voice, file upload, image preview, notes, calendar, approved-contact sharing, offline edit/reconnect sync, safe areas and accessibility. Voice does not currently choose a contact from a spoken name; use the explicit contact-sharing flow.</li></ul>
      ${note('Delivery is not an exact alarm', 'FCM provider acceptance is not proof of a visible alert. The scheduler runs minutely and delivery depends on network, notification permission, Do Not Disturb, battery/OS restrictions and Google Play services. Android Force stop is different from dismissing Recents: force-stopped apps generally need to be reopened; do not promise delivery while force-stopped.', 'warning')}
      <h3>Complete any required closed test</h3><p>Check your Play Console Dashboard. Google’s help currently requires affected personal accounts created after 13 November 2023 to run a closed test with at least <strong>12 testers opted in continuously for 14 days</strong> before applying for production access. Follow the exact current requirement shown for your account. Internal testing and a sideloaded debug APK do not replace this closed-test step. ${external('https://support.google.com/googleplay/android-developer/answer/14151465?hl=en', 'Testing requirements [1]')}</p>
      <p>Review Play’s pre-launch report. Fix critical crashes, delivery, auth, saving or account-isolation issues; increase versionCode, upload a new AAB and retest. Keep sanitized evidence of devices, app state, results, feedback and fixes.</p>`,
    checks: [['play-install', 'Testers installed the intended release from the Play test track.'], ['push', 'Visible push delivery and actions passed the release device/app-state tests.'], ['features', 'Authentication, voice, sharing, files, offline sync and account isolation were tested.'], ['quality', 'Critical issues and pre-launch findings were resolved and retested.'], ['closed-test', 'Any required closed test and production-access approval are complete (or Console confirms not required).']],
    help: `<p><strong>No alert?</strong> Check Android Settings → Apps → Yere → Notifications, the reminder notification channel, Do Not Disturb, network and manufacturer battery settings. Reopen after Force stop. Check the release Firebase project and safe sender diagnostics. Never send the full device token in chat.</p><p><strong>Google login or app links fail only on Play?</strong> Re-check the Play app-signing fingerprint, the actual authentication flow and both hosts’ asset-links files—not only the debug or upload certificate.</p>`
  },
  {
    id: 'listing', short: 'Prepare store info', title: 'Complete the listing, privacy and access details', owner: 'App owner',
    description: 'Describe the tested app accurately and make it possible for Google to review it.',
    content: `<h3>Store listing</h3><p>In Play Console → Yere → Store presence / Main store listing, complete the title, short/full descriptions, category, contact details, app icon, feature graphic and requested screenshots. Use real release-app screens with fictional data, not promises or private accounts. Draft copy is in <code>docs/MOBILE_RELEASE.md</code>; verify it before publication. Supply the exact sizes/device classes the Console requests. Choose pricing and country availability deliberately.</p>
      <h3>App content and data safety</h3><p>Complete App content tasks for target audience, content rating, ads, app access and any permissions/declarations the Console requests. Review actual account identifiers, reminder/contact content, attachments, device/push identifiers, support/audit information, speech providers and configured SDK diagnostics. Do not choose “Data Not Collected” just because Yere has no ads. Audit actual behavior and the ${external('https://support.google.com/googleplay/android-developer/answer/10787469?hl=en', 'Data safety guidance [5]')}.</p>
      <h3>Public links and deletion</h3><ul><li>Website: ${external('https://getyere.com', 'getyere.com')}</li><li>Privacy: ${external('https://getyere.com/privacy-policy', 'Privacy Policy')}</li><li>Terms: ${external('https://getyere.com/termsofuse', 'Terms of Use')}</li><li>Support / deletion instructions: ${external('https://getyere.com/support.html', 'Support')}</li></ul>
      <p>Verify <code>support@getyere.com</code> is a real monitored mailbox. Test <strong>Settings → Account &amp; data → Delete account and cloud data</strong> with a disposable test account. Google requires an in-app deletion path <strong>and a working external web resource to request deletion</strong> for apps that offer account creation. Only submit the support URL as the deletion URL after confirming its instructions and contact process actually fulfill that requirement; otherwise the owner must fix the web flow first. ${external('https://support.google.com/googleplay/android-developer/answer/13327111?hl=en', 'Account deletion requirements [2]')}</p>
      <h3>Reviewer access</h3><p>Under App access, declare that login is required. Supply a dedicated working reviewer account for the real production backend and clear instructions to reach the features, including sharing and notifications. Use fictional data; remove inappropriate access barriers. Provide credentials only in Play Console’s private reviewer fields—not this guide, GitHub, screenshots or chat.</p>
      ${note('Privacy must match the release', 'Explain microphone use, notification permission, data retention and any legitimate deletion exceptions accurately. Yere itself does not retain/upload raw voice audio; the OS speech provider may process audio under its own terms. Never claim more than the actual SDK/provider behavior supports.', 'warning')}`,
    checks: [['assets', 'Listing text, real screenshots, graphics, pricing and availability are ready.'], ['declarations', 'App content and Data safety answers match the actual app and SDKs.'], ['links', 'Public legal/support links work and the support inbox is monitored.'], ['deletion', 'In-app deletion and the external deletion-request resource were tested.'], ['reviewer', 'A working dedicated reviewer account and instructions are privately supplied in Play Console.']],
    help: `<p><strong>Which privacy boxes should I tick?</strong> Ask the engineer to map actual stored/transmitted data and SDK behavior to Google’s definitions. Do not copy another app’s answers or an old draft without checking.</p><p><strong>Can the reviewer use my personal login?</strong> Use a dedicated test account, not your personal or administrator account. No passwords belong in this webpage.</p>`
  },
  {
    id: 'submit', short: 'Submit & release', title: 'Send the tested release to Google', owner: 'App owner',
    description: 'Uploading an AAB is not the same as submitting it, approval, or publication.',
    content: `<ol><li>Check Play Console confirms production access and all required testing, account and app-content tasks are complete.</li><li>Open the <strong>Production</strong> track. Promote the exact tested release if available, or select the intended tested bundle. Confirm package, versionCode, countries, release notes and all warnings. Do not accidentally select an older AAB.</li><li>Review the release and follow the Console’s submission flow. Open <strong>Publishing overview</strong> and send outstanding changes for review if prompted. Exact button labels depend on the account and release.</li><li>Confirm the changes are <strong>In review</strong> or another explicit submitted status. Save the versionCode and submission date in your private release log. A saved draft or uploaded artifact is not a submitted release.</li><li>Check whether managed publishing is on. If enabled, approval can leave changes <strong>Ready to publish</strong> until the owner publishes them. Otherwise approved changes may publish according to the Console’s settings. Do not assume approval always means the app is already available.</li><li>After publication, open the public Play listing and install/update as an ordinary user. Check login, real notification delivery, actions and support links. Monitor crashes/ANRs, user feedback and backend delivery errors.</li></ol>
      ${note('You are finished when…', 'Play Console shows the intended release available to the intended countries/users, and a store-installed production smoke test passes. This webpage cannot verify Google’s status or guarantee approval.', 'success')}
      <p>For a rejection, read Google’s exact reason, fix the actual issue, update the listing or increase versionCode for code changes, and submit through the required flow. Do not create a replacement package/account to evade review.</p>`,
    checks: [['tested-version', 'The exact tested versionCode is selected and production access is approved.'], ['submitted', 'The required changes were actually sent for review, not left as a draft.'], ['published', 'After approval, the intended release is published with the correct availability.'], ['smoke', 'A production Play-installed smoke test passed and monitoring/support are ready.']],
    help: `<p><strong>Approved but nobody can see it?</strong> Check managed publishing, country availability, release status and the Google account used to view the listing. Follow the Console’s actual status; do not promise an exact propagation time.</p><p><strong>Can this guide upload or approve my app?</strong> No. It is a local checklist and reference, not a Google connection or deployment tool.</p>`
  }
];
export const taskIds = stages.flatMap(stage => stage.checks.map(([id]) => `${stage.id}:${id}`));
export function sanitizeState(value) {
  const object = value && typeof value === 'object' ? value : {};
  return {
    current: stages.some(stage => stage.id === object.current) ? object.current : stages[0].id,
    completed: [...new Set(Array.isArray(object.completed) ? object.completed.filter(id => taskIds.includes(id)) : [])]
  };
}
export function loadState(storage) {
  try { return sanitizeState(JSON.parse(storage.getItem(STORAGE_KEY) || '{}')); }
  catch { return sanitizeState({}); }
}
export function getProgress(state) {
  const completed = sanitizeState(state).completed.length;
  return { completed, total: taskIds.length, percent: Math.round(completed / taskIds.length * 100) };
}
export function setTask(state, id, checked) {
  const next = sanitizeState(state);
  if (!taskIds.includes(id)) return next;
  next.completed = checked ? [...new Set([...next.completed, id])] : next.completed.filter(item => item !== id);
  return next;
}

function stageMarkup(stage, index, state, print = false) {
  const prefix = print ? 'print-' : '';
  const complete = stage.checks.filter(([id]) => state.completed.includes(`${stage.id}:${id}`)).length;
  return `<article class="panel ${print ? 'print-stage' : 'active-stage'}" aria-labelledby="${prefix}stage-heading-${stage.id}">
    <header class="stage-header"><span class="stage-icon" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><div class="stage-kicker">Stage ${index + 1} of ${stages.length}</div><h2 id="${prefix}stage-heading-${stage.id}" ${print ? '' : 'tabindex="-1"'}>${stage.title}</h2><p>${stage.description}</p></div><span class="owner-tag">${stage.owner}</span></header>
    <div class="instruction">${stage.content}</div>
    <section class="checklist" aria-label="Stage ${index + 1} checklist"><h3 class="checklist-heading">BEFORE YOU MOVE ON</h3>${stage.checks.map(([id, label]) => {
      const key = `${stage.id}:${id}`;
      return `<label class="check-row"><input type="checkbox" data-task="${key}" ${state.completed.includes(key) ? 'checked' : ''} ${print ? 'disabled' : ''}><span>${label}</span></label>`;
    }).join('')}</section>
    <p class="stage-completion">${complete} of ${stage.checks.length} checked · Self-reported, not independently verified</p>
    <details class="help" ${print ? 'open' : ''}><summary>I’m stuck at this stage</summary><div class="help-body">${stage.help}</div></details>
    ${print ? '' : `<div class="stage-bottom"><button class="button secondary" type="button" data-nav="${index - 1}" ${index === 0 ? 'disabled' : ''}>← Previous</button>${index < stages.length - 1 ? `<button class="button" type="button" data-nav="${index + 1}">Next stage <span aria-hidden="true">→</span></button>` : '<button class="button" type="button" id="review-checklist">Review my checklist ↗</button>'}</div>`}
  </article>`;
}

export function initGuide() {
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  let state = loadState(storage);
  let saveTimer;
  const status = document.getElementById('save-status');
  const announce = text => { document.getElementById('announcement').textContent = text; };
  const save = () => {
    try { if (!storage) throw new Error('Storage unavailable'); storage.setItem(STORAGE_KEY, JSON.stringify(state)); status.textContent = 'Saved on this browser only. No credentials are collected.'; }
    catch { status.textContent = 'Browser storage is unavailable. Progress works now, but won’t survive a reload.'; }
  };
  const renderProgress = () => {
    const progress = getProgress(state);
    document.getElementById('progress-label').textContent = `${progress.completed} of ${progress.total} tasks checked`;
    document.getElementById('progress-percent').textContent = `${progress.percent}%`;
    const bar = document.getElementById('total-progress');
    bar.value = progress.percent; bar.textContent = `${progress.percent}%`;
    document.getElementById('stage-nav').innerHTML = stages.map((stage, index) => {
      const done = stage.checks.filter(([id]) => state.completed.includes(`${stage.id}:${id}`)).length;
      const complete = done === stage.checks.length;
      return `<a class="stage-link${complete ? ' complete' : ''}" href="#${stage.id}" ${state.current === stage.id ? 'aria-current="step"' : ''}><span class="stage-number" aria-hidden="true">${complete ? '✓' : index + 1}</span><span><span class="stage-name">${stage.short}</span><span class="stage-count">${done} / ${stage.checks.length} checked</span></span></a>`;
    }).join('');
    if (window.matchMedia('(max-width: 720px)').matches) {
      const nav = document.getElementById('stage-nav');
      const current = nav.querySelector('[aria-current]');
      nav.scrollLeft = current.offsetLeft - nav.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
    }
  };
  const renderStage = () => {
    const index = stages.findIndex(stage => stage.id === state.current);
    document.getElementById('stage-view').innerHTML = stageMarkup(stages[index], index, state);
    renderProgress();
  };
  const navigate = (id, focus = true) => {
    if (!stages.some(stage => stage.id === id)) return;
    state.current = id; save(); renderStage();
    if (focus) {
      const heading = document.getElementById(`stage-heading-${id}`);
      heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };
  const fromHash = () => {
    const id = location.hash.slice(1);
    if (id === 'glossary') { document.getElementById('glossary-details').open = true; return; }
    navigate(stages.some(stage => stage.id === id) ? id : state.current, false);
  };
  document.getElementById('stage-nav').addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    event.preventDefault(); const id = link.hash.slice(1);
    history.replaceState(null, '', `#${id}`); navigate(id);
  });
  document.getElementById('stage-view').addEventListener('change', event => {
    const input = event.target;
    if (!input.matches('input[data-task]')) return;
    state = setTask(state, input.dataset.task, input.checked); save(); renderProgress();
    const stage = stages.find(stage => stage.id === state.current);
    const checked = stage.checks.filter(([id]) => state.completed.includes(`${stage.id}:${id}`)).length;
    document.querySelector('.active-stage .stage-completion').textContent = `${checked} of ${stage.checks.length} checked · Self-reported, not independently verified`;
    announce(`${getProgress(state).completed} of ${taskIds.length} tasks checked.`);
  });
  document.getElementById('stage-view').addEventListener('click', async event => {
    const nav = event.target.closest('[data-nav]');
    if (nav && !nav.disabled) { const stage = stages[Number(nav.dataset.nav)]; if (stage) { history.replaceState(null, '', `#${stage.id}`); navigate(stage.id); } return; }
    const copy = event.target.closest('.copy-button');
    if (copy) {
      const code = copy.parentElement.querySelector('code');
      try { await navigator.clipboard.writeText(code.textContent); copy.textContent = 'Copied ✓'; announce('Copied to clipboard.'); clearTimeout(saveTimer); saveTimer = setTimeout(() => { copy.textContent = 'Copy'; }, 2000); }
      catch { const range = document.createRange(); range.selectNodeContents(code); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); copy.textContent = 'Select & copy'; announce('Automatic copy is unavailable. The text is selected; use your device’s Copy command.'); }
      return;
    }
    if (event.target.closest('#review-checklist')) {
      const first = stages.find(stage => stage.checks.some(([id]) => !state.completed.includes(`${stage.id}:${id}`)));
      if (first) { history.replaceState(null, '', `#${first.id}`); navigate(first.id); announce('Here is the first stage with unchecked tasks.'); }
      else announce('All checklist items are checked. Confirm review and publication status in Google Play Console; this page cannot verify it.');
    }
  });
  document.getElementById('reset-guide').addEventListener('click', () => {
    if (!window.confirm('Clear all checklist ticks and start at stage 1? This only affects this guide in this browser.')) return;
    state = sanitizeState({}); history.replaceState(null, '', '#start'); save(); renderStage(); announce('Guide progress reset.');
  });
  document.getElementById('glossary-link').addEventListener('click', () => { document.getElementById('glossary-details').open = true; });
  let glossaryWasOpen;
  const preparePrint = () => {
    const glossary = document.getElementById('glossary-details');
    if (typeof glossaryWasOpen !== 'boolean') glossaryWasOpen = glossary.open;
    glossary.open = true;
    document.querySelectorAll('.print-stage').forEach(stage => stage.remove());
    document.getElementById('stage-view').insertAdjacentHTML('beforeend', stages.map((stage, index) => stageMarkup(stage, index, state, true)).join(''));
  };
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('.print-stage').forEach(stage => stage.remove());
    document.getElementById('glossary-details').open = glossaryWasOpen ?? false;
    glossaryWasOpen = undefined;
  });
  document.getElementById('print-guide').addEventListener('click', () => { preparePrint(); window.print(); });
  window.addEventListener('hashchange', fromHash);
  renderStage(); fromHash();
  // Detect storage restrictions immediately rather than claiming persistence until the first tick.
  save();
}
if (typeof document !== 'undefined') initGuide();

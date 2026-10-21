/* Standalone handbook. No account connections, credential inputs, analytics or backend calls. */
export const STORAGE_KEY = 'yere.ios-launch-guide.v1';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const external = (href, label) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
const publicEnvironment = 'set -a\nsource .env.local\nset +a\n';
const command = text => `<div class="command"><pre><code>${escape(text)}</code></pre><button class="copy-button" type="button" aria-label="Copy command">Copy</button></div>`;
const note = (title, text, kind = '') => `<div class="callout ${kind}"><strong>${title}</strong>${text}</div>`;
export const stages = [
  {
    id: 'start', short: 'Get ready', title: 'Gather what you need', owner: 'App owner',
    description: 'You own the Apple account. The original developer never needs your login.',
    content: `<p>You’re taking an <strong>existing app</strong> through Apple’s release process. You do not need to start building Yere again.</p>
      <h3>Before you begin</h3><ol><li><strong>Use a Mac.</strong> Install ${external('https://developer.apple.com/xcode/', 'Xcode')}—Apple’s app-building tool. Use a version Apple currently accepts for uploads. Open it once and finish its setup.</li>
      <li><strong>Sign in to your own Apple account.</strong> Confirm your paid ${external('https://developer.apple.com/account/', 'Apple Developer membership')} is active. Open ${external('https://appstoreconnect.apple.com/', 'App Store Connect')} and accept any outstanding agreements.</li>
      <li><strong>Accept your GitHub invitation.</strong> You need access to <code>YungChuckTaylor/getyere</code>. GitHub holds the app’s source code.</li>
      <li><strong>Arrange backend and website help.</strong> Ask the project owner for access to the existing Supabase project, or arrange for an authorized operator to enter your settings. Website app links may also need their help. GitHub access alone does not give access to either service.</li>
      <li><strong>Have a physical iPhone ready.</strong> You’ll use it to test the app through TestFlight before submission.</li></ol>
      ${note('Keep your keys private', 'Never put Apple passwords, verification codes, .p8 keys, signing certificates or service-role keys in chat or GitHub source. Enter private values only in the official account settings or an approved secret store.', 'warning')}
      <p><strong>What is already done?</strong> Yere has an iOS project, voice capture, shared reminders, offline storage and notification code. A signed iOS release and real-iPhone testing still need completing. Android’s successful build does not verify iOS.</p>`,
    checks: [ ['mac', 'My Mac has Xcode installed and initial setup is complete.'], ['membership', 'My Apple Developer membership is active and I can open App Store Connect.'], ['access', 'I can access the GitHub repo and have arranged backend / website help.'], ['phone', 'I have a physical iPhone for testing.'] ],
    help: `<p><strong>I only have Windows.</strong> Ask an authorized iOS engineer with a Mac to help. You cannot turn the Android APK into an iOS App Store build.</p><p><strong>I don’t want to share my Apple account.</strong> You do not have to. Perform Apple account steps yourself; a helper can explain them without receiving your password or keys.</p>`
  },
  {
    id: 'code', short: 'Prepare the code', title: 'Download and check the app', owner: 'Technical help',
    description: 'Use the existing merged source and the real production settings—not a demo.',
    content: `<ol><li>Install <strong>Git</strong> if needed (Xcode’s command-line tools include it), and install <strong>Node.js 22 or later</strong> from ${external('https://nodejs.org/', 'the Node.js website')}. Use a version supported by the repository.</li>
      <li>Open <strong>Applications → Utilities → Terminal</strong>. Choose where you want to keep the project. Paste the commands below, one line at a time. GitHub may ask you to authenticate securely. Never paste an access token into a chat.</li></ol>
      ${command('git clone https://github.com/YungChuckTaylor/getyere.git\ncd getyere\ngit pull --ff-only\ngit log -1 --oneline')}
      <p>Already downloaded it? Open Terminal in that project folder and run <code>git pull --ff-only</code>; don’t create a second nested copy.</p>
      <p>Confirm the merged source includes <code>docs/NATIVE_NOTIFICATIONS.md</code> and <code>src/notification-intents.js</code>. Ask the maintainer to confirm the release revision. Record its commit ID for your release notes; do not choose an old branch from an earlier message.</p>
      <h3>Add the public build settings</h3><p>In the project folder, create a plain-text file named <code>.env.local</code>. Ask the existing project owner for the real values. The example below is a template, not working credentials.</p>
      ${command('VITE_SUPABASE_URL=<existing-production-Supabase-URL>\nVITE_SUPABASE_ANON_KEY=<existing-publishable-or-anon-key>\nVITE_PUBLIC_APP_URL=https://getyere.com\nVITE_VAPID_PUBLIC_KEY=<existing-public-web-push-key>')}
      ${note('Public does not mean unrestricted', 'Only a Supabase publishable/anon key belongs in this file. Never use the service-role key. Keep this local file out of Git. The VAPID public key is for browser push, not Apple notifications.', 'warning')}
      <p>Back in Terminal, run these from the <code>getyere</code> folder:</p>
      <p>First load these public settings into Terminal. The <code>set</code> / <code>source</code> lines below do that without displaying the values. Repeat them whenever you open a new Terminal window; <code>.env.local</code> alone is not loaded by the command-line safety checks.</p>
      ${command(publicEnvironment + 'npm ci\nnpm test\nnpm run build:native\nnpm run verify:bundle')}
      ${note('You’re ready when…', 'Dependency installation, tests, the native build and bundle verification all finish successfully. A native configuration error must be fixed—not bypassed.', 'success')}`,
    checks: [ ['source', 'I have the current merged Yere code and recorded the release commit.'], ['environment', 'The ignored .env.local file uses the existing production public settings.'], ['tests', 'npm test passes.'], ['build', 'The native build and bundle verification pass.'] ],
    help: `<p><strong>“Repository not found”?</strong> Accept the GitHub invitation and check that you’re signed in to the invited account.</p><p><strong>“Command not found: npm”?</strong> Install Node.js, close Terminal, open it again, then run <code>node --version</code>.</p><p><strong>Missing configuration, test failure or build error?</strong> Stop and send a sanitized error to your engineer. Do not include the .env file or private keys. Do not rebuild the app from a starter template.</p>`
  },
  {
    id: 'apple', short: 'Connect Apple', title: 'Give Yere its Apple identity', owner: 'Owner + engineer',
    description: 'The bundle ID links your code, signing, notifications and App Store listing.',
    content: `<ol><li>Open ${external('https://developer.apple.com/account/', 'Apple Developer')} → <strong>Certificates, Identifiers & Profiles → Identifiers</strong>.</li>
      <li>Find the existing App ID, or register an explicit App ID if needed. Its bundle ID must be <code>com.getyere.app</code>. Enable <strong>Push Notifications</strong>, <strong>Sign in with Apple</strong> and <strong>Associated Domains</strong>.</li>
      <li>From Terminal in your project, open the iOS project:</li></ol>
      ${command(publicEnvironment + 'npm run build:native\nnpx cap sync ios\nnpx cap open ios')}
      <ol start="4"><li>Wait for Xcode to resolve its Swift packages. Select the <strong>App project → App target → Signing & Capabilities</strong>. Choose <strong>your Team</strong>, confirm <code>com.getyere.app</code>, and enable automatic signing if appropriate.</li>
      <li>Confirm the target has <strong>Push Notifications</strong>, <strong>Sign in with Apple</strong>, <strong>Associated Domains</strong> and <strong>Background Modes → Remote notifications</strong>. Refresh provisioning after enabling capabilities.</li></ol>
      ${note('Do not change the bundle ID to make an error disappear', 'If Apple says the identifier belongs to another team, resolve ownership or transfer requirements with the project owner. Changing it breaks the connection to existing authentication, push and links.', 'warning')}
      <h3>Check your signed release</h3><p>The repository targets iOS 15 or later. That minimum does not replace Apple’s current upload SDK requirements. Ask your engineer to confirm the <strong>signed Release archive</strong> includes <code>aps-environment = production</code>. The source file alone is not evidence.</p>
      <p>Debug builds use development APNs; TestFlight and App Store builds use production APNs.</p>`,
    checks: [ ['identifier', 'The client’s Apple team owns the correct bundle identifier.'], ['team', 'Xcode uses my Team and the correct App target.'], ['capabilities', 'Required capabilities and provisioning are configured.'], ['release-signing', 'My engineer will verify production APNs entitlements on the signed Release archive.'] ],
    help: `<p><strong>Signing or provisioning error?</strong> Check Team, membership, bundle ID and enabled capabilities. Allow Xcode to refresh profiles. Share the error text with your engineer, not a certificate export.</p><p><strong>Swift packages cannot resolve?</strong> Run <code>npm ci</code> and <code>npx cap sync ios</code> from the project folder, then resolve packages in Xcode. Do not manually replace the generated Capacitor project.</p>`
  },
  {
    id: 'services', short: 'Enable services', title: 'Connect sign-in, alerts and links', owner: 'Technical help',
    description: 'These are account settings, not things to paste into the app’s source code.',
    content: `${note('This stage needs an authorized backend operator', 'They configure the existing backend. You manage your Apple account and enter private values securely. This guide never asks you to enter or upload credentials.')}
      <h3>A. Make Sign in with Apple work</h3><p>Yere shows an Apple sign-in button on iOS. A visible button is not proof that Apple login is configured.</p><ol><li>Enable Sign in with Apple on the App ID.</li><li>With your engineer, configure the Apple authentication credentials required by <strong>Supabase → Authentication → Apple</strong>. The chosen OAuth flow may also need an Apple Services ID, website domain and return URL.</li><li>Confirm these callbacks with the operator:</li></ol>
      ${command('Native callback: yere://auth/callback\nSupabase return URL: https://nttspzlszckaxjsjdlqi.supabase.co/auth/v1/callback')}
      <p>Verify email/password, confirmation/recovery, Google login and Apple login on the actual build. Configure private email relay where applicable. Track Apple OAuth secret expiry. Account deletion must include Apple authorization revocation where required.</p>
      <h3>B. Enable Apple push notifications (APNs)</h3><ol><li>In Apple Developer → <strong>Keys</strong>, select or create an APNs authentication key authorized for this app’s production environment. Keep the .p8 download private. Record its Key ID and your Team ID.</li><li>Have the authorized operator enter the following in the existing production <strong>Supabase → Edge Functions → Secrets</strong>:</li></ol>
      <table><thead><tr><th>Secret name</th><th>What goes there</th></tr></thead><tbody><tr><td><code>APNS_KEY_ID</code></td><td>The APNs key’s ID</td></tr><tr><td><code>APNS_TEAM_ID</code></td><td>Your Apple Team ID</td></tr><tr><td><code>APNS_PRIVATE_KEY</code></td><td>Complete .p8 PEM contents, including header/footer and newlines</td></tr><tr><td><code>APNS_BUNDLE_ID</code></td><td><code>com.getyere.app</code></td></tr><tr><td><code>APNS_USE_SANDBOX</code></td><td><code>false</code> for TestFlight / App Store</td></tr></tbody></table>
      <p>The operator must confirm <code>test-notification</code> and <code>dispatch-reminders</code> are active with those settings. If redeployment is needed, use the tested release source and existing security settings described in <code>docs/NATIVE_NOTIFICATIONS.md</code>. Do not create another scheduler or replay historical database migrations.</p>
      ${note('Three different keys. Three different jobs.', 'The public Supabase app key, Apple authentication credentials, and APNs private key are not interchangeable. Android Firebase setup does not activate iOS push.', 'warning')}
      ${note('TestFlight is production—even for internal testers', 'Keep APNS_USE_SANDBOX=false on production. A development-signed Debug build needs a separately configured staging backend. This app uses one APNs environment per backend; do not mix sandbox and production tokens.', 'warning')}
      <h3>C. Connect website links to the app</h3><p>Ask the website operator to configure and verify the <code>apple-app-site-association</code> file on <strong>both</strong> <code>getyere.com</code> and <code>www.getyere.com</code>, under <code>/.well-known/</code>. It must match the signed app’s identifier, use HTTPS, and return directly without a redirect. No placeholder IDs.</p><p>Only intended app routes should open Yere; legal and web-admin routes should remain in the browser. Test invitation, reminder and auth links on the iPhone.</p>`,
    checks: [ ['apple-auth', 'Apple authentication is configured; I have a plan to test it on the iPhone.'], ['apns', 'The five APNs settings are configured securely on the existing production backend.'], ['functions', 'The backend operator confirmed both notification functions are active with their security settings intact.'], ['links', 'The website operator configured the association files on both hosts.'], ['environment-separation', 'Production uses production APNs; Debug testing will not change that setting.'] ],
    help: `<p><strong>Apple login fails?</strong> Your engineer must inspect the provider configuration and callback flow. Enabling the Apple capability alone does not fix login.</p><p><strong>APNs says BadDeviceToken or DeviceTokenNotForTopic?</strong> Check production vs sandbox, bundle topic, signing profile and team/key authorization. Do not delete all tokens or switch production to sandbox as a shortcut.</p><p><strong>I don’t have Supabase / website access.</strong> Ask the existing project owner to arrange an authorized operator. There is no reason to create a replacement backend.</p>`
  },
  {
    id: 'archive', short: 'Upload a build', title: 'Package Yere and send it to Apple', owner: 'Owner + engineer',
    description: 'Xcode makes the release build. App Store Connect receives it.',
    content: `<h3>Create the app record</h3><ol><li>Open ${external('https://appstoreconnect.apple.com/', 'App Store Connect')} → <strong>My Apps</strong>. Open the existing Yere record. If none exists, use <strong>+ → New App</strong>.</li><li>Select <strong>iOS</strong>, name <strong>Yere</strong> (subject to availability), the appropriate language, and bundle ID <code>com.getyere.app</code>. Choose a unique internal SKU, such as <code>yere-ios-001</code>. Use the client’s intended legal entity.</li></ol>
      <h3>Make a Release archive</h3><p>From Terminal, refresh the embedded app before archiving:</p>
      ${command(publicEnvironment + 'npm test\nnpm run build:native\nnpm run verify:bundle\nnpx cap sync ios\nnpx cap open ios')}
      <ol><li>In Xcode, select the application scheme. Under <strong>Edit Scheme → Archive</strong>, confirm <strong>Release</strong>.</li><li>In the App target’s <strong>General</strong> settings, confirm the version (initially <code>1.0</code>) and build number. <strong>Increase the build number for every new upload.</strong></li><li>Select a generic physical iOS device archive destination, not a simulator. Choose <strong>Product → Archive</strong>.</li><li>In <strong>Window → Organizer</strong>, select the archive, resolve validation issues, then choose <strong>Distribute App → App Store Connect → Upload</strong>. Wording can vary with Xcode.</li><li>Return to App Store Connect → Yere → <strong>TestFlight</strong>. Wait for processing and address any processing errors or compliance prompts.</li></ol>
      ${note('Keep the build traceable', 'Record the Git commit, Xcode version, app version and build number. Keep the archive privately. Uploading a build does not submit it for App Review.', 'success')}`,
    checks: [ ['app-record', 'Yere’s App Store Connect record belongs to the correct client team and bundle ID.'], ['version', 'I recorded the source commit, Xcode version, app version and unique build number.'], ['archive', 'The Release archive validates, including production push entitlements.'], ['upload', 'The build uploaded and finished processing in TestFlight.'] ],
    help: `<p><strong>Archive is disabled?</strong> Select the app scheme and a generic physical iOS device destination, not a simulator.</p><p><strong>Duplicate build number?</strong> Increase Build in the App target, make a new archive and upload again.</p><p><strong>Missing compliance / processing failure?</strong> Open the build’s message in App Store Connect or Apple’s email. Your engineer should fix the actual error before another upload.</p>`
  },
  {
    id: 'testflight', short: 'Test on iPhone', title: 'Try the real app before review', owner: 'Owner + testers',
    description: 'This is the release gate. A green build is not a substitute for testing.',
    content: `<ol><li>App Store Connect → Yere → <strong>TestFlight</strong>: add eligible internal testers. Complete any required beta information and export-compliance prompts. External testing may need Apple’s beta review.</li><li>On your iPhone, install Apple’s <strong>TestFlight</strong> app, accept the invitation, then install the Yere build you uploaded.</li><li>Use a test Yere account and fictional data. Write down the build number and iOS version.</li></ol>
      <h3>Check the important journeys</h3><ul><li><strong>Account:</strong> sign up, confirm email, sign in with email, Google and Apple, recover your password, sign out, switch accounts and permanently delete a test account. Verify Apple authorization revocation where required.</li><li><strong>Notifications:</strong> enable push in Yere Settings, allow iOS permission and send a test. Confirm a visible alert. Create a push reminder due in 3–5 minutes; test with Yere open, backgrounded/locked and normally closed.</li><li><strong>Actions:</strong> try View, Done and Snooze on separate occurrences. Done/Snooze open Yere before changing anything. Snooze adds ten minutes to the <em>scheduled time</em>, not the time you tap. Old buttons must not change rescheduled reminders; dismissing must do nothing.</li><li><strong>Permissions:</strong> test denied notifications, re-enabling, opt-out, reinstall and token refresh. Old-account reminders must not be applied to a new account.</li><li><strong>Core features:</strong> voice capture, notes, file upload, image preview, calendar, approved-contact sharing and offline edit/reconnect sync. Voice capture does not currently select a contact from a spoken name: use the explicit contact-sharing flow.</li><li><strong>Layout:</strong> keyboard, safe areas, readable text, accessibility and every device class you support—including iPad if the build supports it.</li></ul>
      ${note('Accepted is not delivered', 'A “provider accepted” toast means the server accepted the request. You still need to see the notification on the phone. The minutely scheduler is not an exact alarm; network, Focus settings and OS restrictions can delay alerts.', 'warning')}
      ${note('Stop for a critical failure', 'If sign-in, notifications, saving, account isolation or deletion fails, send sanitized reproduction steps to your engineer. Fix, increase the build number, upload again and retest. Do not submit a known-broken build.', 'warning')}`,
    checks: [ ['install', 'I installed the intended build through TestFlight on a physical iPhone.'], ['authentication', 'Email, Google, Apple, recovery, sign-out and deletion journeys pass.'], ['notifications', 'Real notification delivery and actions pass in the required app states.'], ['core', 'Voice, attachments, sharing, offline sync, layouts and accessibility were tested.'], ['report', 'I recorded the test results and resolved critical issues in the exact build being released.'] ],
    help: `<p><strong>No push alert?</strong> Check iPhone Settings → Notifications → Yere, Focus / summaries, Yere’s own setting, network and the correct production APNs setup. Ask your backend operator to inspect safe error diagnostics. Never send a full device token in chat.</p><p><strong>TestFlight invitation won’t open?</strong> Check the invited Apple account, tester eligibility, build processing and beta-review requirements.</p>`
  },
  {
    id: 'listing', short: 'Prepare the listing', title: 'Tell Apple and users about Yere', owner: 'App owner',
    description: 'Use accurate screenshots, privacy answers and review instructions.',
    content: `<h3>Fill out the store page</h3><p>In App Store Connect → Yere → the intended App Store version, complete the name, subtitle, description, keywords, category, copyright, pricing, territories and current age-rating questions. Productivity is the existing suggested primary category.</p><p>Capture <strong>real screens from the tested app with fictional data</strong>. Supply the current iPhone/iPad screenshot sizes App Store Connect requests for supported devices. Draft listing text is in <code>docs/MOBILE_RELEASE.md</code>; verify it before publishing.</p>
      <h3>Check the public links and support inbox</h3><ul><li>${external('https://getyere.com', 'Website')}</li><li>${external('https://getyere.com/privacy-policy', 'Privacy Policy')}</li><li>${external('https://getyere.com/termsofuse', 'Terms of Use')}</li><li>${external('https://getyere.com/support.html', 'Support')}</li></ul><p>The support page references <code>support@getyere.com</code>. Confirm the mailbox exists and someone monitors it.</p>
      <h3>Privacy and compliance: answer from reality</h3><p>Review account/email identifiers, reminder and contact content, uploaded files, push IDs, usage/audit information and configured diagnostics. Do not select “Data Not Collected” just because there are no ads.</p><p>Have your engineer inspect <code>ios/App/App/PrivacyInfo.xcprivacy</code> and bundled SDK manifests, required-reason APIs and validation warnings. An empty app-level required-reason list does not prove the complete app needs no declarations. Do not copy arbitrary reason codes.</p><p>Confirm export-compliance answers: the current plist declares no non-exempt encryption, but the owner must verify that is accurate. Complete applicable agreements and regional requirements, including trader status where requested. Assess moderation/reporting requirements for shared content. If adding digital purchases, separately assess Apple’s purchase rules.</p>
      <h3>Give the reviewer a working Yere account</h3><ol><li>Create a dedicated, email-confirmed <strong>Yere test account in the backend used by the submitted build</strong>. Use fictional data and a login the reviewer can complete without your help.</li><li>Put its credentials only in the private <strong>App Review Information</strong> fields. This is not your Apple Developer account. Do not commit these credentials.</li><li>Explain how to create a reminder, enable push, use voice, test sharing and find <strong>Settings → Account & data → Delete account and cloud data</strong>. Mention that notification actions open the app and require account/data restoration.</li></ol>`,
    checks: [ ['metadata', 'Listing text, supported-device screenshots, availability and age rating are complete.'], ['urls', 'Legal/support pages work and the support inbox is monitored.'], ['privacy', 'App Privacy, SDK manifests, required-reason APIs and export compliance have been reviewed accurately.'], ['agreements', 'Applicable agreements, regional requirements and shared-content safety requirements are addressed.'], ['review-account', 'A working Yere review account and instructions are supplied privately in App Store Connect.'] ],
    help: `<p><strong>What should the screenshots show?</strong> Home, creating a reminder, details/photos, calendar and trusted contacts. Show only working features, using made-up names and reminders.</p><p><strong>Unsure about privacy or encryption?</strong> Have the owner and engineer review actual backend/SDK behaviour. Do not guess, declare “no data” or assume all speech recognition is on-device.</p>`
  },
  {
    id: 'submit', short: 'Submit for review', title: 'Send your tested build for review', owner: 'App owner',
    description: 'Your goal is a confirmed submission—not just a successful upload.',
    content: `<ol><li>Open ${external('https://appstoreconnect.apple.com/', 'App Store Connect')} → <strong>My Apps → Yere → the intended App Store version</strong>.</li><li>In the <strong>Build</strong> section, select the <strong>same version/build number that passed TestFlight testing</strong>. Confirm the listing, screenshots and review account are complete.</li><li>Choose your release method. <strong>Manual release</strong> lets you decide when to publish after approval.</li><li>Resolve all missing-information prompts. Use the current <strong>Add for Review / Submit for Review</strong> flow. If Apple shows a final submission confirmation, complete it.</li><li>Confirm App Store Connect shows a submitted review status such as <strong>Waiting for Review</strong> or <strong>In Review</strong>. Save a private record of the build and submission date.</li></ol>
      ${note('That’s the submission milestone', 'An uploaded archive, a TestFlight invitation or a completed checklist is not an App Store submission. Apple must show that your version has been submitted. Approval is a separate decision.', 'success')}
      <h3>If Apple asks for changes</h3><p>Read the exact review message. Give your engineer a sanitized copy, reproduce the issue, make the necessary changes and upload with a new build number when needed. Retest affected features, select the new build, respond in App Store Connect and resubmit.</p>
      <h3>What to keep / what to share</h3><p>Privately retain the source commit, archive, Xcode version, version/build numbers, test report, screenshots and key-rotation records. Share only build numbers, sanitized issues and review status with the original developer—not Apple credentials or private keys.</p>
      <p>For the latest Apple-specific instructions, use ${external('https://developer.apple.com/help/app-store-connect/', 'Apple’s App Store Connect help')}.</p>`,
    checks: [ ['tested-build', 'The selected build is exactly the one that passed device testing.'], ['release-method', 'The listing/review details are complete and I chose a release method.'], ['submitted', 'I completed Apple’s final submission flow, not just an upload.'], ['status', 'App Store Connect confirms Waiting for Review, In Review or another submitted review status.'] ],
    help: `<p><strong>I can’t submit?</strong> Look for missing metadata, agreements, privacy/compliance answers, screenshot sizes or an unprocessed build. Check your App Store Connect role has submission permission.</p><p><strong>Apple rejected the app?</strong> Submission is not guaranteed approval. Address the stated issue, not a guessed one; involve your engineer without handing over your private Apple account.</p>`
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
      else announce('All checklist items are checked. Confirm the submitted review status in App Store Connect; this page cannot verify it.');
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

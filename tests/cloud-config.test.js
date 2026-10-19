import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateSupabaseConfig, resolveRuntimeConfig, optionalConfigWarnings } from '../src/config.js';
import { verifyBundle } from '../scripts/verify-bundle.mjs';
import { validateGoogleServices } from '../scripts/validate-google-services.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const REF = 'abcdefghijklmnopqrst';
const URL_OK = `https://${REF}.supabase.co`;

function jwt(payload) {
  const enc = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.c2lnbmF0dXJlc2lnbmF0dXJl`;
}
const ANON_KEY = jwt({ iss: 'supabase', ref: REF, role: 'anon', iat: 1700000000, exp: 2000000000 });
const SERVICE_KEY = jwt({ iss: 'supabase', ref: REF, role: 'service_role', iat: 1700000000, exp: 2000000000 });
const PUBLISHABLE_KEY = 'sb_publishable_AbCdEf0123456789_xyz';

// Environment for child processes: only what the tools need, never the developer's Supabase values.
function cleanEnv(extra = {}) {
  const env = { PATH: process.env.PATH || '', HOME: process.env.HOME || '', NODE_ENV: 'test' };
  for (const key of Object.keys(env)) if (!env[key]) delete env[key];
  return { ...env, ...extra };
}

// ---------- 1. CI environment wiring ----------

test('CI passes the four GitHub repository variables into the Vite and Capacitor build', async () => {
  const workflow = await read('.github/workflows/build-android.yml');
  const jobEnv = workflow.slice(workflow.indexOf('    env:'), workflow.indexOf('    steps:'));
  assert.match(jobEnv, /VITE_SUPABASE_URL: \$\{\{ vars\.VITE_SUPABASE_URL \}\}/);
  assert.match(jobEnv, /VITE_SUPABASE_ANON_KEY: \$\{\{ vars\.VITE_SUPABASE_ANON_KEY \}\}/);
  assert.match(jobEnv, /VITE_PUBLIC_APP_URL: \$\{\{ vars\.VITE_PUBLIC_APP_URL \}\}/);
  assert.match(jobEnv, /VITE_VAPID_PUBLIC_KEY: \$\{\{ vars\.VITE_VAPID_PUBLIC_KEY \}\}/);
  // Values must come from repository variables, never from secrets or literals.
  assert.doesNotMatch(jobEnv, /secrets\./);
});

test('CI never hard-codes Supabase project URLs, JWTs, or secret keys in the workflow or source', async () => {
  const files = ['.github/workflows/build-android.yml', 'src/config.js', 'src/bootstrap.js', 'src/native.js', 'index.html', 'vite.config.js'];
  for (const file of files) {
    const text = await read(file);
    assert.doesNotMatch(text, /https:\/\/[a-z0-9]{20}\.supabase\.co/, `${file} must not contain a real project URL`);
    assert.doesNotMatch(text, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, `${file} must not contain a JWT`);
    assert.doesNotMatch(text, /sb_secret_[A-Za-z0-9]/, `${file} must not contain a Supabase secret key`);
  }
});

test('CI validates configuration before installing, building, or uploading anything', async () => {
  const workflow = await read('.github/workflows/build-android.yml');
  const validate = workflow.indexOf('node scripts/validate-cloud-env.mjs --target native');
  const install = workflow.indexOf('npm ci');
  const build = workflow.indexOf('npm run build:native');
  const verifyWeb = workflow.indexOf('node scripts/verify-bundle.mjs dist');
  const sync = workflow.indexOf('npx cap sync android');
  const verifyNative = workflow.indexOf('node scripts/verify-bundle.mjs android/app/src/main/assets/public');
  const assemble = workflow.indexOf('./gradlew --no-daemon --stacktrace assembleDebug');
  const verifyApk = workflow.indexOf('node scripts/verify-bundle.mjs android/app/build/outputs/apk/debug/app-debug.apk');
  const upload = workflow.indexOf('actions/upload-artifact@v7');
  for (const index of [validate, install, build, verifyWeb, sync, verifyNative, assemble, verifyApk, upload]) {
    assert.ok(index > 0, 'every gate must exist in the workflow');
  }
  assert.ok(validate < install, 'configuration is checked before dependencies install');
  assert.ok(validate < build && build < verifyWeb && verifyWeb < sync, 'web bundle is verified before Capacitor sync');
  assert.ok(sync < verifyNative && verifyNative < assemble, 'synced native assets are verified before Gradle');
  assert.ok(assemble < verifyApk && verifyApk < upload, 'the APK is verified before it is uploaded');
  // The validation step must not be skipped by a continue-on-error or if: guard.
  const validateBlock = workflow.slice(workflow.lastIndexOf('- name:', validate), validate);
  assert.doesNotMatch(validateBlock, /continue-on-error|if:/);
});

test('CI uses the encrypted GOOGLE_SERVICES_JSON_B64 secret without ever uploading or committing the Firebase file', async () => {
  const workflow = await read('.github/workflows/build-android.yml');
  assert.match(workflow, /GOOGLE_SERVICES_JSON_B64: \$\{\{ secrets\.GOOGLE_SERVICES_JSON_B64 \}\}/);
  assert.match(workflow, /base64 --decode > android\/app\/google-services\.json/);
  assert.match(workflow, /node scripts\/validate-google-services\.mjs android\/app\/google-services\.json/);
  // The secret is scoped to the one step that needs it, not exposed to the whole job.
  const jobEnv = workflow.slice(workflow.indexOf('    env:'), workflow.indexOf('    steps:'));
  assert.doesNotMatch(jobEnv, /GOOGLE_SERVICES/);
  const uploadBlock = workflow.slice(workflow.indexOf('actions/upload-artifact@v7'));
  assert.doesNotMatch(uploadBlock, /google-services|\.jks|keystore/i);
  assert.equal(existsSync(path.join(root, 'android/app/google-services.json')), false, 'google-services.json must not be checked in');
});

test('artifact upload only includes the APK and its checksum', async () => {
  const workflow = await read('.github/workflows/build-android.yml');
  const upload = workflow.slice(workflow.indexOf('- name: Upload debug APK'));
  const paths = upload.slice(upload.indexOf('path: |'), upload.indexOf('if-no-files-found'));
  const entries = paths.split('\n').map(line => line.trim()).filter(line => line.startsWith('android/'));
  assert.deepEqual(entries, [
    'android/app/build/outputs/apk/debug/app-debug.apk',
    'android/app/build/outputs/apk/debug/app-debug.apk.sha256'
  ]);
});

test('.gitignore keeps Firebase, service-account, and signing material out of Git', async () => {
  const gitignore = await read('.gitignore');
  for (const pattern of ['google-services.json', '*firebase-adminsdk*.json', '*service-account*.json', '*.p12', '*.jks', '*.keystore', '*.p8', '.env.*']) {
    assert.ok(gitignore.split('\n').includes(pattern), `${pattern} must be ignored`);
  }
  assert.match(await read('android/.gitignore'), /google-services\.json/);
});

// ---------- 2. Validation rules ----------

test('a correct Supabase URL and publishable or anon key pass validation', () => {
  assert.deepEqual(validateSupabaseConfig({ url: URL_OK, anonKey: PUBLISHABLE_KEY }), []);
  assert.deepEqual(validateSupabaseConfig({ url: URL_OK, anonKey: ANON_KEY }), []);
});

test('missing Supabase URL or key is rejected with the variable name in the message', () => {
  const missingUrl = validateSupabaseConfig({ url: '', anonKey: PUBLISHABLE_KEY });
  assert.equal(missingUrl.length, 1);
  assert.match(missingUrl[0], /VITE_SUPABASE_URL is missing/);
  const missingKey = validateSupabaseConfig({ url: URL_OK, anonKey: '   ' });
  assert.equal(missingKey.length, 1);
  assert.match(missingKey[0], /VITE_SUPABASE_ANON_KEY is missing/);
  assert.equal(validateSupabaseConfig({}).length, 2);
});

test('placeholder, insecure, and mismatched values are rejected', () => {
  assert.ok(validateSupabaseConfig({ url: 'https://YOUR_PROJECT_REF.supabase.co', anonKey: PUBLISHABLE_KEY }).some(m => /placeholder/.test(m)));
  assert.ok(validateSupabaseConfig({ url: URL_OK, anonKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY' }).some(m => /placeholder/.test(m)));
  assert.ok(validateSupabaseConfig({ url: 'http://insecure.example.com', anonKey: PUBLISHABLE_KEY }).some(m => /https/.test(m)));
  assert.ok(validateSupabaseConfig({ url: 'not a url', anonKey: PUBLISHABLE_KEY }).some(m => /valid URL/.test(m)));
  assert.ok(validateSupabaseConfig({ url: 'https://otherproject0000000000.supabase.co', anonKey: ANON_KEY }).some(m => /belongs to project/.test(m)));
});

test('service-role and secret keys can never be embedded in a client build', () => {
  assert.ok(validateSupabaseConfig({ url: URL_OK, anonKey: SERVICE_KEY }).some(m => /service_role/.test(m)));
  assert.ok(validateSupabaseConfig({ url: URL_OK, anonKey: 'sb_secret_abcdefghijklmnop' }).some(m => /SECRET key/.test(m)));
  assert.ok(validateSupabaseConfig({ url: URL_OK, anonKey: 'random-garbage' }).some(m => /not a recognised/.test(m)));
});

test('optional web values warn but never block a native build', () => {
  const warnings = optionalConfigWarnings({ vapidPublicKey: '', publicAppUrl: 'http://insecure' });
  assert.ok(warnings.some(w => /VITE_VAPID_PUBLIC_KEY/.test(w)));
  assert.ok(warnings.some(w => /https/.test(w)));
  const result = resolveRuntimeConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: PUBLISHABLE_KEY }, { native: true });
  assert.equal(result.mode, 'native-cloud');
  assert.equal(result.configured, true);
});

// ---------- 3. Build failure without cloud configuration ----------

test('pre-build validation exits non-zero and names the missing variables for native builds', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate-cloud-env.mjs'), '--target', 'native'], {
    cwd: root, env: cleanEnv(), encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /VITE_SUPABASE_URL is missing/);
  assert.match(result.stderr, /VITE_SUPABASE_ANON_KEY is missing/);
  assert.match(result.stderr, /Refusing to build a native app/);
  assert.doesNotMatch(result.stdout + result.stderr, /sb_publishable_|eyJ/);
});

test('pre-build validation exits zero for a valid native configuration and never prints the key', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate-cloud-env.mjs'), '--target', 'native'], {
    cwd: root,
    env: cleanEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: ANON_KEY }),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Cloud configuration OK/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(ANON_KEY.slice(0, 40)));
});

test('the web build may still run without cloud configuration (demo allowed) but reports it', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/validate-cloud-env.mjs'), '--target', 'web'], {
    cwd: root, env: cleanEnv(), encoding: 'utf8'
  });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /WARNING: VITE_SUPABASE_URL is missing/);
});

test('vite build --mode native fails with no cloud configuration and produces no output', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'yere-native-fail-'));
  try {
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'native', '--outDir', outDir, '--emptyOutDir'], {
      cwd: root, env: cleanEnv(), encoding: 'utf8'
    });
    assert.notEqual(result.status, 0, 'native build must fail');
    assert.match(result.stdout + result.stderr, /Native Yere build refused/);
    assert.equal(existsSync(path.join(outDir, 'index.html')), false, 'no bundle may be written');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('vite build --mode native with a valid configuration produces a bundle wired to Supabase', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'yere-native-ok-'));
  try {
    const env = cleanEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_PUBLIC_APP_URL: 'https://www.getyere.com' });
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'native', '--outDir', outDir, '--emptyOutDir'], {
      cwd: root, env, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const verdict = verifyBundle(outDir, env);
    assert.equal(verdict.ok, true, verdict.problems?.join('; '));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ---------- 4. Native builds never fall back to seeded demo content ----------

test('native builds resolve to native-blocked when cloud configuration is absent, never to demo mode', () => {
  const blocked = resolveRuntimeConfig({}, { native: true });
  assert.equal(blocked.mode, 'native-blocked');
  assert.equal(blocked.configured, false);
  assert.ok(blocked.errors.length >= 2);
  assert.equal(blocked.url, '');
  assert.equal(blocked.anonKey, '');
  assert.equal(resolveRuntimeConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: 'YOUR_KEY' }, { native: true }).mode, 'native-blocked');
  // The browser build keeps its local demo, clearly labelled, when cloud config is missing.
  assert.equal(resolveRuntimeConfig({}, { native: false }).mode, 'web-demo');
  assert.equal(resolveRuntimeConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: PUBLISHABLE_KEY }, { native: false }).mode, 'web-cloud');
});

test('index.html blocks native boot before any demo state is loaded or rendered', async () => {
  const html = await read('index.html');
  const boot = html.slice(html.indexOf('async function bootApp(){'), html.indexOf("document.addEventListener('DOMContentLoaded',bootApp"));
  const guard = boot.indexOf("window.YERE_ENV?.mode==='native-blocked'");
  assert.ok(guard > 0, 'bootApp checks for native-blocked mode');
  assert.ok(guard < boot.indexOf('load(true)') || boot.indexOf('load(true)') < 0, 'guard runs first');
  assert.match(boot.slice(guard, guard + 200), /showNativeConfigError\(window\.YERE_ENV\.errors\);return;/);
  // The only seed path in the boot function is the web-demo branch, which runs after the guard.
  assert.ok(boot.indexOf('load(true)') > guard);
  assert.match(html, /function showNativeConfigError\(errors\)/);
  assert.match(html, /id="nativeConfigError"/);
  assert.match(html, /Yere can’t connect yet/);
});

test('seeding sample data is impossible on native builds', async () => {
  const html = await read('index.html');
  assert.match(html, /function seed\(\) \{\n  if \(isNativeApp\(\)\) return;/);
  assert.match(html, /const canSeed=seedIfEmpty&&!isNativeApp\(\);/);
  assert.match(html, /else if \(canSeed\) seed\(\);/);
  assert.doesNotMatch(html, /else if \(seedIfEmpty\) seed\(\)/);
});

test('static HTML does not show sample people or demo labels before JavaScript decides the mode', async () => {
  const html = await read('index.html');
  const shell = html.slice(0, html.indexOf('<!-- Content views -->'));
  assert.doesNotMatch(shell, /Tunde|Adebayo|Amina/);
  assert.doesNotMatch(shell, /Local demo workspace/);
  assert.match(shell, /id="meName">Yere</);
});

test('native launch purges legacy unscoped demo storage instead of restoring it', async () => {
  const native = await read('src/native.js');
  assert.match(native, /const LEGACY_DEMO_KEYS = \['Yere\.v1', 'Yere\.v2'\];/);
  assert.match(native, /function purgeLegacyDemoStorage\(\)/);
  const hydrate = native.slice(native.indexOf('async function hydrateOfflineCache'), native.indexOf('function writeOfflineCache'));
  assert.match(hydrate, /purgeLegacyDemoStorage\(\);\n  try \{/);
  assert.match(hydrate, /if \(LEGACY_DEMO_KEYS\.includes\(key\)\) continue;/);
});

test('the browser bootstrap never creates a Supabase client from invalid values', async () => {
  const bootstrap = await read('src/bootstrap.js');
  assert.match(bootstrap, /if \(runtime\.configured\) \{\n  try \{\n    client = createClient\(runtime\.url, runtime\.anonKey/);
  assert.match(bootstrap, /const mode = client \? runtime\.mode : \(runtime\.native \? 'native-blocked' : 'web-demo'\);/);
  assert.doesNotMatch(bootstrap, /VITE_SUPABASE_SERVICE_ROLE_KEY|service_role/);
});

// ---------- 5. Built output proves it is the real backend ----------

test('verifyBundle accepts output that contains the real URL and key, and rejects demo or misconfigured output', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'yere-bundle-'));
  try {
    const env = { VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: ANON_KEY };
    await mkdir(path.join(dir, 'assets'));
    await writeFile(path.join(dir, 'assets', 'index.js'), `const cfg={url:"${URL_OK}",key:"${ANON_KEY}"};`);
    assert.equal(verifyBundle(dir, env).ok, true);

    await writeFile(path.join(dir, 'assets', 'index.js'), 'const cfg={url:"https://YOUR_PROJECT_REF.supabase.co"};');
    const missing = verifyBundle(dir, env);
    assert.equal(missing.ok, false);
    assert.ok(missing.problems.some(p => /does not contain VITE_SUPABASE_URL/.test(p)));

    await writeFile(path.join(dir, 'assets', 'index.js'), `const cfg={url:"${URL_OK}",key:"${ANON_KEY}",svc:"${SERVICE_KEY}"};`);
    const leaked = verifyBundle(dir, env);
    assert.equal(leaked.ok, false);
    assert.ok(leaked.problems.some(p => /service_role/.test(p)));

    await writeFile(path.join(dir, 'assets', 'index.js'), `const cfg={url:"${URL_OK}",key:"${ANON_KEY}",s:"sb_secret_abcdefghijkl"};`);
    assert.ok(verifyBundle(dir, env).problems.some(p => /secret key/.test(p)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('verifyBundle refuses to pass when the build environment itself is not cloud-configured', () => {
  const verdict = verifyBundle('/nonexistent', {});
  assert.equal(verdict.ok, false);
  assert.match(verdict.problems[0], /VITE_SUPABASE_URL is missing/);
});

// ---------- 6. Firebase client config ----------

test('google-services.json validation accepts only the Android client config for com.getyere.app', () => {
  const good = JSON.stringify({ project_info: { project_id: 'yere' }, client: [{ client_info: { android_client_info: { package_name: 'com.getyere.app' } } }] });
  assert.deepEqual(validateGoogleServices(good), []);
  const wrongPackage = JSON.stringify({ project_info: { project_id: 'yere' }, client: [{ client_info: { android_client_info: { package_name: 'com.example' } } }] });
  assert.ok(validateGoogleServices(wrongPackage).some(m => /com\.getyere\.app/.test(m)));
  const serviceAccount = JSON.stringify({ type: 'service_account', project_id: 'yere', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n' });
  const serviceErrors = validateGoogleServices(serviceAccount);
  assert.ok(serviceErrors.some(m => /private key/.test(m)));
  assert.ok(validateGoogleServices('not json').some(m => /not valid JSON/.test(m)));
});

test('Firebase and Supabase server secrets are documented as server-only, never as VITE_ values', async () => {
  const envExample = await read('.env.example');
  assert.doesNotMatch(envExample, /^VITE_(FIREBASE|APNS|SUPABASE_SERVICE|RESEND|TWILIO|VAPID_PRIVATE)/m);
  const deployment = await read('DEPLOYMENT.md');
  assert.match(deployment, /GOOGLE_SERVICES_JSON_B64/);
  assert.match(deployment, /VITE_SUPABASE_URL/);
  assert.match(deployment, /build:native/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  ATTACHMENT_BUCKET,
  CORE_TABLES,
  EDGE_FUNCTIONS,
  NATIVE_MIGRATION_COLUMNS,
  describeKeyFormat,
  verifyBackend
} from '../scripts/verify-backend.mjs';
import { checkManifest, checkPluginRegistry, SPEECH_PLUGIN } from '../scripts/verify-native-voice.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const REF = 'backendcheck00000000';
const URL_OK = `https://${REF}.supabase.co`;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const ANON_KEY = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'supabase', ref: REF, role: 'anon', iat: 1700000000, exp: 2000000000 })}.signature`;
const PUBLISHABLE_KEY = 'sb_publishable_LocalTestOnly0000000';

function cleanEnv(extra = {}) {
  return { PATH: process.env.PATH || '', HOME: process.env.HOME || '', NODE_ENV: 'test', ...extra };
}

/** Builds a fake fetch that answers like a Supabase project with the given gaps. */
function fakeSupabase({ missingFunctions = [], tables = CORE_TABLES, nativeColumns = NATIVE_MIGRATION_COLUMNS.columns, signupDisabled = false, bucketStatus = 200, rejectBearer = false } = {}) {
  const requests = [];
  const spec = {
    definitions: Object.fromEntries(tables.map((table) => [
      table,
      { properties: table === NATIVE_MIGRATION_COLUMNS.table ? Object.fromEntries(nativeColumns.map((column) => [column, {}])) : { id: {} } }
    ]))
  };
  const respond = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => body });
  const fetchImpl = async (url, init = {}) => {
    const headers = init.headers || {};
    requests.push({ url, method: init.method || 'GET', headers, body: init.body });
    const isGet = (init.method || 'GET') === 'GET';
    // A gateway that refuses a non-JWT bearer token but accepts apikey-only requests.
    if (rejectBearer && isGet && headers.authorization) return respond(401, JSON.stringify({ message: 'Missing JWT' }));
    if (url.endsWith('/rest/v1/')) return respond(200, JSON.stringify(spec));
    if (url.includes('/functions/v1/')) {
      const name = url.split('/functions/v1/')[1];
      return missingFunctions.includes(name) ? respond(404, 'Function not found') : respond(401, JSON.stringify({ error: 'Sign in.' }));
    }
    if (url.includes('/auth/v1/settings')) {
      return respond(200, JSON.stringify({ disable_signup: signupDisabled, mailer_autoconfirm: false, external: { apple: false, google: false } }));
    }
    if (url.includes('/storage/v1/bucket/')) return respond(bucketStatus, bucketStatus === 200 ? JSON.stringify({ name: ATTACHMENT_BUCKET }) : '');
    return respond(404, '');
  };
  return { fetchImpl, requests };
}

// ---------- Backend deployment verification ----------

test('a fully deployed project reports nothing missing', async () => {
  const { fetchImpl, requests } = fakeSupabase();
  const report = await verifyBackend({ url: URL_OK, anonKey: ANON_KEY, fetchImpl });
  assert.equal(report.ok, true, JSON.stringify(report.missing));
  assert.deepEqual(report.missing, []);
  assert.equal(report.present.some((line) => line.includes('Core migration applied')), true);
  assert.equal(report.present.some((line) => line.includes('Native migration applied')), true);
  for (const fn of EDGE_FUNCTIONS) {
    assert.ok(report.present.some((line) => line.includes(`Edge Function ${fn.name} is deployed`)), `${fn.name} verified`);
  }
  assert.ok(report.present.some((line) => line.includes(ATTACHMENT_BUCKET)));
  assert.ok(report.notes.some((note) => note.includes('schedule-reminders.sql.example')), 'the cron step is documented');
  // Read-only: only GETs plus the empty POST probes, and the key never appears in a URL.
  for (const request of requests) {
    assert.ok(!request.url.includes(ANON_KEY), 'the anon key is never placed in a URL');
    if (request.method === 'POST') assert.equal(request.body, '{}', 'Edge Function probes send an empty body');
  }
  assert.ok(!JSON.stringify(report).includes(ANON_KEY), 'the report never echoes the key');
});

test('an undeployed Edge Function is named with the command that deploys it', async () => {
  const { fetchImpl } = fakeSupabase({ missingFunctions: ['delete-account', 'dispatch-reminders'] });
  const report = await verifyBackend({ url: URL_OK, anonKey: ANON_KEY, fetchImpl });
  assert.equal(report.ok, false);
  assert.equal(report.missing.length, 2);
  assert.match(report.missing[0], /Edge Function delete-account is not deployed/);
  assert.match(report.missing[0], /Account & data/);
  assert.match(report.missing[1], /dispatch-reminders/);
  for (const item of report.missing) assert.match(item, /supabase functions deploy/);
});

test('the native migration is verified through the columns it adds', async () => {
  const { fetchImpl } = fakeSupabase({ nativeColumns: ['endpoint'] });
  const report = await verifyBackend({ url: URL_OK, anonKey: ANON_KEY, fetchImpl });
  assert.equal(report.ok, false);
  assert.match(report.missing[0], /202610150001_native_mobile\.sql is not applied/);
  assert.match(report.missing[0], /device_token/);
  assert.match(report.missing[0], /supabase db push/);
});

test('a missing core table and a disabled sign-up are both blocking findings', async () => {
  const { fetchImpl } = fakeSupabase({ tables: CORE_TABLES.filter((table) => table !== 'contact_invites'), signupDisabled: true });
  const report = await verifyBackend({ url: URL_OK, anonKey: ANON_KEY, fetchImpl });
  assert.equal(report.ok, false);
  assert.ok(report.missing.some((item) => /202610120001_yere_core\.sql is not fully applied/.test(item) && item.includes('contact_invites')));
  assert.ok(report.missing.some((item) => /Email sign-up is disabled/.test(item)));
});

test('an unreachable or private endpoint is reported as inconclusive, never as a false pass or fail', async () => {
  const offline = await verifyBackend({
    url: URL_OK,
    anonKey: ANON_KEY,
    fetchImpl: async () => {
      throw new Error('fetch failed');
    }
  });
  assert.equal(offline.ok, false, 'an unverifiable project is not reported as fully verified');
  assert.ok(offline.unknown.length > 0);
  assert.deepEqual(offline.missing, [], 'a network failure must not be reported as "not deployed"');

  const { fetchImpl } = fakeSupabase({ bucketStatus: 400 });
  const privateBucket = await verifyBackend({ url: URL_OK, anonKey: ANON_KEY, fetchImpl });
  assert.ok(privateBucket.unknown.some((item) => item.includes(ATTACHMENT_BUCKET)));
  assert.ok(!privateBucket.missing.some((item) => item.includes(ATTACHMENT_BUCKET)));
  assert.equal(privateBucket.ok, false, 'an inconclusive probe is not a clean bill of health');
});

test('the backend check refuses to guess without valid configuration and never prints the key', () => {
  const strict = spawnSync(process.execPath, [path.join(root, 'scripts/verify-backend.mjs'), '--strict'], {
    cwd: root, env: cleanEnv(), encoding: 'utf8'
  });
  assert.equal(strict.status, 1);
  assert.match(strict.stdout, /VITE_SUPABASE_URL is missing/);
  assert.match(strict.stdout, /VITE_SUPABASE_ANON_KEY is missing/);
  assert.doesNotMatch(strict.stdout + strict.stderr, /eyJ|sb_publishable_|sb_secret_/);

  const lenient = spawnSync(process.execPath, [path.join(root, 'scripts/verify-backend.mjs')], {
    cwd: root, env: cleanEnv(), encoding: 'utf8'
  });
  assert.equal(lenient.status, 0, 'the default report never fails a build');

  const skipped = spawnSync(process.execPath, [path.join(root, 'scripts/verify-backend.mjs')], {
    cwd: root, env: cleanEnv({ YERE_SKIP_BACKEND_CHECK: '1' }), encoding: 'utf8'
  });
  assert.equal(skipped.status, 0);
  assert.match(skipped.stdout, /skipped/);
});

test('CI runs the backend check read-only, before the build, and it cannot block the APK', async () => {
  const workflow = await read('.github/workflows/build-android.yml');
  const backend = workflow.indexOf('node scripts/verify-backend.mjs');
  const build = workflow.indexOf('npm run build:native');
  const upload = workflow.indexOf('actions/upload-artifact@v7');
  assert.ok(backend > 0 && build > 0 && upload > 0);
  assert.ok(backend < build, 'the backend report is produced before the bundle is built');
  assert.ok(backend < upload);
  const stepStart = workflow.lastIndexOf('- name:', backend);
  const stepBlock = workflow.slice(stepStart, workflow.indexOf('- name:', backend));
  assert.match(stepBlock, /continue-on-error: true/, 'a backend gap must not stop an otherwise valid APK');
  assert.match(stepBlock, /GITHUB_STEP_SUMMARY/, 'the result is published on the run summary');
  assert.doesNotMatch(stepBlock, /--strict/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY|service_role|ACCESS_TOKEN/);
});

test('a publishable key that the gateway rejects as a bearer token is retried with apikey only', async () => {
  const { fetchImpl, requests } = fakeSupabase({ rejectBearer: true });
  const report = await verifyBackend({ url: URL_OK, anonKey: PUBLISHABLE_KEY, fetchImpl });
  assert.deepEqual(report.missing, [], JSON.stringify(report.missing));
  assert.ok(report.present.some((line) => line.includes('Core migration applied')), 'migrations are verified after the retry');
  assert.ok(report.present.some((line) => line.includes('Native migration applied')));
  assert.ok(report.present.some((line) => line.includes('Email sign-up is enabled')));
  const restRequests = requests.filter((request) => request.url.endsWith('/rest/v1/'));
  assert.equal(restRequests.length, 2, 'exactly one retry');
  assert.ok(restRequests[0].headers.authorization, 'the first attempt sends both headers');
  assert.equal(restRequests[1].headers.authorization, undefined, 'the retry uses apikey only');
  assert.equal(restRequests[1].headers.apikey, PUBLISHABLE_KEY);
  assert.ok(!JSON.stringify(report).includes(PUBLISHABLE_KEY), 'the key is never echoed back');
});

test('the key format is named for diagnosis without printing any key material', async () => {
  assert.equal(describeKeyFormat(PUBLISHABLE_KEY), 'Supabase publishable key (sb_publishable_...)');
  assert.equal(describeKeyFormat(ANON_KEY), 'legacy Supabase anon JWT');
  assert.equal(describeKeyFormat('sb_secret_AbCdEf0123456789'), 'Supabase SECRET key (must never be used in a client build)');
  assert.equal(describeKeyFormat('nonsense'), 'unrecognised key format');

  const { fetchImpl } = fakeSupabase();
  const report = await verifyBackend({ url: URL_OK, anonKey: PUBLISHABLE_KEY, fetchImpl });
  const note = report.notes.find((line) => line.includes('Public key format'));
  assert.ok(note, 'the report names the key format');
  assert.ok(!note.includes(PUBLISHABLE_KEY));
  assert.doesNotMatch(JSON.stringify(report), /sb_publishable_[A-Za-z0-9]{5,}/);
});

test('a REST API that refuses both header styles is reported as inconclusive, not as missing migrations', async () => {
  const report = await verifyBackend({
    url: URL_OK,
    anonKey: PUBLISHABLE_KEY,
    fetchImpl: async (url, init = {}) => {
      if (url.endsWith('/rest/v1/')) return { status: 401, ok: false, text: async () => 'Missing JWT' };
      if (url.includes('/functions/v1/')) return { status: 401, ok: false, text: async () => '' };
      if (url.includes('/auth/v1/settings')) return { status: 401, ok: false, text: async () => '' };
      if (url.includes('/storage/v1/bucket/')) return { status: 401, ok: false, text: async () => '' };
      void init;
      return { status: 404, ok: false, text: async () => '' };
    }
  });
  assert.deepEqual(report.missing, []);
  assert.ok(report.unknown.some((item) => /Postgres REST API answered HTTP 401/.test(item)));
  assert.equal(report.ok, false);
});

// ---------- Native voice bundling ----------

test('the plugin registry check requires the Capacitor 8 speech plugin', () => {
  assert.deepEqual(checkPluginRegistry(JSON.stringify([{ pkg: SPEECH_PLUGIN, classpath: 'app.capgo.speechrecognition.SpeechRecognitionPlugin' }])), []);
  const missing = checkPluginRegistry(JSON.stringify([{ pkg: '@capacitor/app' }]));
  assert.equal(missing.length, 1);
  assert.match(missing[0], /not registered in capacitor\.plugins\.json/);
  assert.match(checkPluginRegistry('not json')[0], /not valid JSON/);
});

test('the manifest check requires RECORD_AUDIO and the RecognitionService package-visibility query', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  assert.deepEqual(checkManifest(manifest), []);
  assert.match(checkManifest(manifest.replace(/android\.speech\.RecognitionService/, 'android.intent.action.MAIN'))[0], /queries/);
  assert.match(checkManifest(manifest.replace(/android\.permission\.RECORD_AUDIO/, 'android.permission.INTERNET'))[0], /RECORD_AUDIO/);
});

test('CI proves voice capture is inside the synced assets and the final APK', async () => {
  const workflow = await read('.github/workflows/build-android.yml');
  const sync = workflow.indexOf('npx cap sync android');
  const registryCheck = workflow.indexOf('node scripts/verify-native-voice.mjs android/app/src/main/assets/capacitor.plugins.json');
  const assemble = workflow.indexOf('assembleDebug');
  const apkCheck = workflow.indexOf('node scripts/verify-native-voice.mjs android/app/build/outputs/apk/debug/app-debug.apk');
  const upload = workflow.indexOf('actions/upload-artifact@v7');
  for (const index of [sync, registryCheck, assemble, apkCheck, upload]) assert.ok(index > 0);
  assert.ok(sync < registryCheck && registryCheck < assemble, 'the plugin registry is checked after sync and before Gradle');
  assert.ok(assemble < apkCheck && apkCheck < upload, 'the APK itself is checked before it can be uploaded');
  assert.match(workflow, /--aapt2 "\$\{ANDROID_SDK_ROOT\}\/build-tools\/36\.0\.0\/aapt2"/);
  const apkStep = workflow.slice(workflow.lastIndexOf('- name:', apkCheck), upload);
  assert.doesNotMatch(apkStep, /continue-on-error/, 'a voice-less APK must never be published');
});

test('the verification scripts are wired into npm and documented', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts['verify:backend'], 'node scripts/verify-backend.mjs');
  const deployment = await read('DEPLOYMENT.md');
  assert.match(deployment, /verify:backend|verify-backend\.mjs/);
  assert.match(deployment, /202610150001_native_mobile\.sql/);
  assert.match(deployment, /dispatch-reminders/);
});

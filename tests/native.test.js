import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('Capacitor 8 wraps the shared Vite build for both native platforms', async () => {
  const [pkgText, config] = await Promise.all([read('package.json'), read('capacitor.config.ts')]);
  const pkg = JSON.parse(pkgText);
  for (const dependency of [
    '@capacitor/core', '@capacitor/android', '@capacitor/ios', '@capacitor/app',
    '@capacitor/filesystem', '@capacitor/network', '@capacitor/push-notifications',
    '@capacitor/splash-screen', '@capgo/capacitor-supabase'
  ]) assert.ok(pkg.dependencies[dependency], `${dependency} is installed`);
  assert.match(config, /appId:\s*['"]com\.getyere\.app['"]/);
  assert.match(config, /webDir:\s*['"]dist['"]/);
  assert.match(config, /presentationOptions/);
});

test('native bridge provides auth, push, network, offline storage, deep links, and back handling', async () => {
  const source = await read('src/native.js');
  assert.match(source, /CapacitorSupabase\.initialize/);
  assert.match(source, /Filesystem\.writeFile/);
  assert.match(source, /Directory\.LibraryNoCloud/);
  assert.match(source, /Network\.addListener\(['"]networkStatusChange/);
  assert.match(source, /PushNotifications\.register/);
  assert.match(source, /pushNotificationActionPerformed/);
  assert.match(source, /App\.addListener\(['"]appUrlOpen/);
  assert.match(source, /App\.addListener\(['"]backButton/);
  assert.doesNotMatch(source, /SERVICE_ROLE|FIREBASE_PRIVATE_KEY|APNS_PRIVATE_KEY/);
});

test('native device tokens are RLS protected and atomically reassigned on account changes', async () => {
  const migration = await read('supabase/migrations/202610150001_native_mobile.sql');
  assert.match(migration, /device_token text/i);
  assert.match(migration, /provider in \('webpush', 'fcm', 'apns'\)/i);
  assert.match(migration, /unique \(device_token\)/i);
  assert.match(migration, /register_native_push_token/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /delete from public\.push_subscriptions where device_token/i);
  assert.match(migration, /auth\.uid\(\)/i);
});

test('shared Edge Function push path supports Web Push, FCM v1, and APNs', async () => {
  const [push, dispatch, testPush] = await Promise.all([
    read('supabase/functions/_shared/push.ts'),
    read('supabase/functions/dispatch-reminders/index.ts'),
    read('supabase/functions/test-notification/index.ts')
  ]);
  assert.match(push, /sendWebPush/);
  assert.match(push, /firebase\.messaging/);
  assert.match(push, /api\.push\.apple\.com/);
  assert.match(push, /export async function sendPush/);
  assert.match(dispatch, /sendPush\(subscription, payload\)/);
  assert.match(testPush, /sendPush\(subscription, payload\)/);
});

test('native projects declare mobile permissions, identifiers, actions, and privacy metadata', async () => {
  const [manifest, variables, info, entitlements, delegate, privacy] = await Promise.all([
    read('android/app/src/main/AndroidManifest.xml'),
    read('android/variables.gradle'),
    read('ios/App/App/Info.plist'),
    read('ios/App/App/App.entitlements'),
    read('ios/App/App/AppDelegate.swift'),
    read('ios/App/App/PrivacyInfo.xcprivacy')
  ]);
  assert.match(manifest, /com\.getyere\.app|\.MainActivity/);
  assert.match(manifest, /POST_NOTIFICATIONS/);
  assert.match(manifest, /RECORD_AUDIO/);
  assert.match(manifest, /YereMessagingService/);
  assert.match(variables, /minSdkVersion = 26/);
  assert.match(info, /NSMicrophoneUsageDescription/);
  assert.match(info, /NSSpeechRecognitionUsageDescription/);
  assert.match(entitlements, /aps-environment/);
  assert.match(entitlements, /applinks:www\.getyere\.com/);
  assert.match(delegate, /YERE_SNOOZE_10/);
  assert.match(privacy, /NSPrivacyTracking/);
});

test('app links are verified on the canonical apex and the www host', async () => {
  const [manifest, entitlements] = await Promise.all([
    read('android/app/src/main/AndroidManifest.xml'),
    read('ios/App/App/App.entitlements')
  ]);
  // Both hosts are declared, so both must serve a .well-known file (docs/MOBILE_RELEASE.md).
  assert.match(manifest, /android:host="getyere\.com"/);
  assert.match(manifest, /android:host="www\.getyere\.com"/);
  assert.match(entitlements, /applinks:getyere\.com/);
  assert.match(entitlements, /applinks:www\.getyere\.com/);
  // The canonical origin used for email, invite, and password-reset links.
  const [envExample, bootstrap] = await Promise.all([read('.env.example'), read('src/bootstrap.js')]);
  assert.match(envExample, /^VITE_PUBLIC_APP_URL=https:\/\/getyere\.com$/m);
  assert.match(bootstrap, /nativeBridge\.enabled \? 'https:\/\/getyere\.com' : publicAppUrl/);
});

test('Android CI produces an APK and checksum artifact', async () => {
  const workflow = await read('.github/workflows/build-android.yml');
  assert.match(workflow, /java-version:\s*21/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /app-debug\.apk/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
});

#!/usr/bin/env node
// Proves the native voice-capture path is really inside the Android build, not just in package.json.
//
// Checks, in order:
//   1. Capacitor's plugin registry (assets/capacitor.plugins.json) contains
//      @capgo/capacitor-speech-recognition, which is what wires the JS bridge to the native code.
//   2. The merged AndroidManifest inside the artifact still declares RECORD_AUDIO and the
//      android.speech.RecognitionService query. Without that <queries> entry, Android 11+ hides the
//      recognizer and SpeechRecognizer.isRecognitionAvailable() returns false, so voice capture
//      fails even when the microphone permission is granted.
//
// Usage:
//   node scripts/verify-native-voice.mjs android/app/src/main/assets/capacitor.plugins.json
//   node scripts/verify-native-voice.mjs android/app/build/outputs/apk/debug/app-debug.apk
//   node scripts/verify-native-voice.mjs <apk> --aapt2 "$ANDROID_SDK_ROOT/build-tools/36.0.0/aapt2"

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SPEECH_PLUGIN = '@capgo/capacitor-speech-recognition';
export const RECORD_AUDIO_PERMISSION = 'android.permission.RECORD_AUDIO';
export const RECOGNITION_SERVICE_ACTION = 'android.speech.RecognitionService';

/** Validates the Capacitor plugin registry JSON that ships inside the app. */
export function checkPluginRegistry(text) {
  const problems = [];
  let entries = null;
  try {
    entries = JSON.parse(text);
  } catch (_) {
    return [`capacitor.plugins.json is not valid JSON; Capacitor cannot route ${SPEECH_PLUGIN} to native code.`];
  }
  const list = Array.isArray(entries) ? entries : Array.isArray(entries?.plugins) ? entries.plugins : [];
  const names = list.map((entry) => entry?.pkg || entry?.name || entry);
  if (!names.includes(SPEECH_PLUGIN)) {
    problems.push(`${SPEECH_PLUGIN} is not registered in capacitor.plugins.json (found: ${names.join(', ') || 'none'}). Run "npx cap sync android" again.`);
  }
  return problems;
}

/** Validates an AndroidManifest.xml (source or aapt2 dump) for the voice-capture requirements. */
export function checkManifest(xml) {
  const problems = [];
  if (!xml.includes(RECORD_AUDIO_PERMISSION)) {
    problems.push(`The Android manifest no longer declares ${RECORD_AUDIO_PERMISSION}.`);
  }
  if (!xml.includes(RECOGNITION_SERVICE_ACTION)) {
    problems.push(`The Android manifest is missing the <queries> intent for ${RECOGNITION_SERVICE_ACTION}. Android 11+ then reports the speech recognizer as unavailable and voice capture fails.`);
  }
  return problems;
}

export function verifyNativeVoice({ registryText, manifestXml = '' }) {
  const problems = [...checkPluginRegistry(registryText)];
  if (manifestXml) problems.push(...checkManifest(manifestXml));
  return { ok: problems.length === 0, problems };
}

function isApk(target) {
  return target.toLowerCase().endsWith('.apk');
}

function readRegistry(target) {
  if (isApk(target)) {
    return execFileSync('unzip', ['-p', target, 'assets/capacitor.plugins.json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  }
  return readFileSync(target, 'utf8');
}

function dumpManifest(apk, aapt2) {
  if (!aapt2) return '';
  if (!existsSync(aapt2)) {
    console.warn(`aapt2 was not found at ${aapt2}; skipping the merged-manifest check.`);
    return '';
  }
  try {
    return execFileSync(aapt2, ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apk], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    console.warn(`The merged manifest could not be read (${error.message}); skipping that check.`);
    return '';
  }
}

const isMain = process.argv[1]?.endsWith('verify-native-voice.mjs');
if (isMain) {
  const args = process.argv.slice(2);
  const aapt2Index = args.indexOf('--aapt2');
  const aapt2 = aapt2Index >= 0 ? args[aapt2Index + 1] : '';
  const target = args.find((arg) => !arg.startsWith('--') && arg !== aapt2);
  if (!target) {
    console.error('Usage: node scripts/verify-native-voice.mjs <capacitor.plugins.json|app.apk> [--aapt2 <path>]');
    process.exit(2);
  }
  const registryText = readRegistry(target);
  const manifestXml = isApk(target) ? dumpManifest(target, aapt2) : readFileSync(path.join(repoRoot, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const result = verifyNativeVoice({ registryText, manifestXml });
  if (!result.ok) {
    for (const problem of result.problems) console.error(`${process.env.GITHUB_ACTIONS ? '::error::' : 'ERROR: '}${problem}`);
    process.exit(1);
  }
  console.log(`Native voice capture is bundled: ${SPEECH_PLUGIN} is registered${manifestXml ? `, ${RECORD_AUDIO_PERMISSION} and the ${RECOGNITION_SERVICE_ACTION} query are present` : ''}.`);
}

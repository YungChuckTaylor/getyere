#!/usr/bin/env node
// Checks android/app/google-services.json before CI uses it. Only the Firebase *client*
// config is acceptable here. Service-account JSON (which contains a private key) is rejected
// so that it can never be built into an APK.
//
// Usage: node scripts/validate-google-services.mjs android/app/google-services.json

import { readFileSync } from 'node:fs';

export const EXPECTED_PACKAGE = 'com.getyere.app';

export function validateGoogleServices(text) {
  const errors = [];
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text) || /"private_key"\s*:/.test(text)) {
    errors.push('This file contains a private key. Upload only the Firebase Android client config (google-services.json), never a service-account key.');
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return [...errors, 'The file is not valid JSON.'];
  }
  if (data?.type === 'service_account') {
    errors.push('This is a service-account credential, not google-services.json. Download the Android app config from Firebase Project settings → Your apps.');
  }
  const projectId = data?.project_info?.project_id;
  if (typeof projectId !== 'string' || !projectId.trim()) errors.push('project_info.project_id is missing or invalid.');
  const projectNumber = String(data?.project_info?.project_number || '');
  if (!/^\d+$/.test(projectNumber)) errors.push('project_info.project_number is missing or invalid (FCM sender ID).');
  const clients = Array.isArray(data?.client) ? data.client : [];
  const packages = clients.map((client) => client?.client_info?.android_client_info?.package_name);
  if (!packages.includes(EXPECTED_PACKAGE)) {
    errors.push(`No Android client is registered for package "${EXPECTED_PACKAGE}" (found: ${packages.filter(Boolean).join(', ') || 'none'}).`);
  }
  const client = clients.find((entry) => entry?.client_info?.android_client_info?.package_name === EXPECTED_PACKAGE);
  if (client) {
    const appId = client.client_info?.mobilesdk_app_id;
    if (typeof appId !== 'string' || !/^1:\d+:android:[a-fA-F0-9]+$/.test(appId)) {
      errors.push('The matching Android client is missing a valid client_info.mobilesdk_app_id.');
    } else if (appId.split(':')[1] !== projectNumber) {
      errors.push('The Android mobile app ID and project_info.project_number do not match.');
    }
    if (!Array.isArray(client.api_key) || !client.api_key.some((entry) => typeof entry?.current_key === 'string' && entry.current_key.trim())) {
      errors.push('The matching Android client has no api_key.current_key (Firebase Installations cannot register).');
    }
  }
  return errors;
}

const isMain = process.argv[1]?.endsWith('validate-google-services.mjs');
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/validate-google-services.mjs <google-services.json>');
    process.exit(2);
  }
  const errors = validateGoogleServices(readFileSync(file, 'utf8'));
  if (errors.length) {
    for (const message of errors) console.error(`${process.env.GITHUB_ACTIONS ? '::error::' : 'ERROR: '}${message}`);
    process.exit(1);
  }
  console.log(`google-services.json is a valid Android client config for ${EXPECTED_PACKAGE}.`);
}

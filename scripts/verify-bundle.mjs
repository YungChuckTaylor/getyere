#!/usr/bin/env node
// Proves a built artifact talks to the real Supabase project and is not a demo build.
// Accepts a directory (for example dist/ or the Capacitor web assets) or an .apk file.
//
// Usage: VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/verify-bundle.mjs <dist-dir|app.apk>
// The key is read from the environment and is never printed.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { CLOUD_ENV_KEYS, validateSupabaseConfig } from '../src/config.js';

const FORBIDDEN = [
  { pattern: /YOUR_PROJECT_REF|YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY|REPLACE_WITH_/, why: 'contains an unfilled placeholder' },
  { pattern: /sb_secret_[A-Za-z0-9_-]{8,}/, why: 'contains a Supabase secret key' },
  { pattern: /SUPABASE_SERVICE_ROLE_KEY|FIREBASE_PRIVATE_KEY|APNS_PRIVATE_KEY|-----BEGIN PRIVATE KEY-----/, why: 'references server-only credentials' }
];

function listFiles(target) {
  if (target.toLowerCase().endsWith('.apk')) {
    const names = execFileSync('unzip', ['-Z1', target], { encoding: 'utf8' }).split('\n');
    return names.filter((name) => /\.(js|html)$/.test(name) && name.includes('assets/')).map((name) => ({
      name,
      read: () => execFileSync('unzip', ['-p', target, name], { maxBuffer: 256 * 1024 * 1024 })
    }));
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(entry)) files.push({ name: full, read: () => readFileSync(full) });
    }
  };
  walk(target);
  return files;
}

export function verifyBundle(target, env = process.env) {
  const problems = [];
  const url = (env[CLOUD_ENV_KEYS.url] || '').trim();
  const anonKey = (env[CLOUD_ENV_KEYS.anonKey] || '').trim();
  const configErrors = validateSupabaseConfig({ url, anonKey });
  if (configErrors.length) return { ok: false, problems: configErrors };

  const files = listFiles(target);
  const scripts = files.filter((file) => file.name.endsWith('.js'));
  if (scripts.length === 0) return { ok: false, problems: [`No JavaScript bundle found in ${target}.`] };

  const text = scripts.map((file) => file.read().toString('utf8')).join('\n');
  if (!text.includes(url)) problems.push(`The bundle does not contain ${CLOUD_ENV_KEYS.url}; it would not reach the real Supabase project.`);
  if (!text.includes(anonKey)) problems.push(`The bundle does not contain ${CLOUD_ENV_KEYS.anonKey}; sign-in would not work.`);
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(text)) problems.push(`The bundle ${rule.why}.`);
  }
  // Any embedded JWT must be the anon role, never service_role.
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
    try {
      const role = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).role;
      if (role === 'service_role') problems.push('The bundle embeds a service_role JWT.');
    } catch (_) { /* not a Supabase JWT */ }
  }
  return { ok: problems.length === 0, problems, files: files.length };
}

const isMain = process.argv[1]?.endsWith('verify-bundle.mjs');
if (isMain) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/verify-bundle.mjs <dist-dir|app.apk>');
    process.exit(2);
  }
  const result = verifyBundle(target);
  if (!result.ok) {
    for (const problem of result.problems) console.error(`${process.env.GITHUB_ACTIONS ? '::error::' : 'ERROR: '}${problem}`);
    process.exit(1);
  }
  console.log(`Verified ${result.files} web asset file(s): bundle is wired to ${CLOUD_ENV_KEYS.url} with a publishable/anon key and no demo-only or server-only values.`);
}

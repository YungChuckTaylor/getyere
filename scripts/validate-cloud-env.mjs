#!/usr/bin/env node
// Pre-build gate for Yere builds. Fails with a clear message when the public Supabase
// configuration is missing or unsafe. It never prints the anon/publishable key itself.
//
// Usage: node scripts/validate-cloud-env.mjs [--target native|web]
//   native (default) requires a valid Supabase URL and anon/publishable key.
//   web only reports problems; the browser build may still fall back to the local demo.

import { CLOUD_ENV_KEYS, resolveRuntimeConfig } from '../src/config.js';

const inGitHub = process.env.GITHUB_ACTIONS === 'true';

function annotate(level, message) {
  // GitHub turns ::error:: lines into annotations on the workflow run.
  return inGitHub ? `::${level}::${message}` : `${level === 'error' ? 'ERROR' : 'WARNING'}: ${message}`;
}

export function runValidation(env, { target = 'native', log = console.log, logError = console.error } = {}) {
  const native = target === 'native';
  const runtime = resolveRuntimeConfig(env, { native });

  for (const key of [CLOUD_ENV_KEYS.url, CLOUD_ENV_KEYS.anonKey]) {
    const present = typeof env[key] === 'string' && env[key].trim() !== '';
    log(`${key}: ${present ? 'set' : 'MISSING'}`);
  }
  for (const warning of runtime.warnings) logError(annotate('warning', warning));

  if (runtime.errors.length > 0) {
    for (const message of runtime.errors) logError(annotate(native ? 'error' : 'warning', message));
    if (native) {
      logError(annotate('error',
        'Refusing to build a native app without the real Supabase backend. ' +
        'Add the repository variables under Settings → Secrets and variables → Actions → Variables.'));
      return { ok: false, runtime };
    }
    return { ok: true, runtime, demoFallback: true };
  }

  log(`Cloud configuration OK for ${native ? 'native' : 'web'} build (mode ${runtime.mode}).`);
  return { ok: true, runtime };
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate-cloud-env.mjs');
if (isMain) {
  const targetIndex = process.argv.indexOf('--target');
  const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : 'native';
  if (!['native', 'web'].includes(target)) {
    console.error(`Unknown --target "${target}". Use native or web.`);
    process.exit(2);
  }
  const result = runValidation(process.env, { target });
  process.exit(result.ok ? 0 : 1);
}

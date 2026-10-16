#!/usr/bin/env node
// Read-only check that the Supabase project behind VITE_SUPABASE_URL actually has everything the
// Android/iOS apps need: the core and native migrations, every Edge Function, the private
// attachment bucket, and working email/password auth.
//
// It uses ONLY the public project URL and the publishable/anon key that are already embedded in the
// client build. Every request is unauthenticated and read-only:
//   - the REST root spec lists tables and columns (no rows are read);
//   - Edge Functions are probed with an empty POST, which each one answers with 401/405 before it
//     touches any data (dispatch-reminders answers 401 without YERE_CRON_SECRET);
//   - auth settings and the bucket list are plain GETs.
// Nothing is written, no service-role key is used, and the anon key is never printed.
//
// Usage:
//   node scripts/verify-backend.mjs                 # human-readable report, always exits 0
//   node scripts/verify-backend.mjs --strict        # exit 1 when something is missing
//   node scripts/verify-backend.mjs --summary       # GitHub step-summary markdown
//   YERE_SKIP_BACKEND_CHECK=1 node scripts/verify-backend.mjs   # opt out (prints a notice)

import { CLOUD_ENV_KEYS, validateSupabaseConfig } from '../src/config.js';

/** Tables created by supabase/migrations/202610120001_yere_core.sql. */
export const CORE_TABLES = [
  'profiles',
  'user_lists',
  'contacts',
  'contact_invites',
  'reminders',
  'reminder_attachments',
  'push_subscriptions',
  'reminder_fires',
  'audit_logs',
  'contact_blocks',
  'rate_limit_buckets',
  'workspace_security'
];

/** Columns added by supabase/migrations/202610150001_native_mobile.sql (native push targets). */
export const NATIVE_MIGRATION_COLUMNS = { table: 'push_subscriptions', columns: ['device_token', 'platform', 'provider'] };

/** Edge Functions in supabase/functions that the apps call. */
export const EDGE_FUNCTIONS = [
  { name: 'create-contact-invite', usedBy: 'Trusted contacts → invite by email or SMS' },
  { name: 'redeem-contact-invite', usedBy: 'Invite link/code acceptance' },
  { name: 'revoke-contact-invite', usedBy: 'Trusted contacts → revoke an invitation' },
  { name: 'create-delegated-reminder', usedBy: 'An approved contact setting a reminder for you' },
  { name: 'test-notification', usedBy: 'Settings → Send a test notification' },
  { name: 'delete-account', usedBy: 'Settings → Account & data → Delete account (required by the stores)' },
  { name: 'dispatch-reminders', usedBy: 'pg_cron, every minute (deploy with --no-verify-jwt)' }
];

export const ATTACHMENT_BUCKET = 'yere-attachments';

const DEPLOY_HINTS = {
  migrations: 'Deploy with: npx supabase db push --project-ref <ref>  (or paste supabase/migrations/*.sql into the SQL editor, in filename order).',
  functions: 'Deploy with: npx supabase functions deploy <name> --project-ref <ref>  (add --no-verify-jwt for dispatch-reminders).',
  cron: 'Reminders are dispatched by pg_cron. Run supabase/schedule-reminders.sql.example in the SQL editor after replacing its two placeholders, then check cron.job for yere-reminder-dispatch.',
  bucket: `The bucket is created by the core migration: insert into storage.buckets … '${ATTACHMENT_BUCKET}'.`
};

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Names the public key format without ever printing key material. */
export function describeKeyFormat(key) {
  const value = trim(key);
  if (value.startsWith('sb_publishable_')) return 'Supabase publishable key (sb_publishable_...)';
  if (value.startsWith('sb_secret_')) return 'Supabase SECRET key (must never be used in a client build)';
  if (value.split('.').length === 3) return 'legacy Supabase anon JWT';
  return 'unrecognised key format';
}

async function probe(fetchImpl, url, path, init = {}, timeoutMs = 12000, maxBody = 4000) {
  try {
    const response = await fetchImpl(`${url}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs)
    });
    const body = await response.text().catch(() => '');
    return { status: response.status, body: body.slice(0, maxBody), truncated: body.length > maxBody, ok: response.ok };
  } catch (error) {
    return { status: 0, body: '', ok: false, error: String(error?.message || error) };
  }
}

/**
 * GET probe that tolerates both key formats. Supabase's gateway rejects an Authorization header
 * that is not a JWT, so a new publishable key (sb_publishable_...) sent as a bearer token can be
 * answered with 401 even though the apikey is valid. Retrying with apikey only turns those
 * inconclusive 401s into real answers.
 */
async function probeGet(fetchImpl, url, path, key, init = {}, timeoutMs = 12000, maxBody = 4000) {
  const first = await probe(fetchImpl, url, path, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, ...(init.headers || {}) }
  }, timeoutMs, maxBody);
  if (first.status !== 401 && first.status !== 403) return first;
  const retry = await probe(fetchImpl, url, path, {
    ...init,
    headers: { apikey: key, ...(init.headers || {}) }
  }, timeoutMs, maxBody);
  if (retry.status !== 401 && retry.status !== 403) return { ...retry, retriedWithoutBearer: true };
  return first;
}

function tablesFromSpec(spec) {
  if (!spec || typeof spec !== 'object') return { tables: [], columns: {} };
  const definitions = spec.definitions && typeof spec.definitions === 'object' ? spec.definitions : null;
  const columns = {};
  const tables = [];
  if (definitions) {
    for (const [name, definition] of Object.entries(definitions)) {
      tables.push(name);
      columns[name] = Object.keys(definition?.properties || {});
    }
    return { tables, columns };
  }
  for (const key of Object.keys(spec.paths || {})) {
    const name = key.replace(/^\//, '');
    if (name) tables.push(name);
  }
  return { tables, columns };
}

/**
 * Runs every read-only probe and returns a report.
 * @returns {Promise<{ok:boolean, missing:string[], present:string[], unknown:string[], notes:string[], auth:object, tables:string[]}>}
 */
export async function verifyBackend({ url, anonKey, fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const projectUrl = trim(url).replace(/\/$/, '');
  const key = trim(anonKey);
  const report = { ok: false, missing: [], present: [], unknown: [], notes: [], auth: {}, tables: [] };

  const configErrors = validateSupabaseConfig({ url: projectUrl, anonKey: key });
  if (configErrors.length) {
    report.missing.push(...configErrors);
    report.notes.push('Backend verification needs a valid VITE_SUPABASE_URL and publishable/anon key.');
    return report;
  }

  // Edge Function probes keep both headers: the platform answers 401 for an unauthorized caller
  // and 404 for a function that is not deployed, which is exactly the difference we need.
  const headers = { apikey: key, authorization: `Bearer ${key}` };

  // 1. Migrations: tables and native columns from the PostgREST schema cache.
  const spec = await probeGet(fetchImpl, projectUrl, '/rest/v1/', key, { headers: { accept: 'application/json' } }, timeoutMs, 4_000_000);
  if (spec.status === 0) {
    report.unknown.push(`Postgres REST API is unreachable (${spec.error}). Migrations could not be verified from here.`);
  } else if (!spec.ok) {
    report.unknown.push(`Postgres REST API answered HTTP ${spec.status} for both the apikey+bearer and apikey-only requests, so migrations could not be verified from here. Check them in Supabase → Database → Migrations, or re-run with a legacy anon JWT.`);
  } else {
    let parsed = null;
    try {
      parsed = JSON.parse(spec.body);
    } catch (_) {
      parsed = null;
    }
    const { tables, columns } = tablesFromSpec(parsed);
    report.tables = tables;
    const missingTables = CORE_TABLES.filter((table) => !tables.includes(table));
    if (missingTables.length) {
      report.missing.push(`Core migration 202610120001_yere_core.sql is not fully applied. Missing tables: ${missingTables.join(', ')}. ${DEPLOY_HINTS.migrations}`);
    } else {
      report.present.push(`Core migration applied: all ${CORE_TABLES.length} Yere tables are exposed (${CORE_TABLES.join(', ')}).`);
    }

    const nativeColumns = columns[NATIVE_MIGRATION_COLUMNS.table] || [];
    const missingColumns = NATIVE_MIGRATION_COLUMNS.columns.filter((column) => !nativeColumns.includes(column));
    if (!nativeColumns.length) {
      report.unknown.push(`Columns of ${NATIVE_MIGRATION_COLUMNS.table} are not listed by the REST spec; confirm the native migration manually.`);
    } else if (missingColumns.length) {
      report.missing.push(`Native migration 202610150001_native_mobile.sql is not applied: ${NATIVE_MIGRATION_COLUMNS.table} is missing ${missingColumns.join(', ')}. Android/iOS push tokens cannot be stored. ${DEPLOY_HINTS.migrations}`);
    } else {
      report.present.push('Native migration applied: push_subscriptions has device_token, platform, and provider.');
    }
  }

  // 2. Edge Functions: an unauthenticated probe is rejected before any work happens.
  for (const fn of EDGE_FUNCTIONS) {
    const result = await probe(fetchImpl, projectUrl, `/functions/v1/${fn.name}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: '{}'
    }, timeoutMs);

    if (result.status === 0) {
      report.unknown.push(`Edge Function ${fn.name} could not be reached (${result.error}).`);
      continue;
    }
    const looksMissing = result.status === 404
      || (result.status >= 400 && /function not found|no such function|edge function.*not found/i.test(result.body));
    if (looksMissing) {
      report.missing.push(`Edge Function ${fn.name} is not deployed (HTTP ${result.status}; ${fn.usedBy}). ${DEPLOY_HINTS.functions}`);
    } else {
      report.present.push(`Edge Function ${fn.name} is deployed (answered HTTP ${result.status} to an unauthenticated probe, as expected).`);
    }
  }

  // 3. Auth settings the sign-in/create-account flow depends on.
  const auth = await probeGet(fetchImpl, projectUrl, '/auth/v1/settings', key, {}, timeoutMs);
  if (auth.status === 0) {
    report.unknown.push(`Auth settings could not be reached (${auth.error}).`);
  } else if (!auth.ok) {
    report.unknown.push(`Auth settings answered HTTP ${auth.status}; confirm email sign-up manually.`);
  } else {
    try {
      const settings = JSON.parse(auth.body);
      report.auth = {
        signupDisabled: Boolean(settings.disable_signup),
        autoConfirm: Boolean(settings.mailer_autoconfirm),
        externalProviders: Object.keys(settings.external || {}).filter((provider) => settings.external[provider])
      };
      if (report.auth.signupDisabled) {
        report.missing.push('Email sign-up is disabled in Supabase Auth, so "Create account" cannot work. Enable it under Authentication → Providers → Email.');
      } else {
        report.present.push(`Email sign-up is enabled${report.auth.autoConfirm ? ' (auto-confirm on: confirmation emails are skipped)' : ' with confirmation emails'}.`);
      }
      if (report.auth.externalProviders.length) {
        report.present.push(`OAuth providers enabled: ${report.auth.externalProviders.join(', ')}.`);
      }
      report.notes.push('Also confirm Site URL https://www.getyere.com and redirect URLs yere://** and https://www.getyere.com/** under Authentication → URL Configuration.');
    } catch (_) {
      report.unknown.push('Auth settings returned an unreadable payload.');
    }
  }

  // 4. Private attachment bucket. RLS means an anonymous probe can be refused even when it exists.
  const bucket = await probeGet(fetchImpl, projectUrl, `/storage/v1/bucket/${ATTACHMENT_BUCKET}`, key, {}, timeoutMs);
  if (bucket.status === 200) {
    report.present.push(`Storage bucket ${ATTACHMENT_BUCKET} exists.`);
  } else if (bucket.status === 404) {
    report.missing.push(`Storage bucket ${ATTACHMENT_BUCKET} is missing; private attachments will fail. ${DEPLOY_HINTS.bucket}`);
  } else {
    report.unknown.push(`Storage bucket ${ATTACHMENT_BUCKET} answered HTTP ${bucket.status || 'no response'}; it is private, so confirm it in Storage → Buckets.`);
  }

  report.notes.push(`Public key format: ${describeKeyFormat(key)}. Project URL: ${projectUrl}.`);
  report.notes.push(DEPLOY_HINTS.cron);
  // "ok" means every probe answered and nothing is missing. A network failure leaves items in
  // `unknown` so a caller can tell "verified" from "could not be verified from here".
  report.ok = report.missing.length === 0 && report.unknown.length === 0;
  return report;
}

function formatReport(report) {
  const lines = [];
  const verdict = report.missing.length
    ? `${report.missing.length} item(s) still need deploying`
    : report.unknown.length
      ? 'nothing confirmed missing, but some checks could not be completed from here'
      : 'everything the native apps need is deployed';
  lines.push(`Yere backend check: ${verdict}.`);
  for (const item of report.present) lines.push(`  ok       ${item}`);
  for (const item of report.missing) lines.push(`  MISSING  ${item}`);
  for (const item of report.unknown) lines.push(`  unknown  ${item}`);
  for (const note of report.notes) lines.push(`  note     ${note}`);
  return lines.join('\n');
}

function formatSummary(report, projectHost) {
  const lines = ['### Supabase backend check', '', `Project: \`${projectHost}\``, ''];
  const section = (title, items) => {
    if (!items.length) return;
    lines.push(`**${title}**`, '');
    for (const item of items) lines.push(`- ${item}`);
    lines.push('');
  };
  section('Still needs deploying', report.missing);
  section('Needs a manual look (anonymous probe was inconclusive)', report.unknown);
  section('Already deployed', report.present);
  section('Notes', report.notes);
  return lines.join('\n');
}

const isMain = process.argv[1]?.endsWith('verify-backend.mjs');
if (isMain) {
  if (process.env.YERE_SKIP_BACKEND_CHECK === '1') {
    console.log('Backend verification skipped (YERE_SKIP_BACKEND_CHECK=1).');
    process.exit(0);
  }
  const strict = process.argv.includes('--strict');
  const summary = process.argv.includes('--summary');
  const inGitHub = process.env.GITHUB_ACTIONS === 'true';
  const url = trim(process.env[CLOUD_ENV_KEYS.url]);
  const key = trim(process.env[CLOUD_ENV_KEYS.anonKey]);

  const report = await verifyBackend({ url, anonKey: key });
  let host = '';
  try {
    host = new URL(url).host;
  } catch (_) {
    host = '(invalid VITE_SUPABASE_URL)';
  }

  if (summary) {
    console.log(formatSummary(report, host));
  } else {
    console.log(formatReport(report));
  }
  if (inGitHub) {
    for (const item of report.missing) console.error(`::warning title=Backend not fully deployed::${item}`);
    for (const item of report.unknown) console.error(`::notice title=Backend check inconclusive::${item}`);
  }
  // --strict fails only on confirmed gaps; an inconclusive probe is a warning, not a red build.
  process.exit(strict && report.missing.length > 0 ? 1 : 0);
}

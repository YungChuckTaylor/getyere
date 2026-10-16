import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('browser bootstrap exposes only public Supabase and Web Push configuration', async () => {
  const [bootstrap, html, envExample] = await Promise.all([
    read('src/bootstrap.js'), read('index.html'), read('.env.example')
  ]);
  assert.match(bootstrap, /VITE_SUPABASE_URL/);
  assert.match(bootstrap, /VITE_SUPABASE_ANON_KEY/);
  assert.match(bootstrap, /VITE_VAPID_PUBLIC_KEY/);
  assert.doesNotMatch(bootstrap + html, /VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_VAPID_PRIVATE_KEY|RESEND_API_KEY|TWILIO_AUTH_TOKEN|FIREBASE_PRIVATE_KEY|APNS_PRIVATE_KEY/);
  assert.match(html, /delete settings\.pushEnabled/);
  assert.match(html, /delete settings\.notif/);
  assert.doesNotMatch(envExample, /^VITE_SUPABASE_SERVICE_ROLE_KEY=/m);
});

test('sensitive invite and dispatch tables stay behind RLS without browser policies', async () => {
  const sql = await read('supabase/migrations/202610120001_yere_core.sql');
  for (const table of ['contact_invites', 'rate_limit_buckets', 'reminder_fires']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.doesNotMatch(sql, /create\s+policy\s+\w+\s+on\s+public\.contact_invites\b/i);
  assert.doesNotMatch(sql, /create\s+policy\s+\w+\s+on\s+public\.(rate_limit_buckets|reminder_fires)\b/i);
  assert.match(sql, /protect_contact_relationship/);
  assert.match(sql, /protect_reminder_attribution/);
});

test('invite secrets are single-use, hashed, rate-limited, and expire after 24 hours', async () => {
  const [http, invite, redeem, sql] = await Promise.all([
    read('supabase/functions/_shared/http.ts'),
    read('supabase/functions/create-contact-invite/index.ts'),
    read('supabase/functions/redeem-contact-invite/index.ts'),
    read('supabase/migrations/202610120001_yere_core.sql')
  ]);
  assert.match(http, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(invite, /randomToken\(32\)/);
  assert.match(invite, /24 \* 60 \* 60 \* 1000/);
  assert.match(invite, /consumeRateLimit/);
  assert.match(redeem, /consume_contact_invite/);
  assert.match(sql, /for update;/i);
  assert.match(sql, /unique\(reminder_id, due_at\)/i);
});

test('PWA manifest and offline shell assets are present', async () => {
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  const worker = await read('public/sw.js');
  const html = await read('index.html');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0e1220');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.match(worker, /addEventListener\(['"]install/);
  assert.match(worker, /caches\.open/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /yere-mark\.svg/);
});

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
  assert.doesNotMatch(bootstrap + html, /VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_VAPID_PRIVATE_KEY|RESEND_API_KEY|TWILIO_AUTH_TOKEN/);
  assert.match(html, /delete settings\.pushEnabled/);
  assert.match(html, /delete settings\.notif/);
  assert.doesNotMatch(envExample, /^VITE_SUPABASE_SERVICE_ROLE_KEY=/m);
});

test('sign-up and password recovery callbacks use the canonical getyere.com origin', async () => {
  const [bootstrap, html, http, authConfig, envExample, vercelConfig] = await Promise.all([
    read('src/bootstrap.js'), read('index.html'), read('supabase/functions/_shared/http.ts'),
    read('supabase/config.toml'), read('.env.example'), read('vercel.json')
  ]);
  const vercel = JSON.parse(vercelConfig);
  assert.match(bootstrap, /import\.meta\.env\.DEV \? window\.location\.origin : 'https:\/\/getyere\.com'/);
  assert.match(bootstrap, /VITE_PUBLIC_APP_URL/);
  assert.match(html, /new URL\('\/',window\.YERE_ENV\?\.publicAppUrl\|\|window\.location\.origin\)/);
  assert.match(html, /emailRedirectTo:redirectUrl\.href/);
  assert.match(html, /resetPasswordForEmail\(email,\{redirectTo:new URL\('\/\?reset=1',window\.YERE_ENV\?\.publicAppUrl/);
  assert.match(http, /Deno\.env\.get\('PUBLIC_APP_URL'\) \|\| 'https:\/\/getyere\.com'/);
  assert.match(authConfig, /site_url = "https:\/\/getyere\.com"/);
  assert.equal(envExample.includes('VITE_PUBLIC_APP_URL=https://getyere.com'), true);
  assert.ok(vercel.redirects.some(rule => rule.has?.some(item => item.type === 'host' && item.value === 'getyere.vercel.app') && rule.destination === 'https://getyere.com/:path*'));
  assert.doesNotMatch([bootstrap, html, http, authConfig, envExample].join('\n'), /getyere\.app/);
});

test('Supabase confirmation template is Yere-branded and uses the generated confirmation URL', async () => {
  const [template, deployment] = await Promise.all([
    read('supabase/email-templates/confirm-signup.html'), read('DEPLOYMENT.md')
  ]);
  assert.match(template, /https:\/\/getyere\.com\/icons\/icon-192\.png/);
  assert.match(template, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(template, /Confirm your Yere account/);
  assert.match(deployment, /smtp\.resend\.com/);
  assert.match(deployment, /Authentication → Email Templates → Confirm signup/);
});

test('admin invitations use branded password setup and recovery callbacks', async () => {
  const [inviteTemplate, resetTemplate, inviteFunction, adminUi, bootstrap] = await Promise.all([
    read('supabase/email-templates/invite-user.html'), read('supabase/email-templates/reset-password.html'),
    read('supabase/functions/admin-admin-invite/index.ts'), read('src/admin.js'), read('src/bootstrap.js')
  ]);
  assert.match(inviteTemplate, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(resetTemplate, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(inviteFunction, /admin-access\?flow=invite/);
  assert.match(bootstrap, /adminQuery\.get\('flow'\) === 'invite'/);
  assert.match(bootstrap, /adminQuery\.get\('flow'\) === 'recovery'/);
  assert.match(adminUi, /completeAdminPasswordSetup/);
  assert.match(adminUi, /updateUser\(\{ password \}\)/);
  assert.match(adminUi, /resetPasswordForEmail/);
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

test('accepted invitation links immediately approve the trusted relationship', async () => {
  const migration = await read('supabase/migrations/202610130001_auto_approve_invites_and_delegated_controls.sql');
  assert.match(migration, /update public\.contacts set contact_user_id=p_contact_user_id,status='approved'/i);
  assert.match(migration, /ci\.consumed_at is not null/i);
  assert.match(migration, /list_delegated_lists\(p_owner_id uuid\)/i);
  assert.match(migration, /grant execute on function public\.list_delegated_lists\(uuid\) to authenticated/i);
});

test('delegated reminder creation supports the standard scheduling and detail fields', async () => {
  const [html, edgeFunction] = await Promise.all([
    read('index.html'), read('supabase/functions/create-delegated-reminder/index.ts')
  ]);
  for (const field of ['dDate', 'dTime', 'recurrenceEditor(rec)', 'dLink', 'dList', 'dType', 'dChannel', 'dCost']) {
    assert.ok(html.includes(field), `missing delegated reminder field ${field}`);
  }
  for (const field of ['due_at: due.toISOString()', 'recurrence,', 'delivery_channel: channel', 'reminder_type: reminderType', 'cost,', 'list_id: listId']) {
    assert.ok(edgeFunction.includes(field), `missing server-side reminder field ${field}`);
  }
  assert.match(edgeFunction, /eq\('id',listId\)\.eq\('owner_id',ownerId\)/);
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

test('admin data is server-only and private-content reads require an audited reason', async () => {
  const [migration, shared, reminderList, reminderDetail, userDetail, proxy, shell, session, adminUi, bootstrap] = await Promise.all([
    read('supabase/migrations/202610140001_admin_backend.sql'),
    read('supabase/functions/_shared/admin.ts'),
    read('supabase/functions/admin-reminders-list/index.ts'),
    read('supabase/functions/admin-reminder-detail/index.ts'),
    read('supabase/functions/admin-user-detail/index.ts'),
    read('api/admin-proxy.js'), read('api/admin-shell.js'), read('api/admin-session.js'),
    read('src/admin.js'), read('src/bootstrap.js')
  ]);
  assert.match(migration, /token_hash text not null unique check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(migration, /CREATE TRIGGER admin_audit_logs_immutable BEFORE UPDATE OR DELETE/i);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.admin_audit_logs TO service_role/i);
  assert.match(migration, /REVOKE UPDATE, DELETE, TRUNCATE ON public\.admin_audit_logs FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(migration, /REVOKE ALL ON public\.admin_users, public\.admin_sessions, public\.admin_audit_logs/i);
  assert.doesNotMatch(migration, /CREATE POLICY \w+ ON public\.(profiles|user_lists|reminders|contacts|contact_invites|reminder_attachments|reminder_fires|push_subscriptions|audit_logs) FOR SELECT TO authenticated[\s\S]{0,180}admin/i);
  assert.match(shared, /requireAdmin\(req/);
  assert.match(shared, /admin_sessions/);
  for (const source of [reminderList, reminderDetail, userDetail]) {
    assert.match(source, /requireAdmin\(req, 'support'\)/);
    assert.match(source, /viewReason/);
    assert.match(source, /auditAdmin\(/);
  }
  assert.match(shell, /res\.statusCode = 404/);
  assert.match(shell, /functions\/v1\/admin-me/);
  assert.match(session, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(session, /__Host-yere-admin-session/);
  assert.match(proxy, /ALLOWED_FUNCTIONS/);
  assert.match(adminUi, /View reason/);
  assert.match(adminUi, /result\.code === 'mfa_required'/);
  assert.match(bootstrap, /storageKey: 'yere-admin-auth'/);
  assert.match(bootstrap, /window\.sessionStorage/);
  assert.match(bootstrap, /HttpOnly session cookie/);
});

test('admin routes are unlinked, disallowed to crawlers, and marked noindex', async () => {
  const [html, robots, vercelConfig, worker] = await Promise.all([
    read('index.html'), read('public/robots.txt'), read('vercel.json'), read('public/sw.js')
  ]);
  const vercel = JSON.parse(vercelConfig);
  assert.doesNotMatch(html, /href=["'][^"']*\/admin(?:["'/?#])/i);
  assert.match(robots, /Disallow: \/admin\n/);
  assert.match(robots, /Disallow: \/admin-access/);
  assert.match(robots, /Disallow: \/api\/admin-session/);
  assert.ok(vercel.headers.some(rule => rule.source === '/admin-access' && rule.headers.some(header => header.key === 'X-Robots-Tag' && /noindex, nofollow/.test(header.value))));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/admin' && rule.destination === '/api/admin-shell'));
  assert.ok(vercel.rewrites.some(rule => rule.source === '/admin/:path*' && rule.destination === '/api/admin-shell'));
  assert.match(worker, /Never serve a cached public shell for the protected server-guarded admin routes/);
  assert.match(worker, /url\.pathname === '\/admin' \|\| url\.pathname\.startsWith\('\/admin\/'\)/);
});

test('users can submit and read only their own support tickets, while admin replies use audited server routes', async () => {
  const [migration, app, adminUpdate] = await Promise.all([
    read('supabase/migrations/202610140001_admin_backend.sql'), read('index.html'),
    read('supabase/functions/admin-support-update/index.ts')
  ]);
  assert.match(migration, /CREATE POLICY support_tickets_owner_select ON public\.support_tickets FOR SELECT TO authenticated\s+USING \(user_id = auth\.uid\(\)\)/);
  assert.match(migration, /WITH CHECK \(user_id = auth\.uid\(\) AND status = 'open' AND admin_response IS NULL AND responded_by IS NULL\)/);
  assert.match(migration, /GRANT INSERT \(user_id, subject, body\) ON public\.support_tickets TO authenticated/);
  assert.match(app, /supabase\.from\('support_tickets'\)\.insert\(\{user_id:currentSession\.user\.id,subject,body\}\)/);
  assert.match(app, /function loadUserSupportTickets/);
  assert.match(adminUpdate, /requireAdmin\(req, 'support'\)/);
  assert.match(adminUpdate, /auditAdmin\(/);
});

test('Vercel guard and admin APIs return HTTP 404 without an admin session cookie', async () => {
  const [shellModule, sessionModule, proxyModule] = await Promise.all([
    import('../api/admin-shell.js'), import('../api/admin-session.js'), import('../api/admin-proxy.js')
  ]);
  const makeResponse = () => ({
    headers: {}, statusCode: 200, body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end(value = '') { this.body = value; return this; }
  });
  const shellRes = makeResponse();
  await shellModule.default({ method: 'GET', headers: {} }, shellRes);
  assert.equal(shellRes.statusCode, 404);
  assert.match(shellRes.headers['x-robots-tag'], /noindex, nofollow/);
  assert.match(shellRes.body, /Not found/);

  const sessionRes = makeResponse();
  await sessionModule.default({ method: 'GET', headers: {} }, sessionRes);
  assert.equal(sessionRes.statusCode, 404);
  assert.match(sessionRes.headers['set-cookie'], /HttpOnly; Secure; SameSite=Strict/);
  assert.match(sessionRes.headers['x-robots-tag'], /noindex, nofollow/);

  const proxyRes = makeResponse();
  await proxyModule.default({ method: 'GET', query: { function: 'admin-me' }, headers: {} }, proxyRes);
  assert.equal(proxyRes.statusCode, 404);
  assert.match(proxyRes.headers['x-robots-tag'], /noindex, nofollow/);
});

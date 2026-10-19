import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const source = await read('supabase/functions/admin-admin-invite/index.ts');
const executable = ts.transpileModule(source.replace(/^import .*;\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;
const existingUser = { user_id: 'existing-user', email_confirmed: true, is_banned: false, admin_role: null };

function harness(options = {}) {
  const calls = { invite: [], recovery: [], rpc: [], auth: [], rate: [], logs: [] };
  const context = {
    user: { id: 'super-admin' }, ip: null, userAgent: 'test',
    admin: {
      rpc: async (name, args) => {
        calls.rpc.push({ name, args });
        if (name === 'lookup_admin_invite_target') return { data: options.targets ?? [], error: options.lookupError };
        assert.equal(name, 'grant_admin_invitation');
        return { error: options.grantError };
      },
      auth: {
        admin: { inviteUserByEmail: async (...args) => { calls.invite.push(args); return { data: { user: options.invitedUser ?? { id: 'new-user' } }, error: options.emailError }; } },
        resetPasswordForEmail: async (...args) => { calls.recovery.push(args); return { error: options.emailError }; }
      }
    }
  };
  const sandbox = {
    Deno: { serve: handler => { sandbox.handler = handler; } },
    crypto: { randomUUID: () => 'test-reference' },
    console: { error: (...args) => calls.logs.push(args) },
    preflight: req => req.method === 'OPTIONS' ? new Response('ok') : null,
    jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    readJson: req => req.json(),
    normalizedEmail: value => typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()) ? value.trim().toLowerCase() : null,
    safeAppOrigin: () => 'https://getyere.com',
    requireAdmin: async (req, minimum) => { calls.auth.push(minimum); return options.denied ? { response: new Response('{}', { status: 404 }) } : { context }; },
    consumeRateLimit: async (...args) => { calls.rate.push(args.slice(1)); return options.rateAllowed !== false; }
  };
  vm.runInNewContext(executable, sandbox);
  const request = async (body = {}, method = 'POST') => {
    const response = await sandbox.handler(new Request('https://example.test/invite', {
      method, ...(method === 'POST' ? { body: JSON.stringify({ email: ' Person@Example.com ', role: 'admin', reason: 'Operations support access', ...body }) } : {})
    }));
    return { status: response.status, body: method === 'OPTIONS' ? {} : await response.json() };
  };
  return { calls, request };
}

test('new accounts receive the normal Auth invitation, then an audited role grant', async () => {
  const { calls, request } = harness();
  const result = await request();
  assert.equal(result.status, 200); assert.equal(result.body.existingAccount, false);
  assert.equal(calls.invite.length, 1); assert.equal(calls.recovery.length, 0);
  assert.equal(calls.invite[0][0], 'person@example.com');
  assert.equal(calls.invite[0][1].redirectTo, 'https://getyere.com/admin-access?flow=invite');
  assert.equal(calls.rpc[1].name, 'grant_admin_invitation');
  assert.equal(calls.rpc[1].args.p_user_id, 'new-user');
  assert.equal(calls.rpc[1].args.p_actor, 'super-admin');
  assert.equal(calls.rpc[1].args.p_reason, 'Operations support access');
});

test('existing confirmed accounts receive setup email without recreating or resetting the account', async () => {
  const { calls, request } = harness({ targets: [existingUser] });
  const result = await request();
  assert.equal(result.status, 200); assert.equal(result.body.existingAccount, true);
  assert.equal(calls.invite.length, 0); assert.equal(calls.recovery.length, 1);
  assert.equal(calls.recovery[0][1].redirectTo, 'https://getyere.com/admin-access?flow=invite');
  assert.equal(calls.rpc[1].args.p_user_id, 'existing-user');
});

test('unconfirmed accounts keep the invitation confirmation flow', async () => {
  const { calls, request } = harness({ targets: [{ ...existingUser, user_id: 'new-user', email_confirmed: false }] });
  assert.equal((await request()).status, 200);
  assert.equal(calls.invite.length, 1); assert.equal(calls.recovery.length, 0);
});

for (const target of [
  { ...existingUser, admin_role: 'super_admin', admin_active: true },
  { ...existingUser, admin_role: 'support', admin_active: false },
  { ...existingUser, is_banned: true }
]) {
  test(`does not invite or overwrite an existing ${target.admin_role || 'banned'} account`, async () => {
    const { calls, request } = harness({ targets: [target] });
    assert.equal((await request()).status, 409);
    assert.equal(calls.invite.length + calls.recovery.length, 0);
    assert.equal(calls.rpc.length, 1);
  });
}

test('ambiguous identities fail closed without sending mail or granting a role', async () => {
  const { calls, request } = harness({ targets: [existingUser, { ...existingUser, user_id: 'another-user' }] });
  assert.equal((await request()).body.code, 'ambiguous_account');
  assert.equal(calls.invite.length + calls.recovery.length, 0);
  assert.equal(calls.rpc.length, 1);
});

test('super-admin access and the invitation rate limit remain required', async () => {
  for (const options of [{ denied: true }, { rateAllowed: false }]) {
    const { calls, request } = harness(options);
    assert.equal((await request()).status, options.denied ? 404 : 429);
    assert.deepEqual(calls.auth, ['super_admin']);
    assert.equal(calls.invite.length + calls.recovery.length + calls.rpc.length, 0);
  }
});

test('invalid email, role and reason cannot reach Auth or consume the invite budget', async () => {
  for (const body of [{ email: 'invalid' }, { role: 'super_admin' }, { reason: 'short' }]) {
    const { calls, request } = harness();
    assert.equal((await request(body)).status, 400);
    assert.equal(calls.rate.length + calls.rpc.length, 0);
  }
});

for (const [error, status, code] of [
  [{ code: 'email_address_not_authorized' }, 503, 'email_recipient_not_authorized'],
  [{ code: 'over_email_send_rate_limit' }, 429, 'email_rate_limited'],
  [{ code: 'over_request_rate_limit' }, 429, 'email_rate_limited'],
  [{ code: 'email_address_invalid' }, 400, 'email_address_invalid'],
  [{ code: 'email_exists' }, 409, 'account_changed'],
  [{ code: 'user_already_exists' }, 409, 'account_changed'],
  [{ code: 'unexpected_failure', message: 'SMTP password=DO_NOT_EXPOSE' }, 502, 'invite_email_failed']
]) {
  test(`email error ${error.code} is actionable, does not grant a role or expose provider details`, async () => {
    const { calls, request } = harness({ emailError: error });
    const result = await request();
    assert.equal(result.status, status); assert.equal(result.body.code, code);
    assert.equal(calls.rpc.length, 1);
    assert.match(result.body.error, /Reference: test-reference/);
    assert.doesNotMatch(JSON.stringify({ result, logs: calls.logs }), /DO_NOT_EXPOSE/);
  });
}

test('existing-account recovery delivery errors do not grant access', async () => {
  const { calls, request } = harness({ targets: [existingUser], emailError: { status: 500 } });
  assert.equal((await request()).body.code, 'invite_email_failed');
  assert.equal(calls.rpc.length, 1); assert.equal(calls.invite.length, 0);
});

test('a missing migration stops before email and points to configuration', async () => {
  const { calls, request } = harness({ lookupError: { code: 'PGRST202' } });
  const result = await request();
  assert.equal(result.status, 503); assert.equal(result.body.code, 'invite_configuration_missing');
  assert.equal(calls.invite.length + calls.recovery.length, 0);
});

test('a role grant failure reports the partial email success rather than claiming an invite succeeded', async () => {
  const { request } = harness({ grantError: { code: '42883', message: 'private database detail' } });
  const result = await request();
  assert.equal(result.status, 500); assert.equal(result.body.code, 'invite_role_failed');
  assert.match(result.body.error, /email was sent, but administrator access could not be saved/);
  assert.doesNotMatch(result.body.error, /private database detail/);
});

test('a concurrent invite cannot overwrite an existing administrator', async () => {
  const { request } = harness({ grantError: { message: 'admin_invite_target_already_admin' } });
  const result = await request();
  assert.equal(result.status, 409); assert.equal(result.body.code, 'already_admin');
});

test('an unexpected Auth identity is never granted access', async () => {
  const { calls, request } = harness({ targets: [{ ...existingUser, email_confirmed: false }], invitedUser: { id: 'wrong-user' } });
  assert.equal((await request()).status, 502);
  assert.equal(calls.rpc.length, 1);
});

test('non-POST requests do not authorize or trigger any invitation', async () => {
  const { calls, request } = harness();
  assert.equal((await request({}, 'GET')).status, 405);
  assert.equal((await request({}, 'OPTIONS')).status, 200);
  assert.equal(calls.auth.length, 0);
});

test('database lookup and non-overwriting grants are service-only and retain audit/locking safeguards', async () => {
  const sql = await read('supabase/migrations/20261019141922_admin_invite_existing_accounts.sql');
  for (const name of ['lookup_admin_invite_target', 'grant_admin_invitation']) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}[^;]+FROM PUBLIC, anon, authenticated`));
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[^;]+TO service_role`));
  }
  assert.match(sql, /pg_advisory_xact_lock\(742001, 1\)/);
  assert.match(sql, /role = 'super_admin' AND is_active/);
  assert.match(sql, /admin_invite_target_already_admin/);
  assert.match(sql, /PERFORM public\.set_admin_role/);
  assert.doesNotMatch(sql, /UPDATE\s+auth\.users|DELETE FROM|consume_contact_invite/i);
});

test('admin UI explains existing-account setup and prevents duplicate submissions', async () => {
  const ui = await read('src/admin.js');
  const handler = ui.slice(ui.indexOf("inviteForm.addEventListener('submit'"), ui.indexOf("rosterForm.addEventListener('submit'"));
  assert.match(handler, /if \(inviteButton\.disabled\) return/);
  assert.match(handler, /inviteButton\.disabled = true/);
  assert.match(handler, /finally \{ inviteButton\.disabled = false/);
  assert.match(handler, /result\.existingAccount/);
  assert.match(handler, /existing password or use that email to choose one/);
});

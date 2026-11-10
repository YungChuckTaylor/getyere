import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = p => readFile(new URL(`../${p}`, import.meta.url), 'utf8');
const shared = await read('supabase/functions/_shared/admin.ts');
const sessionSource = await read('supabase/functions/admin-session-create/index.ts');
const compile = source => ts.transpileModule(source.replace(/^import .*;\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });
function harness({ role = 'super_admin', active = true, aal = 'aal1', authenticated = true, session = true, rate = true } = {}) {
  const writes = [], checks = [];
  const token = `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`;
  const admin = {
    from(table) {
      const query = { select() { return this; }, eq(k,v) { checks.push([table,k,v]); return this; }, is() { return this; }, gt() { return this; },
        async maybeSingle() { return { data: table === 'admin_users' ? { role, is_active: active } : session ? { id: 'session', expires_at: '2099-01-01' } : null }; },
        update(value) { writes.push([table,value]); return this; },
        insert(value) { writes.push([table,value]); return this; },
        then(resolve) { resolve({ error: null }); }
      }; return query;
    }
  };
  const sandbox = { exports: {}, atob, Date, console, jsonResponse, adminClient: () => admin,
    authenticatedUser: async () => ({ user: authenticated ? { id:'owner' } : null }),
    sha256: async () => 'verified-token-hash', consumeRateLimit: async () => rate };
  vm.runInNewContext(compile(shared), sandbox);
  const request = new Request('https://example.test', { headers: { Authorization:`Bearer ${token}` } });
  return { sandbox, api: sandbox.exports, request, writes, checks };
}

test('only regular admins require MFA; super-admin password access is an explicit server policy', () => {
  const { api } = harness();
  assert.equal(api.mfaRequired('super_admin'), false);
  assert.equal(api.mfaRequired('admin'), true);
  assert.equal(api.mfaRequired('support'), false);
  assert.equal(api.mfaRequired('read_only'), false);
});
test('active password-authenticated super admin can access protected APIs with a valid admin session', async () => {
  const h = harness(); const result = await h.api.requireAdmin(h.request, 'super_admin');
  assert.equal(result.context.role, 'super_admin');
  assert.ok(h.checks.some(([t,k,v]) => t === 'admin_sessions' && k === 'token_hash' && v === 'verified-token-hash'));
});
test('regular admin still needs AAL2 and cannot access super-admin functions', async () => {
  const low = harness({ role:'admin' });
  assert.equal((await low.api.requireAdmin(low.request)).response.status,403);
  const high = harness({ role:'admin', aal:'aal2' });
  assert.equal((await high.api.requireAdmin(high.request, 'admin')).context.role,'admin');
  assert.equal((await high.api.requireAdmin(high.request, 'super_admin')).response.status,404);
});
for (const [name, options] of Object.entries({ inactive:{active:false}, ordinaryUser:{role:'user'}, invalidRole:{role:'constructor'}, unauthenticated:{authenticated:false}, invalidAal:{aal:'invalid'}, revokedOrExpiredSession:{session:false} })) {
  test(`password policy does not admit ${name}`, async () => {
    const h = harness(options); assert.equal((await h.api.requireAdmin(h.request,'super_admin')).response.status,404);
  });
}
test('password super-admin APIs keep rate limiting', async () => {
  const h = harness({rate:false}); assert.equal((await h.api.requireAdmin(h.request)).response.status,429);
});
test('session creation applies the same policy and audits password sign-in', async () => {
  for (const [role, aal, expected] of [['super_admin','aal1',200],['admin','aal1',403],['admin','aal2',200]]) {
    const h = harness({role, aal});
    const sandbox = { ...h.sandbox, ...h.api, preflight:()=>null,
      Deno:{ serve:handler=>{sandbox.handler=handler;} } };
    vm.runInNewContext(compile(sessionSource),sandbox);
    const response = await sandbox.handler(new Request(h.request.url,{method:'POST',headers:h.request.headers}));
    assert.equal(response.status,expected,`${role}/${aal}`);
    if(expected===200) assert.ok(h.writes.some(([table,v])=>table==='admin_audit_logs'&&v.action==='admin_session_started'&&v.metadata.aal===aal));
  }
});

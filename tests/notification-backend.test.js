import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PushDeliveryError, isRetiredSubscription, fcmErrorCode, safePushError } from '../supabase/functions/_shared/push-errors.js';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const executable = source => ts.transpileModule(source.replace(/^import .*;\n/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const testSource = executable(await read('supabase/functions/test-notification/index.ts'));
const dispatchSource = executable(await read('supabase/functions/dispatch-reminders/index.ts'));

function harness({ subscriptions = [], claim = [], sendError = {}, auth = true, rate = true, interruptBefore = null } = {}) {
  const calls = { sends: [], deletes: [], logs: [], emails: [], updates: [], errors: [], claims: 0 };
  const state = { subscriptions: structuredClone(subscriptions), fire: structuredClone(claim[0] || null) };
  let interrupted = false;
  const tables = {
    push_subscriptions: () => state.subscriptions,
    reminders: () => [{ id: 'reminder', owner_id: 'alice', title: 'Private title', notes: 'Private notes', due_at: state.fire?.due_at, delivery_channel: 'both', is_completed: false, approval_status: 'approved' }],
    profiles: () => [{ id: 'alice', settings: {} }],
    reminder_fires: () => state.fire ? [state.fire] : []
  };
  function query(table) {
    let mode = 'select', values, single = false;
    const filters = [];
    const builder = {
      select() { return builder; }, eq(k,v) { filters.push(row => row[k] === v); return builder; }, gt(k,v) { filters.push(row => row[k] > v); return builder; },
      maybeSingle() { single = true; return builder; },
      update(v) { mode = 'update'; values = structuredClone(v); return builder; },
      insert(v) { mode = 'insert'; values = v; return builder; }, delete() { mode = 'delete'; return builder; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (mode === 'insert') { calls.logs.push(...values); return { error: null }; }
          const rows = tables[table]().filter(row => filters.every(f => f(row)));
          if (mode === 'update') {
            if (interruptBefore && !interrupted && values.lease_until && state.fire?.delivery_state?.['push:a']) { interrupted = true; return { data: [], error: null }; }
            calls.updates.push(values); rows.forEach(row => Object.assign(row, values));
          }
          if (mode === 'delete') { calls.deletes.push(...rows.map(r => r.id)); state.subscriptions = state.subscriptions.filter(row => !rows.includes(row)); }
          return { data: single ? rows[0] || null : rows, error: null };
        }).then(resolve, reject);
      }
    };
    return builder;
  }
  const admin = { from: query, rpc: async () => { calls.claims++; return { data: state.fire ? [structuredClone(state.fire)] : [], error: null }; }, auth: { admin: { getUserById: async () => ({ data: { user: { email: 'test@example.test' } }, error: null }) } } };
  const sandbox = {
    exports: {}, Deno: { serve: f => { sandbox.handler = f; } }, Date,
    console: { error: (...v) => calls.errors.push(v) },
    preflight: req => req.method === 'OPTIONS' ? new Response('ok') : null,
    authenticatedUser: async () => ({ user: auth ? { id: 'alice' } : null }), adminClient: () => admin,
    consumeRateLimit: async () => rate, readJson: req => req.json(), env: () => 'test-cron', safeAppOrigin: () => 'https://getyere.com', escapeHtml: v => v,
    jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    sendPush: async (subscription, payload) => { calls.sends.push({ id: subscription.id, payload }); if (sendError[subscription.id]) throw sendError[subscription.id]; return { provider: subscription.provider, reference: 'receipt' }; },
    sendYereEmail: async (...args) => { calls.emails.push(args); return { id: 'email-receipt' }; },
    isRetiredSubscription, safePushError
  };
  return {
    calls, state, run: async (type, body = {}, headers = {}, method = 'POST') => {
      vm.runInNewContext(type === 'test' ? testSource : dispatchSource, sandbox);
      const response = await sandbox.handler(new Request('https://example.test/', { method, headers: { 'x-yere-cron-secret': 'test-cron', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }));
      return { status: response.status, body: method === 'OPTIONS' ? {} : await response.json() };
    }
  };
}
const subscription = (id, platform, owner_id = 'alice') => ({ id, owner_id, platform, provider: platform === 'web' ? 'webpush' : platform === 'ios' ? 'apns' : 'fcm', endpoint: `https://push.example.test/${id}`, device_token: `token-${id}` });
const subscriptions = [subscription('a','android'), subscription('b','ios'), subscription('web','web'), subscription('other','android','bob')];
const fire = () => ({ id: 'fire', reminder_id: 'reminder', owner_id: 'alice', due_at: new Date(Date.now()-300000).toISOString(), delivery_state: {}, lease_id: 'lease', lease_until: new Date(Date.now()+300000).toISOString(), attempt_count: 1 });

test('only explicit provider retirement codes remove subscriptions', () => {
  for (const error of [new Error('404 expired unregistered BadDeviceToken'), new PushDeliveryError('apns','BadDeviceToken',400), new PushDeliveryError('apns','ExpiredProviderToken',403), new PushDeliveryError('fcm','SENDER_ID_MISMATCH',403), new PushDeliveryError('fcm','NOT_FOUND',404), new PushDeliveryError('fcm','OAUTH_FAILED',401)]) assert.equal(isRetiredSubscription(error),false);
  for (const error of [new PushDeliveryError('webpush','SEND_FAILED',410),new PushDeliveryError('webpush','SEND_FAILED',404),new PushDeliveryError('fcm','UNREGISTERED',404),new PushDeliveryError('apns','Unregistered',410)]) assert.equal(isRetiredSubscription(error),true);
  assert.equal(fcmErrorCode({ error: { status: 'NOT_FOUND', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } }), 'UNREGISTERED');
});
test('device test is owner- and device-scoped; another device cannot make it pass', async () => {
  const h = harness({ subscriptions, sendError: { a: new PushDeliveryError('fcm','OAUTH_FAILED',401) } });
  const result = await h.run('test',{ platform: 'android', deviceToken: 'token-a' });
  assert.equal(result.status,502); assert.deepEqual(h.calls.sends.map(s=>s.id),['a']); assert.deepEqual(h.calls.deletes,[]);
  assert.ok(!JSON.stringify(result).includes('token-a'));
});
test('device test reports provider acceptance, never verified delivery', async () => {
  const h = harness({ subscriptions }); const result = await h.run('test',{ platform: 'ios', deviceToken: 'token-b' });
  assert.equal(result.status,200); assert.equal(result.body.accepted,true); assert.equal(result.body.deliveryVerified,false);
  assert.deepEqual(h.calls.sends.map(s=>s.id),['b']);
});
test('web test is scoped to the browser endpoint, not native targets', async () => {
  const h = harness({ subscriptions }); const result = await h.run('test',{ platform: 'web', endpoint: subscriptions[2].endpoint });
  assert.equal(result.status,200); assert.deepEqual(h.calls.sends.map(s=>s.id),['web']);
});
test('test rejects anonymous, untargeted, unregistered and rate-limited requests', async () => {
  assert.equal((await harness({ auth: false }).run('test')).status,401);
  assert.equal((await harness().run('test')).status,400);
  assert.equal((await harness({ subscriptions }).run('test',{ platform:'android',deviceToken:'token-other' })).status,409);
  assert.equal((await harness({ rate: false }).run('test',{ platform:'ios',deviceToken:'token-b' })).status,429);
});
test('retired tokens are pruned but auth/configuration failures keep valid tokens', async () => {
  const h = harness({ subscriptions, sendError: { a: new PushDeliveryError('fcm','UNREGISTERED',404) } });
  await h.run('test',{ platform:'android',deviceToken:'token-a' }); assert.deepEqual(h.calls.deletes,['a']);
});
test('partial dispatch checkpoints each accepted target and email; retries only failures', async () => {
  const errors = { b: new PushDeliveryError('apns','ServiceUnavailable',503) };
  const h = harness({ subscriptions, claim:[fire()], sendError: errors });
  assert.equal((await h.run('dispatch')).status,200);
  assert.equal(h.state.fire.delivery_status,'partial'); assert.ok(h.state.fire.next_attempt_at);
  assert.equal(h.state.fire.delivery_state['push:a'],true); assert.equal(h.state.fire.delivery_state.email,true);
  assert.deepEqual(h.calls.sends.map(s=>s.id),['a','b','web']); assert.equal(h.calls.emails.length,1);
  assert.equal(h.calls.emails[0][4],'yere-reminder-fire');
  delete errors.b; h.state.fire.attempt_count=2; h.state.fire.lease_id='retry'; h.state.fire.lease_until=new Date(Date.now()+300000).toISOString();
  await h.run('dispatch');
  assert.deepEqual(h.calls.sends.map(s=>s.id),['a','b','web','b']); assert.equal(h.calls.emails.length,1); assert.equal(h.state.fire.delivery_status,'sent'); assert.equal(h.state.fire.next_attempt_at,null);
  assert.ok(h.calls.logs.some(log=>log.attempt===2));
});
test('interrupted worker preserves successes and next worker does not resend accepted targets', async () => {
  const h = harness({ subscriptions: subscriptions.slice(0,2), claim:[fire()], interruptBefore:true });
  await h.run('dispatch'); assert.deepEqual(h.calls.sends.map(s=>s.id),['a']); assert.equal(h.state.fire.delivery_state['push:a'],true);
  h.state.fire.attempt_count=2; h.state.fire.lease_id='retry'; h.state.fire.lease_until=new Date(Date.now()+300000).toISOString();
  await h.run('dispatch'); assert.deepEqual(h.calls.sends.map(s=>s.id),['a','b']);
});
test('third failed attempt is terminal; logs do not leak raw provider errors or tokens', async () => {
  const f = fire(); f.attempt_count=3;
  const h = harness({ subscriptions: subscriptions.slice(0,1), claim:[f], sendError:{ a:new Error('private-key token-a raw-request') } });
  await h.run('dispatch'); assert.equal(h.state.fire.next_attempt_at,null); assert.equal(h.state.fire.delivery_status,'partial');
  assert.ok(!JSON.stringify(h.calls.logs).includes('token-a')); assert.ok(!JSON.stringify(h.calls.logs).includes('private-key'));
});
test('dispatch requires the existing cron secret; no database claim occurs on denial', async () => {
  const h = harness(); assert.equal((await h.run('dispatch',{}, { 'x-yere-cron-secret':'wrong' })).status,401); assert.equal(h.calls.claims,0);
});

const pushSource = executable(await read('supabase/functions/_shared/push.ts'));
function senderHarness(settings, fetchImpl) {
  const sandbox = { exports: {}, Deno: { env: { get: k=>settings[k] }, createHttpClient: options=>({ options }) },
    TextEncoder, Uint8Array, btoa, atob, crypto, URLSearchParams, AbortSignal, fetch: fetchImpl,
    PushDeliveryError, fcmErrorCode, webpush: { setVapidDetails() {}, sendNotification: async()=>({}) } };
  vm.runInNewContext(pushSource, sandbox);
  return sandbox.exports.sendPush;
}
const pem = buffer => `-----BEGIN PRIVATE KEY-----\n${Buffer.from(buffer).toString('base64')}\n-----END PRIVATE KEY-----`;
test('real FCM JWT path sends data-only messages with bounded notes and parses provider codes', async () => {
  const key = await crypto.subtle.generateKey({ name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256' },true,['sign','verify']);
  const settings = { FIREBASE_PROJECT_ID:'test-project',FIREBASE_CLIENT_EMAIL:'test@example.test',FIREBASE_PRIVATE_KEY:pem(await crypto.subtle.exportKey('pkcs8',key.privateKey)) };
  const calls = [];
  const sender = senderHarness(settings, async(url,init)=>{
    calls.push({url,init}); return url.includes('oauth2') ? new Response(JSON.stringify({ access_token:'test-access',expires_in:3600 })) : new Response(JSON.stringify({ error: { details:[{ '@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED' }] } }),{status:404});
  });
  await assert.rejects(()=>sender({platform:'android',provider:'fcm',device_token:'test-token'}, { title:'Title',body:'🌍'.repeat(4000),reminderId:'reminder' }), error=>isRetiredSubscription(error));
  assert.equal(calls.length,2); const message = JSON.parse(calls[1].init.body).message;
  assert.equal(message.notification,undefined); assert.equal(message.android.priority,'HIGH'); assert.equal(message.android.ttl,'3600s'); assert.ok(Buffer.byteLength(calls[1].init.body)<4096);
  assert.equal(new URLSearchParams(calls[0].init.body).get('assertion').split('.').length,3);
});
test('real APNs JWT path explicitly uses HTTP/2, correct topic/environment, expiry and category', async () => {
  const key = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const settings = { APNS_TEAM_ID:'TESTTEAM',APNS_KEY_ID:'TESTKEY',APNS_PRIVATE_KEY:pem(await crypto.subtle.exportKey('pkcs8',key.privateKey)),APNS_USE_SANDBOX:'true' };
  const calls=[];
  const sender=senderHarness(settings,async(url,init)=>{calls.push({url,init});return new Response(null,{status:200,headers:{'apns-id':'receipt'}});});
  const result = await sender({platform:'ios',provider:'apns',device_token:'test-token'},{ title:'🌍'.repeat(180),body:'🌍'.repeat(4000),reminderId:'r',ownerId:'alice',dueAt:'2026-10-19T18:00:00Z' });
  assert.equal(result.reference,'receipt'); assert.match(calls[0].url,/api.sandbox.push.apple.com/); assert.equal(calls[0].init.client.options.http2,true);
  assert.equal(calls[0].init.headers['apns-topic'],'com.getyere.app'); assert.ok(Number(calls[0].init.headers['apns-expiration'])>Date.now()/1000);
  const payload=JSON.parse(calls[0].init.body); assert.equal(payload.aps.category,'YERE_REMINDER'); assert.equal(payload.title,undefined); assert.ok(Buffer.byteLength(calls[0].init.body)<4096);
});

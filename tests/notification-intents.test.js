import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createNotificationIntentQueue, normalizeNotification } from '../src/notification-intents.js';

function harness() {
  const context = { userId: null, ready: false }, calls = [];
  let clock = 1000, available = true;
  const queue = createNotificationIntentQueue({ getContext: () => context, execute: i => { if (!available) return false; calls.push(i); }, now: () => clock });
  return { queue, calls, context, tick: n => clock += n, setAvailable: v => available = v };
}
const intent = { reminderId: 'reminder', action: 'snooze', direct: true, minutes: 10, ownerId: 'alice', dueAt: '2026-10-19T18:00:00Z' };

test('notification dismissals never become View actions; iOS buttons normalize correctly', () => {
  assert.equal(normalizeNotification({ data: { reminderId: 'r' } }, 'dismiss'), null);
  const normalized = normalizeNotification({ data: { reminderId: 'r', dueAt: 'date', ownerId: 'alice', tag: 'event' } }, 'YERE_SNOOZE_10');
  assert.equal(normalized.action, 'snooze'); assert.equal(normalized.minutes, 10); assert.equal(normalized.direct, true);
  assert.equal(normalized.dueAt, 'date'); assert.equal(normalized.ownerId, 'alice');
  assert.equal(normalizeNotification({}, 'YERE_DONE').action, 'done');
  assert.equal(normalizeNotification({}, 'tap').action, 'view');
});
test('cold launch waits for authentication AND workspace readiness then runs once', () => {
  const { queue, context, calls } = harness();
  queue.enqueue(intent); queue.flush(); assert.equal(calls.length, 0);
  context.userId = 'alice'; queue.flush(); assert.equal(calls.length, 0);
  context.ready = true; queue.flush(); queue.flush();
  assert.equal(calls.length, 1); assert.equal(queue.size, 0);
  assert.equal(queue.enqueue(intent), false);
});
test('duplicate plugin/deep-link delivery, even equivalent timestamps, does not repeat an action', () => {
  const { queue, context, calls } = harness();
  context.userId = 'alice'; context.ready = true;
  queue.enqueue(intent); queue.enqueue({ ...intent, dueAt: '2026-10-19T19:00:00+01:00' }); queue.flush(); queue.enqueue(intent); queue.flush();
  assert.equal(calls.length, 1);
});
test('an account mismatch never mutates another account’s reminder', () => {
  const { queue, context, calls } = harness();
  queue.enqueue(intent); context.userId = 'bob'; context.ready = true; queue.flush();
  assert.equal(calls.length, 0); assert.equal(queue.size, 0);
});
test('missing offline data is retained until refreshed; sign-out clears pending actions', () => {
  const { queue, context, calls, setAvailable } = harness();
  context.userId = 'alice'; context.ready = true; setAvailable(false);
  queue.enqueue(intent); queue.flush(); assert.equal(queue.size, 1);
  setAvailable(true); queue.flush(); assert.equal(calls.length, 1);
  queue.enqueue({ ...intent, reminderId: 'another' }); queue.clear(); queue.flush(); assert.equal(calls.length, 1);
});
test('expired pending actions are discarded; view can be reopened after duplicate event window', () => {
  const { queue, context, calls, tick } = harness();
  queue.enqueue(intent); tick(86400001); context.userId = 'alice'; context.ready = true; queue.flush(); assert.equal(calls.length, 0);
  const view = { ...intent, action: 'view' }; queue.enqueue(view); queue.flush(); tick(1001); queue.enqueue(view); queue.flush(); assert.equal(calls.length, 2);
});

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const handlers = html.slice(html.indexOf('let notificationIntentQueue=null;'), html.indexOf('async function handleNativeUrl'));
function appHarness({ due = intent.dueAt, completed = false, ready = true } = {}) {
  const calls = [], reminder = { id: 'reminder', due, completed };
  const context = { state: { reminders: [reminder] }, currentSession: { user: { id: 'alice' } }, cloudReady: ready, cloudWorkspaceLoading: false, signOutInProgress: false, notificationDataReady: ready,
    window: { YERE_NOTIFICATION_INTENTS: { createNotificationIntentQueue } }, isNativeApp: () => true, supabase: {}, isOnline: () => true,
    snooze: (...args) => calls.push(['snooze', ...args]), toggleComplete: id => calls.push(['done', id]), openDetail: id => calls.push(['view', id]), openSnoozeScreen: id => calls.push(['screen', id]), toast: m => calls.push(['toast', m]) };
  vm.runInNewContext(handlers, context);
  return { context, calls };
}
test('actual app handler uses reminder.due, executes a valid Snooze once, and rejects stale notifications', () => {
  const { context, calls } = appHarness(); context.handleNativeNotificationIntent(intent); context.handleNativeNotificationIntent(intent);
  assert.deepEqual(calls, [['snooze', 'reminder', 10]]);
  const stale = appHarness({ due: '2026-10-20T18:00:00Z' }); stale.context.handleNativeNotificationIntent(intent);
  assert.equal(stale.calls[0][0], 'toast'); assert.equal(stale.calls.length, 1);
});
test('Done never toggles a completed reminder back to incomplete', () => {
  const { context, calls } = appHarness({ completed: true }); context.handleNativeNotificationIntent({ ...intent, action: 'done' }); assert.equal(calls.length, 0);
});
test('actual app handler waits for cloud data, not a 250ms timer', () => {
  const { context, calls } = appHarness({ ready: false }); context.handleNativeNotificationIntent(intent); assert.equal(calls.length, 0);
  context.cloudReady = true; context.notificationDataReady = true; context.flushNotificationIntents(); assert.equal(calls.length, 1);
});
test('iOS forwards success/errors and all mutation actions foreground the app', async () => {
  const delegate = await readFile(new URL('../ios/App/App/AppDelegate.swift', import.meta.url), 'utf8');
  assert.match(delegate, /capacitorDidRegisterForRemoteNotifications, object: deviceToken/);
  assert.match(delegate, /capacitorDidFailToRegisterForRemoteNotifications, object: error/);
  assert.equal((delegate.match(/options: \[\.foreground\]/g) || []).length, 3);
});

test('browser-only local demo notification navigation is preserved without native demo fallback', () => {
  const { context, calls } = appHarness({ ready: false }); context.currentSession = null; context.supabase = null;
  context.isNativeApp = () => false;
  context.handleNativeNotificationIntent({ reminderId: 'reminder', action: 'view' });
  assert.deepEqual(calls, [['view', 'reminder']]);
  const native = appHarness({ ready: false }); native.context.currentSession = null; native.context.supabase = null;
  native.context.handleNativeNotificationIntent({ reminderId: 'reminder', action: 'view' }); assert.equal(native.calls.length,0);
});
const htmlPush = html.slice(html.indexOf('let nativePushTask=Promise.resolve();'), html.indexOf('async function ensureNativePushRegistration'));
test('token refresh is serialized before opt-out deletion and cannot silently enroll again', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; }); const calls=[];
  const context = { currentSession: { user: { id:'alice' } }, signOutInProgress:false,state:{settings:{pushEnabled:true}},navigator:{userAgent:'test'},
    supabase:{rpc:async()=>{calls.push('register');await gate;return{error:null};},from:()=>({delete:()=>({eq:()=>({eq:async()=>{calls.push('delete');return{error:null};}})})})} };
  vm.runInNewContext(htmlPush,context);
  const registering = context.registerNativePushSubscription({token:'test-device',platform:'android',provider:'fcm'});
  await new Promise(resolve=>setImmediate(resolve));
  context.state.settings.pushEnabled=false;
  const removing=context.removeNativePushSubscription({token:'test-device'});
  const refreshing=context.registerNativePushSubscription({token:'new-token',platform:'android',provider:'fcm'});
  assert.deepEqual(calls,['register']); release(); await registering; await removing; assert.equal(await refreshing,false);
  assert.deepEqual(calls,['register','delete']);
});
test('queued token registration is rejected after logout or account switch', async () => {
  const calls=[];
  const context={currentSession:{user:{id:'alice'}},signOutInProgress:false,state:{settings:{pushEnabled:true}},navigator:{userAgent:'test'},supabase:{rpc:async()=>{calls.push('register');return{error:null};}}};
  vm.runInNewContext(htmlPush,context);
  const task=context.registerNativePushSubscription({token:'test-device',platform:'android',provider:'fcm'});
  context.currentSession={user:{id:'bob'}};assert.equal(await task,false);
  context.signOutInProgress=true;assert.equal(await context.registerNativePushSubscription({token:'test-device',platform:'android',provider:'fcm'}),false);assert.deepEqual(calls,[]);
});

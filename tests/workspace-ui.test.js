import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { homeMetrics } from '../src/dashboard.js';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const reference = new Date('2026-10-19T12:00:00Z');
const reminder = (id, extra = {}) => ({ id, title: id, due: '2026-10-20T12:00:00Z', approved: true, completed: false, ...extra });

test('workspace metrics are derived from real visible data, not pending or rejected tasks', () => {
  const result = homeMetrics({ reminders: [
    reminder('past', { due: '2026-10-18T10:00:00Z' }), reminder('later'),
    reminder('done', { completed: true, completedAt: '2026-10-19T10:00:00Z' }),
    reminder('rejected', { rejected: true }), reminder('pending', { approved: false }),
    reminder('waiting', { requiresApproval: true, approved: undefined })
  ], contacts: [{ status: 'approved' }, { status: 'pending' }], audit: [
    { at: 'bad-date' }, { at: '2026-10-18', action: 'older' }, { at: '2026-10-19', action: 'newest' }
  ] }, reference);
  assert.equal(result.total, 3); assert.equal(result.open, 2); assert.equal(result.completed, 1);
  assert.equal(result.overdue, 1); assert.equal(result.contacts, 1);
  assert.equal(result.completionRate, 33); assert.equal(result.completedThisWeek, 1);
  assert.equal(result.days.length, 7); assert.equal(result.recentActivity[0].action, 'newest');
});

test('empty accounts have zero metrics; history excludes old, invalid and future completions', () => {
  const empty = homeMetrics({}, reference);
  assert.equal(empty.completionRate, 0); assert.equal(empty.total, 0);
  assert.ok(empty.days.every(day => day.count === 0));
  const result = homeMetrics({ reminders: [
    reminder('old', { completed: true, completedAt: '2026-09-01' }),
    reminder('invalid', { completed: true, completedAt: 'not-a-date' }),
    reminder('future', { completed: true, completedAt: '2026-10-19T16:00:00Z' })
  ] }, reference);
  assert.equal(result.completedThisWeek, 0);
});

test('home groups all open reminders by day with no seven-day cutoff and retains completed/approval sections', () => {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', classList: { toggle() {} }, setAttribute() {} }); return elements.get(id); };
  const items = [reminder('overdue', { due: '2026-01-01' }), reminder('far-future', { due: '2028-01-01' }),
    reminder('done', { completed: true }), reminder('pending', { requiresApproval: true, approved: false }),
    reminder('undefined-approval', { requiresApproval: true, approved: undefined }), reminder('rejected', { rejected: true })];
  const groups = [];
  const context = { state: { lists: [], reminders: items }, view: 'today', searchQ: '',
    uiText: (element,text) => { element.textContent=text; }, document: { getElementById: get }, renderCustomListsNav() {}, greeting: () => 'Welcome',
    filteredReminders: () => items, compareReminders: (a,b) => new Date(a.due)-new Date(b.due),
    renderHomeDashboard: () => '<summary>Metrics</summary>',
    renderByDay: list => { groups.push(list.map(item => item.id)); return 'day-groups'; },
    renderPending: list => `approval:${list.map(item => item.id).join(',')}`,
    renderList: list => `completed:${list.map(item => item.id).join(',')}`
  };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function render() {'), html.indexOf('function renderHomeDashboard()')), context);
  context.render();
  assert.deepEqual(groups[0], ['overdue', 'far-future']);
  assert.match(get('content').innerHTML, /approval:pending,undefined-approval/);
  assert.match(get('content').innerHTML, /completed:done/);
  assert.doesNotMatch(get('content').innerHTML, /rejected/);
});

function logoutHarness({ native = false, answer = false, error = null } = {}) {
  const calls = { confirm: 0, web: 0, native: 0, tokens: 0, labels: 0 };
  const session = { user: { id: 'user-1' } };
  const context = {
    notificationIntentQueue: null, removeNativePushSubscription: async () => { calls.tokens++; }, currentSession: session, cloudReady: true, cloudPending: true, realtimeChannel: null,
    state: { reminders: [reminder('saved')], contacts: [], relationships: [], audit: [], lists: [], invites: [] },
    supabase: { auth: { signOut: async () => { calls.web++; return { error }; } }, from: () => { calls.tokens++; return { delete: () => ({ eq: () => ({ eq: async () => ({}) }) }) }; } },
    window: { YERE_NATIVE: { getPushRegistration: () => ({ token: 'device-token' }), unregisterPush: async () => {}, auth: { signOut: async () => { calls.native++; } } } },
    t: value => value, isNativeApp: () => native, confirm: () => { calls.confirm++; return answer; }, closeProfileMenu() {},
    toast() {}, setAccountLabel: () => { calls.labels++; }, setAuthMode() {}
  };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('let signOutInProgress=false;'), html.indexOf('async function deleteAccount()')), context);
  return { context, calls, session };
}
for (const native of [false, true]) {
  test(`logout cancellation leaves the ${native?'native':'web'} session, tokens and data untouched`, async () => {
    const { context, calls, session } = logoutHarness({ native });
    await context.signOut();
    assert.equal(calls.confirm, 1); assert.equal(calls.web+calls.native+calls.tokens, 0);
    assert.equal(context.currentSession, session); assert.equal(context.state.reminders.length, 1);
  });
  test(`confirmed ${native?'native':'web'} logout uses the correct auth path`, async () => {
    const { context, calls } = logoutHarness({ native, answer: true });
    await context.signOut();
    assert.equal(calls.confirm, 1); assert.equal(native?calls.native:calls.web, 1);
    assert.equal(context.currentSession, null); assert.equal(context.state.reminders.length, 0);
  });
}

test('failed logout keeps the current account and allows retry', async () => {
  const { context, calls, session } = logoutHarness({ answer: true, error: new Error('Offline') });
  await context.signOut(); await context.signOut();
  assert.equal(context.currentSession, session); assert.equal(calls.confirm, 2);
});

test('profile menu supports arrows, Escape, outside clicks, and action routing', () => {
  const callbacks = {}, actions = [];
  const doc = { activeElement: null, addEventListener: (name, fn) => { callbacks[name] = fn; } };
  const classes = new Set(['hidden']);
  const items = Array.from({ length: 3 }, () => ({ focus() { doc.activeElement = this; } }));
  const button = { attrs: {}, setAttribute(name,value) { this.attrs[name]=value; }, focus() { doc.activeElement=this; } };
  const menu = { classList: { contains: value => classes.has(value), add: value => classes.add(value), toggle(value, on) { if(on)classes.add(value);else classes.delete(value); } }, querySelector: () => items[0], querySelectorAll: () => items };
  doc.getElementById = id => ({ profileMenu: menu, profileMenuButton: button, profileMenuRoot: { contains: target => target === button || items.includes(target) } })[id];
  const context = { document: doc, signOut: () => actions.push('logout'), setView: view => actions.push(view), openAuthGate() {}, toggleTheme() {}, startTour() {} };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('/* ---------- Profile menu ---------- */'), html.indexOf('/* ---------- End profile menu ---------- */')), context);
  const key = value => context.handleProfileMenuKey({ key: value, preventDefault() {}, stopPropagation() {} });
  key('ArrowDown'); assert.equal(button.attrs['aria-expanded'], 'true'); assert.equal(doc.activeElement, items[0]);
  key('ArrowUp'); assert.equal(doc.activeElement, items[2]);
  key('Escape'); assert.equal(button.attrs['aria-expanded'], 'false'); assert.equal(doc.activeElement, button);
  context.toggleProfileMenu(); callbacks.click({ target: {} }); assert.equal(button.attrs['aria-expanded'], 'false');
  context.profileMenuAction('settings'); context.profileMenuAction('logout');
  assert.deepEqual(actions, ['settings','logout']);
});

test('all requested copy and shortcuts are present without removing the drawer sign-out', () => {
  assert.match(html, /Choose a new password':'Welcome'/);
  assert.doesNotMatch(html, /Welcome back|Skip Nigeria public holidays by default/);
  assert.match(html, /Skip public holidays by default/);
  assert.match(html, /id="signOutBtn" onclick="signOut\(\)"/);
  assert.match(html, /onclick="openInviteModal\(\)"[^>]*>Add trusted contact/);
  assert.match(html, /aria-haspopup="menu" aria-expanded="false"/);
});

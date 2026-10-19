import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('function renderDetailsDiscovery()'), html.indexOf('function renderHomeDashboard()'));
function harness() {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', focusCount: 0, focus() { this.focusCount++; } }); return elements.get(id); };
  const calls = { show: 0, capture: 0, modal: 0, edit: [] };
  const context = { state: { reminders: [], settings: { defaultHour: 9, defaultMin: 0 } }, currentSession: null,
    document: { getElementById: get }, now: () => new Date(), draft: null, editingId: 'old', draftAttachment: 'old',
    compareReminders: (a,b) => new Date(a.due) - new Date(b.due), formatDue: () => ({ dayLabel: 'Tomorrow' }),
    esc: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    openConfirmFromInput: () => { calls.capture++; }, showConfirmModal: () => { calls.show++; }, openModal: () => { calls.modal++; },
    editReminder: id => { calls.edit.push(id); }, toast() {} };
  vm.createContext(context); vm.runInContext(source, context);
  return { context, calls, get };
}
test('Home permanently explains notes, photos, files and privacy with actionable shortcuts', () => {
  const { context } = harness();
  const markup = context.renderDetailsDiscovery();
  assert.match(markup, /Keep notes, photos &amp; files with every reminder/);
  assert.match(markup, /openDetailedCapture/); assert.match(markup, /Sign in to save private photos and files/);
  assert.doesNotMatch(markup, /openDetailsPicker/);
  context.currentSession = { user: { id: 'account' } };
  context.state.reminders = [{ id: 'one' }];
  assert.match(context.renderDetailsDiscovery(), /openDetailsPicker/);
  assert.match(context.renderDetailsDiscovery(), /private to your account/);
  assert.match(html, /return renderDetailsDiscovery\(\)\+`<section aria-label="Workspace overview"/);
});
test('Create with details opens an empty real editor without saving or seeding a reminder', () => {
  const { context, calls, get } = harness(); context.openDetailedCapture();
  assert.equal(calls.show, 1); assert.equal(context.draft.title, ''); assert.equal(context.draft.id, null);
  assert.equal(context.draftAttachment, null); assert.equal(context.editingId, null);
  assert.equal(context.state.reminders.length, 0); assert.equal(get('dTitle').focusCount, 1);
  assert.ok(new Date(context.draft.due) > new Date());
});
test('Create with details preserves and parses an in-progress quick capture', () => {
  const { context, calls, get } = harness(); get('quickInput').value = 'Call Mandy tomorrow at 4';
  context.openDetailedCapture(); assert.equal(calls.capture, 1); assert.equal(calls.show, 0);
  assert.equal(get('quickInput').value, 'Call Mandy tomorrow at 4');
});
test('existing-reminder shortcut includes real completed reminders and focuses their existing notes', () => {
  const { context, calls, get } = harness();
  context.state.reminders = [{ id: 'one', title: '<My reminder>', completed: true, due: '2026-10-20' }, { id: 'rejected', rejected: true }];
  context.openDetailsPicker();
  assert.match(get('modalCard').innerHTML, /&lt;My reminder&gt; · Tomorrow · Completed/);
  assert.doesNotMatch(get('modalCard').innerHTML, /value="rejected"/);
  context.editReminderDetails('one'); assert.deepEqual(calls.edit, ['one']); assert.equal(get('dNotes').focusCount, 1);
  context.editReminderDetails('missing'); assert.equal(calls.edit.length, 1);
});
test('fourth tour slide describes the feature and teaches the same Home/editor shortcuts', () => {
  const context = {}; vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('const TOUR_STEPS='), html.indexOf('let tourIndex=')) + '\nthis.steps=TOUR_STEPS;', context);
  assert.equal(context.steps.length, 5);
  assert.equal(context.steps[3].title, 'Add notes, photos & files to reminders.');
  assert.match(context.steps[3].body, /Create with details on Home/);
  assert.match(context.steps[3].body, /Tap an attached photo to expand it/);
  assert.match(html, /id="reminderDetailsTitle"/);
  assert.match(html, /class="detail-add-button"/);
});

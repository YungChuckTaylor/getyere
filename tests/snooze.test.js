import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('function snooze(id, mins) {'), html.indexOf('function approveRem(id)'));

function harness(due) {
  const reminder = { id: 'reminder', title: 'Call Mandy', due, completed: true, completedAt: '2026-10-18T08:00:00Z' };
  const calls = { persist: 0, render: 0, close: 0, haptic: 0, audit: 0, messages: [] };
  // Freeze the clock far away from the reminder's due date, to expose the old bug.
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2030-01-01T12:00:00Z'])); }
    static now() { return Date.parse('2030-01-01T12:00:00Z'); }
  }
  const context = {
    Date: FixedDate, state: { reminders: [reminder] },
    window: { YERE_NATIVE: { impactHaptic: () => calls.haptic++ } },
    logAudit: () => calls.audit++, persist: () => calls.persist++, closeModal: () => calls.close++, render: () => calls.render++,
    toast: message => calls.messages.push(message)
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { reminder, calls, snooze: context.snooze };
}

for (const minutes of [10, 60]) {
  test(`snooze ${minutes}m adds to the scheduled due time, not the wall clock`, () => {
    const { reminder, calls, snooze } = harness('2026-10-19T03:43:00Z');
    snooze('reminder', minutes);
    assert.equal(Date.parse(reminder.due), Date.parse('2026-10-19T03:43:00Z') + minutes*60_000);
    assert.equal(reminder.completed, false);
    assert.equal(reminder.completedAt, null);
    assert.equal(calls.persist, 1); assert.equal(calls.render, 1); assert.equal(calls.close, 1);
    assert.equal(calls.haptic, 1); assert.equal(calls.audit, 1);
  });
}

test('future reminders and repeated snoozes keep extending the scheduled time', () => {
  const { reminder, snooze } = harness('2031-05-01T23:55:00Z');
  snooze('reminder', 10);
  assert.equal(reminder.due, '2031-05-02T00:05:00.000Z');
  snooze('reminder', 60);
  assert.equal(reminder.due, '2031-05-02T01:05:00.000Z');
});

test('snooze uses elapsed minutes across timezone/daylight-saving changes', () => {
  const { reminder, snooze } = harness('2026-11-01T01:55:00-04:00');
  snooze('reminder', 10);
  assert.equal(reminder.due, '2026-11-01T06:05:00.000Z');
});

test('an invalid scheduled time is explained rather than silently replaced with now', () => {
  const { reminder, calls, snooze } = harness('invalid-date');
  snooze('reminder', 10);
  assert.equal(reminder.due, 'invalid-date');
  assert.equal(calls.persist, 0); assert.equal(calls.haptic, 0);
  assert.match(calls.messages[0], /valid scheduled time/);
});

test('missing reminders are ignored', () => {
  const { calls, snooze } = harness('2026-10-19T03:43:00Z');
  snooze('missing', 60);
  assert.equal(calls.persist, 0);
});

test('popup and notification snooze paths reuse the same shared implementation', () => {
  assert.match(html, /onclick="snooze\('\$\{esc\(r\.id\)\}',10\)"/);
  assert.match(html, /onclick="snooze\('\$\{esc\(r\.id\)\}',60\)"/);
  assert.match(html, /intent\.action==='snooze'&&intent\.direct\)snooze\(intent\.reminderId/);
});

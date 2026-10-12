import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const appSource = inlineScripts.sort((a, b) => b.length - a.length)[0];
const context = vm.createContext({
  console,
  crypto: webcrypto,
  document: { addEventListener() {} },
  window: {},
  navigator: {},
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout, clearTimeout, setInterval, clearInterval,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary')
});
vm.runInContext(`${appSource}\nglobalThis.__yereTest={parseNaturalLanguage,combineDateTime,isHoliday,state};`, context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

test('natural-language capture extracts a Nigerian reminder title, date, and time', () => {
  const result = evaluate(`(() => {
    const parsed=parseNaturalLanguage('Call Aunty tomorrow at 4:30pm');
    const due=combineDateTime(parsed.date,parsed.time);
    return {title:parsed.title,hour:due.getHours(),minute:due.getMinutes(),date:parsed.date.getDate()};
  })()`);
  const expectedTomorrow = new Date();
  expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);
  assert.equal(result.title, 'Call Aunty');
  assert.equal(result.hour, 16);
  assert.equal(result.minute, 30);
  assert.equal(result.date, expectedTomorrow.getDate());
});

test('unspecified reminder times default to 9:00 AM and weekday recurrence skips weekends', () => {
  const result = evaluate(`(() => {
    const parsed=parseNaturalLanguage('Pay school fees tomorrow');
    const due=combineDateTime(parsed.date,{h:state.settings.defaultHour,m:state.settings.defaultMin});
    const weekday=parseNaturalLanguage('Take medicine every weekday').recurrence;
    return {hour:due.getHours(),minute:due.getMinutes(),skipWeekends:weekday.skipWeekends,unit:weekday.interval.unit};
  })()`);
  assert.equal(result.hour, 9);
  assert.equal(result.minute, 0);
  assert.equal(result.skipWeekends, true);
  assert.equal(result.unit, 'days');
});

test('Nigeria holiday helper covers fixed-date national holidays and computed Easter observances', () => {
  const result = evaluate(`(() => ({
    newYear:isHoliday(new Date(2026,0,1)),
    goodFriday:isHoliday(new Date(2026,3,3)),
    ordinaryDay:isHoliday(new Date(2026,3,7))
  }))()`);
  assert.equal(result.newYear, true);
  assert.equal(result.goodFriday, true);
  assert.equal(result.ordinaryDay, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stages, taskIds, sanitizeState, loadState, setTask, getProgress, STORAGE_KEY } from '../public/ios-guide.js';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('eight ordered stages have stable unique checklist IDs and actionable instructions', () => {
  assert.equal(stages.length,8); assert.equal(new Set(stages.map(s=>s.id)).size,8);
  assert.equal(new Set(taskIds).size,taskIds.length);
  for (const stage of stages) { assert.ok(stage.checks.length>=4); assert.ok(stage.content.length>700); assert.ok(stage.help.length>100); }
});
test('progress only counts valid unique tasks and supports checking/unchecking', () => {
  const state=sanitizeState({current:'submit',completed:[taskIds[0],taskIds[0],'not-a-task']});
  assert.equal(state.completed.length,1); assert.equal(state.current,'submit');
  const next=setTask(state,taskIds[1],true); assert.equal(getProgress(next).completed,2); assert.equal(state.completed.length,1);
  assert.equal(getProgress(setTask(next,taskIds[0],false)).completed,1);
  assert.equal(getProgress(setTask(next,'invalid',true)).completed,2);
  assert.equal(getProgress({completed:taskIds}).percent,100);
});
test('missing, corrupted, invalid or unavailable storage safely starts a fresh guide', () => {
  for (const raw of ['not-json','null','[]','{"current":"<script>","completed":"wrong"}']) {
    assert.deepEqual(loadState({getItem:()=>raw}),{current:'start',completed:[]});
  }
  assert.deepEqual(loadState({getItem:()=>{throw new Error('blocked');}}),{current:'start',completed:[]});
  assert.deepEqual(loadState(null),{current:'start',completed:[]});
  assert.equal(loadState({getItem:key=>{assert.equal(key,STORAGE_KEY);return JSON.stringify({current:'apple',completed:[taskIds[0]]});}}).current,'apple');
});
test('guide preserves security, honest release gates and current supported voice flow', () => {
  const text=stages.map(s=>s.content).join('\n');
  for (const required of ['com.getyere.app','APNS_PRIVATE_KEY','APNS_USE_SANDBOX','Sign in with Apple','production APNs','physical iPhone','Waiting for Review','service-role','does not currently select a contact']) assert.ok(text.includes(required),required);
  assert.match(text,/Do not create another scheduler/);
  for (const id of ['code','apple','archive']) assert.match(stages.find(s=>s.id===id).content,/set -a\nsource .env.local\nset \+a/);
});
test('static page is isolated, accessible and has an extensionless web route', async () => {
  const html=await read('public/ios-release-guide.html'), js=await read('public/ios-guide.js');
  assert.match(html,/name="robots" content="noindex, nofollow"/);
  assert.match(html,/aria-live="polite"/); assert.match(html,/Skip to instructions/);
  assert.doesNotMatch(html,/<input[^>]+(?:password|text|email)/);
  assert.doesNotMatch(js,/\bfetch\s*\(|createClient\s*\(|\.functions\.invoke/);
  const config=JSON.parse(await read('vercel.json'));
  assert.ok(config.rewrites.some(route=>route.source==='/ios-guide.html'&&route.destination==='/ios-release-guide.html'));
  assert.ok(config.rewrites.some(route=>route.source==='/ios-release-guide'&&route.destination==='/ios-release-guide.html'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stages, taskIds, sanitizeState, loadState, setTask, getProgress, STORAGE_KEY } from '../public/android-guide.js';
import { STORAGE_KEY as IOS_STORAGE_KEY } from '../public/ios-guide.js';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android guide has eight ordered stages, unique tasks and no pre-completed release claims', () => {
  assert.deepEqual(stages.map(s=>s.id), ['status','prepare','configure','signing','bundle','testing','listing','submit']);
  assert.equal(taskIds.length,36);
  assert.equal(new Set(taskIds).size,taskIds.length);
  for (const stage of stages) { assert.ok(stage.checks.length>=4); assert.ok(stage.content.length>700); assert.ok(stage.help.length>100); }
  assert.deepEqual(sanitizeState({}),{current:'status',completed:[]});
  assert.match(stages[0].content,/user-reported debug test/);
  assert.match(stages[0].content,/not verified in this handoff/);
});
test('Android progress is independent of iOS and validates check/uncheck state', () => {
  assert.notEqual(STORAGE_KEY,IOS_STORAGE_KEY);
  let state = sanitizeState({current:'submit',completed:[taskIds[0],taskIds[0],'ios:mac','unknown']});
  assert.deepEqual(state.completed,[taskIds[0]]);
  const next=setTask(state,taskIds[1],true);
  assert.equal(getProgress(next).completed,2);
  assert.equal(state.completed.length,1);
  assert.equal(getProgress(setTask(next,taskIds[0],false)).completed,1);
  assert.equal(getProgress({completed:taskIds}).percent,100);
  assert.equal(getProgress(setTask(next,'invalid',true)).completed,2);
});
test('Android guide tolerates broken, invalid and blocked local storage', () => {
  for (const value of ['bad-json','null','[]','{"current":"start","completed":"bad"}']) {
    assert.deepEqual(loadState({getItem:()=>value}),{current:'status',completed:[]});
  }
  assert.deepEqual(loadState(null),{current:'status',completed:[]});
  assert.deepEqual(loadState({getItem:()=>{throw Error('blocked');}}),{current:'status',completed:[]});
  assert.equal(loadState({getItem:()=>JSON.stringify({current:'testing',completed:[taskIds[0]]})}).current,'testing');
});
test('Android review describes the actual SDK, package, version and unsigned-release configuration', async () => {
  const variables=await read('android/variables.gradle'), gradle=await read('android/app/build.gradle');
  assert.match(variables,/minSdkVersion = 26/); assert.match(variables,/targetSdkVersion = 36/);
  assert.match(gradle,/applicationId "com.getyere.app"/); assert.match(gradle,/versionCode 1/);
  assert.doesNotMatch(gradle,/signingConfig\s/);
  const text=stages.map(s=>s.content).join('\n');
  for (const phrase of ['Android 8.0','versionName 1.0 / versionCode 1','assembleDebug','no signing configuration','Play app-signing','GOOGLE_SERVICES_JSON_B64','FIREBASE_PRIVATE_KEY','Force stop','scheduled time','not an exact alarm','node --env-file=.env.local --run build:native','node --env-file=.env.local --run verify:bundle','account deletion']) assert.ok(text.includes(phrase),phrase);
});
test('Android release gates cover both Firebase paths, Play installation, deletion, privacy and review', () => {
  const text=stages.map(s=>s.content).join('\n');
  for (const phrase of ['not a service-account JSON key','same Firebase project','existing scheduler','upload certificate','both getyere.com and www.getyere.com','Internal testing','12 testers','14 days','external web resource','Data safety','Publishing overview','managed publishing','not currently choose a contact']) assert.ok(text.includes(phrase),phrase);
  assert.ok(stages.every(s=>s.owner));
});
test('Android page is a direct public HTML route without credential inputs or account connections', async () => {
  const html=await read('public/android-guide.html'), js=await read('public/android-guide.js');
  assert.match(html,/<title>Android launch guide/); assert.match(html,/name="robots" content="noindex, nofollow"/);
  assert.match(html,/src="\/android-guide.js"/); assert.match(html,/href="\/ios-guide.css"/);
  assert.match(html,/aria-live="polite"/); assert.match(html,/Skip to instructions/);
  assert.doesNotMatch(html,/<input[^>]+(?:password|text|email)/);
  assert.doesNotMatch(js,/\bfetch\s*\(|createClient\s*\(|\.functions\.invoke/);
  assert.doesNotMatch(js,/App Store Connect|APNS_PRIVATE_KEY|TestFlight/);
});

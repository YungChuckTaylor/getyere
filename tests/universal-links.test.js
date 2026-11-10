import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import handler, { associationDocument } from '../api/apple-app-site-association.js';
import { reminderFromAppLink } from '../src/app-links.js';
import { createNotificationIntentQueue } from '../src/notification-intents.js';
const read = p => readFile(new URL(`../${p}`, import.meta.url),'utf8');
const fixtureId = 'TESTTEAM01.com.getyere.app';
function response() {
  return { headers:{}, statusCode:0, body:null, setHeader(k,v){this.headers[k]=v;}, status(v){this.statusCode=v;return this;}, json(v){this.body=v;return this;}, end(){return this;} };
}
test('AASA fails closed without a verified signed application identifier', () => {
  for(const id of [undefined,'','APPLE_TEAM_ID.com.getyere.app','6826483998','TESTTEAM01.other.app']) assert.equal(associationDocument(id),null);
  const old = process.env.APPLE_APP_ID; delete process.env.APPLE_APP_ID;
  try { const res=response(); handler({method:'GET'},res); assert.equal(res.statusCode,503); assert.equal(res.headers['Cache-Control'],'no-store'); }
  finally { if(old===undefined)delete process.env.APPLE_APP_ID;else process.env.APPLE_APP_ID=old; }
});
test('AASA serves JSON directly for GET/HEAD and excludes admin/legal routes', () => {
  const old=process.env.APPLE_APP_ID;process.env.APPLE_APP_ID=fixtureId;
  try {
    for(const method of ['GET','HEAD']) { const res=response();handler({method},res);assert.equal(res.statusCode,200);assert.match(res.headers['Content-Type'],/application\/json/);assert.equal(res.headers.Location,undefined);if(method==='HEAD')assert.equal(res.body,null); }
    const res=response();handler({method:'POST'},res);assert.equal(res.statusCode,405);
    const doc=associationDocument(fixtureId);assert.deepEqual(doc.applinks.details[0].appIDs,[fixtureId]);
    const rules=doc.applinks.details[0].components;
    assert.ok(rules.some(r=>r['/']==='/'&&r['?']?.reminder));
    assert.ok(rules.some(r=>r['/']==='/admin*'&&r.exclude));
    assert.ok(!rules.some(r=>r['/']==='/*'&&!r.exclude));
  } finally {if(old===undefined)delete process.env.APPLE_APP_ID;else process.env.APPLE_APP_ID=old;}
});
test('both association paths route to the handler and bypass the service worker', async () => {
  const config=JSON.parse(await read('vercel.json')), sw=await read('public/sw.js');
  for(const source of ['/.well-known/apple-app-site-association','/apple-app-site-association']){
    assert.equal(config.rewrites.find(r=>r.source===source)?.destination,'/api/apple-app-site-association');
    assert.ok(sw.includes(source));
  }
  const entitlements=await read('ios/App/App/App.entitlements'),scene=await read('ios/App/App/SceneDelegate.swift');
  for(const host of ['getyere.com','www.getyere.com'])assert.ok(entitlements.includes(`applinks:${host}`));
  assert.match(scene,/SceneDelegateProxy.shared.scene\(scene, continue: userActivity\)/);
  assert.match(scene,/SceneDelegateProxy.shared.scene\(scene, willConnectTo: session, options: connectionOptions\)/);
  const project=await read('ios/App/App.xcodeproj/project.pbxproj');
  assert.equal((project.match(/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g)||[]).length,2);
});
test('reminder links are allowlisted navigation, not remotely supplied Done/Snooze actions', () => {
  for(const host of ['getyere.com','www.getyere.com']){
    assert.deepEqual(reminderFromAppLink(`https://${host}/?reminder=abc-123&action=done&direct=1&minutes=10`),{reminderId:'abc-123',action:'view',ownerId:''});
  }
  assert.equal(reminderFromAppLink('yere://reminder/abc-123').reminderId,'abc-123');
  for(const raw of ['https://evil.test/?reminder=abc','http://getyere.com/?reminder=abc','https://getyere.com:8443/?reminder=abc','https://u:p@getyere.com/?reminder=abc','https://www.getyere.com/admin?reminder=abc','https://www.getyere.com/?reminder=','https://www.getyere.com/?reminder=%3Cscript%3E','yere://unknown/?reminder=abc'])assert.equal(reminderFromAppLink(raw),null,raw);
});
test('cold email navigation waits for auth/data; another account cannot consume an owner-bound link', () => {
  const state={userId:'',ready:false},calls=[];
  const q=createNotificationIntentQueue({getContext:()=>state,execute:i=>{calls.push(i);return true;}});
  q.enqueue(reminderFromAppLink('https://www.getyere.com/?reminder=abc&ownerId=alice'));q.flush();assert.equal(calls.length,0);
  state.userId='bob';state.ready=true;q.flush();assert.equal(calls.length,0);
  state.userId='alice';q.enqueue(reminderFromAppLink('https://www.getyere.com/?reminder=abc'));q.flush();assert.equal(calls[0].action,'view');
});
test('actual app URL handler forces view and refuses foreign/admin links', async () => {
  const html=await read('index.html'),source=html.slice(html.indexOf('async function handleNativeUrl'),html.indexOf('function handleNotificationIntent()'));
  const calls=[],ctx={URL,window:{YERE_APP_LINKS:{reminderFromAppLink}},handleNativeNotificationIntent:i=>calls.push(i),console,history:{replaceState:()=>{}},handleInviteLink:async()=>calls.push('invite'),supabase:null};
  vm.runInNewContext(source,ctx);
  await ctx.handleNativeUrl('https://www.getyere.com/?reminder=abc&action=done');assert.equal(calls[0].action,'view');
  await ctx.handleNativeUrl('https://evil.test/?invite=secret');
  await ctx.handleNativeUrl('https://www.getyere.com/admin-access?invite=secret');assert.equal(calls.length,1);
});
test('new reminder emails avoid the apex redirect and keep retry/idempotency protections', async () => {
  const dispatch=await read('supabase/functions/dispatch-reminders/index.ts');
  assert.match(dispatch,/linkOrigin[\s\S]*https:\/\/www.getyere.com/);
  assert.match(dispatch,/const url = `\$\{linkOrigin\}\/\?reminder=/);
  assert.match(dispatch,/`yere-reminder-\$\{fire.id\}`/);
  assert.match(dispatch,/deliveryState.email = true/);
});

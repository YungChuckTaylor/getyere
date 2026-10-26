import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
const read = path => readFile(new URL(`../${path}`, import.meta.url),'utf8');
const source = await read('public/language.js');
const catalog = await read('public/locales/app.js');
function harness({ preference, path = '/', denied = false, body = '<main></main>', values = new Map() } = {}) {
 const { document, window } = parseHTML(`<html><head></head><body>${body}</body></html>`);
 if (preference) values.set('Yere.appLanguage', preference);
 const navigation=[], listeners=new Map();
 const context = { document, CustomEvent: window.CustomEvent, MutationObserver: window.MutationObserver,
  localStorage: { getItem: key => {if(denied)throw Error('blocked');return values.get(key)??null;},setItem:(key,value)=>{if(denied)throw Error('blocked');values.set(key,value);} },
  location: { pathname:path,search:'?source=test',hash:'#retention',assign:value=>navigation.push(value),replace:value=>navigation.push(value) },addEventListener:(name,listener)=>listeners.set(name,listener)
 };
 vm.createContext(context);vm.runInContext(catalog,context);vm.runInContext(source,context);
 return { api:context.YERE_I18N, messages:context.YERE_MESSAGES,document,values,navigation,context,listeners };
}
test('the app defaults to English, including blocked/invalid storage and the former shared preference',()=>{
 for(const options of [{},{denied:true},{preference:'de'},...['en','fr'].map(value=>({values:new Map([['Yere.language',value],['Yere.legalLanguage','fr']])}))]){
  const h=harness(options);assert.equal(h.api.language,'en');assert.equal(h.document.documentElement.lang,'en');assert.equal(h.api.locale,'en-CA');
 }
 const h=harness();assert.equal(h.api.setLanguage('fr'),true);assert.equal(h.values.get('Yere.appLanguage'),'fr');assert.equal(h.api.locale,'fr-CA');
 assert.equal(h.api.setLanguage('xx'),false);assert.equal(h.api.language,'fr');
 assert.equal(harness({preference:'fr'}).api.language,'fr');
 assert.equal(harness({preference:'fr',path:'/admin'}).document.documentElement.lang,'en');
});
test('only privacy, terms and support default to French; explicit document routes override their own preference',()=>{
 for(const path of ['/privacy-policy','/termsofuse','/support.html','/privacy.html','/privacy-fr.html','/terms.html','/terms-fr.html','/support-en.html']){
  for(const options of [{},{denied:true},{values:new Map([['Yere.appLanguage','en'],['Yere.language','en'],['Yere.legalLanguage','de']])}])assert.equal(harness({path,...options}).api.language,'fr',path);
 }
 assert.equal(harness({path:'/privacy-policy',values:new Map([['Yere.legalLanguage','en']])}).api.language,'en');
 assert.equal(harness({path:'/fr/privacy-policy',values:new Map([['Yere.legalLanguage','en']])}).api.language,'fr');
 assert.equal(harness({denied:true,path:'/en/termsofuse'}).api.language,'en');
});
test('app and legal choices are independent across navigation and cross-tab storage events',()=>{
 const values=new Map([['Yere.language','fr']]);
 const legal=harness({path:'/fr/privacy-policy',values});legal.document.body.dataset.legalLanguage='fr';
 assert.equal(values.get('Yere.legalLanguage'),'fr');
 const app=harness({values});assert.equal(app.api.language,'en');
 app.api.setLanguage('fr');legal.api.setLanguage('en');
 assert.equal(values.get('Yere.appLanguage'),'fr');assert.equal(values.get('Yere.legalLanguage'),'en');
 assert.equal(harness({values}).api.language,'fr');assert.equal(harness({path:'/support.html',values}).api.language,'en');
 app.api.setLanguage('en');app.listeners.get('storage')({key:'Yere.legalLanguage',newValue:'fr'});assert.equal(app.api.language,'en');
 app.listeners.get('storage')({key:'Yere.language',newValue:'fr'});assert.equal(app.api.language,'en');
 app.listeners.get('storage')({key:'Yere.appLanguage',newValue:'fr'});assert.equal(app.api.language,'fr');
 legal.listeners.get('storage')({key:'Yere.appLanguage',newValue:'fr'});assert.equal(legal.api.language,'en');
 assert.equal(values.get('Yere.language'),'fr','legacy value is ignored, not deleted');
});
test('translations are marked-only: form values, stored titles, custom names and identifiers stay unchanged',()=>{
 const h=harness({preference:'fr',body:'<p id="custom">Home</p><input id="title" value="Settings"><textarea id="notes">Delete</textarea><input id="email" value="person@example.com"><div id="ui"></div>'});
 h.document.getElementById('ui').innerHTML=h.api.html('Home');h.api.apply();
 assert.equal(h.document.querySelector('[data-i18n]').textContent,'Accueil');
 for(const language of ['en','fr']){h.api.setLanguage(language);assert.equal(h.document.getElementById('custom').textContent,'Home');assert.equal(h.document.getElementById('title').value,'Settings');assert.equal(h.document.getElementById('notes').value,'Delete');assert.equal(h.document.getElementById('email').value,'person@example.com');}
 assert.equal(h.api.text('Unknown provider error'),'Unknown provider error');
});
test('dynamic names are escaped and preserved across translation; option machine values never translate',()=>{
 const h=harness({preference:'fr'}),name='<img src=x onerror=alert(1)> Home';
 h.document.body.innerHTML=h.api.html('Send reminder to {name}',{name})+`<select>${h.api.option('hours','hours',true)}</select>`;
 h.api.apply();assert.equal(h.document.querySelector('img'),null);assert.equal(h.document.querySelector('span').textContent,`Envoyer le rappel à ${name}`);
 assert.equal(h.document.querySelector('option').textContent,'heures');assert.equal(h.document.querySelector('option').getAttribute('value'),'hours');
 h.api.setLanguage('en');assert.equal(h.document.querySelector('span').textContent,`Send reminder to ${name}`);assert.equal(h.document.querySelector('option').getAttribute('value'),'hours');
});
test('legal language selection keeps route, query and section and is explicit without storage',()=>{
 const h=harness({path:'/fr/privacy-policy',denied:true});h.document.body.dataset.legalLanguage='fr';h.api.setLanguage('en');
 assert.deepEqual(h.navigation,['/en/privacy-policy?source=test#retention']);
});
test('common French dates pass through the existing parser grammar bridge without network calls',()=>{
 const h=harness();assert.equal(h.api.frenchDateInput('Appeler maman demain à 15 h'),'Appeler maman tomorrow at 15:00');
 assert.equal(h.api.frenchDateInput('Étudier dans 45 minutes'),'Étudier in 45 minutes');
 assert.equal(h.api.frenchDateInput('Appeler tous les lundis à 9 h'),'Appeler every monday at 9:00');
 assert.equal(h.api.frenchDateInput('Revoir premier vendredi du mois'),'Revoir first friday of the month');
 assert.doesNotMatch(source,/\bfetch\(|XMLHttpRequest|SpeechRecognition|\.value\s*=.*text\(/);
});
test('every marked source UI message has both catalog entries and matching interpolation parameters',async()=>{
 const h=harness();const app=await read('index.html');
 const keys=[...app.matchAll(/data-i18n(?:-placeholder|-title|-aria-label)?="(m[0-9a-f]+)"/g)].map(m=>m[1]);assert.ok(keys.length>250);
 for(const key of keys){assert.equal(typeof h.messages.en[key],'string',key);assert.equal(typeof h.messages.fr[key],'string',key);}
 for(const [key,en]of Object.entries(h.messages.en)){
  const params=value=>[...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(params(h.messages.fr[key]),params(en),key);assert.doesNotMatch(h.messages.fr[key],/<script|onerror\s*=/i);
 }
 assert.match(app,/<html lang="en">/);
 assert.match(app,/<title[^>]*>Yere — Remember the times, together!<\/title>/);
 assert.match(app,/YERE_I18N\?\.locale \|\| 'en-CA'/);
 assert.match(app,/function voiceLanguage\(\)\{ return uiLocale\(\); \}/);
 assert.match(await read('public/sw.js'),/new URL\('locales\/app.js'/);
});
test('French canonical and explicit English legal/support documents identify the same operator',async()=>{
 const config=JSON.parse(await read('vercel.json'));
 for(const [route,french,english]of[['privacy-policy','privacy-fr.html','privacy.html'],['termsofuse','terms-fr.html','terms.html'],['support.html','support.html','support-en.html']]){
  for(const [file,language]of[[french,'fr'],[english,'en']]){
   const html=await read(`public/${file}`);const {document}=parseHTML(html);
   assert.equal(document.documentElement.lang,language);assert.match(html,/Maple Dominion Consulting Inc\./);assert.match(html,/1004 Kicking Horse Path/);assert.match(html,/src="\/language.js"/);
   const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
   for(const link of document.querySelectorAll('a[href^="#"]'))assert.ok(document.getElementById(link.getAttribute('href').slice(1)));
  }
  if(route!=='support.html')assert.ok(config.rewrites.some(r=>r.source===`/${route}`&&r.destination===`/${french}`));
  assert.ok(config.rewrites.some(r=>r.source===`/en/${route}`&&r.destination===`/${english}`));
 }
 const privacy=await read('public/privacy-fr.html');for(const fragment of ['90 jours','12 mois','24 mois','30 jours','25 novembre 2026','eu-west-1','iad1','n’a encore été vérifié'])assert.ok(privacy.includes(fragment),fragment);
 const sw=await read('public/sw.js');assert.ok(sw.includes('/support.html'));assert.ok(sw.includes('(en|fr)'));
});

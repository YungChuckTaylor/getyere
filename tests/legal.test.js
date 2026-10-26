import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [route, file, title] of [['/privacy-policy', 'privacy.html', 'Privacy Policy'], ['/termsofuse', 'terms.html', 'Terms of Use']]) {
  test(`${route} serves a standalone, accessible public legal document`, async () => {
    const html = await read(`public/${file}`);
    const config = JSON.parse(await read('vercel.json'));
    assert.ok(config.rewrites.some(rule => rule.source === `/en${route}` && rule.destination === `/${file}`));
    assert.ok(config.redirects.some(rule => rule.source === `/${file}` && rule.destination === route));
    assert.match(html, new RegExp(`<h1>${title}</h1>`));
    assert.ok(html.includes(`rel="canonical" href="https://getyere.com/en${route}"`));
    assert.match(html, /datetime="2026-10-26"/);
    assert.match(html, /href="#content"/);
    assert.match(html, /href="\/(?:en\/)?privacy-policy"/);
    assert.match(html, /href="\/(?:en\/)?termsofuse"/);
    assert.match(html, /support@getyere\.com/);
    assert.doesNotMatch(html, /<script(?! src=)|noindex|TODO|Lorem ipsum|\[Your/i);
    assert.match(html, /src="\/language.js"/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `anchor ${match[1]} exists`);
  });
}

test('privacy policy covers actual auth, local storage, voice, deletion, sharing and rights', async () => {
  const html = await read('public/privacy.html');
  for (const word of ['Google', 'Gmail', 'microphone', 'Supabase', 'Vercel', 'offline', 'Delete account and cloud data', 'PIPEDA', 'withdraw', 'backup']) {
    assert.match(html.toLowerCase(), new RegExp(word.toLowerCase()));
  }
});

test('auth and settings link to both requested legal URLs', async () => {
  const html = await read('index.html');
  assert.match(html, /By creating an account, you agree to our/);
  assert.match(html, /href="\/(?:en\/)?termsofuse"/);
  assert.match(html, /href="\/(?:en\/)?privacy-policy"/);
  assert.doesNotMatch(html, /href="\/privacy.html"/);
});

test('service worker never responds with an app shell for a legal URL', async () => {
  const source = await read('public/sw.js');
  const listeners = {};
  const context = { URL, self: { registration: { scope: 'https://getyere.com/' }, addEventListener: (name, callback) => { listeners[name] = callback; } } };
  vm.createContext(context);
  vm.runInContext(source, context);
  for (const path of ['/privacy-policy', '/termsofuse', '/privacy-policy/', '/privacy.html', '/terms.html', '/en/privacy-policy', '/fr/termsofuse', '/support.html', '/en/support.html', '/fr/support.html']) {
    let intercepted = false;
    listeners.fetch({ request: { url: `https://getyere.com${path}`, method: 'GET', mode: 'navigate' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
});

test('local route middleware matches production without returning a post-install hook', async () => {
  const source = await read('vite.config.js');
  const fn = source.slice(source.indexOf('function legalRoutes()'), source.indexOf('export default defineConfig'));
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${fn}\nglobalThis.plugin = legalRoutes();`, context);
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    let middleware;
    const result = context.plugin[hook]({ middlewares: { use: callback => { middleware = callback; return () => { throw new Error('Must not return the Connect app as a Vite post hook'); }; } } });
    assert.equal(result, undefined);
    for (const [url, expected] of [['/privacy-policy', '/privacy-fr.html'], ['/termsofuse?source=signup', '/terms-fr.html?source=signup'], ['/privacy-policy/', '/privacy-fr.html'], ['/admin', '/admin']]) {
      const req = { url }; let nextCalled = false;
      middleware(req, {}, () => { nextCalled = true; });
      assert.equal(req.url, expected);
      assert.equal(nextCalled, true);
    }
  }
});


test('Canadian privacy notice covers consent, provincial laws, transfers, access and complaints', async () => {
  const privacy = await read('public/privacy.html');
  for (const word of ['Personal Information Protection and Electronic Documents Act', 'Alberta', 'British Columbia', 'Québec', 'Law 25', 'meaningful consent', 'outside Canada', 'privacy impact assessment', '30 calendar days', 'real risk of significant harm', 'Office of the Privacy Commissioner of Canada', 'CASL', '10 business days']) assert.ok(privacy.includes(word), word);
  assert.match(privacy, /not blanket consent/);
  assert.match(privacy, /does not create an unconditional right/);
  assert.match(privacy, /do not promise Canada-only hosting/);
  assert.match(privacy, /13/); assert.match(privacy, /under 14/);
});

test('Terms and Conditions use Canadian law without inventing a province or waiving consumer rights', async () => {
  const terms = await read('public/terms.html');
  for (const word of ['Terms and Conditions', 'applicable laws of Canada', 'conflict-of-laws rules', 'No particular province or exclusive court', 'consumer protections', 'Civil Code of Québec', 'French-language rights', 'do not impose mandatory arbitration', 'currency', 'cancellation', 'CASL']) assert.ok(terms.includes(word), word);
  assert.match(terms, /at least 14 in Québec/);
  for (const file of ['public/privacy.html', 'public/terms.html']) {
    const html = await read(file);
    assert.doesNotMatch(html, /Nigeria|Nigerian|Nigeria Data Protection Commission/i);
    assert.doesNotMatch(html, /fully compliant|certified compliant|incorporated in Canada|governed by the laws of Ontario/i);
  }
});

test('privacy, terms and support publish identical Ontario mailing and Privacy Officer contacts', async () => {
  for (const file of ['public/privacy.html', 'public/terms.html', 'public/support-en.html']) {
    const html = await read(file);
    assert.match(html, /1004 Kicking Horse Path<br>Oshawa, Ontario L1J 0B4<br>Canada/);
    assert.match(html, /Privacy Officer — person responsible for the protection of personal information/);
    assert.match(html, /mailto:support@getyere\.com/);
    assert.doesNotMatch(html, /Yere (?:Inc\.|Ltd\.|Corporation)|Nigeria|Nigerian|24\/7 support|within 48 hours/i);
  }
});

test('Toronto publication and effective dates are labelled separately', async () => {
  for (const file of ['public/privacy.html', 'public/terms.html']) {
    const html = await read(file);
    assert.match(html, /Last updated: <time data-legal-updated datetime="2026-10-25">25 October 2026<\/time> \(Toronto\)/);
    assert.match(html, /Effective date of this revision: <time data-legal-effective datetime="2026-10-26">26 October 2026<\/time> \(Toronto\)/);
  }
  assert.match(await read('public/terms.html'), /effective date above is not a substitute/);
});

test('retention separates actual deletion behavior, record criteria and unverified backup expiry', async () => {
  const privacy = await read('public/privacy.html');
  for (const text of ['active cloud data', '24 months from creation', '90 days from creation', '12 months from the ticket’s last update', '30 days after expiry or revocation', '25 November 2026 (Toronto)', 'specific security investigation', 'snapshot expires or is overwritten', 'maximum backup-expiry window across providers has not yet been verified', 'saved to another person’s account', 'eu-west-1', 'iad1', 'not a complete list', 'not a claim that every provider is located in Canada or that the required transfer assessments and agreements have been completed']) assert.ok(privacy.includes(text), text);
  assert.doesNotMatch(privacy, /(?:backups|logs).{0,30}(?:expire|deleted) within \d+ days/i);
});

test('support protects unsynced data and qualifies deletion and availability promises', async () => {
  const support = await read('public/support-en.html');
  for (const text of ['Being online does not mean syncing has completed', 'before signing out, clearing app/browser data, or reinstalling', 'another already-signed-in device or web session', 'active cloud data', 'backups follow the provider’s actual expiry/overwrite cycle', 'Privacy Policy §7', 'Revoke', 'Redeem an invite code', 'Direct access', 'People who approved you', 'operating-system version', 'time and timezone', 'no published response-time', 'do not assume continuous monitoring', 'not emergency services']) assert.ok(support.includes(text), text);
  assert.doesNotMatch(support, /This permanently removes|sign out only after confirming the device is online/);
  const ids = [...support.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(support, /href="\/en\/privacy-policy#retention"/);
});

test('terms bind material changes to written notice and a usable refusal/cancellation process', async () => {
  const terms = await read('public/terms.html');
  for (const text of ['must follow section 13', 'Only non-essential elements', 'require your express agreement', '30 days in advance', 'registered email address', 'notice will contain only', 'old and amended clause', 'Updating the date on this webpage alone is not that notice', 'Terms cancellation', 'without cost, penalty or cancellation indemnity', '30 days after', 'not the same as deleting your account', 'own acts or those of its representatives']) assert.ok(terms.includes(text), text);
});

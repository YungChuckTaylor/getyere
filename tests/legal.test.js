import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [route, file, title] of [['/privacy-policy', 'privacy.html', 'Privacy Policy'], ['/termsofuse', 'terms.html', 'Terms of Use']]) {
  test(`${route} serves a standalone, accessible public legal document`, async () => {
    const html = await read(`public/${file}`);
    const config = JSON.parse(await read('vercel.json'));
    assert.ok(config.rewrites.some(rule => rule.source === route && rule.destination === `/${file}`));
    assert.ok(config.redirects.some(rule => rule.source === `/${file}` && rule.destination === route));
    assert.match(html, new RegExp(`<h1>${title}</h1>`));
    assert.ok(html.includes(`rel="canonical" href="https://getyere.com${route}"`));
    assert.match(html, /datetime="2026-10-26"/);
    assert.match(html, /href="#content"/);
    assert.match(html, /href="\/privacy-policy"/);
    assert.match(html, /href="\/termsofuse"/);
    assert.match(html, /support@getyere\.com/);
    assert.doesNotMatch(html, /<script\b|noindex|TODO|Lorem ipsum|\[Your/i);
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
  assert.match(html, /href="\/termsofuse"/);
  assert.match(html, /href="\/privacy-policy"/);
  assert.doesNotMatch(html, /href="\/privacy.html"/);
});

test('service worker never responds with an app shell for a legal URL', async () => {
  const source = await read('public/sw.js');
  const listeners = {};
  const context = { URL, self: { registration: { scope: 'https://getyere.com/' }, addEventListener: (name, callback) => { listeners[name] = callback; } } };
  vm.createContext(context);
  vm.runInContext(source, context);
  for (const path of ['/privacy-policy', '/termsofuse', '/privacy-policy/', '/privacy.html', '/terms.html']) {
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
    for (const [url, expected] of [['/privacy-policy', '/privacy.html'], ['/termsofuse?source=signup', '/terms.html?source=signup'], ['/privacy-policy/', '/privacy.html'], ['/admin', '/admin']]) {
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

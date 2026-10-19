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
    assert.match(html, /datetime="2026-10-19"/);
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
  for (const word of ['Google', 'Gmail', 'microphone', 'Supabase', 'Vercel', 'offline', 'Delete account and cloud data', 'Nigeria Data Protection', 'withdraw', 'backup']) {
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

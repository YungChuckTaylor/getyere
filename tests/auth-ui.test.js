import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { startSocialSignIn, enhancePasswordFields, togglePasswordVisibility } from '../src/auth-ui.js';

for (const provider of ['google']) {
  test(`${provider} uses Supabase OAuth on the current web origin and preserves invitations`, async () => {
    let request;
    const client = { auth: { signInWithOAuth: async options => { request = options; return { data: { url: 'https://provider.example' }, error: null }; } } };
    await startSocialSignIn({ provider, client, location: { origin: 'https://www.getyere.com', search: '?invite=hello%26world&untrusted=1' } });
    assert.equal(request.provider, provider);
    assert.equal(request.options.redirectTo, 'https://www.getyere.com/?invite=hello%26world');
  });
  test(`${provider} selects the native bridge without starting a second web redirect`, async () => {
    let request;
    await startSocialSignIn({ provider, client: {}, native: { enabled: true, auth: { signInWithOAuth: async value => { request = value; } } } });
    assert.deepEqual(request, { provider });
  });
}

test('unsupported providers, missing config and Supabase errors are surfaced', async () => {
  await assert.rejects(startSocialSignIn({ provider: 'malicious' }), /Unsupported/);
  await assert.rejects(startSocialSignIn({ provider: 'google' }), /not configured/);
  await assert.rejects(startSocialSignIn({ provider: 'google', location: { origin: 'https://getyere.com' }, client: { auth: { signInWithOAuth: async () => ({ error: new Error('Provider not enabled') }) } } }), /Provider not enabled/);
});

test('password reveal preserves value, toggles accessible state and hides again', () => {
  const attrs = {};
  const slash = { toggleAttribute: (name, value) => { attrs.slashHidden = value; } };
  const button = { setAttribute: (key, value) => { attrs[key] = value; }, querySelector: () => slash };
  const input = { type: 'password', value: 'Do not change me' };
  togglePasswordVisibility(input, button);
  assert.equal(input.type, 'text');
  assert.equal(input.value, 'Do not change me');
  assert.equal(attrs['aria-label'], 'Hide password');
  assert.equal(attrs['aria-pressed'], 'true');
  assert.equal(attrs.slashHidden, false);
  togglePasswordVisibility(input, button);
  assert.equal(input.type, 'password');
  assert.equal(attrs['aria-label'], 'Show password');
  assert.equal(attrs['aria-pressed'], 'false');
});

test('password enhancement is idempotent and buttons do not submit forms', () => {
  const elements = [];
  const document = { createElement: () => {
    const element = { attrs: {}, children: [], append(node) { this.children.push(node); }, setAttribute(key, value) { this.attrs[key] = value; }, addEventListener(event, fn) { this[event] = fn; } };
    elements.push(element);
    return element;
  } };
  const input = { type: 'password', name: 'password', dataset: {}, style: {}, ownerDocument: document, before() {} };
  const root = { querySelectorAll: () => [input] };
  enhancePasswordFields(root);
  enhancePasswordFields(root);
  assert.equal(elements.length, 2);
  assert.equal(elements[1].type, 'button');
  assert.equal(elements[1].attrs['aria-controls'], input.id);
  assert.equal(elements[1].attrs['aria-pressed'], 'false');
  assert.equal(input.style.paddingRight, '3.25rem');
});

test('native social auth shares PKCE storage, opens external browser and exchanges callback', async () => {
  const source = await readFile(new URL('../src/native.js', import.meta.url), 'utf8');
  const object = source.slice(source.indexOf('const nativeAuth = {'), source.indexOf('// Voice capture'));
  let options, browserUrl, closed = false, exchanged;
  const context = {
    webClient: { auth: {
      signInWithOAuth: async value => { options = value; return { data: { url: 'https://auth.example/authorize' } }; },
      exchangeCodeForSession: async code => { exchanged = code; return { data: { session: { user: { id: 'real-user' } } } }; }
    } },
    Browser: { open: async ({ url }) => { browserUrl = url; }, close: async () => { closed = true; } }
  };
  vm.createContext(context);
  vm.runInContext(`${object}\nglobalThis.auth = nativeAuth;`, context);
  await context.auth.signInWithOAuth({ provider: 'google' });
  assert.equal(options.options.redirectTo, 'yere://auth/callback');
  assert.equal(options.options.skipBrowserRedirect, true);
  assert.equal(browserUrl, 'https://auth.example/authorize');
  const result = await context.auth.completeOAuth('one-time-code');
  assert.equal(exchanged, 'one-time-code');
  assert.equal(closed, true);
  assert.equal(result.data.session.user.id, 'real-user');
  await assert.rejects(context.auth.signInWithOAuth({ provider: 'unknown' }), /Unsupported/);
  await assert.rejects(context.auth.signInWithOAuth({ provider: 'facebook' }), /Unsupported/);
});

test('OAuth callbacks do not open password recovery unless explicitly requested', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-social-provider="google"/);
  assert.doesNotMatch(html, /data-social-provider="facebook"/);
  assert.match(html, /!isReset&&!isRecovery\?`<div/);
  assert.match(html, /params\.get\('reset'\)==='1'\|\|params\.get\('type'\)==='recovery'/);
  assert.doesNotMatch(html, /params\.get\('reset'\)==='1'\|\|route==='auth'/);
});

test('Facebook is disabled before any web or native auth request', async () => {
  let called = false;
  const signInWithOAuth = async () => { called = true; };
  for (const native of [undefined, { enabled: true, auth: { signInWithOAuth } }]) {
    await assert.rejects(startSocialSignIn({ provider: 'facebook', client: { auth: { signInWithOAuth } }, native }), /Unsupported/);
  }
  assert.equal(called, false);
});

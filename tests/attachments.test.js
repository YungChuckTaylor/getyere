import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { isPreviewableImage, createAttachmentController } from '../src/attachments.js';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function harness(signer = async () => 'https://storage.example.test/private-image?token=temporary') {
  let owner = 'account-one';
  const elements = new Map(), files = new Map([['photo', { id: 'photo', name: 'photo.png', path: 'owner/photo', contentType: 'image/png' }]]);
  const document = { body: { style: { overflow: 'hidden' } }, activeElement: null, listeners: {},
    getElementById: id => elements.get(id), addEventListener(name, callback, capture) { this.listeners[name] = { callback, capture }; } };
  const element = id => {
    const classes = new Set(['hidden']);
    const el = { id, hidden: false, inert: false, isConnected: true, textContent: '', alt: '', attributes: {}, listeners: {},
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
      removeAttribute(name) { delete this.attributes[name]; if (name === 'src') delete this.src; },
      focus() { document.activeElement = this; }, addEventListener(name, callback) { this.listeners[name] = callback; } };
    elements.set(id, el); return el;
  };
  for (const id of ['imagePreview', 'imagePreviewImage', 'imagePreviewTitle', 'imagePreviewStatus', 'imagePreviewClose', 'imagePreviewRetry', 'modal']) element(id);
  const source = element('source'); source.focus();
  const calls = { signed: [], messages: [] };
  const controller = createAttachmentController({ document, getSessionKey: () => owner, getFile: id => files.get(id),
    signUrl: async file => { calls.signed.push(file); return signer(file); }, toast: message => calls.messages.push(message) });
  const thumbnail = () => {
    const button = element('thumb'), img = element('thumb-image'), label = element('thumb-status');
    button.dataset = { imageAttachment: 'photo' };
    button.querySelector = selector => selector === 'img' ? img : label;
    const root = { querySelectorAll: () => [button], contains: el => el === button && button.isConnected };
    return { button, img, label, root };
  };
  return { controller, document, calls, files, source, thumbnail, el: id => elements.get(id), setOwner: value => { owner = value; } };
}

test('only supported raster images are previewed; documents and SVG stay files', () => {
  for (const contentType of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'IMAGE/PNG']) assert.ok(isPreviewableImage({ contentType }));
  for (const contentType of ['application/pdf', 'image/svg+xml', 'text/html', 'application/msword']) assert.equal(isPreviewableImage({ contentType, name: 'fake.png' }), false);
  assert.ok(isPreviewableImage({ name: 'old-photo.JPG' }));
  assert.equal(isPreviewableImage({ name: 'photo.png.exe' }), false);
});

test('thumbnail uses a signed URL, then expands in-app without replacing the editor', async () => {
  const h = harness(), tile = h.thumbnail();
  await h.controller.hydrate(tile.root);
  assert.match(tile.img.src, /^https:/); tile.img.onload();
  assert.equal(tile.img.hidden, false); assert.equal(tile.label.textContent, 'Tap to expand');
  await tile.button.onclick();
  assert.equal(h.el('imagePreview').classList.contains('hidden'), false);
  assert.equal(h.el('modal').inert, true);
  h.el('imagePreviewImage').onload(); assert.equal(h.el('imagePreviewImage').hidden, false);
  assert.equal(h.el('imagePreviewTitle').textContent, 'photo.png');
  assert.equal(h.calls.signed.length, 2); // expansion obtains a fresh URL, not an expired thumbnail URL
  assert.equal(h.controller.close(), true);
  assert.equal(h.el('modal').inert, false); assert.equal(h.document.body.style.overflow, 'hidden');
  assert.equal(h.document.activeElement, tile.button); assert.equal(h.el('imagePreviewImage').src, undefined);
  assert.equal(h.controller.close(), false);
});

test('Escape is captured, closes only the image, and restores focus', async () => {
  const h = harness(); await h.controller.open('photo', h.source);
  const actions = [];
  h.document.listeners.keydown.callback({ key: 'Escape', preventDefault: () => actions.push('prevent'), stopImmediatePropagation: () => actions.push('stop') });
  assert.equal(h.document.listeners.keydown.capture, true);
  assert.deepEqual(actions, ['prevent', 'stop']); assert.equal(h.document.activeElement, h.source);
  assert.equal(h.el('imagePreview').classList.contains('hidden'), true);
});

test('Tab stays in the expanded viewer; its backdrop closes it', async () => {
  const h = harness(); await h.controller.open('photo', h.source);
  h.document.listeners.keydown.callback({ key: 'Tab', preventDefault() {} });
  assert.equal(h.document.activeElement, h.el('imagePreviewClose'));
  h.el('imagePreview').listeners.click({ target: { closest: () => true } });
  assert.equal(h.document.activeElement, h.source);
});

test('failed images expose a retry action and retry obtains another fresh URL', async () => {
  const h = harness(); await h.controller.open('photo', h.source);
  h.el('imagePreviewImage').onerror();
  assert.equal(h.el('imagePreviewRetry').hidden, false);
  assert.equal(h.el('imagePreviewImage').src, undefined);
  await h.controller.open('photo', h.source);
  assert.equal(h.calls.signed.length, 2); assert.equal(h.el('imagePreviewRetry').hidden, true);
});

test('a closed viewer cannot be resurrected by a late signed-URL response', async () => {
  let finish; const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const opening = h.controller.open('photo', h.source);
  h.controller.close(); finish('https://storage.example.test/late'); await opening;
  assert.equal(h.el('imagePreviewImage').src, undefined);
  assert.equal(h.el('imagePreview').classList.contains('hidden'), true);
});

test('switching accounts removes images and discards pending private URL responses', async () => {
  let finish; const h = harness(() => new Promise(resolve => { finish = resolve; })), tile = h.thumbnail();
  const loading = h.controller.hydrate(tile.root);
  h.setOwner('account-two'); h.controller.syncSession();
  finish('https://storage.example.test/account-one'); await loading;
  assert.equal(tile.img.src, undefined); assert.equal(tile.label.textContent, 'Reopen to view');
});

test('signing out clears an open image and its thumbnail URLs', async () => {
  const h = harness(), tile = h.thumbnail(); await h.controller.hydrate(tile.root);
  await h.controller.open('photo', h.source);
  h.setOwner(''); h.controller.syncSession();
  assert.equal(h.el('imagePreviewImage').src, undefined); assert.equal(tile.img.src, undefined);
  assert.equal(h.el('imagePreview').classList.contains('hidden'), true);
});

test('signed-out views and missing files cannot request private image URLs', async () => {
  const h = harness(); h.setOwner('');
  await h.controller.hydrate(h.thumbnail().root); await h.controller.open('photo');
  await h.controller.open('missing');
  assert.equal(h.calls.signed.length, 0); assert.match(h.calls.messages[0], /Sign in/);
});

test('a modal that was replaced while loading is never updated by a stale thumbnail response', async () => {
  let finish; const h = harness(() => new Promise(resolve => { finish = resolve; })), tile = h.thumbnail();
  const loading = h.controller.hydrate(tile.root); tile.button.isConnected = false;
  finish('https://storage.example.test/late'); await loading;
  assert.equal(tile.img.src, undefined);
});

test('invalid URLs and signing errors do not render private image sources', async () => {
  for (const signer of [async () => 'javascript:alert(1)', async () => { throw new Error('private provider error'); }]) {
    const h = harness(signer), tile = h.thumbnail();
    await h.controller.hydrate(tile.root); assert.match(tile.label.textContent, /Preview unavailable/);
    await h.controller.open('photo'); assert.equal(h.el('imagePreviewRetry').hidden, false);
    assert.equal(h.el('imagePreviewImage').src, undefined);
    assert.doesNotMatch(h.el('imagePreviewStatus').textContent, /private provider error/);
  }
});

test('image markup has accessible thumbnails rather than visible filenames; documents keep filenames', () => {
  const context = { window: { YERE_ATTACHMENTS: { isPreviewableImage } }, esc: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function renderAttachmentFiles('), html.indexOf('function openDetail(')), context);
  const photo = context.renderAttachmentFiles([{ id: 'photo', name: '<private>.png', contentType: 'image/png' }]);
  assert.match(photo, /data-image-attachment="photo"/); assert.match(photo, /aria-label="Expand image: &lt;private&gt;.png"/);
  assert.doesNotMatch(photo, />&lt;private&gt;.png<|<private>/);
  const document = context.renderAttachmentFiles([{ id: 'doc', name: 'form.pdf', contentType: 'application/pdf' }]);
  assert.match(document, /📎 form.pdf<\/button>/); assert.doesNotMatch(document, /<img/);
});

test('detail and edit views hydrate the same private thumbnails; native Back and account changes clean up', () => {
  assert.equal((html.match(/reminderAttachmentController\(\)\.hydrate\(document.getElementById\('modalCard'\)\)/g) || []).length, 2);
  assert.match(html, /createSignedUrl\(file.path,120\)/);
  assert.match(html, /function handleNativeBack\(\)\{\s*if\(attachmentController\?\.close\(\)\)return/);
  assert.match(html, /function setAccountLabel\(\) \{\s*attachmentController\?\.syncSession\(\)/);
  assert.match(html, /function closeModal\(\)\{ attachmentController\?\.close\(false\)/);
});

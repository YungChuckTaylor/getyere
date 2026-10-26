import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const read = file => readFile(new URL(`../${file}`, import.meta.url));
const text = async file => (await read(file)).toString();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const png = async file => {
  const bytes = await read(file);
  assert.equal(bytes.subarray(1,4).toString(), 'PNG', file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), type: bytes[25] };
};

test('all generated brand images match the uploaded source inventory', async () => {
  const inventory = JSON.parse(await text('assets/branding/generated-assets.json'));
  const source = await read(inventory.source);
  assert.equal(sha(source), inventory.sourceSha256);
  assert.deepEqual(await read('public/yere-logo-v2.png'), source);
  assert.ok(Object.keys(inventory.outputs).length >= 53);
  for (const [path, hash] of Object.entries(inventory.outputs)) assert.equal(sha(await read(path)), hash, path);
  assert.match(await text('public/yere-mark.svg'), new RegExp(source.toString('base64').replace(/[+]/g, '\\+')));
});

test('web manifest, favicon and Apple touch assets have the declared dimensions', async () => {
  const manifest = JSON.parse(await text('public/manifest.webmanifest'));
  for (const icon of manifest.icons) {
    assert.match(icon.src, /-v2\.png$/);
    const size = await png(`public${icon.src}`);
    assert.equal(`${size.width}x${size.height}`, icon.sizes);
    assert.equal(size.type, 2, 'launcher images are opaque RGB');
  }
  assert.equal((await png('public/icons/apple-touch-icon-v2.png')).width, 180);
  assert.equal((await png('public/icons/favicon-v2-32.png')).width, 32);
  const html = await text('index.html');
  assert.match(html, /sizes="180x180" href="\/icons\/apple-touch-icon-v2\.png"/);
  assert.match(html, /href="\/icons\/favicon-v2-32\.png"/);
});

test('web, admin, legal, support and email surfaces use new cache-safe branding', async () => {
  for (const file of ['index.html', 'src/admin.js', 'public/privacy.html', 'public/terms.html', 'public/support.html']) {
    const source = await text(file);
    assert.match(source, /yere-logo-v2\.png/, file);
    assert.doesNotMatch(source, /yere-mark\.svg|icon-192\.png/, file);
  }
  for (const file of ['confirm-signup', 'invite-user', 'reset-password']) {
    assert.match(await text(`supabase/email-templates/${file}.html`), /getyere\.com\/icons\/icon-192-v2\.png/);
  }
});

test('Android includes updated legacy, adaptive, monochrome and status icons at every density', async () => {
  for (const [density, size, foreground, status] of [['mdpi',48,108,24], ['hdpi',72,162,36], ['xhdpi',96,216,48], ['xxhdpi',144,324,72], ['xxxhdpi',192,432,96]]) {
    const res = 'android/app/src/main/res';
    for (const name of ['ic_launcher', 'ic_launcher_round']) assert.equal((await png(`${res}/mipmap-${density}/${name}.png`)).width, size);
    for (const name of ['ic_launcher_foreground', 'ic_launcher_monochrome']) {
      const icon = await png(`${res}/mipmap-${density}/${name}.png`);
      assert.equal(icon.width, foreground); assert.equal(icon.type, 6);
    }
    const notification = await png(`${res}/drawable-${density}/ic_stat_yere.png`);
    assert.equal(notification.width, status); assert.equal(notification.type, 6);
  }
  assert.match(await text('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), /@mipmap\/ic_launcher_monochrome/);
  assert.match(await text('android/app/src/main/res/values/ic_launcher_background.xml'), /#FFFFFF/);
});

test('iOS launcher is 1024px without transparency and splash assets are valid', async () => {
  const icon = await png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  assert.deepEqual(icon, { width: 1024, height: 1024, type: 2 });
  const splash = JSON.parse(await text('ios/App/App/Assets.xcassets/Splash.imageset/Contents.json'));
  for (const image of splash.images) assert.equal((await png(`ios/App/App/Assets.xcassets/Splash.imageset/${image.filename}`)).width, 2732);
});

test('service worker rotates the old brand cache and uses a monochrome notification badge', async () => {
  const source = await text('public/sw.js');
  assert.match(source, /CACHE_PREFIX}v4-language-scope/);
  assert.match(source, /badge: '\/icons\/badge-v2-96\.png'/);
  assert.match(source, /new URL\('yere-logo-v2\.png'/);
  assert.doesNotMatch(source, /yere-mark\.svg|icon-192\.png/);
});

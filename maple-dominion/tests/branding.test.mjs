import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
test('header and footer use the same supplied full logo, not a recreated wordmark', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const header = html.match(/<header[\s\S]*?<\/header>/)[0];
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
  for (const region of [header, footer]) {
    assert.match(region, /src="assets\/maple-dominion-logo\.png"/);
    assert.match(region, /alt="Maple Dominion Consulting Inc\."/);
    assert.doesNotMatch(region, /src="assets\/maple-mark\.png"/);
  }
  assert.doesNotMatch(header, /<small>CONSULTING INC\.<\/small>/);
});


test('published full logo is the exact supplied black-lettering PNG, without alteration', async () => {
  const image = await readFile(new URL('../assets/maple-dominion-logo.png', import.meta.url));
  assert.equal(createHash('sha256').update(image).digest('hex'), 'da8f34554aa87f4b947d55dea31e4191ed083e64fdc1e2d2a44a4b241e41133b');
  assert.equal(image.readUInt32BE(16), 505);
  assert.equal(image.readUInt32BE(20), 390);
});

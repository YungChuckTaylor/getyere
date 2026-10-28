import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

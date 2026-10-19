import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('attachment picker has a prominent native button while preserving file types, filename display and selection handler', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  const input = html.match(/<input id="dAttachment"[^>]+>/)?.[0];
  assert.ok(input);
  assert.match(input, /type="file"/);
  assert.match(input, /accept="image\/\*,\.pdf,\.doc,\.docx"/);
  assert.match(input, /class="attachment-file-input /);
  assert.match(input, /onchange="setDraftAttachment\(this.files\[0\]\)"/);
  assert.doesNotMatch(input, /\bhidden\b|display:\s*none/);
  assert.match(css, /\.attachment-file-input::file-selector-button\s*\{[^}]*min-height:44px;[^}]*background:#4f46e5;[^}]*color:#fff;/);
  assert.match(css, /\.attachment-file-input:focus-visible\s*\{[^}]*outline:3px solid/);
});

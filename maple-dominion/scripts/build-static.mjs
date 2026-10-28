// Independent Maple-only output. Never read/copy the parent Yere application.
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const output = new URL('site/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.mjs', 'data.mjs', 'engine.mjs']) {
  await copyFile(new URL(file, root), new URL(file, output));
}
await cp(new URL('assets/', root), new URL('assets/', output), { recursive: true });
console.log('Built standalone Maple Dominion static site; no Yere files or secrets included.');

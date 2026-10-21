// Portable owner handoff: one HTML file that can be opened without hosting.
// Generated output is ignored by Git; the public/ sources remain authoritative.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root));
let html = (await read('public/ios-release-guide.html')).toString();
html = html.replace('<link rel="stylesheet" href="/ios-guide.css">',
  `<style>${(await read('public/ios-guide.css')).toString()}</style>`);
html = html.replace('<script type="module" src="/ios-guide.js"></script>',
  `<script type="module">${(await read('public/ios-guide.js')).toString().replace(/<\/script/gi, '<\\/script')}</script>`);
for (const [file, mime] of [['yere-logo-v2.png', 'image/png'], ['icons/favicon-v2-32.png', 'image/png']]) {
  html = html.replaceAll(`/${file}`, `data:${mime};base64,${(await read(`public/${file}`)).toString('base64')}`);
}
html = html.replace('href="/" aria-label="Yere home"', 'href="https://getyere.com" aria-label="Yere home"');
await mkdir(new URL('artifacts/', root), { recursive: true });
await writeFile(new URL('artifacts/Yere-iOS-Launch-Guide.html', root), html);
console.log('Exported artifacts/Yere-iOS-Launch-Guide.html (self-contained; no credentials).');

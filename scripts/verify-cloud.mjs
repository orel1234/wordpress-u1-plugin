// Cloud delivery, the extension's half.
//
//   node scripts/verify-cloud.mjs
//
// Cloud publishes the same files a handover carries, so what a worker sees
// while working has to be what the live site will run. Two places decide
// "does this mapping apply on this page": the panel (pageScopedElsewhere, and
// the __u1Here guard it writes into u1-fixes.js) and background.js's
// auto-apply (forThisPage). The second ignored page scope entirely, so a
// mapping set to one page ran on every page while working and on one page
// once published. This pins the two to the same answer.
//
// It also checks the Publish view is wired: every element panel.js reaches
// for by id exists in panel.html, and sync.js exposes the three calls.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const panelSrc = read('panel.js');
const bgSrc = read('background.js');
const html = read('panel.html');
const syncSrc = read('sync.js');

// Same brace-matching lift as the other verify-*.mjs: the real functions, not copies.
function lift(src, name) {
  const a = src.indexOf(`function ${name}(`);
  if (a < 0) throw new Error(`could not find function ${name}`);
  let i = src.indexOf('{', a), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(a, i + 1);
}

const ctx = { URL, decodeURIComponent };
vm.createContext(ctx);
vm.runInContext(
  ['pagePathOf', 'isPageScoped', 'pageScopedElsewhere'].map((n) => lift(panelSrc, n)).join('\n') + '\n' +
  ['pagePathOfUrl', 'forThisPage'].map((n) => lift(bgSrc, n)).join('\n'),
  ctx,
);

let passed = 0, failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
};

console.log('\nAuto-apply honours page scope the way the export does:');
const list = [
  { type: 'menu', primary: '.nav' },                                             // site-wide
  { type: 'tabs', primary: '.t', scope: 'page', pagePath: '/products' },
  { type: 'dialog', primary: '.d', scope: 'page', pagePath: '/צור-קשר' },          // non-ASCII path
  { type: 'listbox', primary: '.l', scope: 'site', pagePath: '/products' },     // site wins over a stale path
];
const urls = [
  'https://example.com/',
  'https://example.com/products',
  'https://example.com/products/',
  'https://example.com/products?page=2#x',
  'https://example.com/products/shoes',
  'https://example.com/%D7%A6%D7%95%D7%A8-%D7%A7%D7%A9%D7%A8',
];
for (const url of urls) {
  const bg = ctx.forThisPage(list, url).map((m) => m.primary).join(',');
  const panel = list.filter((m) => !ctx.pageScopedElsewhere(m, url)).map((m) => m.primary).join(',');
  check(`same mappings on ${url}`, bg === panel, `background=[${bg}] panel=[${panel}]`);
}
check('a page-scoped mapping does not run on another page',
  !ctx.forThisPage(list, 'https://example.com/').some((m) => m.primary === '.t'));
check('…and runs on its own page, trailing slash or query aside',
  ctx.forThisPage(list, 'https://example.com/products/?q=1').some((m) => m.primary === '.t'));
check('a missing list is an empty list', Array.isArray(ctx.forThisPage(undefined, 'https://example.com/')));

console.log('\nThe Publish view is wired:');
for (const id of ['exportTileCloud', 'exportTileCloudSub', 'exportTileFinish', 'exportViewCloud', 'cloudDomains', 'cloudPublishBox', 'cloudNote', 'cloudPublishBtn', 'cloudStatus']) {
  check(`#${id} exists in panel.html`, html.includes(`id="${id}"`));
}
check('the Cloud tile opens the Cloud view', /data-exportview="cloud"/.test(html) && /cloud:\s*'exportViewCloud'/.test(panelSrc));
check('sync.js exposes delivery, publish and setLive', /return \{[^}]*\bdelivery\b[^}]*\bpublish\b[^}]*\bsetLive\b[^}]*\}/.test(syncSrc));
check('Cloud always publishes the window.u1.config form (a script tag cannot run an ES module)',
  /buildConfigFileContent\(config, skipLinks, 'wordpress'\)/.test(lift(panelSrc, 'refreshDelivery') + panelSrc.slice(panelSrc.indexOf("getElementById('cloudPublishBtn')"))));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

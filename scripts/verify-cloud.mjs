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
  /buildConfigFileContent\(config, skipLinks, 'wordpress'\)/.test(lift(panelSrc, 'cloudFiles')));
const pubHandler = panelSrc.slice(panelSrc.indexOf("getElementById('cloudPublishBtn')?.addEventListener"));
const pvHandler = panelSrc.slice(panelSrc.indexOf("getElementById('cloudPreviewBtn')?.addEventListener"), panelSrc.indexOf("getElementById('cloudPreviewStopBtn')?.addEventListener"));
check('Publish and Preview build the same files (one builder, so a preview is what goes live)',
  /await cloudFiles\(\)/.test(pubHandler) && /await cloudFiles\(\)/.test(pvHandler));

console.log('\nPreview runs the candidate bundle instead of auto-apply, in that tab only:');
for (const id of ['cloudPreviewRow', 'cloudPreviewBtn', 'cloudPreviewStopBtn', 'cloudPreviewNote']) {
  check(`#${id} exists in panel.html`, html.includes(`id="${id}"`));
}
check('sync.js exposes preview', /return \{[^}]*\bpreview\b[^}]*\}/.test(syncSrc));
for (const action of ['startPreview', 'stopPreview', 'previewState']) {
  check(`background answers ${action}`, bgSrc.includes(`msg.action === '${action}'`));
}
// The injecting listener (there is an earlier, unrelated onUpdated near the top).
const listener = bgSrc.slice(bgSrc.indexOf('chrome.tabs.onUpdated.addListener(async (tabId, info, tab)'));
const divert = listener.indexOf('const pv = await previewFor(tabId)');
check('a preview tab is diverted before any of our own injection',
  divert > 0 && divert < listener.indexOf('injectPatch(tabId)') && divert < listener.indexOf('injectMappings(tabId'));
check('preview state is per tab, in session storage (survives a worker restart, not a browser restart)',
  /chrome\.storage\.session/.test(lift(bgSrc, 'previewFor')) && /'__preview_' \+ tabId/.test(bgSrc));
check('leaving the previewed domain ends the preview', /getHostnameFromTab\(tab\) !== pv\.hostname/.test(listener));
check('a closed tab forgets its preview', /chrome\.tabs\.onRemoved\.addListener\(\(tabId\) => \{ setPreview\(tabId, null\)/.test(bgSrc));
const inj = lift(bgSrc, 'injectPreview');
check('the preview loads after the U1 library, like the live tag', /window\.u1 && window\.u1\.fix/.test(inj) && /s\.async = false/.test(inj));
check('the page says it is a preview', /U1 preview: not live/.test(inj));

// ── Run the real background.js against a fake chrome, and watch what it injects ──
console.log('\nThe real background.js, on a normal tab and on a preview tab:');
async function bootBackground() {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { (listeners[name] = listeners[name] || []).push(fn); } });
  const local = {
    'mappings_shop.example': [{ type: 'menu', primary: '.nav' }],
    'manualInject_shop.example': { cssLink: 'https://cdn.example/u1.css', jsLink: 'https://cdn.example/u1.js' },
  };
  const session = {};
  const injected = [];
  const pick = (store, keys) => {
    if (keys == null) return { ...store };
    const ks = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
    const out = {}; for (const k of ks) if (k in store) out[k] = store[k]; return out;
  };
  const area = (store) => ({
    get: async (k) => pick(store, k),
    set: async (o) => { Object.assign(store, o); },
    remove: async (k) => { for (const x of [].concat(k)) delete store[x]; },
    getBytesInUse: async () => 0,
  });
  // Anything background.js touches that this test does not care about: event
  // objects for on*, harmless async no-ops for the rest.
  const lenient = (o) => new Proxy(o, {
    get: (t, k) => (k in t ? t[k] : typeof k === 'string' && k.startsWith('on') ? on(k) : async () => {}),
  });
  const chrome0 = {
    runtime: { id: 'self', onMessage: on('message'), getURL: (p) => p, getManifest: () => ({}) },
    action: { onClicked: on('action') },
    sidePanel: { open() {}, setPanelBehavior: async () => {} },
    tabs: { onRemoved: on('removed'), onUpdated: on('updated'), onActivated: on('activated'), reload: async () => {}, get: async () => ({}) },
    debugger: { detach: async () => {}, onDetach: on('dbgDetach'), onEvent: on('dbgEvent') },
    storage: { local: area(local), session: area(session), onChanged: on('changed') },
    scripting: {
      executeScript: async (o) => { injected.push(o.files ? 'file:' + o.files.join(',') : (o.args && typeof o.args[0] === 'string' && o.args[0].includes('/api/u1/preview/')) ? 'preview' : (o.func && /u1Js|u1Css/.test(o.func.toString())) ? 'engine' : 'func'); return [{}]; },
    },
    declarativeNetRequest: { updateDynamicRules: async () => {}, getDynamicRules: async () => [], updateSessionRules: async () => {} },
  };
  const chrome = new Proxy(chrome0, { get: (t, k) => (k in t ? (typeof t[k] === 'object' ? lenient(t[k]) : t[k]) : lenient({})) });
  const ctx = { chrome, console: { log() {}, warn() {}, error() {} }, URL, setTimeout, clearTimeout, Promise, Map, Set, JSON, Date, Math, Object, Array, String, Number, Boolean, Error, decodeURIComponent };
  ctx.self = ctx; ctx.window = ctx; ctx.globalThis = ctx;
  ctx.importScripts = (...files) => { for (const f of files) vm.runInContext(read(f), ctx, { filename: f }); };
  vm.createContext(ctx);
  vm.runInContext(bgSrc, ctx, { filename: 'background.js' });
  const fire = async (tabId, status, url) => {
    for (const fn of listeners.updated || []) await fn(tabId, { status }, { id: tabId, url });
  };
  const send = (msg) => new Promise((res) => {
    let answered = false;
    for (const fn of listeners.message || []) {
      const r = fn(msg, { id: 'self' }, (x) => { answered = true; res(x); });
      if (r !== true && !answered) continue;
    }
  });
  return { fire, send, injected, session };
}

{
  const bg = await bootBackground();
  await bg.fire(1, 'loading', 'https://shop.example/');
  await bg.fire(1, 'complete', 'https://shop.example/');
  check('a normal tab gets the patch and the mappings from the extension',
    bg.injected.includes('file:u1-patch.js') && bg.injected.filter((x) => x === 'func').length >= 1, bg.injected.join(' '));
  check('…and never a preview', !bg.injected.includes('preview'));

  bg.injected.length = 0;
  await bg.send({ action: 'startPreview', tabId: 2, url: 'https://crm.example/api/u1/preview/' + 'a'.repeat(32) + '.js', hostname: 'shop.example' });
  await bg.fire(2, 'loading', 'https://shop.example/');
  await bg.fire(2, 'complete', 'https://shop.example/');
  check('a preview tab gets none of the extension\'s own fixes', !bg.injected.includes('file:u1-patch.js') && !bg.injected.includes('func'), bg.injected.join(' '));
  check('…still gets the U1 library the site is configured to load', bg.injected.includes('engine'), bg.injected.join(' '));
  check('…and then the preview bundle', bg.injected.indexOf('preview') > bg.injected.indexOf('engine'), bg.injected.join(' '));

  bg.injected.length = 0;
  await bg.fire(1, 'loading', 'https://shop.example/');
  check('another tab on the same site is unaffected', bg.injected.includes('file:u1-patch.js'), bg.injected.join(' '));

  bg.injected.length = 0;
  await bg.fire(2, 'loading', 'https://elsewhere.example/');
  check('the preview tab leaving the domain ends its preview', !('__preview_2' in bg.session));

  await bg.send({ action: 'startPreview', tabId: 3, url: 'https://crm.example/api/u1/preview/x.js', hostname: 'shop.example' });
  await bg.send({ action: 'stopPreview', tabId: 3 });
  bg.injected.length = 0;
  await bg.fire(3, 'loading', 'https://shop.example/');
  check('Stop preview returns the tab to the extension\'s own fixes', bg.injected.includes('file:u1-patch.js') && !('__preview_3' in bg.session), bg.injected.join(' '));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

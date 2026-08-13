// Runtime checks for store.js against a fake chrome.storage.local.
//
// The store is now the only path to a worker's saved mappings, so a mistake here
// loses client work. The rules it must keep: stored key names never change (a
// backup taken before the refactor has to import after it), and a private key
// never leaves the machine.
//
//   node scripts/verify-store.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const pass = (m) => console.log(`  ✅ ${m}`);
const fail = (m) => { failures++; console.error(`  ❌ ${m}`); };
const check = (name, cond, detail = '') => cond ? pass(name) : fail(`${name}${detail ? ` — ${detail}` : ''}`);

// --- Fake storage ---------------------------------------------------------

function makeChrome(initial = {}) {
  let data = { ...initial };
  return {
    storage: {
      local: {
        async get(keys) {
          if (keys === null || keys === undefined) return { ...data };
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) if (k in data) out[k] = data[k];
          return out;
        },
        async set(items) { Object.assign(data, items); },
        async remove(keys) {
          for (const k of (Array.isArray(keys) ? keys : [keys])) delete data[k];
        },
      },
    },
    _dump: () => data,
  };
}

function loadStore(initial) {
  const chrome = makeChrome(initial);
  const sandbox = { chrome, self: {}, console };
  vm.createContext(sandbox);
  new vm.Script(readFileSync(join(ROOT, 'store.js'), 'utf8')).runInContext(sandbox);
  return { store: sandbox.self.U1Store, chrome };
}

// Realistic contents: two sites of real work plus a signed-in session.
const SAMPLE = {
  'mappings_example.com': [{ id: 'm-a1', type: 'button', primary: '.btn' }],
  'config_example.com': { focusColor: '#000' },
  'skipLinks_example.com': [{ text: 'Skip', target: '#main' }],
  'autoApply_example.com': true,
  'platform_example.com': 'wordpress',
  'manualInject_example.com': { jsLink: 'https://x/u1.js', cssLink: 'https://x/u1.css' },
  'mappings_shop.co.il': [{ id: 'm-b2', type: 'menu', primary: 'nav' }],
  cssLink: 'https://x/u1.css',
  jsLink: 'https://x/u1.js',
  __studioAuth: { refreshToken: 'SECRET-MUST-NOT-LEAVE', client: { email: 'a@b.com' } },
  __studioSiteCache: { 'example.com': { allowed: true } },
  __closeOutReportHtml: '<html>…</html>',
};

console.log('\nThe store passes storage through unchanged:');
{
  const { store, chrome } = loadStore(SAMPLE);
  const got = await store.get('mappings_example.com');
  check('get returns the same shape as chrome.storage.local',
    JSON.stringify(got) === JSON.stringify({ 'mappings_example.com': SAMPLE['mappings_example.com'] }),
    JSON.stringify(got));

  await store.set({ 'mappings_new.com': [{ id: 'm-c3', type: 'link' }] });
  check('set writes under the exact key given', 'mappings_new.com' in chrome._dump());

  await store.remove('mappings_new.com');
  check('remove deletes that key only', !('mappings_new.com' in chrome._dump()) && 'mappings_example.com' in chrome._dump());

  const multi = await store.get(['mappings_example.com', 'config_example.com']);
  check('get accepts an array', Object.keys(multi).length === 2);

  const all = await store.get(null);
  check('get(null) returns everything', Object.keys(all).length === Object.keys(SAMPLE).length);
}

console.log('\nBackups carry work, never credentials:');
{
  const { store } = loadStore(SAMPLE);
  const exported = await store.getExportable();
  const json = JSON.stringify(exported);

  check('the refresh token is gone', !json.includes('SECRET-MUST-NOT-LEAVE'));
  check('no private key survives', !Object.keys(exported).some((k) => k.startsWith('__')),
    Object.keys(exported).filter((k) => k.startsWith('__')).join(', '));

  // Every non-private key must survive verbatim — this is the invariant that
  // lets a backup taken before this refactor import after it.
  const expected = Object.keys(SAMPLE).filter((k) => !k.startsWith('__')).sort();
  check('every other key survives, byte for byte',
    JSON.stringify(Object.keys(exported).sort()) === JSON.stringify(expected),
    JSON.stringify(Object.keys(exported).sort()));

  check('mapping contents are untouched',
    JSON.stringify(exported['mappings_example.com']) === JSON.stringify(SAMPLE['mappings_example.com']));

  check('exporting does not mutate storage',
    JSON.stringify(Object.keys((await store.get(null))).sort()) === JSON.stringify(Object.keys(SAMPLE).sort()));
}

console.log('\nKey parsing matches the names already on disk:');
{
  const { store } = loadStore({});
  const cases = [
    ['mappings_example.com', 'mappings', 'example.com'],
    ['config_sub.example.co.il', 'config', 'sub.example.co.il'],
    ['skipLinks_a.com', 'skipLinks', 'a.com'],
    ['autoApply_a.com', 'autoApply', 'a.com'],
    ['platform_a.com', 'platform', 'a.com'],
    ['manualInject_a.com', 'manualInject', 'a.com'],
  ];
  for (const [key, prefix, host] of cases) {
    const p = store.parseKey(key);
    check(`${key} → ${prefix} / ${host}`, p && p.prefix === prefix && p.hostname === host, JSON.stringify(p));
  }
  for (const key of ['cssLink', 'jsLink', '__studioAuth', 'mappings_', 'nonsense_a.com', '_a.com', '']) {
    check(`${JSON.stringify(key)} is not a per-site key`, store.parseKey(key) === null);
  }

  check('private keys are recognised', store.isPrivate('__studioAuth') && !store.isPrivate('mappings_a.com'));
}

console.log('\nSite listing:');
{
  const { store } = loadStore(SAMPLE);
  const sites = await store.listSites();
  check('lists each site once, sorted',
    JSON.stringify(sites) === JSON.stringify(['example.com', 'shop.co.il']), JSON.stringify(sites));
}

// ── The mapping push has to fit inside the server's body limit ─────────────
//
// Measured, not assumed: PUT /api/studio/sites/*/mappings takes 99KB and
// answers 100KB with `{"message":"request entity too large"}` — Express's
// default `json` limit of 100kb. The batch budget was 400KB, so every push of
// a site with more than a handful of mappings was rejected outright, and the
// panel reported it as "Saved on this computer, but not shared with the team".
//
// The whole list goes on every save (a row that stops being mentioned is how a
// deletion is expressed), so this only gets worse as pages are added.
console.log('\n  Mapping push batches:');
{
  const SERVER_LIMIT = 100 * 1024;
  const src = readFileSync(join(ROOT, 'sync.js'), 'utf8');
  const budget = Number(/const PUSH_BYTES = (\d+) \* 1024;/.exec(src)[1]) * 1024;
  check('the batch budget is inside the server limit', budget < SERVER_LIMIT,
        `${budget / 1024}KB budget vs ${SERVER_LIMIT / 1024}KB limit`);
  check('…and leaves room for the JSON envelope', budget <= SERVER_LIMIT * 0.7,
        `${budget / 1024}KB`);
  check('…and is measured in BYTES, not characters',
        /new TextEncoder\(\)\.encode\(JSON\.stringify\(m\)\)\.length/.test(src));
  check('a mapping too big for any request is named, not silently dropped',
        /oversized\.push\(m\.key\)/.test(src) && /too large for the/.test(src));

  // The real shape, at the sizes a multi-page site reaches.
  const one = (i) => ({
    key: `m-${i}`, deleted: false, baseUpdatedAt: '2026-08-13T00:00:00.000Z',
    payload: { type: 'tabs', primary: '#dealTabs',
               config: { selectors: { tab: '#dealTabs>.tab-bar__btn', tabList: '#dealTabs' } },
               code: 'window.u1?.fix.tabs(…)'.padEnd(1200, ' ') } });
  let worstAll = 0;
  for (const n of [24, 100, 600]) {
    let cur = [], size = 0; const batches = [];
    for (let i = 0; i < n; i++) {
      const m = one(i);
      const b = new TextEncoder().encode(JSON.stringify(m)).length + 1;
      if (cur.length && size + b > budget) { batches.push(cur); cur = []; size = 0; }
      cur.push(m); size += b;
    }
    if (cur.length) batches.push(cur);
    const worst = Math.max(...batches.map((b) =>
      new TextEncoder().encode(JSON.stringify({ mappings: b })).length));
    worstAll = Math.max(worstAll, worst);
  }
  check('…so no request is over the limit at 24, 100 or 600 mappings',
        worstAll < SERVER_LIMIT, `largest ${(worstAll / 1024).toFixed(1)}KB`);
}

console.log(failures === 0 ? '\n✅ The store keeps every stored key intact.\n' : `\n❌ ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

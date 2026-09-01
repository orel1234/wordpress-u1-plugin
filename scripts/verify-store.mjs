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

console.log('\nA one-project backup carries that project and nothing else:');
{
  const { store } = loadStore(SAMPLE);
  const one = await store.getExportableForSite('example.com');

  check('every key of that site is there',
    JSON.stringify(Object.keys(one).sort()) === JSON.stringify([
      'autoApply_example.com', 'config_example.com', 'manualInject_example.com',
      'mappings_example.com', 'platform_example.com', 'skipLinks_example.com',
    ]), JSON.stringify(Object.keys(one).sort()));

  // The whole point of the button: the colleague who receives one client's
  // project must not receive every other client on the machine with it.
  check('no other site rides along', !Object.keys(one).some((k) => k.endsWith('shop.co.il')));
  check('the refresh token is gone', !JSON.stringify(one).includes('SECRET-MUST-NOT-LEAVE'));
  // Global cssLink/jsLink belong to whichever site was set up last. Putting
  // them inside a named site's export is how one client's bundle URLs reached
  // another client's handover.
  check('global keys stay out', !('cssLink' in one) && !('jsLink' in one));

  check('contents are untouched',
    JSON.stringify(one['mappings_example.com']) === JSON.stringify(SAMPLE['mappings_example.com']));

  const none = await store.getExportableForSite('never-worked-on.com');
  check('a site with no work exports nothing', Object.keys(none).length === 0);

  // A hostname is matched whole. 'ample.com' is a suffix of 'example.com', and
  // a suffix/substring match here would hand out the wrong client's work.
  const suffix = await store.getExportableForSite('ample.com');
  check('a partial hostname matches nothing', Object.keys(suffix).length === 0,
    JSON.stringify(Object.keys(suffix)));

  check('exporting does not mutate storage',
    JSON.stringify(Object.keys((await store.get(null))).sort()) === JSON.stringify(Object.keys(SAMPLE).sort()));
}

// The picker decides what gets exported; the button must honour it rather than
// silently exporting the site the browser happens to be on.
{
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const block = /document\.getElementById\('exportSiteBtn'\)[\s\S]*?\n\}\);/.exec(panelSrc);
  check('the per-project export reads the picker', !!block &&
    /getElementById\('exportSiteSelect'\)\.value/.test(block[0]));
  check('…and goes through the per-site export, not the all-sites one', !!block &&
    /U1Store\.getExportableForSite\(host\)/.test(block[0]) &&
    !/getExportable\(\)/.test(block[0]));
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
  // The screenshot is a data: URI of the element — local evidence, not shared
  // configuration, and by far the biggest thing on a mapping. Two on elal.com
  // were individually over the entire request budget because of it.
  check('the screenshot is stripped before a mapping is pushed',
        /delete copy\.screenshot;/.test(src) && /payload: strip\(r\.payload\)/.test(src));
  {
    // What that is worth: a mapping with a modest 80KB screenshot on it.
    const shot = 'data:image/jpeg;base64,' + 'A'.repeat(80 * 1024);
    const withShot = { type: 'dialog', primary: '.login-widget', config: {}, screenshot: shot };
    const without = Object.assign({}, withShot); delete without.screenshot;
    const big = new TextEncoder().encode(JSON.stringify(withShot)).length;
    const small = new TextEncoder().encode(JSON.stringify(without)).length;
    // Over the per-request budget on its own — which is exactly what gets a
    // mapping set aside and reported as "too large even on their own".
    check('…which is what puts a single mapping over the budget on its own',
          big > budget && small < budget,
          `${(big / 1024).toFixed(0)}KB with it, ${small} bytes without`);
  }

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

// ── A pull must not delete what never reached the server ────────────────────
//
// This is the one that cost real work: every push was being rejected with 413,
// so the server held 8 of 24 mappings, and pullSiteFromServer replaced the
// local copy with the server's. Sixteen gone, silently, on a panel reopen.
//
// The rule is pure so it can be answered without a server, a browser or a
// login — see reconcilePulled in panel.js.
console.log('\n  A pull against unpushed local work:');
{
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const lift = (name) => {
    const re = new RegExp(`\\nfunction ${name}\\([\\s\\S]*?\\n\\}`);
    const m = re.exec(panelSrc);
    if (!m) throw new Error(`cannot lift ${name} from panel.js`);
    return m[0];
  };
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${lift('mappingKey')}\n${lift('reconcilePulled')}`, ctx);
  const reconcile = (a, b, c) => vm.runInContext('reconcilePulled', ctx)(a, b, c);

  const m = (type, primary) => ({ type, primary, config: {} });
  const key = (x) => vm.runInContext('mappingKey', ctx)(x);

  // 24 built locally, 8 of them made it up.
  const local = Array.from({ length: 24 }, (_, i) => m('tabs', '#t' + i));
  const server = local.slice(0, 8);
  const pushed = new Set(server.map(key));

  const r1 = reconcile(server, local, pushed);
  check('nothing local is lost when the server only got some of it',
        r1.merged.length === 24, `${r1.merged.length} of 24`);
  check('…and the ones that never arrived are named as such',
        r1.stranded.length === 16, String(r1.stranded.length));

  // The behaviour the wholesale replace existed to protect: a colleague's
  // deletion must still win. That row WAS acknowledged once.
  const deletedByColleague = local[0];
  const r2 = reconcile(server.slice(1), local, pushed);
  check('a mapping a colleague deleted still disappears',
        !r2.merged.some((x) => key(x) === key(deletedByColleague)));

  // And the ordinary case: everything synced, nothing to rescue.
  const r3 = reconcile(local, local, new Set(local.map(key)));
  check('a fully synced site keeps exactly the server copy',
        r3.merged.length === 24 && r3.stranded.length === 0);

  // An empty server with nothing ever pushed is the first-contact case; the
  // rows are kept and re-pushed rather than wiped.
  const r4 = reconcile([], local, new Set());
  check('an empty server does not empty this machine', r4.merged.length === 24);

  check('the pull actually uses the rule, rather than replacing wholesale',
        // let, not const, since the pull now also drops U1's own bootstrap rows
        // out of the reconciled list before writing it.
        /(const|let) \{ merged, stranded \} = reconcilePulled\(data\.mappings, localNow, everPushed\);/.test(panelSrc) &&
        /\[storageKey\('mappings', currentHostname\)\]: merged/.test(panelSrc));
  check('…and only server-confirmed keys are remembered as pushed',
        /await rememberPushedKeys\(currentHostname, out\.keys \|\| \[\]\);/.test(panelSrc));

  // ── The screenshot survives the round trip ────────────────────────────────
  //
  // pushMappings strips `screenshot` on purpose: it is a data: URI, the
  // largest thing on a mapping, and two on elal.com were individually over the
  // whole request budget. The consequence was never followed through — the
  // server therefore holds a screenshot-less copy of every row it HAS seen,
  // and those are precisely the rows this function replaces wholesale. So the
  // picture was captured, saved, pushed without itself, and destroyed by the
  // next pull, on the machine that took it. Reported twice as images that
  // would not stay saved.
  const shot = 'data:image/png;base64,AAAA';
  const withShot = { ...m('form', '.f'), screenshot: shot, pageUrl: 'https://s/a', pageTitle: 'A', capturedAt: 111 };
  const fromServer = m('form', '.f');                    // same row, stripped
  const pushedF = new Set([key(withShot)]);

  const r5 = reconcile([fromServer], [withShot], pushedF);
  check('a screenshot is NOT lost when the server returns the row without one',
        r5.merged.length === 1 && r5.merged[0].screenshot === shot);
  // The close-out report groups by pageUrl. Carrying the picture without the
  // page it was taken on would file it under the wrong section.
  check('…along with the page it was taken on',
        r5.merged[0].pageUrl === 'https://s/a' && r5.merged[0].pageTitle === 'A' &&
        r5.merged[0].capturedAt === 111);
  // Only the local-only field is rescued; the server still decides behaviour.
  const changedOnServer = { ...m('form', '.f'), overwriteRole: 'button' };
  const r6 = reconcile([changedOnServer], [withShot], pushedF);
  check('…while the server still wins on everything that decides behaviour',
        r6.merged[0].overwriteRole === 'button' && r6.merged[0].screenshot === shot);
  // If a colleague ever does push one, theirs is not overwritten by ours.
  const serverHasShot = { ...m('form', '.f'), screenshot: 'data:image/png;base64,BBBB' };
  const r7 = reconcile([serverHasShot], [withShot], pushedF);
  check('…and a screenshot the server DOES hold is left alone',
        r7.merged[0].screenshot === 'data:image/png;base64,BBBB');
  // A row nobody has a picture for must not gain a stray field.
  const r8 = reconcile([fromServer], [m('form', '.f')], pushedF);
  check('…and a row with no screenshot anywhere is untouched',
        !('screenshot' in r8.merged[0]));

  // ── Import's type allow-list must cover every component type ─────────────
  //
  // sanitizeImport filters mappings by VALID_MAPPING_TYPES. A type missing
  // there is not rejected loudly: the row is silently dropped from the
  // restored backup. link-list, keyboard-tabs and breadcrumb were all added as
  // component types long after that set was written, and none of them was
  // added to it — so a backup from a site using them restored short, quietly.
  // Derived from the schema rather than hand-listed, so the next new type
  // cannot repeat it.
  {
    const schemaStart = panelSrc.indexOf('const COMPONENT_SCHEMAS');
    const schemaBody = panelSrc.slice(schemaStart, panelSrc.indexOf('const VALID_MAPPING_TYPES'));
    const schemaTypes = [...schemaBody.matchAll(/^  '?([a-z-]+)'?:\s*\{/gm)].map((m) => m[1]);
    const setBody = panelSrc.slice(panelSrc.indexOf('const VALID_MAPPING_TYPES'),
                                   panelSrc.indexOf('function sanitizeImport'));
    const allowed = new Set([...setBody.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]));
    const missing = schemaTypes.filter((t) => !allowed.has(t));
    check('every component type survives an imported backup',
          schemaTypes.length > 0 && missing.length === 0,
          missing.length ? `dropped on import: ${missing.join(', ')}` : '');
  }

  // The strip is deliberate and must stay — this is the reason the rescue above
  // has to exist, so if the strip ever goes, the comment stops being true.
  const syncSrc = readFileSync(join(ROOT, 'sync.js'), 'utf8');
  check('pushMappings still strips the screenshot before sending',
        /delete copy\.screenshot;/.test(syncSrc));
}

// ── The survey upload: nothing scratch may ride along ───────────────────────
//
// A candidate is ~376 bytes and a section can hold 250. Hanging the naming
// pause's candidate list off the stop put it into chrome.storage AND into the
// survey pushed to the server: 21 sections became 771KB against a 99KB limit,
// and a scan that had just worked came back "saved on this machine but did not
// reach the server: http_413".
console.log('\n  The survey upload:');
{
  const syncSrc = readFileSync(join(ROOT, 'sync.js'), 'utf8');
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');

  check('the candidate list is not hung on the stop at all',
        /sweepCands\.set\(stop\.n, cands\);/.test(panelSrc) &&
        !/stop\.__cands = /.test(panelSrc));
  check('…and the push strips private keys as well, not just the picture',
        /if \(k === 'thumb' \|\| k\.startsWith\('__'\)\) continue;/.test(syncSrc));
  check('…and a refusal says the size rather than only "413"',
        /the survey is \$\{\(bytes \/ 1024\)/.test(syncSrc));

  // What it is worth, at the size that failed.
  const LIMIT = 100 * 1024;          // measured against the server
  const withCands = 376 * 100 * 21;  // ~376 bytes a candidate, 100 a section
  check('…which is the difference between refused and accepted',
        withCands > LIMIT * 7,
        `${(withCands / 1024).toFixed(0)}KB of candidates alone, limit ${LIMIT / 1024}KB`);
}

// ── Delete-all is destructive and shared ────────────────────────────────────
console.log('\n  Delete all mappings:');
{
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const block = /document\.getElementById\('deleteAllBtn'\)[\s\S]*?\n\}\);/.exec(panelSrc);
  check('there is a button, and it asks first', !!block && /dlg\.showModal\(\)/.test(block[0]));
  check('…and says how many and of what before it takes them',
        !!block && /mapping\$\{list\.length === 1 \? '' : 's'\} on \$\{escapeHtml\(currentHostname\)\}/.test(block[0]));
  // These live on the server too. A "local only" delete comes straight back.
  check('…deletes through set(), so the server is told',
        !!block && /await U1Store\.set\(\{ \[key\]: \[\] \}\)/.test(block[0]) &&
        !/setLocalOnly\(\{ \[key\]: \[\] \}\)/.test(block[0]));
  check('…and says so when only this machine forgot them',
        !!block && /err\.localOnly/.test(block[0]));
  // One site. Not every client on the machine, from a debug button.
  check('…for this site only',
        !!block && /storageKey\('mappings', currentHostname\)/.test(block[0]) &&
        !/listSites|SITE_PREFIXES/.test(block[0]));
}

// ── Turning down the site's own fixes sticks, and it sticks for everyone ────
//
// The adoption offer is read from the LIVE page, so it is not answerable by
// doing nothing: delete the mappings and the page still runs the same fixes,
// so the offer refills with all of them. Saying no has to be recorded, and —
// the owner was explicit about this — recorded on the server, not on one
// machine, or the next colleague is offered exactly what was thrown out.
{
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const storeSrc = readFileSync(join(ROOT, 'store.js'), 'utf8');

  check("'declined' is a site key, so it syncs like the rest",
        /SITE_PREFIXES = \[[^\]]*'declined'/.test(storeSrc));

  const remember = /async function rememberDeclinedFixes[\s\S]*?\n\}/.exec(panelSrc);
  check('…written through set(), which is what carries it off this machine',
        !!remember && /await U1Store\.set\(/.test(remember[0]) &&
        !/setLocalOnly/.test(remember[0]));
  check('…and pushed as a setting, like the dismissed list beside it',
        /parsed\.prefix === 'declined'\)\s*await U1Sync\.pushSettings\(currentHostname, \{ declined/.test(panelSrc));
  check('…and read back on the next pull',
        /data\.settings\.declined\)\s*writes\[storageKey\('declined', currentHostname\)\]/.test(panelSrc));
  check('…and carried by an imported backup and by a first push',
        /'u1Links', 'dismissed', 'declined'/.test(panelSrc));

  // Owner decision (2026-09-02): the adopt-the-site's-own-fixes offer does
  // not exist. Every remembered answer to it — by key, wholesale, surviving
  // wipes or not — found a reason to re-open a settled question, so nothing
  // is offered and nothing is asked. The pins now hold its ABSENCE.
  check('the offer does not exist any more — nothing offered, nothing asked',
        /this offer does not exist/.test(panelSrc) &&
        !/skipExistingBtn/.test(panelSrc) && !/adoptExistingBtn/.test(panelSrc) &&
        !/restoreDeclinedBtn/.test(panelSrc));

  // The loop the owner hit had TWO wrong answers in a row. First: adopt 83,
  // delete 83, be offered 83 again — answered by recording the delete as a
  // DECLINE. Then the decline turned out to be the bigger wrong: every
  // map-apply-delete experiment forged a permanent, team-wide refusal, and
  // "17 fixes set aside" that nobody remembered refusing. The standing
  // doctrine: deleting is the OPPOSITE of declining. The leftover on the
  // page is remembered locally as OURS (so the offer skips it without
  // forging anyone's no), and any standing decline of the same fix is
  // LIFTED — deleted means deletable-from-everywhere, re-discoverable,
  // re-offerable.
  const delBtn = /container\.querySelectorAll\('\.del-btn'\)[\s\S]*?\n  \}\);/.exec(panelSrc);
  check('deleting one never forges a decline',
        !!delBtn && !/rememberDeclinedFixes\(/.test(delBtn[0]) &&
        /rememberSelfApplied\(\[mappingKey\(gone\)\]\)/.test(delBtn[0]) &&
        /forgetDeclinedFixes\(\[mappingKey\(gone\)\]\)/.test(delBtn[0]));
  const delAll = /document\.getElementById\('deleteAllBtn'\)[\s\S]*?\n\}\);/.exec(panelSrc);
  check('…and deleting all of them lifts the declines and wipes the slate',
        !!delAll && !/rememberDeclinedFixes\(/.test(delAll[0]) &&
        /forgetDeclinedFixes\(goneKeys\)/.test(delAll[0]) &&
        /storageKey\('declined', currentHostname\)\]: \[\]/.test(delAll[0]));
  check('…while this machine\'s own leftovers are still remembered locally',
        /rememberSelfApplied\(\[mappingKey\(gone\)\]\)/.test(panelSrc));

  // The two lists must not become one. A dismissal hides an element from the
  // SCAN, and the panel promises elsewhere that deleting a mapping brings it
  // back — filing deletions under 'dismissed' would quietly break that.
  check("a declined offer is not filed as a scan dismissal",
        !!delBtn && !/rememberDismissed/.test(delBtn[0]));
}

console.log(failures === 0 ? '\n✅ The store keeps every stored key intact.\n' : `\n❌ ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

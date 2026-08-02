// Does every component type actually produce a working mapping?
//
//   node scripts/verify-mappings.mjs
//
// A long debugging session ended at a menu that reported "Applied" while the
// DOM gained no roles at all. The cause was a config the panel was happy to
// generate — menubar:true together with submenus — which makes U1 throw
// "Submenu must have a trigger element" and abort tagging entirely. The
// knowledge that this combination is fatal was written in five files. Nothing
// checked for it, because nothing in this repo tested a mapping end to end.
//
// So: for every type in COMPONENT_SCHEMAS, build the template the way the panel
// builds it, apply it the way the panel applies it, and assert against what
// test-engine.js says U1 should produce. The u1 here is a stand-in that follows
// the documented behaviour — it proves OUR pipeline, not the real library — and
// it refuses the same things the real one refuses.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');

// ── Pull the pure builders out of panel.js without booting the panel ────────
// Panel.js is one file of UI and logic together, so it cannot be imported: the
// top level touches document. Lift the declarations we need by matching braces,
// which keeps this test running against the REAL builder rather than a copy
// that would quietly drift away from it.
function lift(kind, name) {
  const needle = `${kind} ${name}`;
  const a = panelSrc.indexOf(needle + (kind === 'const' ? ' =' : '('));
  if (a < 0) throw new Error(`could not find ${needle}`);
  let i = panelSrc.indexOf('{', a), depth = 0;
  for (; i < panelSrc.length; i++) {
    const c = panelSrc[i];
    if (c === '{') depth++;
    else if (c === '}') { if (--depth === 0) { i++; break; } }
    else if (c === '"' || c === "'" || c === '`') {           // skip strings
      const quote = c;
      for (i++; i < panelSrc.length; i++) {
        if (panelSrc[i] === '\\') { i++; continue; }
        if (panelSrc[i] === quote) break;
      }
    } else if (c === '/' && panelSrc[i + 1] === '/') {        // skip line comments
      i = panelSrc.indexOf('\n', i);
    } else if (c === '/' && panelSrc[i + 1] === '*') {        // skip block comments
      i = panelSrc.indexOf('*/', i) + 1;
    }
  }
  return panelSrc.slice(a, i) + (kind === 'const' ? ';' : '');
}

const parts = [
  lift('const', 'COMPONENT_SCHEMAS'),
  ...['setDeep', 'deepClone', 'normalizeU1Selector', 'isU1ValidSelector', 'isValidIdent',
      'formatJsObject', 'buildAriaLabelCode', 'buildTemplate', 'stripEmpty',
      'buildKeyboardGridCode', 'primaryKeyOf'].map(n => lift('function', n)),
];
const sandbox = {};
new Function('S', `${parts.join('\n')}\nS.COMPONENT_SCHEMAS=COMPONENT_SCHEMAS;S.buildTemplate=buildTemplate;`)(sandbox);
const { COMPONENT_SCHEMAS, buildTemplate } = sandbox;

// The in-page apply function, lifted verbatim from applyMappingsBatch.
const applyFnSrc = panelSrc
  .slice(panelSrc.indexOf('      func: async (list) => {') + '      func: '.length,
         panelSrc.indexOf('      args: [structured],'))
  .trim().replace(/,$/, '');

// ── Per-type fixtures: realistic markup + the selectors a specialist would use ─
const CASES = {
  button:    { html: `<button class="btn" id="go">Go</button>`, primary: '#go', fields: {} },
  link:      { html: `<a class="lnk" id="lg" href="/">Home</a>`, primary: '#lg', fields: {} },
  menu: {
    html: `<nav id="nav"><div class="it"><a class="lk" href="/">Home</a></div>
      <div class="it it--dd"><button class="tg" data-nav-trigger>Shop</button>
      <div class="dd"><a class="ddlk" href="/a">All</a></div></div></nav>`,
    primary: '#nav',
    fields: { items: '.lk,.ddlk', submenus: '.dd', triggers: '.tg' },
    roots: { menubar: false },
  },
  accordion: { html: `<div id="ac"><button class="hd" aria-expanded="false">H</button><div class="pn">P</div></div>`,
               primary: '.hd', fields: { contentSelector: '.pn' } },
  carousel:  { html: `<div id="car"><div class="sl">1</div><div class="sl">2</div><button class="pv"></button><button class="nx"></button></div>`,
               primary: '#car', fields: { slide: '.sl', prevButton: '.pv', nextButton: '.nx' } },
  datepicker:{ html: `<button id="dpt">Pick</button><div id="dp"><div class="yl">2026</div><div class="ml">Aug</div><table class="dt"><td class="dy">1</td></table></div>`,
               primary: '#dp', fields: { trigger: '#dpt', 'year.label': '.yl', 'month.label': '.ml', 'days.table': '.dt', 'days.day': '.dy' } },
  dialog:    { html: `<button id="dt">Open</button><div id="dlg"><h2 class="dh">T</h2><button class="dc">X</button></div>`,
               primary: '#dlg', fields: { trigger: '#dt', closeBtn: '.dc', heading: '.dh' } },
  listbox:   { html: `<button id="lbt">Pick</button><ul id="lb"><li class="op">A</li><li class="op">B</li></ul>`,
               primary: '#lb', fields: { trigger: '#lbt', options: '#lb>li' } },
  combobox:  { html: `<div id="cb"><input class="tb"><ul class="lbx"><li class="op">A</li></ul></div>`,
               primary: '#cb', fields: { listbox: '.lbx', textbox: '.tb', options: '.op' } },
  checkbox:  { html: `<div id="cx" class="off">Agree</div>`, primary: '#cx',
               fields: { checkedState: '.on', uncheckedState: '.off' } },
  radio:     { html: `<div id="rg"><div class="rb off">A</div><div class="rb off">B</div></div>`,
               primary: '#rg', fields: { radioButton: '.rb', checkedState: '.on', uncheckedState: '.off' } },
  tabs:      { html: `<div id="tw"><div class="tl"><button class="tb">A</button></div><div class="tp">P</div></div>`,
               primary: '.tb', fields: { tabList: '.tl', tabPanel: '.tp' } },
  form:      { html: `<form id="fm"><input class="if"><button class="sb" type="submit">Go</button></form>`,
               primary: '#fm', fields: { submitButton: '.sb', inputField: '.if', invalidField: '.inv' } },
  table:     { html: `<table id="tbl"><tr class="rw"><td class="cl">1</td></tr></table>`,
               primary: '#tbl', fields: { row: '.rw', cell: '.cl' } },
  grid:      { html: `<div id="gr"><div class="rw"><div class="cl">1</div></div></div>`,
               primary: '#gr', fields: { row: '.rw', cell: '.cl' } },
  pagination:{ html: `<nav id="pg"><button class="pb">1</button><button class="pb">2</button></nav>`,
               primary: '#pg', fields: { pageButtons: '.pb' } },
  loading:   { html: `<div id="ld">Loading…</div>`, primary: '#ld', fields: {} },
  tooltip:   { html: `<div id="tt">Tip</div>`, primary: '#tt', fields: {} },
  heading:   { html: `<div id="hd">Title</div>`, primary: '#hd', fields: {} },
};

// ── A stand-in u1 that behaves the way the docs and test-engine describe ─────
function makeU1(doc, log) {
  const handled = new WeakSet();
  const decorate = (sel, attrs) => {
    doc.querySelectorAll(sel).forEach(el => {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    });
  };
  const wrap = (fn) => (first, cfg) => {
    const root = doc.querySelector(cfg?.selectors ? Object.values(cfg.selectors)[0] : first) || doc.querySelector(first);
    if (!root) return undefined;
    if (handled.has(root)) return undefined;      // once per element per load
    handled.add(root);
    fn(root, cfg || {});
    root.setAttribute('u1st-avoid-change-detection', 'true');
    root.setAttribute('aria-hidden', 'false');
  };
  const s = (cfg, k) => (cfg.selectors || {})[k];
  return {
    fix: {
      button: wrap((r) => r.setAttribute('role', 'button')),
      link:   wrap((r) => r.setAttribute('role', 'link')),
      menu:   wrap((r, cfg) => {
        // The documented pitfall: submenus + menubar:true throws and aborts.
        if (s(cfg, 'submenus') && cfg.menubar === true) {
          log.push('menu: THREW "Submenu must have a trigger element"');
          throw new Error('Submenu must have a trigger element');
        }
        if (cfg.menubar === true) {
          r.setAttribute('role', 'menubar');
          decorate(s(cfg, 'items'), { role: 'menuitem' });
        } else {
          // Navigation mode: triggers become buttons, submenus become menus.
          if (s(cfg, 'triggers')) decorate(s(cfg, 'triggers'), { role: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
          if (s(cfg, 'submenus')) decorate(s(cfg, 'submenus'), { role: 'menu' });
          if (s(cfg, 'items')) decorate(s(cfg, 'items'), { tabindex: '0' });
        }
      }),
      dialog:    wrap((r, cfg) => { r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-label', 'Dialog');
                                    if (s(cfg, 'closeBtn')) decorate(s(cfg, 'closeBtn'), { role: 'button' }); }),
      listbox:   wrap((r, cfg) => { r.setAttribute('role', 'listbox'); if (s(cfg, 'options')) decorate(s(cfg, 'options'), { role: 'option' }); }),
      combobox:  wrap((r, cfg) => { r.setAttribute('role', 'combobox'); if (s(cfg, 'options')) decorate(s(cfg, 'options'), { role: 'option' }); }),
      accordion: wrap((r, cfg) => { r.setAttribute('role', 'button'); r.setAttribute('aria-expanded', 'false');
                                    if (s(cfg, 'contentSelector')) decorate(s(cfg, 'contentSelector'), { role: 'region' }); }),
      tabs:      wrap((r, cfg) => { r.setAttribute('role', 'tab'); r.setAttribute('aria-selected', 'false');
                                    if (s(cfg, 'tabList')) decorate(s(cfg, 'tabList'), { role: 'tablist' });
                                    if (s(cfg, 'tabPanel')) decorate(s(cfg, 'tabPanel'), { role: 'tabpanel' }); }),
      table:     wrap((r, cfg) => { r.setAttribute('role', 'table'); if (s(cfg, 'row')) decorate(s(cfg, 'row'), { role: 'row' });
                                    if (s(cfg, 'cell')) decorate(s(cfg, 'cell'), { role: 'cell' }); }),
      grid:      wrap((r, cfg) => { r.setAttribute('role', 'grid'); if (s(cfg, 'row')) decorate(s(cfg, 'row'), { role: 'row' });
                                    if (s(cfg, 'cell')) decorate(s(cfg, 'cell'), { role: 'gridcell' }); }),
      checkbox:  wrap((r) => { r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', 'false'); r.setAttribute('tabindex', '0'); }),
      radio:     wrap((r, cfg) => { r.setAttribute('role', 'radiogroup');
                                    if (s(cfg, 'radioButton')) decorate(s(cfg, 'radioButton'), { role: 'radio', 'aria-checked': 'false' }); }),
      carousel:  wrap((r, cfg) => { r.setAttribute('role', 'region'); r.setAttribute('aria-roledescription', 'carousel');
                                    if (s(cfg, 'slide')) decorate(s(cfg, 'slide'), { role: 'group' }); }),
      datepicker:wrap((r, cfg) => { r.setAttribute('role', 'dialog'); if (s(cfg, 'days.day')) decorate(s(cfg, 'days.day'), { role: 'gridcell' }); }),
      form:      wrap((r, cfg) => { if (s(cfg, 'inputField')) decorate(s(cfg, 'inputField'), { 'aria-required': 'false' });
                                    if (s(cfg, 'submitButton')) decorate(s(cfg, 'submitButton'), { role: 'button' }); }),
      pagination:wrap((r, cfg) => { r.setAttribute('role', 'navigation'); if (s(cfg, 'pageButtons')) decorate(s(cfg, 'pageButtons'), { role: 'button' }); }),
      loading:   wrap((r) => { r.setAttribute('role', 'status'); r.setAttribute('aria-live', 'polite'); }),
      tooltip:   wrap((r) => r.setAttribute('role', 'tooltip')),
      heading:   wrap((r, cfg, roots) => { r.setAttribute('role', 'heading'); r.setAttribute('aria-level', '2'); }),
    },
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────
const types = Object.keys(COMPONENT_SCHEMAS).filter(t => !COMPONENT_SCHEMAS[t].custom);
const results = [];

for (const type of types) {
  const c = CASES[type];
  if (!c) { results.push({ type, ok: false, note: 'no fixture — untested' }); continue; }

  const tpl = buildTemplate(type, c.primary, c.fields, c.roots || {});
  if (!tpl) { results.push({ type, ok: false, note: 'buildTemplate returned null' }); continue; }

  const dom = new JSDOM(`<!doctype html><body>${c.html}</body>`);
  const doc = dom.window.document;
  const log = [];
  dom.window.u1 = makeU1(doc, log);
  global.window = dom.window;
  global.document = doc;

  let res;
  try {
    res = await eval('(' + applyFnSrc + ')')([
      { type: tpl.type, primary: tpl.primary, firstArg: tpl.firstArg, config: tpl.config },
    ]);
  } catch (e) {
    results.push({ type, ok: false, note: 'apply threw: ' + e.message });
    continue;
  }

  const roles = doc.querySelectorAll('[role]').length;
  const d = (res.details || [])[0] || {};
  const ok = res.applied === 1 && roles > 0;
  results.push({
    type, ok,
    note: ok
      ? `${d.changed} changed · ${roles} role(s)` +
        (d.fieldsNoEffect?.length ? ` · no effect: ${d.fieldsNoEffect.join(',')}` : '')
      : `applied=${res.applied} roles=${roles} ${d.status || ''} ${log.join(' ') || d.reason || ''}`.trim(),
  });
}

// ── The pitfall that started this: it must be caught, not silently generated ──
const menuCase = CASES.menu;
const bad = buildTemplate('menu', menuCase.primary, menuCase.fields, { menubar: true });
const badDom = new JSDOM(`<!doctype html><body>${menuCase.html}</body>`);
global.window = badDom.window; global.document = badDom.window.document;
const badLog = [];
badDom.window.u1 = makeU1(badDom.window.document, badLog);
const badRes = await eval('(' + applyFnSrc + ')')([
  { type: 'menu', primary: bad.primary, firstArg: bad.firstArg, config: bad.config },
]);
const pitfallCaught = badRes.applied === 0 || badLog.some(l => l.includes('THREW'));

// ── The regression seen live: a menu left hidden and unfocusable ────────────
// The real page came back with aria-hidden="true" on the <nav> and
// tabindex="-1" on every trigger — hidden from screen readers, out of the tab
// order — and the panel called it a success. That must be caught and undone.
const harmDom = new JSDOM(`<!doctype html><body>${CASES.menu.html}</body>`);
const harmDoc = harmDom.window.document;
global.window = harmDom.window; global.document = harmDoc;
harmDom.window.u1 = { fix: { menu: (first, cfg) => {
  const root = harmDoc.querySelector(cfg.selectors.menu);
  root.setAttribute('aria-hidden', 'true');                       // hides it from AT
  harmDoc.querySelectorAll(cfg.selectors.items).forEach(i => i.setAttribute('tabindex', '-1'));
} } };
const harmTpl = buildTemplate('menu', CASES.menu.primary, CASES.menu.fields, { menubar: false });
const harmRes = await eval('(' + applyFnSrc + ')')([
  { type: 'menu', primary: harmTpl.primary, firstArg: harmTpl.firstArg, config: harmTpl.config },
]);
const harmDetail = (harmRes.details || [])[0] || {};
const navAfter = harmDoc.querySelector('#nav');
const itemsFocusable = [...harmDoc.querySelectorAll('.lk,.ddlk')].filter(e => e.getAttribute('tabindex') !== '-1');
const harmCaught = !!(harmDetail.harm && harmDetail.harm.length) && harmRes.applied === 1;
// It must NOT revert: undoing U1's work on a heuristic is worse than warning.
const harmKept = navAfter.getAttribute('aria-hidden') === 'true';

// ── Defaults must agree with the documentation written beside them ──────────
// menu.menubar shipped as `true` while its own desc said "Default false =
// navigation menu". Every menu mapping was therefore born with the one setting
// that makes U1 throw as soon as submenus are filled. Nothing caught it,
// because nothing compared a default to its own docs.
const defaultMismatches = [];
for (const [t, sc] of Object.entries(COMPONENT_SCHEMAS)) {
  for (const [k, v] of Object.entries(sc.rootFields || {})) {
    const m = /Default(?: is)? (true|false|\d+)/i.exec((sc.desc || {})[k] || '');
    if (!m) continue;
    const documented = m[1] === 'true' ? true : m[1] === 'false' ? false : Number(m[1]);
    if (documented !== v) defaultMismatches.push(`${t}.${k}: code=${v} docs=${documented}`);
  }
}
const defaultsAgree = defaultMismatches.length === 0;

// A nav with drop-downs must not be born with the fatal combination.
const navTpl = buildTemplate('menu', CASES.menu.primary, CASES.menu.fields, {});
const navSafe = navTpl.config.menubar !== true;

// ── Mappings already saved with the fatal pair must be repaired, not left ───
// Changing the schema default only helps NEW mappings. The one someone has
// been staring at for hours is already in storage with menubar:true.
const savedBad = {
  type: 'menu', primary: '.main-nav',
  config: { menubar: true, selectors: { menu: '.main-nav', items: '.main-nav__item', submenus: '.main-nav__item--has-dropdown' } },
  code: 'stale',
};
const migSrc = panelSrc.slice(panelSrc.indexOf('async function migrateFatalMenubar'),
                              panelSrc.indexOf('async function migrateWwwHostname'));
const store = { 'mappings_x': [structuredClone(savedBad), { type: 'link', primary: 'a', config: {} }] };
globalThis.storageKey = () => 'mappings_x';
globalThis.U1Store = { get: async () => ({ mappings_x: store.mappings_x }), set: async (o) => Object.assign(store, o) };
globalThis.buildTemplate = buildTemplate;
const migrate = new Function(migSrc + '; return migrateFatalMenubar;')();
const repaired = await migrate('x');
const after = store.mappings_x[0];
const migrated = repaired === 1 && after.config.menubar === false && !/menubar: true/.test(after.code);
const leftAlone = store.mappings_x[1].type === 'link' && !('menubar' in store.mappings_x[1].config);

// ── The Shoe Store failure: a nav rebuilt after U1 has finished with it ─────
// The page ships <nav id="mainNav"> EMPTY and fills it on DOMContentLoaded via
// innerHTML. U1 runs first, decorates the empty container, marks it handled and
// hides it — then every child it touched is replaced, and it never returns.
// Applying must notice and re-apply, or the menu can never be decorated at all.
async function rebuildCase(rebuild) {
  const dom = new JSDOM('<!doctype html><body><nav class="main-nav" id="nav"></nav></body>');
  const d = dom.window.document;
  const handled = new Set();
  dom.window.u1 = { fix: { menu: (first, cfg) => {
    const el = d.querySelector(cfg.selectors.menu);
    if (!el || handled.has(el)) return undefined;                   // once per element
    if (el.hasAttribute('u1st-avoid-change-detection')) return undefined;
    handled.add(el);
    setTimeout(() => {
      const items = d.querySelectorAll(cfg.selectors.items);
      el.setAttribute('aria-hidden', items.length ? 'false' : 'true');   // empty ⇒ hidden
      el.setAttribute('u1st-avoid-change-detection', 'true');
      items.forEach((i, n) => i.setAttribute('tabindex', n ? '-1' : '0'));
      d.querySelectorAll(cfg.selectors.triggers).forEach(t => {
        t.setAttribute('aria-haspopup', 'true'); t.setAttribute('aria-expanded', 'false');
      });
      d.querySelectorAll(cfg.selectors.submenus).forEach(x => x.setAttribute('role', 'menu'));
    }, 60);
  } } };
  global.window = dom.window; global.document = d;

  const cfg = { menubar: false, selectors: {
    menu: '#nav', items: '.lk,.ddlk', triggers: '.tg', submenus: '.dd' } };

  // 1. U1's own early pass over the EMPTY nav.
  dom.window.u1.fix.menu('#nav', cfg);
  await new Promise(r => setTimeout(r, 200));

  // 2. The site builds the real menu (or, in the control, does not).
  if (rebuild) {
    d.querySelector('#nav').innerHTML =
      '<div class="it"><a class="lk" href="/">Home</a></div>' +
      '<div class="it"><button class="tg">Shop</button><div class="dd"><a class="ddlk" href="/a">All</a></div></div>';
  }

  // 3. The specialist presses Apply.
  const res = await eval('(' + applyFnSrc + ')')([
    { type: 'menu', primary: '#nav', firstArg: '#nav', config: cfg }]);
  const nav = d.querySelector('#nav');
  return {
    res, detail: (res.details || [])[0] || {},
    ariaHidden: nav.getAttribute('aria-hidden'),
    haspopup: d.querySelectorAll('[aria-haspopup]').length,
    roleMenu: d.querySelectorAll('[role="menu"]').length,
  };
}

const rb = await rebuildCase(true);
const rebuiltDetected = rb.detail.rebuilt === true;

// Control: a nav U1 handled that was NOT rebuilt must not be re-applied.
const ct = await rebuildCase(false);
const controlLeftAlone = ct.detail.rebuilt !== true;

// ── The vendor's own documented selector must validate ─────────────────────
// U1's fix.menu docs use a pseudo-class:
//   items: 'a.menu-item:not(.has-submenu), li.has-submenu'
// Our grammar rejected every :pseudo, so the selector printed in the vendor's
// own documentation failed our validation and the auto-mapper could never
// propose or save it. What U1 genuinely cannot take is a descendant space.
// Rebuild the real validator, compound rule and normaliser included.
const validator = new Function(
  lift('const', 'U1_COMPOUND_RE') + '\n' +
  lift('function', 'normalizeU1Selector') + '\n' +
  lift('function', 'isU1ValidSelector') + '\n' +
  'return isU1ValidSelector;')();
const selCases = [
  ['a.menu-item:not(.has-submenu), li.has-submenu', true],   // straight from the docs
  ['li.has-submenu', true], ['.submenu', true], ['#menu', true],
  ['li:first-child>a', true], ['div[data-x="1"]', true],
  ['#nav a.link', false], ['.a .b', false],                  // descendant space still rejected
  ['.a,,', false], ['.a>', false],
];
const selOk = selCases.every(([sel, want]) => validator(sel) === want);

// It must also stay LINEAR. The previous grammar took 21 seconds on a
// 32-character non-match, on every keystroke — that is what froze the panel.
const t0 = Date.now();
validator('a'.repeat(200) + '!');
validator('.main-nav__item--has-dropdown!'.repeat(20));
const selFast = (Date.now() - t0) < 50;

// ── Report ───────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
console.log('\n  Component mappings — does each one produce accessible markup?\n');
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? '✅' : '❌'} ${pad(r.type, 12)} ${r.note}`);
}
console.log(`\n  ${pitfallCaught ? '✅' : '❌'} menubar:true + submenus is rejected by U1 (the config that broke the live menu)`);
if (!pitfallCaught) failed++;
console.log(`  ${harmCaught ? '✅' : '❌'} an apply that hides the page from screen readers is flagged`);
if (!harmCaught) failed++;
console.log(`  ${harmKept ? '✅' : '❌'} …and is NOT silently reverted — the warning is loud, the work stays`);
if (!harmKept) failed++;
console.log(`  ${defaultsAgree ? '✅' : '❌'} every root option defaults to what its own docs say${defaultsAgree ? '' : ' — ' + defaultMismatches.join(', ')}`);
if (!defaultsAgree) failed++;
console.log(`  ${navSafe ? '✅' : '❌'} a menu with submenus is not born with menubar:true`);
if (!navSafe) failed++;
console.log(`  ${migrated ? '✅' : '❌'} a menu ALREADY SAVED with the fatal pair is repaired and its code rebuilt`);
if (!migrated) failed++;
console.log(`  ${leftAlone ? '✅' : '❌'} …and other mappings are left untouched`);
if (!leftAlone) failed++;
console.log(`  ${rebuiltDetected ? '✅' : '❌'} a nav rebuilt by the site AFTER U1 finished is DETECTED (not blamed on selectors)`);
if (!rebuiltDetected) failed++;
console.log(`  ${controlLeftAlone ? '✅' : '❌'} …and a nav that was NOT rebuilt is not re-applied`);
if (!controlLeftAlone) failed++;
console.log(`  ${selOk ? '✅' : '❌'} the selector in U1's own menu docs validates, and descendant spaces still do not`);
if (!selOk) failed++;
console.log(`  ${selFast ? '✅' : '❌'} …and validation is linear — no catastrophic backtracking on a long non-match`);
if (!selFast) failed++;

const total = results.length + 11;
console.log(`\n  ${total - failed}/${total} checks passed\n`);
if (failed) process.exit(1);

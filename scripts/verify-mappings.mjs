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
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
let overwriteEverywhere, overwriteWhere;
let narrowScopes, narrowValidates, narrowLeavesNoneInside, narrowOnSave, narrowOnApply, narrowIsSaid, radioHasRule, fatalNamed;

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
  lift('const', 'JS_LINE_WIDTH'),
  lift('const', 'U1_COMPOUND_RE'),
  lift('const', 'U1_PSEUDO_OK'),
  lift('function', 'u1PseudosOk'),
  ...['setDeep', 'deepClone', 'normalizeU1Selector', 'isU1ValidSelector', 'isValidIdent',
      'formatJsInline', 'formatJsObject', 'buildAriaLabelCode', 'buildTemplate', 'stripEmpty',
      'buildKeyboardGridCode', 'buildKeyboardTabsCode', 'primaryKeyOf'].map(n => lift('function', n)),
];
const sandbox = {};
new Function('S', `${parts.join('\n')}\nS.COMPONENT_SCHEMAS=COMPONENT_SCHEMAS;S.buildTemplate=buildTemplate;S.primaryKeyOf=primaryKeyOf;S.isU1ValidSelector=isU1ValidSelector;`)(sandbox);
const { COMPONENT_SCHEMAS, buildTemplate, primaryKeyOf, isU1ValidSelector } = sandbox;

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

// ── "Overwrite" has to actually overwrite ───────────────────────────────────
// The role-clash dialog asks whether to replace a role the SITE wrote, and the
// "overwrite" answer used to do nothing but let the save through: U1 will not
// write over an author's role, so the component kept saying role="menu" and the
// listbox never existed. The answer only means something if the attribute comes
// off before the fix runs — here, and identically in the exported file.
const owDom = new JSDOM(`<!doctype html><body>
  <button id="lbt">Pick</button>
  <ul id="lb" role="menu"><li class="op">A</li><li class="op">B</li></ul></body>`);
const owDoc = owDom.window.document;
global.window = owDom.window; global.document = owDoc;
let sawRole = 'not called';
owDom.window.u1 = { fix: { listbox: (first, cfg) => {
  const list = owDoc.querySelector(cfg.selectors.listbox);
  sawRole = list.getAttribute('role');                  // what U1 meets when it arrives
  if (!sawRole) list.setAttribute('role', 'listbox');   // the real library will not overwrite
} } };
const owTpl = buildTemplate('listbox', '#lb', { trigger: '#lbt', options: '#lb>li' }, {});
await eval('(' + applyFnSrc + ')')([
  { type: 'listbox', primary: '#lb', firstArg: owTpl.firstArg, config: owTpl.config, overwriteRole: 'menu' },
]);
const overwritten = sawRole === null && owDoc.querySelector('#lb').getAttribute('role') === 'listbox';

// Without the answer the site's role is untouched and U1 meets it — the state
// that has to stay reachable, because "leave it alone" is one of the three
// answers the dialog offers.
const keepDom = new JSDOM(`<!doctype html><body>
  <button id="lbt">Pick</button>
  <ul id="lb" role="menu"><li class="op">A</li></ul></body>`);
const keepDoc = keepDom.window.document;
global.window = keepDom.window; global.document = keepDoc;
keepDom.window.u1 = { fix: { listbox: () => {} } };
const keepRes = await eval('(' + applyFnSrc + ')')([
  { type: 'listbox', primary: '#lb', firstArg: owTpl.firstArg, config: owTpl.config },
]);
const kept = keepDoc.querySelector('#lb').getAttribute('role') === 'menu';

// And the apply has to NAME it. "These fields changed nothing" is a symptom;
// the cause is readable right there and was not being read.
const keepClash = ((keepRes.details || [])[0] || {}).roleClash;
const clashNamed = !!keepClash && keepClash.role === 'menu' && keepClash.willWrite === 'listbox';

// A role U1 itself wrote is ours, and asking about our own work is noise
// people learn to click through.
const oursDom = new JSDOM(`<!doctype html><body>
  <button id="lbt">Pick</button>
  <ul id="lb" role="menu" u1st-avoid-change-detection="true"><li class="op">A</li></ul></body>`);
global.window = oursDom.window; global.document = oursDom.window.document;
oursDom.window.u1 = { fix: { listbox: () => {} } };
const oursRes = await eval('(' + applyFnSrc + ')')([
  { type: 'listbox', primary: '#lb', firstArg: owTpl.firstArg, config: owTpl.config },
]);
const notAsked = !((oursRes.details || [])[0] || {}).roleClash;

// And the exported file must make the same choice, or Apply and the client's
// own run disagree about what the component says it is.
// The FUNCTION, not its first two thousand characters. A new branch added at
// the top of mappingToCode pushed `overwriteRole` past the old window and
// failed a check about behaviour that had not changed at all.
const codeSrc = /function mappingToCode\(m\)[\s\S]*?\n\}/.exec(panelSrc)[0];
const exportsStrip = /overwriteRole/.test(codeSrc) &&
                     /removeAttribute\('role'\)/.test(codeSrc);

// Every apply path shows its result through describeApply, so the clash has to
// be reported there — once — rather than in whichever caller remembered to.
const describeApply = new Function(
  lift('function', 'describeApply') + '\n' + lift('function', 'describeApplyResult') +
  '\nreturn describeApply;')();
const clashMsg = describeApply({
  ok: true,
  details: [{ type: 'listbox', sel: '.clicker', status: 'ok', changed: 2,
              fieldsNoEffect: ['listbox', 'options'],
              roleClash: { sel: '.signin-dropdown', role: 'menu', willWrite: 'listbox' } }],
}, { type: 'listbox' });
const clashReported = clashMsg.ok === false &&
  (clashMsg.msg.match(/role="menu"/g) || []).length === 1 && !!clashMsg.roleClash;
// A clean apply must not grow the sentence.
const cleanMsg = describeApply({ ok: true, details: [{ type: 'listbox', sel: '.x', status: 'ok', changed: 3 }] }, {});
const cleanQuiet = cleanMsg.ok === true && !/role=/.test(cleanMsg.msg);

// The clash is a decision, so it is asked as one — on screen, not as a button
// appended to the status line at the bottom, where it went unread.
const asksOnScreen = /function askRoleClash[\s\S]{0,2000}?showModal\(\)/.test(panelSrc) &&
                     !panelSrc.includes('data-role-overwrite');

// Every route that creates a mapping has to ask. There are three — the manual
// Add, the AI card's "Approve & apply", and the bulk save — and only the first
// one did. The guarantee is structural: the question lives inside
// saveMappingEntry, which all three go through, and nowhere else.
const askInSave = /async function saveMappingEntry[\s\S]{0,1200}?confirmRoleOverwrite\(template\)/.test(panelSrc);
// It is asked EARLIER too — on the AI component card, where the container and
// trigger are chosen and the answer still changes whether a mapping is worth
// building. Asked twice is worse than asked late: people learn to click through
// a dialog that repeats. So the answer is recorded, and the question refuses to
// ask again once it is.
const asksOnCard = /confirmRoleOverwrite\(roleAsk\)/.test(panelSrc);
const answerSticks = /async function confirmRoleOverwrite[\s\S]{0,900}?if \(tpl\.overwriteRole\) return true;/.test(panelSrc);
const askedOnce = askInSave && asksOnCard && answerSticks;

// The two ROLE_BY_TYPE tables — one in selector-intel for the save-time
// question, one inside the in-page apply, which cannot reach it — must agree.
// Drifting apart means asking about a role at save time and staying silent
// about the same role at apply time, or the reverse.
const roleTable = (src) => {
  const m = /ROLE_BY_TYPE = \{([\s\S]*?)\};/.exec(src);
  return m ? new Function('return {' + m[1] + '};')() : null;
};
const tA = roleTable(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8')), tB = roleTable(panelSrc);
const tablesAgree = !!tA && !!tB && JSON.stringify(tA) === JSON.stringify(tB);

// ── A child selector wider than its parent ──────────────────────────────────
// The reported failure. `.tab-bar__btn` matched 11 elements, 6 of them inside
// #dealTabs; the patch refused the strip, u1.fix.tabs was never called, and the
// panel said "U1 will only decorate the ones inside it" — the opposite of what
// happens. Fix the selector rather than describe the problem.
{
  const src = panelSrc;
  const fn = /async function narrowContained[\s\S]*?\n}/.exec(src)[0];
  narrowScopes = /commonSelectorFor\(parent, inside, job\.parentSel\)/.test(fn);
  // A descendant combinator is not available — isU1ValidSelector splits on
  // [>+~] and rejects a compound with a space — so every candidate is checked
  // before it is written.
  narrowValidates = /isU1ValidSelector\(f\.now\)/.test(fn);
  // "None inside" is a wrong selector, not a wide one. Narrowing it would turn
  // a loud error into a silent no-match.
  narrowLeavesNoneInside = /inside\.length === kids\.length \|\| !inside\.length/.test(fn);
  // Every route saves through saveMappingEntry, which is why it is the place.
  narrowOnSave = /const narrowed = await narrowContained\(template\);/.test(src);
  narrowOnApply = /const narrowedNow = await narrowContained\(currentTemplate\);/.test(src);
  narrowIsSaid = /function showNarrowed/.test(src) && /narrowed to \$\{n\.now\}/.test(src);
  // radio had no containment rule at all, so nothing reported it and nothing
  // narrowed it.
  radioHasRule = /radio:\s*\[\{ parent: 'radioGroup', child: 'radioButton', inside: true \}\]/.test(src);
  // And the message that was wrong.
  fatalNamed = /const FATAL_IF_WIDE = \['tabs'\];/.test(src) &&
               /that is fatal, not partial/.test(src);
}

// ── overwriteRole must survive every apply path ─────────────────────────────
// It was threaded through the single apply and dropped by the batch — so a
// mapping whose role clash had been answered "replace it" was applied without
// the site's role being lifted, U1 refused to write over it, and the element
// came back undecorated. Only ever wrong in bulk, which is the only way the
// whole-page route applies anything.
{
  const calls = [...panelSrc.matchAll(/applyMappingsBatch\(([\s\S]{0,400}?)\);/g)]
    .map((m) => m[1])
    .filter((body) => /\bconfig\b/.test(body) && !/^\s*fixes\s*$/.test(body));
  const missing = calls.filter((body) => !/overwriteRole/.test(body));
  overwriteEverywhere = missing.length === 0;
  overwriteWhere = missing.map((b) => b.replace(/\s+/g, ' ').slice(0, 60));
}

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

// ── Dialogs already saved with the dialog and trigger swapped ───────────────
// Verbatim off molinahealthcare.com's console: the modal filed as its own
// opener and a LINK filed as the dialog. U1 then tries to focus into the link,
// which is the "Cannot read properties of undefined (reading 'focus')" thrown
// from u1_vanilla-js-a11y.js on every page load.
let dlgFlipped = false, dlgLeftAlone = false, dlgSaneUntouched = false;
{
  const inverted = {
    type: 'dialog',
    primary: '#state-select-modal-find-doctor',
    firstArg: '#state-select-modal-find-doctor',
    config: { selectors: { dialog: '#HealthCareProfessionals>a', trigger: '#state-select-modal-find-doctor' } },
    code: 'stale',
  };
  // A dialog the right way round must be left exactly as it is.
  const sane = {
    type: 'dialog', primary: '#modal', firstArg: '#opener',
    config: { selectors: { dialog: '#modal', trigger: '#opener' } }, code: 'good',
  };
  const s2 = { mappings_x: [structuredClone(inverted), { type: 'link', primary: 'a', config: {} }, structuredClone(sane)] };
  globalThis.U1Store = { get: async () => ({ mappings_x: s2.mappings_x }), set: async (o) => Object.assign(s2, o) };
  const mSrc = panelSrc.slice(panelSrc.indexOf('async function migrateInvertedDialog'),
                              panelSrc.indexOf('async function migrateWwwHostname'));
  const flip = new Function(mSrc + '; return migrateInvertedDialog;')();
  const n = await flip('x');
  const got = s2.mappings_x[0];
  dlgFlipped = n === 1 &&
    got.config.selectors.dialog === '#state-select-modal-find-doctor' &&
    got.config.selectors.trigger === '#HealthCareProfessionals>a' &&
    got.primary === '#state-select-modal-find-doctor' &&
    got.code !== 'stale';                       // the emitted code is rebuilt, not left stale
  dlgLeftAlone = s2.mappings_x[1].type === 'link' && !s2.mappings_x[1].config.selectors;
  dlgSaneUntouched = s2.mappings_x[2].code === 'good' &&
    s2.mappings_x[2].config.selectors.dialog === '#modal';
}

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

// ── A fix that wrote only its own bookkeeping is not a fix ─────────────────
//
// On molinahealthcare.com u1.fix.menu came back having written
// u1st-avoid-change-detection and aria-hidden="false" on the container, and
// nothing whatsoever anywhere else — no role, no aria-haspopup, no tabindex.
// The panel reported "Applied", then blamed the mapping's fields: "items,
// submenus, triggers changed nothing — U1 decorated the container and left
// those fields alone." It had not decorated anything; those two attributes
// mean only "U1 has been here".
//
// The same run went on to advise removing u1st-avoid-change-detection from
// the site's markup. That site serves no u1st-* attribute at all.
async function bookkeepingOnlyCase() {
  const dom = new JSDOM(`<!doctype html><body><nav id="nav">
    <div class="it"><a class="lk" href="/">Home</a></div>
    <div class="it"><button class="tg">Shop</button><div class="dd"><a class="ddlk" href="/a">All</a></div></div>
    </nav></body>`);
  const d = dom.window.document;
  dom.window.u1 = { fix: { menu: (first, cfg) => {
    const el = d.querySelector(cfg.selectors.menu);
    if (!el) return undefined;
    setTimeout(() => {
      el.setAttribute('aria-hidden', 'false');
      el.setAttribute('u1st-avoid-change-detection', 'true');
    }, 60);
  } } };
  global.window = dom.window; global.document = d;
  const cfg = { menubar: false, selectors: {
    menu: '#nav', items: '.lk,.ddlk', triggers: '.tg', submenus: '.dd' } };
  const res = await eval('(' + applyFnSrc + ')')([
    { type: 'menu', primary: '#nav', firstArg: '#nav', config: cfg }]);
  return { res, detail: (res.details || [])[0] || {} };
}
const bk = await bookkeepingOnlyCase();
const bookkeepingNotCounted = bk.detail.status === 'no-effect' && bk.res.applied === 0;

// And the line the person reads has to say something. A mapping that changed
// nothing printed as a bare "✗ dialog #MedicareAlert" — mark, type, selector,
// no reason — because the report only asked describeApply about half-applied
// mappings, and this is the case with no other way to find out why.
const noEffectExplained = (() => {
  const msg = describeApply({ ok: true, applied: 0, details: [
    { type: 'dialog', sel: '#MedicareAlert', status: 'no-effect', changed: 0,
      reason: 'already-processed' }] }, { type: 'dialog' }).msg;
  return /reload/i.test(msg) && msg.length > 30;
})();

// The opt-out note must not assert whose attribute it is: U1 stamps the same
// marker on everything it handles, so "it is in the site's HTML" is a guess,
// and it was being printed as a fact next to a demand to edit that HTML.
const optOutHonest = (() => {
  const msg = describeApply({ ok: true, applied: 1, details: [
    { type: 'menu', sel: '.mainNav', status: 'ok', changed: 2, unblocked: true }] },
    { type: 'menu' }).msg;
  return /reload/i.test(msg) && !/carries u1st-avoid-change-detection in the site's HTML/.test(msg);
})();

// One line per unmatched selector, not two. Every no-match was recorded both
// as a detail and as an engine error, and the report printed both.
const noMatchOnce = /details\.filter\(d => d\.status === 'no-match'\)[\s\S]{0,200}?echoed\.has\(e\)/.test(panelSrc);

// ── The vendor's own documented selector must validate ─────────────────────
// U1's fix.menu docs use a pseudo-class:
//   items: 'a.menu-item:not(.has-submenu), li.has-submenu'
// Our grammar rejected every :pseudo, so the selector printed in the vendor's
// own documentation failed our validation and the auto-mapper could never
// propose or save it. What U1 genuinely cannot take is a descendant space.
// Rebuild the real validator, compound rule and normaliser included.
const validator = new Function(
  lift('const', 'U1_COMPOUND_RE') + '\n' +
  // The pseudo allow-list, which the panel's copy of the validator was missing
  // entirely — it matched the SHAPE of a compound and never looked inside it.
  lift('const', 'U1_PSEUDO_OK') + '\n' +
  lift('function', 'u1PseudosOk') + '\n' +
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

// ── A selector must not be built on a class that changes every deploy ──────
// css-1x2y3z, sc-bdVaJa, a7Fk2p: a mapping built on one works today and breaks
// at the next release, silently. Being conservative matters as much — throwing
// away a real class like `col2` costs more than keeping a doubtful one.
const intelSrc = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
const looksGenerated = new Function(
  intelSrc.slice(intelSrc.indexOf('const looksGenerated'), intelSrc.indexOf('function compound')) +
  '; return looksGenerated;')();
const classCases = [
  ['css-1x2y3z', true], ['sc-bdVaJa', true], ['a7Fk2p', true], ['_btn_1a2b3', true],
  ['jsx-2841', true], ['card-9f8e7d', true], ['ab1c2d3e4f', true],
  ['main-nav__link', false], ['btn-primary', false], ['category-tile', false],
  ['col2', false], ['h1', false], ['main-nav__item--has-dropdown', false], ['slide2', false],
];
const classOk = classCases.every(([c, want]) => looksGenerated(c) === want);

// ── A scan must not pay for empty structure ────────────────────────────────
// Every candidate used to carry all thirteen fields whether or not they held
// anything, pretty-printed. This tool is used by scanning the same page section
// by section, so that waste is paid on every pass.
const aiSrc = readFileSync(join(ROOT, 'ai-advisor.js'), 'utf8');
const compactList = new Function(
  aiSrc.slice(aiSrc.indexOf('const compactList'), aiSrc.indexOf('// ── Key storage')) +
  '; return compactList;')();
const sample = { mark: 1, tag: 'button', role: '', name: 'Search', selector: 'button[aria-label="x"]',
  matches: 1, alt: null, ariaLabel: 'x', ariaHidden: '', tabindex: null, disabled: false,
  labelled: false, signals: ['tag'], box: { x: 1, y: 2, w: 3, h: 4 } };
const lean = compactList([sample])[0];
const leanOk =
  lean.mark === 1 && lean.tag === 'button' && lean.selector && lean.name === 'Search' &&
  lean.ariaLabel === 'x' &&                       // kept: real values survive
  !('role' in lean) && !('alt' in lean) && !('disabled' in lean) && !('matches' in lean) &&
  !('box' in lean) &&                             // dropped: empty, default, or redundant
  'alt' in compactList([{ ...sample, alt: '' }])[0] &&      // "" on an img is meaningful
  compactList([{ ...sample, matches: 7 }])[0].matches === 7;
const bulk = Array.from({ length: 60 }, (_, i) => ({ ...sample, mark: i + 1 }));
const shrank = JSON.stringify(compactList(bulk)).length < JSON.stringify(bulk, null, 1).length * 0.5;

// ── The closed half of the page has to survive the whole pipeline ──────────
//
// Collecting a shut dialog is worth nothing if the fact is dropped between the
// collector and the saved mapping, and every link in that chain is in a
// different file. What the page declared about what opens what has to reach
// the model's list, be asked for in the answer, be explained in the prompt,
// arrive on the review card, and arrive in the unattended sweep — and it must
// still lose to a measurement, because a probe that PRESSED the control beats
// anything read off the markup.
const withEdge = compactList([{ ...sample, openedBy: '#searchOpen', openedVia: 'aria-controls' }])[0];
const edgeCarried = withEdge.openedBy === '#searchOpen' && withEdge.openedVia === 'aria-controls' &&
  !('openedBy' in lean) && !('openedVia' in lean);
const schemaAsks = /triggerSelector:\s*\{/.test(aiSrc) &&
  /required:[^\]]*'triggerSelector'/.test(aiSrc);
const promptSays = /openedBy/.test(aiSrc) && /triggerSelector/.test(aiSrc);
const cardPrefills = /class="ai-comp-cont"[\s\S]{0,200}triggerSelector/.test(panelSrc);
const sweepCarries = /trigger:\s*c\.triggerSelector/.test(panelSrc) &&
  /acceptsTrigger\(f\.type\)\s*&&\s*f\.trigger[\s\S]{0,600}container = f\.trigger;/.test(panelSrc);
// Order matters, not just presence: the lbShape assignment has to come AFTER
// the declared trigger is put on the row, or the measured answer is the one
// that gets thrown away.
const measuredWins = (() => {
  const meas = panelSrc.indexOf('row.trigger = lbShape.trigger');
  const used = panelSrc.indexOf('instruction: row.trigger');
  const sent = panelSrc.indexOf('value: row.trigger');
  return meas !== -1 && used > meas && sent > meas;
})();

// ── Ask the page before telling the user to go and look ────────────────────
//
// Two components came back "could not be mapped" on a real site, with messages
// addressed to a person in an unattended sweep. Both were answerable from the
// markup, and in one case by a function the tool already had.
const formMeasured = /row\.type === 'form'[\s\S]{0,200}formShape/.test(panelSrc) &&
  /formShape,/.test(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8'));
// The refusal for a listbox with no container fires in rowFromParts. The
// measurement that answers it lived one step later, in prepareOne, which the
// refusal made unreachable — so the sweep has to measure BEFORE it builds.
const listboxMeasuredFirst = (() => {
  // The sweep's own call, not the card's — there are two, and the card's comes
  // first in the file.
  const meas = panelSrc.indexOf("f.type === 'listbox'");
  const build = panelSrc.lastIndexOf('const built = rowFromParts({');
  return meas !== -1 && build !== -1 && meas < build;
})();

// The rename has to happen in BOTH places, and for different reasons. The save
// gate is the one door every route goes through, so the guarantee lives there.
// But the card is drawn long before the save gate runs, and a card showing a
// name the engine cannot use — under a red banner explaining that it cannot —
// is a thing the specialist is being asked to approve.
const repairsAtSave = (() => {
  // The save gate's own list, not the first `const bad = []` in the file.
  const gate = panelSrc.lastIndexOf('const bad = [];');
  if (gate === -1) return false;
  const before = panelSrc.lastIndexOf('repairForU1', gate);
  // The repair must sit inside the same guard, immediately above the refusal —
  // not merely somewhere earlier in the file.
  return before !== -1 && gate - before < 1500;
})();
const repairsBeforeCard = (() => {
  const rep = panelSrc.indexOf('repairForU1');
  const card = panelSrc.indexOf('const idx = aiMapped.length;');
  return rep !== -1 && card !== -1 && rep < card;
})();

// ── Three answers the model kept getting wrong, now measured instead ───────
// The prompt asks for all three in plain words. The list still came back full
// of links that were already links, a role="menu" drop-down mapped with
// fix.menu, and a description composed for a component the page had already
// named. Asking again was not going to work.
const auditRuns = /auditSurveyComponents\(out\.components, tab\)/.test(panelSrc) &&
  /auditSurveyComponents\(part\.components, tab\)/.test(panelSrc);
const auditReports = /left out for needing no fix/.test(panelSrc) &&
  /left out \$\{d\.label\}/.test(panelSrc);
const descFromPage = /componentWording/.test(panelSrc) &&
  /description\$\/i/.test(panelSrc);

// ── A real class on the page must not be called invented ────────────────────
//
// checkAiSelector built its "known" set from the selectors robustSelector had
// EMITTED, and that prefers #id — so for <div class="tab-bar" id="faqTabs"> the
// class `.tab-bar` appeared in no produced selector and was refused as
// invented, with "handle this one by hand", while sitting on the page.
let selReal = false, selNear = false, selNoGuess = false, selTokens = false;
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><body>
    <div class="tab-bar" id="faqTabs"><button class="tab-bar__btn">a</button></div></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.HTMLElement.prototype.getBoundingClientRect =
    () => ({ width: 300, height: 40, top: 20, left: 10, bottom: 60, right: 310 });
  w.eval(INTEL);
  const ctxPage = w.__u1SelectorIntel.collectCandidates(60, null);
  selTokens = (ctxPage.tokens || []).includes('.tab-bar');

  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const lift = (n) => new RegExp(`\\nfunction ${n}\\([\\s\\S]*?\\n\\}`).exec(panelSrc)[0];
  const c = {}; c.globalThis = c; c.__u1SelectorIntel = w.__u1SelectorIntel;
  vm.createContext(c);
  vm.runInContext(lift('checkAiSelector') + lift('nearestToken') + lift('editDistance'), c);
  const check = vm.runInContext('checkAiSelector', c);

  selReal = check('.tab-bar', ctxPage).ok;
  const typo = check('.tab-barr', ctxPage);
  selNear = !typo.ok && (typo.suggest || []).includes('.tab-bar');
  selNoGuess = !check('.totally-made-up', ctxPage).ok &&
               !(check('.totally-made-up', ctxPage).suggest || []).length;
}

// ── A duplicated id must not be trusted as a selector ───────────────────────
//
// molinahealthcare.com's homepage carries #state-select-modal, #MedicareAlert
// and #siteLeavingAlert TWICE each — a desktop and a mobile copy. U1 resolves
// selectors through jQuery, where a duplicated #id matches only the FIRST
// copy, so a selector built on the id can never reach the second element —
// and pointed at the first, it may be decorating the copy that is
// display:none at this breakpoint. robustSelector used to short-circuit on
// any '#' selector without ever counting it.
let dupIdDistinct = false, dupIdResolves = false, uniqueIdKept = false;
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><body>
    <header><div><div id="alertBox" class="modal">desktop copy</div></div></header>
    <footer><div><div id="alertBox" class="modal">mobile copy</div></div></footer>
    <div id="onlyOne" class="modal">unique</div></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.HTMLElement.prototype.getBoundingClientRect =
    () => ({ width: 300, height: 40, top: 20, left: 10, bottom: 60, right: 310 });
  w.eval(INTEL);
  const S = w.__u1SelectorIntel;
  const els = [...w.document.querySelectorAll('[id="alertBox"]')];
  const sa = S.robustSelector(els[0]), sb = S.robustSelector(els[1]);
  dupIdDistinct = els.length === 2 && sa && sb && sa !== sb &&
                  sa !== '#alertBox' && sb !== '#alertBox';
  const hit = (s) => { try { return [...w.document.querySelectorAll(s)]; } catch { return []; } };
  dupIdResolves = hit(sa).length === 1 && hit(sa)[0] === els[0] &&
                  hit(sb).length === 1 && hit(sb)[0] === els[1];
  // The ordinary page must be untouched: a genuinely unique id is still the
  // best selector there is.
  uniqueIdKept = S.robustSelector(w.document.getElementById('onlyOne')) === '#onlyOne';
}

// ── The accordion: detection has to hand the mapping the right inputs ───────
//
// The CASES entry above proves the mapping machinery has always handled an
// accordion correctly WHEN GIVEN the header as primary and a contentSelector.
// It never got them. Detection points at the container — the element carrying
// the `accordion` class — and contentSelector is required, so what was built
// was fix.accordion('#faqPanel', { headerSelector: '#faqPanel' }) with no
// content. Nothing about that could work.
let accHeader = false, accContent = false, accLevel = false, accFromTrigger = false, accWired = false;
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><body>
    <div class="accordion" id="faqPanel">
      <div class="accordion__item">
        <h3><button class="accordion__trigger" data-controls="faqBody-0">Return window?</button></h3>
        <div class="accordion__panel" id="faqBody-0">30 days.</div>
      </div>
      <div class="accordion__item">
        <h3><button class="accordion__trigger" data-controls="faqBody-1">Cost?</button></h3>
        <div class="accordion__panel" id="faqBody-1" hidden>No.</div>
      </div>
    </div></body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return this.hasAttribute('hidden')
      ? { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }
      : { width: 300, height: 40, top: 20, left: 10, bottom: 60, right: 310 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetHeight',
    { get() { return this.hasAttribute('hidden') ? 0 : 40; }, configurable: true });
  w.eval(INTEL);

  const shape = w.__u1SelectorIntel.accordionShape('#faqPanel');
  // The header, not the container. This is the whole bug.
  accHeader = !!shape && shape.headerSelector === '.accordion__trigger';
  // Required by the schema, supplied by nobody until now.
  accContent = !!shape && shape.contentSelector === '.accordion__panel';
  // From the wrapping <h3>, not a default.
  accLevel = !!shape && shape.headingLevel === '3';
  // A person or a model may point at either end of it.
  const fromTrigger = w.__u1SelectorIntel.accordionShape('.accordion__trigger');
  accFromTrigger = !!fromTrigger && fromTrigger.headerSelector === shape.headerSelector;

  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  accWired = /row\.type === 'accordion'/.test(panelSrc) &&
             /if \(accShape\) row\.sel = accShape\.headerSelector;/.test(panelSrc) &&
             /out\.primary = accShape\.headerSelector;/.test(panelSrc);
}

// ── The page's names have to survive the whole chain ────────────────────────
//
// collectCandidates reports them, collectRegion has to pass them on, and the
// merged context has to keep them — a break anywhere and checkAiSelector is
// back to judging by the selectors it emitted, which is what refused `.tab-bar`.
let chainOk = false, cbShapeOk = false, cbNoFalse = false, cbWired = false, dlOk = false;
{
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const intelSrc = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  chainOk =
    /tokens: \[\.\.\.pageTokens\]/.test(intelSrc) &&
    (panelSrc.match(/tokens: context\.tokens \|\| \[\]/g) || []).length >= 2 &&
    /const mergedContext = \{ candidates: collected\.candidates, tokens: collected\.tokens \|\| \[\] \};/.test(panelSrc) &&
    /for \(const t of \(context\.tokens \|\| \[\]\)\) knownTokens\.add\(t\);/.test(panelSrc);

  // An autocomplete has no class pattern, no role path and no probe verdict —
  // it is found by SHAPE: a text input with a list of options beside it.
  const dom = new JSDOM(`<!doctype html><body>
    <div class="search-box" id="siteSearch">
      <input id="q" type="text">
      <ul class="search-suggestions"><li class="suggestion">A</li><li class="suggestion">B</li></ul>
    </div>
    <footer><a id="faraway" href="/x">Unrelated</a></footer>
    <form id="plain"><input id="name" type="text"><button>Go</button></form></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.HTMLElement.prototype.getBoundingClientRect =
    () => ({ width: 300, height: 40, top: 20, left: 10, bottom: 60, right: 310 });
  w.eval(intelSrc);
  const S = w.__u1SelectorIntel;
  const want = { combobox: '#siteSearch', textbox: '#q', listbox: '.search-suggestions', options: '.suggestion' };
  const same = (r) => !!r && Object.keys(want).every((k) => r[k] === want[k]);
  cbShapeOk = ['#siteSearch', '#q', '.search-suggestions'].every((from) => same(S.comboboxShape(from)));
  // Climbing six levels from anything must not report an autocomplete that is
  // somewhere else on the page.
  cbNoFalse = ['#faraway', '#plain', '#name'].every((from) => S.comboboxShape(from) === null);

  // Found on the real shop page: a header search field with no list of its own
  // paired with an unrelated util-bar list four sections away, reported as
  // `combobox: body`. A wrapper that large is not a component, it is the page.
  const wide = new JSDOM(`<!doctype html><body>
    <div class="util-bar"><ul class="util-bar__list--start"><li><a href="/a">Track</a></li>
      <li><a href="/b">Returns</a></li></ul></div>
    <header><input id="searchInput" type="search"></header></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  wide.window.HTMLElement.prototype.getBoundingClientRect =
    () => ({ width: 300, height: 40, top: 20, left: 10, bottom: 60, right: 310 });
  wide.window.eval(intelSrc);
  cbNoFalse = cbNoFalse &&
    wide.window.__u1SelectorIntel.comboboxShape('#searchInput') === null;

  cbWired = /row\.type === 'combobox'/.test(panelSrc) &&
            /if \(cbShape\) row\.sel = cbShape\.combobox;/.test(panelSrc) &&
            /out\.primary = cbShape\.combobox;/.test(panelSrc);
  dlOk = /function attachSelectorSuggestions\(form, ctx\)/.test(panelSrc) &&
         /inp\.setAttribute\('list', id\);/.test(panelSrc) &&
         /attachSelectorSuggestions\(form, \(aiFound && aiFound\.context\) \|\| null\);/.test(panelSrc);
}

// ── Simple components must not wait on a model that has nothing to say ──────
//
// A link is `selectors: { element: PRIMARY }`. There is no second selector to
// work out and no state to name — the mapping is entirely determined by the
// selector already in hand, and it was still sending a page of markup and
// waiting on the reply. On the shop page that is 16 of 24.
let fastSimple = false, fastComplex = false, fastWired = false, fastLevel = false;
{
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(
    /const COMPONENT_SCHEMAS = \{[\s\S]*?\n\};/.exec(panelSrc)[0] +
    /function needsModelToMap\(type\)[\s\S]*?\n\}/.exec(panelSrc)[0], ctx);
  const need = vm.runInContext('needsModelToMap', ctx);

  fastSimple = ['link', 'heading', 'button', 'loading'].every((t) => !need(t));
  // The line that must not move: a component with real parts to find still
  // asks. A dialog's closeBtn and a tooltip's trigger are "(Optional)" to U1
  // and not optional to the person using it.
  fastComplex = ['menu', 'tabs', 'accordion', 'carousel', 'combobox', 'form',
                 'dialog', 'tooltip', 'listbox', 'datepicker'].every((t) => need(t));
  fastWired = /if \(!needsModelToMap\(row\.type\)\) \{/.test(panelSrc) &&
              /no model call\.`\]/.test(panelSrc);
  // The one measurable extra a heading needs.
  fastLevel = /row\.type === 'heading'/.test(panelSrc) &&
              /el\.tagName\.match\(\/\^H\(\\d\)\$\/\)/.test(panelSrc);
}

// ── The per-component rules must stay in step with the schema ───────────────
//
// component-rules.md is fed to the model when it works out a mapping's
// selectors. Rules that name a field the builder does not accept, or a
// component the file has never heard of, are worse than no rules: they produce
// confident answers the builder then drops.
let rulesEveryType = [], rulesUnknownFields = [], rulesShipped = false, rulesUsed = false;
{
  const md = readFileSync(join(ROOT, 'component-rules.md'), 'utf8');
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(/const COMPONENT_SCHEMAS = \{[\s\S]*?\n\};/.exec(panelSrc)[0], ctx);
  const schemas = vm.runInContext('COMPONENT_SCHEMAS', ctx);

  const sections = {};
  for (const m of md.matchAll(/^## (.+)$/gm)) {
    const body = md.slice(m.index).split(/\n## /)[0];
    for (const name of m[1].split(/,| and /).map((x) => x.trim())) sections[name] = body;
  }

  // Every mappable type a person can pick has to be covered.
  const SKIP = new Set(['aria-label', 'keyboard-grid', 'keyboard-clickable', 'keyboard-tabs', 'loading']);
  // Sections that describe a PATTERN rather than a u1.fix.* type. They are
  // named here so a new one cannot be added without a decision — a section
  // matching no schema is otherwise checked by nothing.
  const PATTERNS = new Set([
    'filter with live results — NOT a combobox',
    // Policy, not a type: when NOT to map something. A native <a>/<button>
    // already carries the role, so declaring it adds nothing perceivable and
    // fills the drawer and the client's report with work that was never work.
    'Never map a tag that already is what you would declare',
    // Also policy. u1.fix.form requires `invalidField`, the class the page puts
    // on a rejected field — which does not exist until somebody submits a bad
    // form, so it cannot be read from markup, and inventing a plausible one
    // ships a mapping that looks complete and does nothing. There IS a `form`
    // section below this one carrying the real field rules.
    'form — not mapped',
  ]);
  for (const name of Object.keys(sections)) {
    if (PATTERNS.has(name) || schemas[name]) continue;
    if (!/^The rules that hold/.test(name)) rulesUnknownFields.push(`section "${name}" matches no component`);
  }
  rulesEveryType = Object.keys(schemas).filter((t) => !SKIP.has(t) && !sections[t]);

  // And every field name the file mentions in backticks has to be real.
  for (const [name, body] of Object.entries(sections)) {
    const sc = schemas[name];
    if (!sc) continue;
    const known = new Set([...Object.keys(sc.selectors || {}), ...(sc.fields || []),
                           ...Object.keys(sc.rootFields || {})]);
    for (const t of body.matchAll(/^- `([a-zA-Z]+)`/gm)) {
      if (!known.has(t[1])) rulesUnknownFields.push(`${name}.${t[1]}`);
    }
  }

  rulesShipped = /'component-rules\.md'/.test(readFileSync(join(ROOT, 'scripts/build.mjs'), 'utf8'));
  const adv = readFileSync(join(ROOT, 'ai-advisor.js'), 'utf8');
  rulesUsed = /mapRulesText = await readRules\('component-rules\.md'\)/.test(adv) &&
              /system: MAP_PROMPT \+ \(rules \? /.test(adv);
}

// ── A required selector may not be missing ──────────────────────────────────
//
// This shipped to a client:
//   fix.tabs("#dealTab-week", { selectors: { tab: ".tab-bar__btn",
//                                            tabList: "#dealTab-week" } })
// tabPanel is required and absent, tabList is a single BUTTON. u1 decorates
// nothing and reports nothing, while the drawer says the strip is mapped.
//
// validateMapping existed and was reachable from one place — the manual form.
// Every other route went past it.
let reqEnforced = false, reqAtTheFunnel = false, reqNamesThem = false, reqSkipsCustom = false;
{
  const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const save = /async function saveMappingEntry\([\s\S]*?\n  const narrowed = await narrowContained\(template\);/.exec(panelSrc);
  reqAtTheFunnel = !!save;
  reqEnforced = !!save && /\(sc\.req \|\| \[\]\)\.filter/.test(save[0]) && /throw new Error\(/.test(save[0]);
  reqNamesThem = !!save && /missing\.join\(' and '\)/.test(save[0]);
  // A staticFix has no schema and no required selectors; it must still save.
  reqSkipsCustom = !!save && /template\.type && !template\.custom/.test(save[0]);
}

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
console.log(`  ${overwritten ? '✅' : '❌'} "overwrite the site's role" actually removes it before u1.fix runs`);
if (!overwritten) failed++;
console.log(`  ${selTokens ? '✅' : '❌'} the collector reports the names on the page, not only the ones it emitted`);
if (!selTokens) failed++;
console.log(`  ${selReal ? '✅' : '❌'} a class that IS on the page is accepted (.tab-bar under an id'd element)`);
if (!selReal) failed++;
console.log(`  ${selNear ? '✅' : '❌'} …a typo is refused AND told the real one (.tab-barr → .tab-bar)`);
if (!selNear) failed++;
console.log(`  ${selNoGuess ? '✅' : '❌'} …and a name near nothing is refused without a made-up suggestion`);
if (!selNoGuess) failed++;
// The inventory is not the page: a dialog scanned while open carries classes
// no collected candidate has, and "invented" fired on the same card whose own
// 👁 said "1 match — highlighted on the page".
const selReprieve = (() => {
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const pass = /includes\('invented'\)[\s\S]{0,700}countSelectors\(sels\)[\s\S]{0,500}go\.disabled = false;/.test(src);
  const notForInvalid = /never reprieved/.test(src) &&
    /\.textContent \|\| ''\)\.includes\('invented'\)/.test(src);
  return pass && notForInvalid;
})();
console.log(`  ${selReprieve ? '✅' : '❌'} …but a selector the PAGE resolves is reprieved — the page outranks the inventory`);
if (!selReprieve) failed++;

// ── A dialog is not its own trigger ─────────────────────────────────────────
// `firstArgFrom:'trigger'` says only which selector becomes fix()'s FIRST
// ARGUMENT — "the element to wait for". Reading it as "the found element IS
// the trigger" inverted every dialog: point at the modal, name its opener, and
// out came fix.dialog({ dialog: <the opener>, trigger: <the modal> }).
const dialogNotInverted = (() => {
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const fn = /function rowFromParts\(\{[\s\S]*?\n\}/.exec(src)[0];
  // The swap must key on whether the trigger is REQUIRED, not on firstArgFrom.
  const keyedRight = /const swap = triggerRequired\(type\) && !!container;/.test(fn) &&
                     !/const swap = triggerFirstType\(type\)/.test(fn);
  // datepicker and listbox require one and do mean the found element is it;
  // dialog's is optional and does not.
  const schemas = /const COMPONENT_SCHEMAS = \{[\s\S]*?\n\};/.exec(src)[0];
  const dlg = /\n  dialog: \{[\s\S]*?\n  \},/.exec(schemas)[0];
  const dialogTriggerOptional = /req:\['dialog'\]/.test(dlg);
  // The hint under the field has to promise the same arrangement the swap
  // actually builds, or it describes the opposite mapping.
  const hintAgrees = /hint\.textContent = required/.test(src);
  return keyedRight && dialogTriggerOptional && hintAgrees;
})();
console.log(`  ${dialogNotInverted ? '✅' : '❌'} a dialog is rooted on the dialog, never swapped with its trigger`);
if (!dialogNotInverted) failed++;

// ── A dialog ships with something bound to close it ─────────────────────────
// closeBtn is optional in the schema, so the model treated it as optional in
// fact — and "leave a field out rather than guess" made omitting it the
// safe-looking answer every time.
let dlgClose = false, dlgCloseFills = false, dlgCloseNoOverrule = false;
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><body>
    <div id="modal" class="modal">
      <h2 class="modal-title">Choose a State</h2>
      <button class="btn-close" aria-label="Close this dialog">×</button>
      <a href="/x">Not the close button</a>
    </div></body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.HTMLElement.prototype.getBoundingClientRect =
    () => ({ width: 300, height: 40, top: 20, left: 10, bottom: 60, right: 310 });
  w.eval(INTEL);
  const shape = w.__u1SelectorIntel.dialogShape('#modal');
  dlgClose = !!shape && !!shape.closeBtn && !!shape.heading &&
             w.document.querySelector(shape.closeBtn) === w.document.querySelector('.btn-close') &&
             w.document.querySelector(shape.heading) === w.document.querySelector('.modal-title');
  // A dialog with genuinely nothing to close it is a real state, and must not
  // be given a made-up selector.
  const bare = new JSDOM(`<!doctype html><body><div id="m"><p>no controls here</p></div></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  bare.window.HTMLElement.prototype.getBoundingClientRect =
    () => ({ width: 300, height: 40, top: 20, left: 10, bottom: 60, right: 310 });
  bare.window.eval(INTEL);
  dlgCloseNoOverrule = bare.window.__u1SelectorIntel.dialogShape('#m') === null;

  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  dlgCloseFills = /dlgShape = await inPage\(tab\.id, \(s\) => window\.__u1SelectorIntel\.dialogShape\(s\)/.test(src) &&
    // Fills only what was left empty — a close control the model DID find is
    // the same kind of evidence, so it is not overruled.
    /const had = \(out\.fields \|\| \[\]\)\.find\(\(f\) => f\.key === key && String\(f\.value \|\| ''\)\.trim\(\)\);\s*\n\s*if \(had\) continue;/.test(src);
}
console.log(`  ${dlgClose ? '✅' : '❌'} a dialog's close button and heading are measured off the markup, not asked for`);
if (!dlgClose) failed++;
console.log(`  ${dlgCloseNoOverrule ? '✅' : '❌'} …and a dialog with no closing control is left alone, not given one`);
if (!dlgCloseNoOverrule) failed++;
console.log(`  ${dlgCloseFills ? '✅' : '❌'} …filling only what the model left empty, never overruling a real answer`);
if (!dlgCloseFills) failed++;

// ── Reading back a U1 deployment somebody else wrote ────────────────────────
//
// A site we are engaged on has often had U1 on it for months. Its effect is
// visible in the DOM (u1_menu_link, u1st-* ids) but what was ASKED for was
// not, so the only way to work with it was to guess the original call. The
// patch now records every u1.fix.* the page runs, and background.js injects
// that patch at document_start in the MAIN world — before the site's own U1 —
// so the record is the site's real arguments, not a reconstruction.
let recRecords = false, recAllTypes = false, recHarmless = false, recConverts = false, recDropsUnknown = false;
{
  const patch = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');

  // Recorded over EVERY fixer, not folded into PER_MATCH — that list is seven
  // types and `menu` is not one of them, which is the very component that
  // prompted this. Recording is orthogonal to correcting.
  const perMatch = /var PER_MATCH = \[([^\]]*)\]/.exec(patch)[1];
  recAllTypes = !/'menu'/.test(perMatch) &&
                /Object\.keys\(u1\.fix\)\.forEach/.test(patch) &&
                /P\.calls\.push\(\{/.test(patch);
  recRecords = /type: name,/.test(patch) && /selector: selector,/.test(patch) &&
               /props: JSON\.parse\(JSON\.stringify\(props === undefined \? \{\} : props\)\)/.test(patch);
  // It only observes: the original is called with `arguments` untouched, and a
  // throw in the recorder must never take the site's own fix down.
  recHarmless = /try \{[\s\S]{0,600}\} catch \(e\) \{\}\s*\n\s*return inner\.apply\(this, arguments\);/.test(patch);

  // A recorded call becomes the mapping the builder would have produced.
  const dom = new JSDOM('<!doctype html><body></body>');
  const w = dom.window;
  const recorded = [
    { type: 'menu', selector: '.elementor-nav-menu',
      props: { selectors: { items: '.u1_menu_link', submenus: '.u1_submenu_con' }, menubar: false } },
    { type: 'dialog', selector: '.modal', props: { selectors: { closeBtn: '.close' } } },
  ];
  const isInternalFn = new Function(
    /\nfunction isU1InternalSelector[\s\S]*?\n\}/.exec(panelSrc)[0] +
    '; return isU1InternalSelector;')();
  const conv = new Function('COMPONENT_SCHEMAS', 'buildTemplate', 'primaryKeyOf', 'isU1InternalSelector',
    /\nfunction mappingFromRecordedCall\([\s\S]*?\n\}/.exec(panelSrc)[0] +
    '; return mappingFromRecordedCall;')(COMPONENT_SCHEMAS, buildTemplate, primaryKeyOf, isInternalFn);

  const menu = conv(recorded[0]);
  const dlg = conv(recorded[1]);
  recConverts =
    !!menu && menu.type === 'menu' && menu.primary === '.elementor-nav-menu' &&
    menu.config.selectors.items === '.u1_menu_link' &&
    menu.config.selectors.submenus === '.u1_submenu_con' &&
    menu.config.menubar === false &&                       // a root option survives
    !!dlg && dlg.config.selectors.dialog === '.modal' &&   // the primary is filled in
    dlg.config.selectors.closeBtn === '.close';
  // The library has fixers this build does not model. A mapping that cannot be
  // rebuilt cannot be exported, edited or verified, so it is dropped rather
  // than half-adopted.
  recDropsUnknown = conv({ type: 'notathing', selector: '.z', props: {} }) === null;

  // Adopting goes through the ONE save path, so an adopted mapping meets the
  // same required-field refusal and role question as a hand-built one. A
  // recorded call is evidence of what the site asked for, not proof it was right.
  const adopts = /closest\('#adoptExistingBtn'\)[\s\S]{0,1200}saveMappingEntry\(tpl, \{ refreshUi: false \}\)/.test(panelSrc);
  if (!adopts) recConverts = false;
}
console.log(`  ${recRecords ? '✅' : '❌'} the patch records every fix the SITE runs — type, selector and props`);
if (!recRecords) failed++;
console.log(`  ${recAllTypes ? '✅' : '❌'} …over every fixer, not just PER_MATCH, which does not include menu`);
if (!recAllTypes) failed++;
console.log(`  ${recHarmless ? '✅' : '❌'} …observing only: the site's own fix still runs, and a throw here cannot stop it`);
if (!recHarmless) failed++;
console.log(`  ${recConverts ? '✅' : '❌'} …and a recorded call becomes a real mapping, adopted through the one save path`);
if (!recConverts) failed++;
console.log(`  ${recDropsUnknown ? '✅' : '❌'} …while a fixer this build cannot rebuild is dropped, not half-adopted`);
if (!recDropsUnknown) failed++;

// ── U1 scanning for its OWN markers is not a deployment ─────────────────────
//
// The library bootstraps by calling fix.checkbox('[u1-checkbox]'),
// fix.tabs('[u1-tabs]') and so on for every type. The first run of adopt took
// that for a deployment and saved 21 empty mappings, one per component type.
// A site's own fix points at the SITE's markup; pointing one at a marker the
// library adds to itself would be circular, so the primary tells them apart.
let junkFiltered = false, junkKeepsReal = false, junkCleansUp = false;
{
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const isInternal = new Function(
    /\nfunction isU1InternalSelector[\s\S]*?\n\}/.exec(src)[0] +
    '; return isU1InternalSelector;')();
  // Every scaffolding selector seen in the real run.
  junkFiltered = ['[u1-checkbox]', '[u1-radio]', '[u1-grid]', '[u1-tabs]', '[u1-form]',
                  '[u1-menu]', '[u1-listbox]', '[u1-carousel]', '[u1-pagination]',
                  '.u1_Datepicker_trigger', '#u1st-abc'].every(isInternal);
  // And nothing a person would write.
  junkKeepsReal = ['.elementor-nav-menu', '.modal', '#site-header', 'a.x',
                   '.elementor-widget-container>p', 'main#main'].every((v) => !isInternal(v));
  const conv = new Function('COMPONENT_SCHEMAS', 'buildTemplate', 'primaryKeyOf', 'isU1InternalSelector',
    /\nfunction mappingFromRecordedCall\([\s\S]*?\n\}/.exec(src)[0] +
    '; return mappingFromRecordedCall;')(COMPONENT_SCHEMAS, buildTemplate, primaryKeyOf, isInternal);
  const refused = conv({ type: 'checkbox', selector: '[u1-checkbox]', props: {} }) === null;
  // Only the PRIMARY is judged — a menu's items really can be .u1_menu_link
  // once the library has run, and that must not disqualify the mapping.
  const fieldOk = !!conv({ type: 'menu', selector: '.elementor-nav-menu',
                           props: { selectors: { items: '.u1_menu_link' } } });
  junkFiltered = junkFiltered && refused && fieldOk;
  // The ones already saved before the filter existed have to be cleared, since
  // a mapping does not remove itself.
  junkCleansUp = /async function migrateDropU1Internal\(host\)/.test(src) &&
                 /isU1InternalSelector\(m\.primary\)/.test(src) &&
                 /await migrateDropU1Internal\(currentHostname\)/.test(src);
}
console.log(`  ${junkFiltered ? '✅' : '❌'} U1's own bootstrap scan is not adopted as if it were a deployment`);
if (!junkFiltered) failed++;
console.log(`  ${junkKeepsReal ? '✅' : '❌'} …while a selector a person would actually write is kept`);
if (!junkKeepsReal) failed++;
console.log(`  ${junkCleansUp ? '✅' : '❌'} …and the ones already saved before the filter are cleared out`);
if (!junkCleansUp) failed++;

// ── A U1 deployment is per PAGE, not per site ───────────────────────────────
//
// tamam.co.il's home page runs a menu; its Aviation Catering page runs a form,
// a menu and a carousel. Walking the site is how the full picture is
// collected — so every page has to be looked at, including one on the same
// host. loadMappingsList lives inside the hostnameChanged branch, so moving
// between two pages of one site never re-checked, and the offer went stale.
let rescansEveryPage = false, rescansAfterSettling = false;
{
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const fn = /async function onTabChanged\(tab\) \{[\s\S]*?\n\}/.exec(src)[0];
  // Outside the hostnameChanged branch — that branch is the one that misses a
  // same-site navigation entirely.
  const branch = /if \(hostnameChanged\) \{[\s\S]*?\n  \}/.exec(fn)[0];
  rescansEveryPage = /renderExistingFixes\(\);/.test(fn) &&
                     !/renderExistingFixes\(\)/.test(branch);
  // The library's own fixes land as the page settles, so `complete` alone is
  // often a fraction early — an offer that appears empty and fills in later
  // reads as the tool having missed things.
  rescansAfterSettling =
    /setTimeout\(async \(\) => \{[\s\S]{0,200}renderExistingFixes\(\);[\s\S]{0,60}\}, 2000\);/.test(fn);
}
console.log(`  ${rescansEveryPage ? '✅' : '❌'} the offer is re-read on every page, not only when the SITE changes`);
if (!rescansEveryPage) failed++;
console.log(`  ${rescansAfterSettling ? '✅' : '❌'} …and again once the page has settled, since fixes land after "complete"`);
if (!rescansAfterSettling) failed++;

// ── A selector the ENGINE cannot use must not be saveable ───────────────────
//
// U1 resolves through jQuery, which refuses a pseudo-class SILENTLY — the fix
// never applies and nothing says so, so the mapping looks finished in the
// drawer, ships in the export, and decorates nothing forever. From
// tamam.co.il: a heading rooted on
//   .elementor-widget-text-editor>.elementor-widget-container>p:last-of-type
// saved cleanly and did nothing. isU1ValidSelector existed all along; the AI
// route called it and the manual builder never did.
let engineRefuses = false, engineChecksFields = false, engineAllowsGood = false;
{
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const fn = /\nasync function saveMappingEntry\([\s\S]*?\n\}/.exec(src);
  const body = fn ? fn[0] : src;
  engineRefuses = /if \(template\.primary && !isU1ValidSelector\(template\.primary\)\)/.test(src) &&
                  /U1 cannot use \$\{bad\.length === 1 \? 'this selector' : 'these selectors'\}/.test(src) &&
                  /refuses them SILENTLY/.test(src);
  // Not only the primary: a sub-selector with a pseudo-class fails the same
  // silent way, and a mapping half of which never runs is no better.
  engineChecksFields = /for \(const \[k, v\] of Object\.entries\(sels\)\)[\s\S]{0,200}!isU1ValidSelector\(v\)/.test(src);
  // The validator itself agrees about the real case.
  const isValid = isU1ValidSelector;
  engineAllowsGood =
    !isValid('.elementor-widget-text-editor>.elementor-widget-container>p:last-of-type') &&
    !isValid('.a .b') &&                       // a descendant space is refused too
    isValid('.elementor-slides>.swiper-slide') &&
    isValid('#menu-1-a35013c') &&
    isValid('.a,.b');
}
console.log(`  ${engineRefuses ? '✅' : '❌'} a selector U1 cannot resolve is refused at save, not shipped to fail silently`);
if (!engineRefuses) failed++;
console.log(`  ${engineChecksFields ? '✅' : '❌'} …sub-selectors too, since half a mapping that never runs is no better`);
if (!engineChecksFields) failed++;
console.log(`  ${engineAllowsGood ? '✅' : '❌'} …while > + ~ , and plain compounds still pass`);
if (!engineAllowsGood) failed++;

// ── The two validators must not disagree ────────────────────────────────────
//
// There are two: selector-intel's isU1Valid and panel.js's isU1ValidSelector.
// The panel's had no pseudo check at all — it matched the SHAPE of a compound
// and never looked inside it — so :last-of-type was refused by one and waved
// through by the other, and the permissive one was the one guarding the save.
// A check that passes in the panel and fails in the field is the worst
// outcome available, so they are held to the same answer here.
let validatorsAgree = false;
{
  const dom = new JSDOM('<!doctype html><body></body>',
    { runScripts: 'outside-only', url: 'https://x.test/' });
  dom.window.eval(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8'));
  const intel = dom.window.__u1SelectorIntel.isU1Valid;
  const cases = [
    '.a:last-of-type', '.a:hover', '.a::before', 'p:nth-of-type(2)',
    'li:first-child>a', '.a:not(.b)', '.a .b', '.a>.b', '.a,.b',
    '#id', 'div[data-x="1"]', '.elementor-slides>.swiper-slide',
    '.elementor-widget-text-editor>.elementor-widget-container>p:last-of-type',
  ];
  const differ = cases.filter((c) => intel(c) !== isU1ValidSelector(c));
  validatorsAgree = differ.length === 0;
  if (differ.length) console.log('    (they differ on: ' + differ.join(', ') + ')');
}
console.log(`  ${validatorsAgree ? '✅' : '❌'} …and the panel's validator answers exactly as selector-intel's does`);
if (!validatorsAgree) failed++;

// ── A stage's messages must land in that stage ──────────────────────────────
//
// Reported as "I press Approve & apply and nothing happens". It was not doing
// nothing: the card was a form with no invalidField, the save refused it — and
// the sentence saying so was written to #aiMapStatus, which lives inside
// #aiResults, which setStage('cards') had set to display:none. A correct
// refusal, painted where nobody could read it.
let stageStatusScoped = false, cardStatusExists = false, refusalSaysWhy = false;
{
  const html = readFileSync(join(ROOT, 'panel.html'), 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const inResults = doc.getElementById('aiResults');
  const inCards = doc.getElementById('aiMappings');
  const cardStatus = doc.getElementById('aiCardStatus');
  // The cards stage has a line of its own, and it is INSIDE the cards stage.
  cardStatusExists = !!cardStatus && inCards.contains(cardStatus) &&
                     !inResults.contains(cardStatus);
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  // The card handler and the bulk finish both address the stage on screen.
  stageStatusScoped = /function stageStatusEl\(\)/.test(src) &&
    /cards: 'aiCardStatus'/.test(src) &&
    /const save = e\.target\.closest\('\[data-savecard\]'\);[\s\S]{0,900}const status = stageStatusEl\(\);/.test(src) &&
    // …and the bulk one AFTER setStage, since resumeStage picks the stage.
    /setStage\(resumeStage\(\)\);[\s\S]{0,300}showNotice\(stageStatusEl\(\)/.test(src);
  // The refusal itself has to name the fields and say what saving anyway would
  // produce — "invalid" alone sends people hunting through eight selectors.
  refusalSaysWhy = /it would decorate nothing and say nothing/.test(src) &&
                   /needs \$\{missing\.join\(' and '\)\}/.test(src);
}
console.log(`  ${cardStatusExists ? '✅' : '❌'} the cards stage has its own status line, inside the cards stage`);
if (!cardStatusExists) failed++;
console.log(`  ${stageStatusScoped ? '✅' : '❌'} …and messages go to the stage on screen, not into a hidden container`);
if (!stageStatusScoped) failed++;
console.log(`  ${refusalSaysWhy ? '✅' : '❌'} …so a refused save names the empty required fields and why it refused`);
if (!refusalSaysWhy) failed++;

// ── Inline links in prose ───────────────────────────────────────────────────
//
// The markup below is verbatim from tamam.co.il. Reported as "the screen reader
// reads all the links together", and the cause is in the last two: between
// `כשרות</a>` and the next `<a>` there is not one character, so JAWS and NVDA
// run them into a single link and two separate documents are heard as one. The
// other three have commas and are fine.
//
// The whole point of the fix is that it changes NOTHING VISIBLE — a hard
// requirement from the client, not a preference — so that is asserted as
// firmly as the repair itself.
const TAMAM = `<p>אנו בת.מ.מ פועלים בפיקוח משרד הבריאות <a href="/a/HACCP.pdf" target="_blank" rel="noopener">HACCP</a>, ` +
  `<a href="/a/iso.pdf" target="_blank" rel="noopener">ISO 9001</a> ,` +
  `<a href="/a/GMP.pdf" target="_blank" rel="noopener">GMP</a> וכן ` +
  `<a href="/a/kosher.jpg" target="_blank" rel="noopener">תעודת כשרות</a>` +
  `<a href="/a/license.pdf" target="_blank" rel="noopener"> ורישיון יצרן.</a></p>`;

let llBuilt = false, llParted = false, llNamed = false, llInvisible = false,
    llLeavesGoodAlone = false, llIdempotent = false, llNoGuess = false;
{
  const tpl = buildTemplate('link-list', 'p', {}, {
    separate: true, separator: ', ', fileWord: 'קובץ %s', newTabWord: 'נפתח בלשונית חדשה',
  });
  llBuilt = !!tpl && tpl.custom === 'linkList' && tpl.primary === 'p' &&
            /__u1FixLinkListFromMapping/.test(tpl.code);

  const dom = new JSDOM(`<!doctype html><body>${TAMAM}</body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://www.tamam.co.il/' });
  const w = dom.window;
  w.requestAnimationFrame = (f) => setTimeout(f, 0);
  const seenBefore = w.document.querySelector('p').textContent;
  w.eval(readFileSync(join(ROOT, 'grid-nav.js'), 'utf8'));
  // The template's OWN generated code, not a hand-written call — so this
  // proves the path a specialist actually gets, builder included.
  w.eval(tpl.code);

  const links = [...w.document.querySelectorAll('a')];
  const nameOf = (a) => a.getAttribute('aria-label') || a.textContent;

  // 1. The two that touched are parted, and ONLY those two.
  const seps = [...w.document.querySelectorAll('span[__u1LinkListSep]')];
  // The separator has to sit BETWEEN the two anchors that touched — inserting
  // one somewhere else would score the same on a count and fix nothing.
  llParted = seps.length === 1 &&
    links[4].previousSibling === seps[0] &&
    seps[0].previousSibling === links[3] &&
    /,/.test(seps[0].textContent);
  // The three with commas of their own must not have collected a second one.
  llLeavesGoodAlone = !/,\s*,/.test(w.document.querySelector('p').textContent);

  // 2 & 3. Each link says its own type and that it opens a new tab.
  llNamed =
    nameOf(links[0]) === 'HACCP (קובץ PDF, נפתח בלשונית חדשה)' &&
    nameOf(links[3]) === 'תעודת כשרות (קובץ JPG, נפתח בלשונית חדשה)' &&
    // The leading space and the sentence's full stop come off the name.
    nameOf(links[4]) === 'ורישיון יצרן. (קובץ PDF, נפתח בלשונית חדשה)';

  // NOTHING VISIBLE MAY CHANGE. display:none and visibility:hidden would also
  // hide the separator from the accessibility tree, which is the one thing it
  // exists to be in — so it must be CLIPPED, and nothing else may be touched.
  llInvisible = seps.length > 0 &&
    seps.every((s) => {
      const st = s.getAttribute('style') || '';
      return /clip-path:\s*inset\(50%\)/.test(st) &&
             !/display:\s*none/.test(st) && !/visibility:\s*hidden/.test(st);
    }) &&
    // No style was put on the links themselves, and the paragraph's own text
    // is byte-for-byte what it was once the clipped separators are discounted
    // — they are the only thing added, and they are not on screen.
    links.every((a) => !a.getAttribute('style')) &&
    (() => {
      const copy = w.document.querySelector('p').cloneNode(true);
      copy.querySelectorAll('span[__u1LinkListSep]').forEach((s) => s.remove());
      return copy.textContent === seenBefore;
    })();

  // Applying twice must not stack a second separator or a second "(PDF…)".
  w.eval(tpl.code);
  llIdempotent =
    [...w.document.querySelectorAll('span[__u1LinkListSep]')].length === 1 &&
    nameOf(w.document.querySelectorAll('a')[0]) === 'HACCP (קובץ PDF, נפתח בלשונית חדשה)';

  // A URL that does not plainly name a file type must not be given one — a
  // guess about what a URL serves is the confident-wrong-answer failure mode.
  const d2 = new JSDOM(`<!doctype html><body><p><a href="/reports?id=7">Report</a>` +
    `<a href="/about/">About</a></p></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  d2.window.requestAnimationFrame = (f) => setTimeout(f, 0);
  d2.window.eval(readFileSync(join(ROOT, 'grid-nav.js'), 'utf8'));
  d2.window.eval(tpl.code);
  llNoGuess = [...d2.window.document.querySelectorAll('a')]
    .every((a) => !/קובץ/.test(a.getAttribute('aria-label') || ''));
}
console.log(`  ${llBuilt ? '✅' : '❌'} link-list builds a runnable mapping from the container alone`);
if (!llBuilt) failed++;
console.log(`  ${llParted ? '✅' : '❌'} …two links that TOUCH are parted, which is what "reads them all together" is`);
if (!llParted) failed++;
console.log(`  ${llLeavesGoodAlone ? '✅' : '❌'} …while links already separated by a comma are left alone`);
if (!llLeavesGoodAlone) failed++;
console.log(`  ${llNamed ? '✅' : '❌'} …each link says its file type and that it opens a new tab, in the page's language`);
if (!llNamed) failed++;
console.log(`  ${llNoGuess ? '✅' : '❌'} …and a URL that names no file type is not given one`);
if (!llNoGuess) failed++;
console.log(`  ${llInvisible ? '✅' : '❌'} …changing NOTHING visible: the separator is clipped, never display:none`);
if (!llInvisible) failed++;
console.log(`  ${llIdempotent ? '✅' : '❌'} …and applying it twice does not stack a second separator or note`);
if (!llIdempotent) failed++;

// ── A skip link with its two fields filled the wrong way round ──────────────
//
// From tamam.co.il. Two of four skip links were stored as
//   { label: '#site-header', selector: 'ראש העמוד' }
//   { label: 'main#main',    selector: 'תוכן המרכזי של העמוד' }
// — selector in the label box, label in the selector box. Nothing caught it,
// because CSS identifiers may be non-ASCII: `ראש העמוד` is VALID CSS meaning
// "element <העמוד> inside element <ראש>". It matched nothing, took the benign
// "not on this page — saved anyway" path, and was stored pointing at an anchor
// that can never be assigned.
let skipSwapCaught = false, skipNoFalsePositive = false, skipGuardWired = false;
{
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const fns = /function looksLikeSelector[\s\S]*?\n\}/.exec(src)[0] +
              /function looksLikeProse[\s\S]*?\n\}/.exec(src)[0];
  const { looksLikeSelector, looksLikeProse } =
    new Function(fns + '; return { looksLikeSelector, looksLikeProse };')();

  // The real swapped pairs must be recognised as swapped.
  const swapped = [['#site-header', 'ראש העמוד'], ['main#main', 'תוכן המרכזי של העמוד']];
  skipSwapCaught = swapped.every(([lab, tgt]) => looksLikeSelector(lab) && looksLikeProse(tgt));

  // …and the CORRECT rows from the very same save must not be touched. A label
  // with spaces is ordinary; refusing those would break every real skip link.
  const fine = [
    ['תפריט ניווט', '.elementor-nav-menu'],
    ['טופס צרו איתנו קשר', '.elementor-form'],
    ['Skip to main content', '#main'],
    ['Menu', 'nav'],                      // one word: ambiguous, so left alone
  ];
  skipNoFalsePositive = fine.every(([lab, tgt]) => !(looksLikeSelector(lab) && looksLikeProse(tgt)));

  // Wired into the save, and only when the "selector" also matches nothing —
  // prose that somehow does match is not a swap, it is a working selector.
  skipGuardWired =
    /if \(looksLikeSelector\(label\) && looksLikeProse\(target\) && queryResult\.count === 0\) \{/.test(src) &&
    /These two look swapped/.test(src) &&
    /hasError = true;[\s\S]{0,40}continue;[\s\S]{0,200}if \(queryResult\.count === 0\) \{/.test(src);
}
console.log(`  ${skipSwapCaught ? '✅' : '❌'} a skip link with label and target swapped is caught before it is saved`);
if (!skipSwapCaught) failed++;
console.log(`  ${skipNoFalsePositive ? '✅' : '❌'} …while the correctly-filled rows beside it are left alone`);
if (!skipNoFalsePositive) failed++;
console.log(`  ${skipGuardWired ? '✅' : '❌'} …and it only fires when the "selector" really does match nothing`);
if (!skipGuardWired) failed++;

// ── A default that must be retyped to take effect is a trap ─────────────────
//
// fileWord and newTabWord shipped as '' with the wording shown only as a
// PLACEHOLDER — grey text that reads exactly like a filled field. On
// tamam.co.il the mapping was created with them looking filled in, applied,
// and the separator went in while not one aria-label did, because empty means
// "skip this". Verified against the live DOM afterwards.
let llRealDefaults = false, llLangAware = false, llClearable = false;
{
  const sc = COMPONENT_SCHEMAS['link-list'];
  llRealDefaults = !!String(sc.rootFields.fileWord || '').trim() &&
                   !!String(sc.rootFields.newTabWord || '').trim() &&
                   sc.rootFields.fileWord.includes('%s');
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  // Spoken to the visitor, so it has to be the visitor's language — and the
  // Config tab already knows which that is.
  const table = /const LINK_NOTE_WORDS = \{[\s\S]*?\n\};/.exec(src);
  llLangAware = !!table &&
    /he: \{ file: 'קובץ %s'/.test(table[0]) &&
    /getElementById\('langSelect'\)/.test(src) &&
    /type === 'link-list' && \(k === 'fileWord' \|\| k === 'newTabWord'\)/.test(src);
  // Every language in the Config dropdown needs an entry, or a site set to it
  // silently falls back to English in the visitor's ear.
  const html = readFileSync(join(ROOT, 'panel.html'), 'utf8');
  const langSel = /<select id="langSelect">([\s\S]*?)<\/select>/.exec(html);
  const langs = langSel ? [...langSel[1].matchAll(/value="([a-z-]+)"/g)].map((m) => m[1]) : [];
  const words = table ? table[0] : '';
  const missing = langs.filter((l) => !new RegExp('\\b' + l + ': \\{').test(words));
  if (missing.length) llLangAware = false;
  // Clearing one is how you switch it off — the placeholder now says so
  // instead of impersonating a value.
  llClearable = /clear this to say nothing about file types/.test(src) &&
                /clear this to say nothing about new tabs/.test(src);
  if (missing.length) console.log('    (languages with no wording: ' + missing.join(', ') + ')');
}
console.log(`  ${llRealDefaults ? '✅' : '❌'} the file/new-tab wording is a real default, not a placeholder that does nothing`);
if (!llRealDefaults) failed++;
console.log(`  ${llLangAware ? '✅' : '❌'} …in the site's own language, for every language Config offers`);
if (!llLangAware) failed++;
console.log(`  ${llClearable ? '✅' : '❌'} …and the placeholder says clearing it is how you switch it off`);
if (!llClearable) failed++;

// ── Pointing at the links instead of the block that holds them ──────────────
// Reported from tamam.co.il: `.elementor-widget-container>p>a` was entered, the
// panel listed five matching links back, and nothing happened — because an <a>
// contains no <a>. It returned ok:true with a soft "wires automatically if they
// appear", which is a failure dressed as a success and worse than an error.
let llRefusesLinks = false, llNamesTheParent = false, llRefusesNothing = false, llManyOk = false;
{
  const d = new JSDOM(`<!doctype html><body><div class="wrap">${TAMAM}</div></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://www.tamam.co.il/' });
  const w = d.window;
  w.requestAnimationFrame = (f) => setTimeout(f, 0);
  w.HTMLElement.prototype.getBoundingClientRect =
    () => ({ width: 300, height: 40, top: 10, left: 10, bottom: 50, right: 310 });
  w.eval(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8'));
  w.eval(readFileSync(join(ROOT, 'grid-nav.js'), 'utf8'));

  const atLinks = w.__u1FixLinkList({ container: '.wrap>p>a' });
  llRefusesLinks = atLinks.ok === false && /not the block around them/.test(atLinks.err || '');
  // Naming the parent matters: without it the same wrong answer gets typed
  // twice, since the field gives no clue which element it wanted.
  llNamesTheParent = /try p\b/.test(atLinks.err || '');
  const atNothing = w.__u1FixLinkList({ container: '.does-not-exist' });
  llRefusesNothing = atNothing.ok === false && /matches nothing/.test(atNothing.err || '');
}
// Several matches is the ORDINARY case for this type — "every paragraph in the
// article" is a good scope — so the primary must not be graded as though it
// were a u1.fix.* selector that resolves exactly one element.
llManyOk = COMPONENT_SCHEMAS['link-list'].primaryMany === true &&
  /unique: !\(schema && schema\.primaryMany\)/.test(readFileSync(join(ROOT, 'panel.js'), 'utf8')) &&
  /const isUnique = \(key\) => \(key === '__primary' \? !many : SINGULAR_FIELDS\.has\(key\)\);/
    .test(readFileSync(join(ROOT, 'panel.js'), 'utf8'));
console.log(`  ${llRefusesLinks ? '✅' : '❌'} …pointing it at the LINKS is refused, not silently reported as done`);
if (!llRefusesLinks) failed++;
console.log(`  ${llNamesTheParent ? '✅' : '❌'} …naming the element that should have been used instead`);
if (!llNamesTheParent) failed++;
console.log(`  ${llRefusesNothing ? '✅' : '❌'} …and a selector matching nothing is refused too`);
if (!llRefusesNothing) failed++;
console.log(`  ${llManyOk ? '✅' : '❌'} …while several paragraphs is NOT warned about — the normal case for this type`);
if (!llManyOk) failed++;

// ── Opening a dialog and pressing "Scan the whole page" ─────────────────────
// That route begins with window.scrollTo(0,0) and walks the page a screenful
// at a time — which is exactly what closes a modal. It then surveys the page
// BEHIND it and reports, truthfully and uselessly, that there was no dialog.
let modalSeen = false, modalClosedIgnored = false, modalWarns = false;
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const mk = (html) => {
    const d = new JSDOM(`<!doctype html><body>${html}</body>`,
      { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
    d.window.HTMLElement.prototype.getBoundingClientRect = function () {
      return this.hasAttribute('data-hidden')
        ? { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }
        : { width: 400, height: 300, top: 20, left: 10, bottom: 320, right: 410 };
    };
    d.window.eval(INTEL);
    return d.window;
  };
  modalSeen = mk('<div id="picker" role="dialog" aria-modal="true">Choose a State</div>')
    .__u1SelectorIntel.openModalNow() === '#picker';
  // Every site ships closed modals in its markup; those are not what this asks.
  modalClosedIgnored =
    mk('<div id="shut" role="dialog" data-hidden>closed</div>').__u1SelectorIntel.openModalNow() === '';
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  modalWarns = /window\.__u1SelectorIntel\.openModalNow\(\)/.test(src) &&
    /This route scrolls the page from the top, which will close it/.test(src) &&
    // Named the route that CAN do it, rather than only refusing.
    /Use Automatic \(AI\) instead/.test(src);
}
console.log(`  ${modalSeen ? '✅' : '❌'} an open modal is detected before a whole-page scan scrolls it shut`);
if (!modalSeen) failed++;
console.log(`  ${modalClosedIgnored ? '✅' : '❌'} …while the closed modals every site ships are ignored`);
if (!modalClosedIgnored) failed++;
console.log(`  ${modalWarns ? '✅' : '❌'} …and the run stops and names the route that can scan it instead`);
if (!modalWarns) failed++;
console.log(`  ${dupIdDistinct ? '✅' : '❌'} a duplicated id is never used as a selector (jQuery reaches only the first copy)`);
if (!dupIdDistinct) failed++;
console.log(`  ${dupIdResolves ? '✅' : '❌'} …each copy gets its own selector that resolves to exactly that element`);
if (!dupIdResolves) failed++;
console.log(`  ${uniqueIdKept ? '✅' : '❌'} …while a genuinely unique id is still preferred over everything else`);
if (!uniqueIdKept) failed++;
console.log(`  ${accHeader ? '✅' : '❌'} an accordion is rooted on its HEADER, not the container it was found by`);
if (!accHeader) failed++;
console.log(`  ${accContent ? '✅' : '❌'} …and the required contentSelector is read from what the header controls`);
if (!accContent) failed++;
console.log(`  ${accLevel ? '✅' : '❌'} …and headingLevel comes from the wrapping heading, not a default`);
if (!accLevel) failed++;
console.log(`  ${accFromTrigger ? '✅' : '❌'} …whether you point at the container or at a trigger`);
if (!accFromTrigger) failed++;
console.log(`  ${accWired ? '✅' : '❌'} …and the mapping path actually uses that shape`);
if (!accWired) failed++;
console.log(`  ${chainOk ? '✅' : '❌'} the page's own names survive collector → region → context`);
if (!chainOk) failed++;
console.log(`  ${cbShapeOk ? '✅' : '❌'} an autocomplete with no ARIA is found by shape, from any of its parts`);
if (!cbShapeOk) failed++;
console.log(`  ${cbNoFalse ? '✅' : '❌'} …and an unrelated element does not report the one elsewhere on the page`);
if (!cbNoFalse) failed++;
console.log(`  ${cbWired ? '✅' : '❌'} …and the mapping path uses it instead of asking for four typed selectors`);
if (!cbWired) failed++;
console.log(`  ${dlOk ? '✅' : '❌'} every selector field offers the page's real names to choose from`);
if (!dlOk) failed++;
console.log(`  ${fastSimple ? '✅' : '❌'} a link, heading, button or loading bar is mapped with no model call`);
if (!fastSimple) failed++;
console.log(`  ${fastComplex ? '✅' : '❌'} …while anything with real parts to find still asks`);
if (!fastComplex) failed++;
console.log(`  ${fastWired ? '✅' : '❌'} …and the mapping path takes that shortcut`);
if (!fastWired) failed++;
console.log(`  ${fastLevel ? '✅' : '❌'} …with a heading's level read off its tag`);
if (!fastLevel) failed++;
console.log(`  ${rulesEveryType.length === 0 ? '✅' : '❌'} every mappable component has rules written for it${
  rulesEveryType.length ? ` — missing: ${rulesEveryType.join(', ')}` : ''}`);
if (rulesEveryType.length) failed++;
console.log(`  ${rulesUnknownFields.length === 0 ? '✅' : '❌'} …and every field they name is one the builder accepts${
  rulesUnknownFields.length ? ` — unknown: ${rulesUnknownFields.join(', ')}` : ''}`);
if (rulesUnknownFields.length) failed++;
console.log(`  ${rulesShipped ? '✅' : '❌'} …the file ships in the package`);
if (!rulesShipped) failed++;
console.log(`  ${rulesUsed ? '✅' : '❌'} …and the model is actually given it when building a mapping`);
if (!rulesUsed) failed++;
console.log(`  ${reqAtTheFunnel ? '✅' : '❌'} required selectors are checked in saveMappingEntry — the one path all routes take`);
if (!reqAtTheFunnel) failed++;
console.log(`  ${reqEnforced ? '✅' : '❌'} …and a mapping missing one is refused, not stored`);
if (!reqEnforced) failed++;
console.log(`  ${reqNamesThem ? '✅' : '❌'} …and told which ones`);
if (!reqNamesThem) failed++;
console.log(`  ${reqSkipsCustom ? '✅' : '❌'} …while a static fix, which has no schema, still saves`);
if (!reqSkipsCustom) failed++;
console.log(`  ${kept ? '✅' : '❌'} …and a mapping without that answer leaves the site's role alone`);
if (!kept) failed++;
console.log(`  ${exportsStrip ? '✅' : '❌'} …and the exported file makes the same choice, not just Apply`);
if (!exportsStrip) failed++;
console.log(`  ${clashNamed ? '✅' : '❌'} an apply blocked by the site's role reports THE CAUSE, not just "changed nothing"`);
if (!clashNamed) failed++;
console.log(`  ${notAsked ? '✅' : '❌'} …and a role U1 itself wrote is not reported as a clash`);
if (!notAsked) failed++;
console.log(`  ${clashReported ? '✅' : '❌'} …and every apply path reports it, once, through describeApply`);
if (!clashReported) failed++;
console.log(`  ${cleanQuiet ? '✅' : '❌'} …while a clean apply says nothing about roles`);
if (!cleanQuiet) failed++;
console.log(`  ${asksOnScreen ? '✅' : '❌'} …and the question is a dialog on screen, not a link under the fold`);
if (!asksOnScreen) failed++;
console.log(`  ${askedOnce ? '✅' : '❌'} the role question is asked at the card AND backstopped in saveMappingEntry — never twice`);
if (!askedOnce) failed++;
console.log(`  ${tablesAgree ? '✅' : '❌'} …and the save-time and apply-time role tables say the same thing`);
if (!tablesAgree) failed++;
console.log(`  ${narrowScopes && narrowValidates ? '✅' : '❌'} a child selector wider than its parent is narrowed, and validated before it is written`);
if (!(narrowScopes && narrowValidates)) failed++;
console.log(`  ${narrowLeavesNoneInside ? '✅' : '❌'} …but "none inside" is left alone — that is a wrong selector, not a wide one`);
if (!narrowLeavesNoneInside) failed++;
console.log(`  ${narrowOnSave && narrowOnApply ? '✅' : '❌'} …on every save and on the picker's Apply, so the exported file carries it too`);
if (!(narrowOnSave && narrowOnApply)) failed++;
console.log(`  ${narrowIsSaid ? '✅' : '❌'} …and it is said out loud, never rewritten behind your back`);
if (!narrowIsSaid) failed++;
console.log(`  ${radioHasRule ? '✅' : '❌'} radio has a containment rule at last, so the same repair covers it`);
if (!radioHasRule) failed++;
console.log(`  ${fatalNamed ? '✅' : '❌'} …and for tabs the warning says fatal, because nothing at all is decorated`);
if (!fatalNamed) failed++;
console.log(`  ${overwriteEverywhere ? '✅' : '❌'} every apply path carries overwriteRole, not just the single one${overwriteEverywhere ? '' : ' — ' + overwriteWhere.join(' | ')}`);
if (!overwriteEverywhere) failed++;
console.log(`  ${defaultsAgree ? '✅' : '❌'} every root option defaults to what its own docs say${defaultsAgree ? '' : ' — ' + defaultMismatches.join(', ')}`);
if (!defaultsAgree) failed++;
console.log(`  ${navSafe ? '✅' : '❌'} a menu with submenus is not born with menubar:true`);
if (!navSafe) failed++;
console.log(`  ${migrated ? '✅' : '❌'} a menu ALREADY SAVED with the fatal pair is repaired and its code rebuilt`);
if (!migrated) failed++;
console.log(`  ${leftAlone ? '✅' : '❌'} …and other mappings are left untouched`);
if (!leftAlone) failed++;
console.log(`  ${dlgFlipped ? '✅' : '❌'} a dialog ALREADY SAVED inverted is put back the right way round and rebuilt`);
if (!dlgFlipped) failed++;
console.log(`  ${dlgSaneUntouched ? '✅' : '❌'} …while a dialog that was already correct is not touched`);
if (!dlgSaneUntouched) failed++;
console.log(`  ${dlgLeftAlone ? '✅' : '❌'} …nor is anything that is not a dialog`);
if (!dlgLeftAlone) failed++;
console.log(`  ${rebuiltDetected ? '✅' : '❌'} a nav rebuilt by the site AFTER U1 finished is DETECTED (not blamed on selectors)`);
if (!rebuiltDetected) failed++;
console.log(`  ${controlLeftAlone ? '✅' : '❌'} …and a nav that was NOT rebuilt is not re-applied`);
if (!controlLeftAlone) failed++;
console.log(`  ${bookkeepingNotCounted ? '✅' : '❌'} a fix that wrote only u1st-avoid-change-detection + aria-hidden=false counts as NOTHING applied`);
if (!bookkeepingNotCounted) failed++;
console.log(`  ${noEffectExplained ? '✅' : '❌'} …and a mapping that changed nothing says why, instead of printing a bare ✗`);
if (!noEffectExplained) failed++;
console.log(`  ${optOutHonest ? '✅' : '❌'} …and the opt-out note stops claiming the attribute is in the site's HTML`);
if (!optOutHonest) failed++;
console.log(`  ${noMatchOnce ? '✅' : '❌'} …and an unmatched selector is reported once, not as two lines saying the same thing`);
if (!noMatchOnce) failed++;
console.log(`  ${selOk ? '✅' : '❌'} the selector in U1's own menu docs validates, and descendant spaces still do not`);
if (!selOk) failed++;
console.log(`  ${selFast ? '✅' : '❌'} …and validation is linear — no catastrophic backtracking on a long non-match`);
if (!selFast) failed++;
console.log(`  ${classOk ? '✅' : '❌'} build-generated classes are rejected, hand-written ones kept`);
if (!classOk) failed++;
console.log(`  ${leanOk ? '✅' : '❌'} the scan payload drops empty fields and keeps every real one`);
if (!leanOk) failed++;
console.log(`  ${shrank ? '✅' : '❌'} …less than half the size it was`);
if (!shrank) failed++;

console.log(`  ${edgeCarried ? '✅' : '❌'} what opens a hidden container travels with it into the model's list`);
if (!edgeCarried) failed++;
console.log(`  ${schemaAsks ? '✅' : '❌'} …and the survey is required to answer with it`);
if (!schemaAsks) failed++;
console.log(`  ${promptSays ? '✅' : '❌'} …and told what it means, so the picture does not overrule the page`);
if (!promptSays) failed++;
console.log(`  ${cardPrefills ? '✅' : '❌'} …it arrives filled in on the review card, still editable`);
if (!cardPrefills) failed++;
console.log(`  ${sweepCarries ? '✅' : '❌'} …and in the unattended sweep, where nobody is there to type it`);
if (!sweepCarries) failed++;
console.log(`  ${measuredWins ? '✅' : '❌'} …but a probe that pressed the control still overrules it`);
if (!measuredWins) failed++;
console.log(`  ${formMeasured ? '✅' : '❌'} a form's required fields are read off the page before the model is asked`);
if (!formMeasured) failed++;
console.log(`  ${listboxMeasuredFirst ? '✅' : '❌'} …and a listbox is measured before the sweep refuses it for having no container`);
if (!listboxMeasuredFirst) failed++;
console.log(`  ${repairsBeforeCard ? '✅' : '❌'} a name U1 cannot resolve is renamed before the card offers it for approval`);
if (!repairsBeforeCard) failed++;
console.log(`  ${repairsAtSave ? '✅' : '❌'} …and again at the one door every route saves through`);
if (!repairsAtSave) failed++;
console.log(`  ${auditRuns ? '✅' : '❌'} the survey's answer is checked against the page on BOTH routes, not just one`);
if (!auditRuns) failed++;
console.log(`  ${auditReports ? '✅' : '❌'} …and a row dropped for needing no fix says so, on both`);
if (!auditReports) failed++;
console.log(`  ${descFromPage ? '✅' : '❌'} a description is taken from the page's own words, not composed`);
if (!descFromPage) failed++;

const total = results.length + 122;
console.log(`\n  ${total - failed}/${total} checks passed\n`);
if (failed) process.exit(1);

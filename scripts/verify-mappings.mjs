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
  ...['setDeep', 'deepClone', 'normalizeU1Selector', 'isU1ValidSelector', 'isValidIdent',
      'formatJsInline', 'formatJsObject', 'buildAriaLabelCode', 'buildTemplate', 'stripEmpty',
      'buildKeyboardGridCode', 'buildKeyboardTabsCode', 'primaryKeyOf'].map(n => lift('function', n)),
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
const codeSrc = panelSrc.slice(panelSrc.indexOf('function mappingToCode(m)'));
const exportsStrip = /overwriteRole/.test(codeSrc.slice(0, 2000)) &&
                     /removeAttribute\('role'\)/.test(codeSrc.slice(0, 2000));

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
console.log(`  ${rebuiltDetected ? '✅' : '❌'} a nav rebuilt by the site AFTER U1 finished is DETECTED (not blamed on selectors)`);
if (!rebuiltDetected) failed++;
console.log(`  ${controlLeftAlone ? '✅' : '❌'} …and a nav that was NOT rebuilt is not re-applied`);
if (!controlLeftAlone) failed++;
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

const total = results.length + 31;
console.log(`\n  ${total - failed}/${total} checks passed\n`);
if (failed) process.exit(1);

// The dynamic scan's three asks from the 2026-09-07 review, each pinned:
//
//   node scripts/verify-dynamic-scan.mjs
//
//   · A listbox whose options ACT ON FOCUS (links that navigate the moment
//     they are focused): arrowing through it changed the page. The mapping
//     switch `enterSelects` runs the aria-activedescendant model for that
//     list — focus stays on the list, arrows only move the highlight, Enter
//     or Space picks, Tab leaves without choosing.
//   · A dialog is closed until its trigger is pressed, so the code checks
//     read "not set while closed" on a dialog that works. runTest now presses
//     the trigger the mapping names, reads the open dialog, closes it again.
//   · The panel side (waiting for the page to come back, folding mappings that
//     belong to other pages, remembering the verdict on the row) is checked
//     as source shape here — it drives chrome.tabs and cannot run in JSDOM.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const PATCH = read('u1-patch.js');
const ENGINE = read('test-engine.js');
const PANEL = read('panel.js');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

function slice(types) {
  const wanted = new Set(['core', ...(types || [])]);
  const picked = [];
  const re = /\/\/#region u1-patch:([a-z]+)\r?\n([\s\S]*?)\r?\n\/\/#endregion/g;
  let m;
  while ((m = re.exec(PATCH))) if (wanted.has(m[1])) picked.push(m[2]);
  return `'use strict';\n${picked.join('\n\n')}`;
}
function dom(html) {
  const d = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const proto = d.window.HTMLElement.prototype;
  const hidden = function () { return this.hasAttribute('hidden') || this.style.display === 'none' || (this.closest && this.closest('[hidden]')); };
  Object.defineProperty(proto, 'offsetWidth', { get() { return hidden.call(this) ? 0 : 40; } });
  Object.defineProperty(proto, 'offsetHeight', { get() { return hidden.call(this) ? 0 : 40; } });
  Object.defineProperty(proto, 'offsetParent', { get() { return hidden.call(this) ? null : this.ownerDocument.body; } });
  proto.getBoundingClientRect = function () { const h = hidden.call(this); return { width: h ? 0 : 100, height: h ? 0 : 20, left: 0, top: 0, right: 100, bottom: 20 }; };
  proto.scrollIntoView = function () {};
  return d;
}
const key = (w, el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, code: k === ' ' ? 'Space' : k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };

// ── enterSelects: arrows only move, Enter picks ────────────────────────────
console.log('\nlistbox: enterSelects');
{
  const d = dom(`
    <button class="t" aria-haspopup="listbox" aria-expanded="true">Language</button>
    <ul class="lb" role="listbox">
      <li role="option" id="o1"><a href="/en">English</a></li>
      <li role="option" id="o2"><a href="/he">עברית</a></li>
      <li role="option" id="o3"><a href="/es">Español</a></li>
    </ul>`);
  const w = d.window, doc = w.document;
  // The site: an option that navigates the moment its link is focused.
  const navigated = [];
  doc.querySelectorAll('.lb a').forEach((a) => a.addEventListener('focus', () => navigated.push('focus:' + a.getAttribute('href'))));
  doc.querySelectorAll('.lb a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); navigated.push('click:' + a.getAttribute('href')); }));
  // The library's own Tab-clicks-the-active-option handler, on the list in capture.
  const list = doc.querySelector('.lb');
  list.addEventListener('keydown', (e) => { if (e.code === 'Tab') navigated.push('lib-tab-click'); }, true);

  // A stand-in u1 so the core intercept has something to wrap.
  const calls = [];
  w.u1 = { fix: { listbox: (sel, props) => { calls.push(props); return true; } } };
  w.eval(slice(['listbox']));
  const P = w.__u1Patch;
  check('the patch booted with a listbox region', !!P && typeof P.rove === 'function');

  // The mapping carries the switch; U1 must not see it.
  w.u1.fix.listbox('.t', { enterSelects: true, closeOnSelect: true, selectors: { listbox: '.lb', trigger: '.t', options: '.lb > li' } });
  check('enterSelects is stripped before U1 is called', calls.length === 1 && !('enterSelects' in calls[0]) && calls[0].closeOnSelect === true);
  check('…and recorded for the region', Array.isArray(P.enterSelects) && P.enterSelects.length === 1 && P.enterSelects[0].listSel === '.lb');

  P.correctors.forEach((f) => f());
  const opts = [...doc.querySelectorAll('[role=option]')];
  check('the option links are taken out of the tab order; the list gets the stop',
    [...doc.querySelectorAll('.lb a')].every((a) => a.tabIndex === -1) && list.tabIndex === 0, `list ${list.tabIndex}`);
  check('a highlight exists from the start (aria-activedescendant → first option)',
    list.getAttribute('aria-activedescendant') === 'o1' && opts[0].getAttribute('aria-selected') === 'true');

  list.focus();
  const down = key(w, list, 'ArrowDown');
  check('ArrowDown moves the highlight, not focus', list.getAttribute('aria-activedescendant') === 'o2' && doc.activeElement === list && down.defaultPrevented,
    `${list.getAttribute('aria-activedescendant')} active=${doc.activeElement && doc.activeElement.tagName}`);
  check('…and nothing on the site fired: no option focus, no navigation', navigated.length === 0, navigated.join(','));
  key(w, list, 'ArrowDown'); key(w, list, 'ArrowDown');
  check('the highlight wraps', list.getAttribute('aria-activedescendant') === 'o1');
  key(w, list, 'End');
  check('End goes to the last option', list.getAttribute('aria-activedescendant') === 'o3');
  const tab = key(w, list, 'Tab');
  check('Tab leaves WITHOUT choosing (the library\'s Tab-click is stopped)', navigated.length === 0 && !tab.defaultPrevented, navigated.join(','));
  key(w, list, 'ArrowUp');
  key(w, list, 'Enter');
  check('Enter clicks the highlighted option\'s link — the one and only way to pick', navigated.length === 1 && navigated[0] === 'click:/he', navigated.join(','));

  // A stray focus on an option (site script, mouse) is pulled back to the list.
  doc.querySelector('#o1 a').focus();
  check('focus that lands on an option is returned to the list, with that option highlighted',
    doc.activeElement === list && list.getAttribute('aria-activedescendant') === 'o1');

  // A second listbox WITHOUT the switch keeps the old roving.
  const d2 = dom(`<ul class="lb2" role="listbox"><li role="option" id="p1" tabindex="0">A</li><li role="option" id="p2" tabindex="-1">B</li></ul>`);
  d2.window.u1 = { fix: { listbox: () => true } };
  d2.window.eval(slice(['listbox']));
  d2.window.__u1Patch.correctors.forEach((f) => f());
  const p1 = d2.window.document.getElementById('p1');
  p1.focus(); key(d2.window, p1, 'ArrowDown');
  check('a listbox without the switch still roves focus between options', d2.window.document.activeElement.id === 'p2');

  check('the Picker offers the switch on a listbox mapping, in our words',
    /rootFields:\{closeOnSelect:true, enterSelects:false\}/.test(PANEL) && /enterSelects:'Arrows only move/.test(PANEL));
  check('the Mappings drawer shows and toggles it on the row', /data-toggle-cfg="enterSelects"/.test(PANEL) && /\.mh-flag-toggle\[data-toggle-cfg\]/.test(PANEL));
  check('the keyboard test asserts the promise when the switch is on', /cfg\.enterSelects === true/.test(ENGINE) && /focus stays on the list, nothing is chosen/.test(ENGINE));
}

// ── dialog: opened via its trigger before the code checks ─────────────────
console.log('\ndialog: opened through the trigger for the check');
{
  const d = dom(`
    <button id="open">Open</button>
    <div id="dlg" style="display:none"><h2 id="h">Hello</h2><button id="close">×</button></div>`);
  const w = d.window, doc = w.document;
  const dlg = doc.getElementById('dlg'), open = doc.getElementById('open');
  // The site opens on click; "U1" decorates only while open; Escape closes.
  let opens = 0;
  open.addEventListener('click', () => { opens++; dlg.style.display = 'block'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'h'); doc.getElementById('close').focus(); });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg.style.display === 'block') { dlg.style.display = 'none'; dlg.removeAttribute('role'); dlg.removeAttribute('aria-modal'); open.focus(); } });
  w.chrome = { runtime: { sendMessage() {} } };
  w.eval(ENGINE);
  const T = w.__u1TestEngine;

  const closedOnly = T.runStaticChecks('dialog', '#dlg', { trigger: '#open', closeBtn: '#close' }, {});
  check('read while closed, the code checks can only say "not set while closed"',
    closedOnly.steps.some((s) => s.label === 'role="dialog"' && s.status === 'warn'));

  const res = await T.runTest('dialog', '#dlg', { selectors: { trigger: '#open', closeBtn: '#close' } });
  const st = res.static.steps;
  check('runTest pressed the trigger before the code checks', st[0] && /Opened via the trigger/.test(st[0].label), st[0] && st[0].label);
  check('…so role="dialog", aria-modal and the name are read from the OPEN dialog and pass',
    ['role="dialog"', 'aria-modal="true"', 'Accessible name'].every((l) => st.find((s) => s.label === l && s.status === 'pass')),
    st.map((s) => `${s.label}:${s.status}`).join(' | '));
  check('the dialog was closed again before the keyboard test, which opened it itself', opens === 2 && dlg.style.display === 'none', `opens=${opens}`);
  check('the keyboard test still reports the open/escape/focus-return sequence',
    res.keyboard.steps.some((s) => s.label === 'Trigger opens the dialog' && s.status === 'pass') &&
    res.keyboard.steps.some((s) => s.label === 'Escape closes the dialog' && s.status === 'pass'));

  // A dialog WITHOUT a trigger is left as it is — nothing to press.
  const d2 = dom(`<div id="dlg2" style="display:none">x</div>`);
  d2.window.chrome = { runtime: { sendMessage() {} } };
  d2.window.eval(ENGINE);
  const r2 = await d2.window.__u1TestEngine.runTest('dialog', '#dlg2', { selectors: {} });
  check('no trigger → no press, the checks read the closed state as before', !r2.static.steps.some((s) => /Opened via/.test(s.label)));
}

// ── the panel side, as source shape ────────────────────────────────────────
console.log('\npanel: come back, fold, remember');
{
  const run = PANEL.slice(PANEL.indexOf('async function runElementScan'), PANEL.indexOf('function pickMappingFields'));
  check('a navigation mid-run waits for the page to come back (awaitReturn), not just a hard reload', /await awaitReturn\(tab\.id, pageUrl, status\)/.test(run));
  const ar = PANEL.slice(PANEL.indexOf('async function awaitReturn'), PANEL.indexOf('const elemTestStoreKey'));
  check('…history back first, then the hard return by itself — no waiting on the person', /chrome\.tabs\.goBack/.test(ar) && /!elemScanAbort/.test(ar) && /returnTabTo\(tabId, url\)/.test(ar) && !/waiting \$\{left\}s/.test(ar));
  check('…and it waits for the patch and the library to be back on the page before testing again', /window\.__u1Patch && \(window\.u1/.test(ar));
  const render = PANEL.slice(PANEL.indexOf('function renderElemScanResults'), PANEL.indexOf('function elemScanLiveStep'));
  check('mappings that belong to other pages are one line, not rows', /to other pages — not tested here/.test(render) && /r\.status !== 'absent'/.test(render));
  check('the verdict is remembered per mapping and shown on the drawer row', /rememberElemTested\(results\)/.test(run) && /mh-test \$\{tv\.status\}/.test(PANEL) && /sm-test \$\{escapeHtml\(tv\.status\)\}/.test(PANEL));
}

// ── 2026-09-08: own pane, jump from the drawer, pages, everywhere ──────────
console.log('\npanel: own pane, jump, pages, everywhere');
{
  const pane = PANEL.slice(PANEL.indexOf('function setScanChoicePane'), PANEL.indexOf('function showOnlyScan'));
  check('each scan\'s results show only under its own pane', /pane === 'content' && scanResults\.length/.test(pane) && /pane === 'mappings' && elemScanResults\.length/.test(pane));
  check('the Dynamic pane reopens on its last saved run', /loadElemLastRun\(\)/.test(pane));
  check('a drawer verdict chip opens the result it came from', /data-open-result=/.test(PANEL) && /async function openElemResultFor/.test(PANEL) && /data-elem-key="\$\{escapeHtml\(r\.key/.test(PANEL));
  const run = PANEL.slice(PANEL.indexOf('async function runElementScan'), PANEL.indexOf('function pickMappingFields'));
  check('the all-mappings run visits the pages the other mappings were captured on', /elsewhere\.set\(pu/.test(run) && /await gotoPageReady\(tab\.id, pg\.url\)/.test(run) && /runBatch\(batch, pg\.url/.test(run));
  check('…only the all-mappings run travels; one row\'s 🧪 stays put', /!onlyKey && !onlyHere && pu && pu !== hereUrl/.test(run));
  check('…and it comes back to the page it started on', /if \(travelled\)[\s\S]*gotoPageReady\(tab\.id, tab\.url\)/.test(run));
  check('every result is stamped with the page it was tested on', /last\.pageUrl = pageUrl; last\.pageTitle = pageTitle/.test(run));
  const render = PANEL.slice(PANEL.indexOf('function renderElemScanResults'), PANEL.indexOf('function elemScanLiveStep'));
  check('results render as one accordion per page — title as heading, address as link', /class="elem-page/.test(render) && /elem-page-title/.test(render) && /elem-page-link/.test(render) && /pages\.size <= 1/.test(render));
  check('the listbox test waits for aria-expanded and focus instead of reading them at 0ms', /waitFor\(\(\) => trigger\.getAttribute\('aria-expanded'\) === 'true', 1200\)/.test(ENGINE) && /waitFor\(\(\) => activeInside\(root\), 1200\)/.test(ENGINE));
}

// ── skip links the config asked for, beyond the engine's three ─────────────
console.log('\nskip links from config');
{
  const d = dom(`
    <a class="u1st-skip-link" href="#nav">Skip to navigation</a>
    <a class="u1st-skip-link" href="#main">Skip to main content</a>
    <nav id="nav">n</nav><main id="main">m</main>
    <div class="click-nav">sign in</div><input id="searchInputText">`);
  const w = d.window, doc = w.document;
  w.u1 = { fix: {}, config: { skipLinks: [
    { label: 'skip to main content', target: '#main', selector: '#main' },
    { label: 'skip to sign in', target: '#u1-anchor-x1', selector: '.click-nav', syntheticId: 'u1-anchor-x1' },
    { label: 'search', target: '#searchInputText', selector: '#searchInputText' },
  ] } };
  w.eval(slice([]));
  w.__u1Patch.correctors.forEach((f) => f());
  const links = [...doc.querySelectorAll('a.u1st-skip-link')].map((a) => a.getAttribute('href') + ' ' + a.textContent);
  check('the two the engine did not render are added, after the engine\'s own, in config order',
    links.length === 4 && links[2] === '#u1-anchor-x1 Skip to sign in' && links[3] === '#searchInputText Skip to search', links.join(' | '));
  check('the one the engine already rendered is not duplicated', links.filter((l) => l.startsWith('#main ')).length === 1);
  check('a selector target with no id gets the synthetic id the config recorded', doc.querySelector('.click-nav').id === 'u1-anchor-x1');
  w.__u1Patch.correctors.forEach((f) => f());
  check('a second pass adds nothing', doc.querySelectorAll('a.u1st-skip-link').length === 4);
  // The engine rendering the same target later wins; ours comes out.
  const late = doc.createElement('a'); late.className = 'u1st-skip-link'; late.href = '#searchInputText'; late.textContent = 'Skip to search'; doc.body.prepend(late);
  w.__u1Patch.correctors.forEach((f) => f());
  check('if the engine later renders the same target, ours is removed', doc.querySelectorAll('a.u1st-skip-link[href="#searchInputText"]').length === 1 && !doc.querySelector('a.u1p-skip-link[href="#searchInputText"]'));
}

// ── static fixes from the scan: new-tab names, stray <br>, real heading levels ─
console.log('\nstatic fixes: new tab, stray br, heading level');
{
  const d = dom(`<html lang="en"><body>
    <ul><li>1</li><br><li>2</li></ul>
    <a id="a1" href="https://x.test" target="_blank">Careers</a>
    <a id="a2" href="https://x.test" target="_blank">Blog (opens in a new tab)</a>
    <a id="a3" href="https://x.test" target="_blank"><img src="f.png" alt="Facebook"></a>
    <h2>A</h2><h4 id="h">Get Active!</h4><div id="fake">Not a heading</div></body></html>`);
  const w = d.window, doc = w.document;
  w.u1 = { fix: {} };
  w.__u1Statics = { 'link-newwindow': {}, 'list-stray-br': {} };
  w.eval(slice(['statics']));
  w.__u1Patch.correctors.forEach((f) => f());
  check('a new-tab link gets "(opens in a new tab)" added to its name, once', doc.getElementById('a1').getAttribute('aria-label') === 'Careers (opens in a new tab)');
  check('…a link that already says so is left alone', !doc.getElementById('a2').hasAttribute('aria-label'));
  check('…an icon link is named from its alt', doc.getElementById('a3').getAttribute('aria-label') === 'Facebook (opens in a new tab)');
  // An aria-label mapping rewrote the name after the phrase was added; the next pass puts it back.
  doc.getElementById('a1').setAttribute('aria-label', 'Careers about Molina');
  w.__u1Patch.correctors.forEach((f) => f());
  check('…and if another mapping rewrites the name later, the phrase is restored on the next pass (content, not a done-marker)', doc.getElementById('a1').getAttribute('aria-label') === 'Careers about Molina (opens in a new tab)');
  check('a stray <br> in a list is hidden from screen readers, the list untouched', doc.querySelector('ul br').getAttribute('aria-hidden') === 'true' && doc.querySelectorAll('ul li').length === 2);
  w.__u1Patch.ensureFixers();
  w.u1.fix.heading('#h', { level: 3 });
  w.u1.fix.heading('#fake', { level: 2 });
  check('a real <h4> mapped to level 3 gets aria-level=3 (no role — it is a heading already)', doc.getElementById('h').getAttribute('aria-level') === '3' && !doc.getElementById('h').hasAttribute('role'));
  check('a non-heading gets role=heading and the level', doc.getElementById('fake').getAttribute('role') === 'heading' && doc.getElementById('fake').getAttribute('aria-level') === '2');
  check('the scan offers both as one-press fixes, and re-reads the page right after', /'link-newwindow':\s*\{ does:/.test(PANEL) && /'list-stray-br':\s*\{ does:/.test(PANEL) && /await refreshScanAfterMapping\(rule\);\n  \} catch \(err\) \{\n    showNotice\(status, 'Could not apply it/.test(PANEL));
  check('alts can be approved, singly and all at once, and approved ones leave the list', /scan-alt-ok-all/.test(PANEL) && /dropApprovedAlts\(scanResults\)/.test(PANEL));
  check('the score is per question, shown on the header and kept in history', /SCAN_Q_WEIGHT/.test(PANEL) && /\$\{computeScanScore\(scanResults\)\}% · /.test(PANEL));
}

// ── 2026-09-08 (2): why nothing landed, and the fixes that now do ──────────
console.log('\nstatic fixes reach the page; contrast, landmarks, heading, skip links');
{
  const apply = PANEL.slice(PANEL.indexOf('async function applyStaticFixesToPage'), PANEL.indexOf('let filterShape'));
  check('the static-fix declaration is written in the MAIN world, where the patch lives (it went to the isolated world before)', /world: 'MAIN',\s*\n\s*func: \(decl\) => \{\s*\n\s*window\.__u1Statics = decl/.test(apply) && !/inPage\(/.test(apply));

  const d = dom(`<html lang="en"><body>
    <a class="u1st-skip-link" href="#nav">Skip to navigation</a><nav id="nav">n</nav>
    <div class="click-nav">sign in</div>
    <div class="input-group" role="form"><label for="q" hidden>Search</label><input id="q" name="searchInputText"></div>
    <div role="region"><h3>Offers</h3>x</div>
    <p><a id="c1" href="/a" class="ext">here</a> <a id="c2" href="/b" class="ext">Learn more.</a></p>
    <h2>A</h2><h4 id="h">Get Active!</h4></body></html>`);
  const w = d.window, doc = w.document;
  let engineHeadingCalls = 0;
  w.u1 = { fix: { heading: () => { engineHeadingCalls++; } }, config: {} };
  // Studio's copy, which setConfiguration cannot wipe.
  w.__u1SkipLinks = [{ label: 'skip to sign in', target: '#u1-anchor-s1', selector: '.click-nav', syntheticId: 'u1-anchor-s1' }];
  w.__u1Statics = { contrast: { rules: [{ selectors: ['#c1', '#c2'], color: '#0b6e70' }] }, 'landmark-noname': {} };
  w.eval(slice(['statics']));
  w.__u1Patch.correctors.forEach((f) => f());
  check('skip links are rendered from window.__u1SkipLinks even when u1.config has none', !!doc.querySelector('a.u1p-skip-link[href="#u1-anchor-s1"]'));
  const st = doc.getElementById('u1p-contrast');
  check('a contrast fix becomes one stylesheet rule on the exact elements', !!st && /#c1,\n#c2 \{ color: #0b6e70 !important; \}/.test(st.textContent));
  const search = doc.querySelector('.input-group');
  check('an unnamed role=form around a search field becomes role=search, named after its field', search.getAttribute('role') === 'search' && search.getAttribute('aria-label') === 'Search');
  const owned = doc.createElement('div'); owned.setAttribute('role', 'form'); owned.setAttribute('u1st-avoid-change-detection', 'true'); owned.innerHTML = '<input id="q2" name="search" aria-label="Search site">'; doc.body.appendChild(owned);
  w.__u1Patch.correctors.forEach((f) => f());
  check('a search form the ENGINE manages keeps role=form (the engine rewrites it) and gets the name instead', owned.getAttribute('role') === 'form' && owned.getAttribute('aria-label') === 'Search site');
  const region = doc.querySelector('[role=region]');
  check('an unnamed region takes its heading as the name', region.getAttribute('aria-labelledby') && doc.getElementById(region.getAttribute('aria-labelledby')).textContent === 'Offers');
  w.u1.fix.heading('#h', { level: 3, selectors: { heading: '#h' } });
  check('the heading intercept writes the level at once and still calls the engine', doc.getElementById('h').getAttribute('aria-level') === '3' && engineHeadingCalls === 1);

  check('contrast findings carry the colour pair and the link\'s href from the engine', /fgColor: d\.fgColor/.test(read('scan-engines.js')) && /href: el && el\.closest/.test(read('scan-engines.js')));
  check('the scan groups contrast by colour pair and SUGGESTS a darker shade — colours are the site\'s, nothing is applied', /function scanContrastPairs/.test(PANEL) && /function darkenToContrast/.test(PANEL) && /scan-contrast-suggest/.test(PANEL) && !/scan-contrast-fix/.test(PANEL));
  check('new-tab links, duplicate ids and stray <br>s render as ONE row each, elements listed inside', /SCAN_GROUPED = new Set\(\['link-newwindow', 'dup-ids', 'list-stray-br'\]\)/.test(PANEL) && /function scanGroupedItemHtml/.test(PANEL));
  check('after a fix the panel says, per rule, how many landed and which are still there', /fixed on the page\./.test(PANEL) && /Still there:/.test(PANEL) && /refreshScanAfterMapping\(rule\)/.test(PANEL));
  check('unnamed landmarks have a one-press fix', /'landmark-noname':\s*\{ does:/.test(PANEL));
  check('the page highlight is the unmissable kind', /__u1tPulse/.test(PANEL) && /#ff2d95/.test(PANEL));
}

// darkenToContrast, lifted: same hue family, meets the ratio.
{
  const start = PANEL.indexOf('function hexToRgb');
  const end = PANEL.indexOf('function scanContrastPairs');
  const ctx = {}; (await import('node:vm')).default.createContext(ctx);
  (await import('node:vm')).default.runInContext(PANEL.slice(start, end), ctx);
  const c = ctx.darkenToContrast('#009ea0', '#ffffff', 4.5);
  check('#009ea0 on white is darkened until it meets 4.5:1', ctx.contrastOf(ctx.hexToRgb(c), [255, 255, 255]) >= 4.5 && /^#00/.test(c), c);
  const light = ctx.darkenToContrast('#666666', '#111111', 4.5);
  check('on a dark background the text is lightened instead', ctx.contrastOf(ctx.hexToRgb(light), [17, 17, 17]) >= 4.5, light);
}

// ── a re-injected patch brings its own current fallback ────────────────────
console.log('\nre-injection replaces the patch\'s own stand-ins');
{
  const d = dom(`<h2>A</h2><h4 id="h">Get Active!</h4>`);
  const w = d.window, doc = w.document;
  w.u1 = { fix: {} };
  // An OLD stand-in, as the previous install of the patch left it: refuses native headings.
  const old = function () { return 0; }; old.__u1PatchFilled = true;
  w.u1.fix.heading = old;
  w.eval(slice([]));
  w.__u1Patch.ensureFixers();
  check('ensureFixers replaces a stand-in this patch installed earlier (a real engine fixer would be kept)', w.u1.fix.heading !== old && !!w.u1.fix.heading.__u1PatchFilled);
  w.u1.fix.heading('#h', { level: 3 });
  check('…so the current fallback runs: the <h4> gets aria-level=3 without a page reload', doc.getElementById('h').getAttribute('aria-level') === '3');
  const d2 = dom(`<div id="x">x</div>`);
  const real = (sel, p) => { d2.window.document.querySelector(sel).setAttribute('data-real', p.level); };
  d2.window.u1 = { fix: { heading: real } };
  d2.window.eval(slice([]));
  d2.window.__u1Patch.ensureFixers();
  check('a REAL engine fixer is never replaced', d2.window.u1.fix.heading === real || (d2.window.u1.fix.heading.__u1PatchHeadingWrap && !d2.window.u1.fix.heading.__u1PatchFilled));
  check('the scan\'s own Map-it writes the level after applying, whatever the engine did', /kind === 'heading'\) \{\s*\n\s*try \{\s*\n\s*await chrome\.scripting\.executeScript\(\{\s*\n\s*target: \{ tabId \}, world: 'MAIN'/.test(PANEL));
  check('the page mark is measured after an instant scroll, follows scrolling, and explains a hidden element', /behavior: 'instant'/.test(PANEL) && /window\.addEventListener\('scroll', follow, true\)/.test(PANEL) && /not visible right now/.test(PANEL));
  check('static fixes read as rules in the drawer, not as raw code', /static-fix-what/.test(PANEL) && /type = isStatic \? 'static fix'/.test(PANEL));
}

// ── name a vague link by hand; verify-on-page renders first ────────────────
console.log('\nvague links named by hand; skip links rendered before verifying');
{
  const i = PANEL.indexOf('function buildAriaLabelCode');
  const ctx = {}; const vm = (await import('node:vm')).default; vm.createContext(ctx);
  vm.runInContext(PANEL.slice(i, PANEL.indexOf('// One place that answers', i)), ctx);
  const code = ctx.buildAriaLabelCode('a.externalLink', '', '', '988 Suicide & Crisis Lifeline website');
  check('a typed name becomes a plain aria-label mapping, used as it is', /setAttribute\('aria-label', "988 Suicide & Crisis Lifeline website"\)/.test(code) && !/headingText/.test(code));
  check('the vague-link row offers BOTH: name-from-card (headingSelector, the same mapping the AI route builds) AND a free-text box, each saved as a mapping', /scan-name-input/.test(PANEL) && /data-map="label"/.test(PANEL) && /data-map="aria-label"/.test(PANEL) && /name from card/.test(PANEL));
  check('focusing the box lights the link on the page; Enter saves', /closest\('\.scan-name-input'\)[\s\S]{0,400}highlightMatch\(t\.sel, t\.idx, true\)/.test(PANEL) && /e\.key === 'Enter'\) \{ e\.preventDefault\(\); inp\.parentElement\.querySelector\('\.scan-map'\)/.test(PANEL));
  check('applyAriaLabel and the form accept the typed name in place of a heading', /if \(label && label\.trim\(\)\) \{/.test(PANEL) && /r === 'headingSelector' && rootValues && String\(rootValues\.label/.test(PANEL));
  const v = PANEL.slice(PANEL.indexOf('async function verifySkipLinksOnPage'), PANEL.indexOf("document.getElementById('verifySkipBtn')"));
  check('"Verify on page" first puts the patch and the list on the page and renders, then looks', /files: \['u1-patch\.js'\]/.test(v) && /window\.__u1SkipLinks = items/.test(v) && /renderSkipLinks\(\)/.test(v));
  check('the renderer is exposed on the patch and still registered as a corrector', /P\.renderSkipLinks = function/.test(PATCH) && /P\.correct\(P\.renderSkipLinks\)/.test(PATCH));
}

// ── documented where the question is asked; drawer by page; every skip link ─
console.log('\nfixes documented per question; drawer by page; skip links listed');
{
  check('each checklist question can list the mappings on this page that answer it, with status', /const SCAN_CHECK_MAPPINGS = \{/.test(PANEL) && /async function loadScanMappingStatus/.test(PANEL) && /function scanCheckMappingsHtml/.test(PANEL) && /const handled = scanCheckMappingsHtml\(c\);/.test(PANEL) && /\$\{handled\}\n\s*<\/details>/.test(PANEL));
  check('…status is read off the element in the MAIN world (aria-label present, aria-level present, static rule on)', /it\.custom === 'ariaLabel'\) return \{ \.\.\.base, state: el\.getAttribute\('aria-label'\)/.test(PANEL) && /window\.__u1Statics && window\.__u1Statics\[it\.primary\]/.test(PANEL));
  check('the Mappings drawer\'s "All" view is one accordion per page, this page first and open, site-wide rules on top', /class="mapping-page\$\{isHere \? ' is-here' : ''\}"/.test(PANEL) && /Whole site — rules/.test(PANEL));
  const inv = PANEL.slice(PANEL.indexOf('skipLinks: q(\'a[href^="#"]\')'), PANEL.indexOf('positiveTabindex:'));
  check('the inventory lists every skip link on the page and whether each lands', /lands: !!t/.test(inv) && /u1st-skip-link/.test(inv));
  check('…and the Skip link row shows them all', /skip link\$\{list\.length === 1 \? '' : 's'\}/.test(PANEL) && /target missing/.test(PANEL));
}

console.log('\nreadable: handled block after the findings, in words');
{
  check('the handled block is folded, placed AFTER the open findings, and says so', /Already handled here — /.test(PANEL) && /The findings above are what is still open/.test(PANEL));
  check('each line says what the element SAYS and what was done ("Heading “…” → level 3", "Link named “…”")', /Heading \$\{what\} → level/.test(PANEL) && /named \$\{what\}/.test(PANEL));
  check('an unnamed landmark finding says which one ("the form around “Search”")', /the \$\{el\.getAttribute\('role'\)\} around “/.test(PANEL));
  check('engine rows say what kind of element ("dropdown “English Español”")', /tag: el \? el\.tagName\.toLowerCase\(\) : ''/.test(read('scan-engines.js')) && /select: 'dropdown'/.test(PANEL));
}

console.log('\nan engine-managed form is named the engine\'s way');
{
  const fixAll = PANEL.slice(PANEL.indexOf("const btn = e.target.closest('.scan-fix-all');"), PANEL.indexOf('async function applyStaticFixesToPage'));
  check('Fix all for unnamed landmarks first completes a saved form mapping\'s formLabelAbsolute from the field\'s label, then re-applies it', /rule === 'landmark-noname'/.test(fixAll) && /formLabelAbsolute = hit\.label/.test(fixAll) && /applyMappingsBatch\(named\.map/.test(fixAll));
}

// ── dynamic scan: apply first, one answer for "not applied", visible trigger ─
console.log('\ndynamic scan: fast and honest');
{
  const d = dom(`<button class="t" style="display:none">mobile</button><div class="wrap"><button class="t">Language</button><ul id="lb"><li>English</li><li>Español</li></ul></div>`);
  const w = d.window; w.chrome = { runtime: { sendMessage() {} } };
  w.eval(ENGINE);
  const t0 = Date.now();
  const res = await w.__u1TestEngine.runTest('listbox', '#lb', { selectors: { trigger: '.t', options: '#lb > li' } });
  check('an undecorated widget (no role=listbox) gets ONE answer — not applied — and no keyboard run', res.notApplied === 'role' && res.keyboard.steps.length === 1 && /has not touched this listbox/.test(res.keyboard.steps[0].message));
  check('…and it answers at once instead of waiting out five key presses', Date.now() - t0 < 1500, `${Date.now() - t0}ms`);
  const r2 = await w.__u1TestEngine.runTest('listbox', '#nope', { selectors: {} });
  check('a missing element is "nothing matches", not a keyboard failure', r2.notApplied === 'missing');
  const run = PANEL.slice(PANEL.indexOf('async function runElementScan'), PANEL.indexOf('function pickMappingFields'));
  check('the panel applies a page\'s mappings before driving them', /await applyMappingsBatch\(needApply\.map/.test(run));
  check('…reports "Not applied here" as its own status, and caps a mapping at 15s', /res\.notApplied \? 'notapplied'/.test(run) && /15000\)/.test(run) && /notapplied: \{ label: 'Not applied here'/.test(PANEL));
  check('the trigger is the VISIBLE one nearest the widget, not querySelector\'s first', /const pickTrigger = \(sel, root\)/.test(ENGINE) && /pickTrigger\(sel\.trigger, root\)/.test(ENGINE));
}

console.log('\nthe decorated copy is the one tested');
{
  const d = dom(`
    <div class="m" style="display:none"><button class="t">Lang</button><ul class="dd"><li>a</li><li>b</li></ul></div>
    <div class="d"><button class="t" aria-haspopup="listbox" aria-expanded="false">Lang</button>
      <ul class="dd" role="listbox"><li role="option" id="o1">a</li><li role="option" id="o2">b</li></ul></div>`);
  const w = d.window; w.chrome = { runtime: { sendMessage() {} } };
  w.eval(ENGINE);
  const st = w.__u1TestEngine.runStaticChecks('listbox', '.dd', { trigger: '.t', options: '.dd > li' }, {});
  check('the static checks read the DECORATED copy, not querySelector\'s first (hidden, undecorated)', st.steps.some(s => s.label === 'role="listbox"' && s.status === 'pass'), st.steps.map(s => s.label + ':' + s.status).join(' | '));
}

console.log('\na fresh run replaces the stale one instead of sitting beside it');
{
  const run = PANEL.slice(PANEL.indexOf('async function runElementScan'), PANEL.indexOf('function pickMappingFields'));
  check('every reported result (legacy, custom, absent) carries a real page — its own pageUrl/pageTitle, or this page\'s — never blank', /const ownPage = \(typeof m === 'object' && m\.pageUrl\)/.test(run) && /\.\.\.ownPage,/.test(run) && /pageUrl: m\.pageUrl \|\| tab\.url, pageTitle: m\.pageTitle \|\| tab\.title/.test(run));
  check('a new run clears the previous run\'s finished summary and result list before it starts, instead of showing both at once', /cnt\.textContent = 'Running…'/.test(run) && /resBox\.innerHTML = ''/.test(run) && /filt\.innerHTML = ''/.test(run));
}

console.log('\nonly the mappings not yet on the page are re-applied before testing');
{
  const run = PANEL.slice(PANEL.indexOf('async function runElementScan'), PANEL.indexOf('function pickMappingFields'));
  check('each mapping is checked for U1\'s own marks (role/tabindex/aria-*/u1st-*) before deciding to re-apply it', /const marked = \(el\) => !!el && \(Array\.from\(el\.attributes\)\.some\(a => \/\^\(role\|tabindex\)\$\|\^aria-\|\^u1st-\/\.test\(a\.name\)\)/.test(run));
  check('only the ones that need it are sent to applyMappingsBatch — not the whole batch every run', /needApply = nonCustom\.filter\(\(_, i\) => need\[i\]\)/.test(run) && /applyMappingsBatch\(needApply\.map/.test(run) && !/applyMappingsBatch\(batch\.filter\(m => !m\.custom\)\.map/.test(run));
  check('the notice says how many of the total actually needed applying', /Applying \$\{needApply\.length\} of \$\{nonCustom\.length\} mapping/.test(run));
  check('a probe that fails still applies everything, the safe direction, rather than skipping silently', /couldn't tell — apply all, the safe direction/.test(run));
}

// ── "not applied" means untouched, not "one sub-check failed" ──────────────
console.log('\nnot applied = untouched; a partial widget is a finding, not silence');
{
  const boot = (html) => { const d = dom(html); d.window.chrome = { runtime: { sendMessage() {} } }; d.window.eval(ENGINE); return d.window; };
  // Tabs: the container IS decorated (role=tablist) but the items never got role=tab.
  let w = boot(`<div id="tabs" role="tablist"><button>A</button><button>B</button></div><div id="p">panel</div>`);
  let res = await w.__u1TestEngine.runTest('tabs', '#tabs', { selectors: { tabPanel: '#p' } });
  check('a decorated tab strip with untagged items is NOT "not applied" — the keyboard test runs and the missing role is a normal finding', !res.notApplied && !res.keyboard.steps.some(s => s.label === 'Keyboard test not run') && res.static.steps.some(s => s.label === 'role="tab" present' && s.status === 'fail'));
  // Radio: group decorated, one option not.
  w = boot(`<div id="rg" role="radiogroup"><div class="o" role="radio" aria-checked="true" tabindex="0">a</div><div class="o">b</div></div>`);
  res = await w.__u1TestEngine.runTest('radio', '#rg', { selectors: { radioButton: '.o' } });
  check('a decorated radio group with one untagged option is a finding, not "not applied"', !res.notApplied);
  // Listbox never opened: the trigger carries the engine's marks, the list does not yet.
  w = boot(`<button class="t" role="button" aria-haspopup="listbox" aria-expanded="false">Lang</button><ul id="lb" style="display:none"><li>a</li><li>b</li></ul>`);
  res = await w.__u1TestEngine.runTest('listbox', '#lb', { selectors: { trigger: '.t', options: '#lb > li' } });
  check('a correctly mapped listbox that was never opened (decorated trigger, bare list) is NOT "not applied"', !res.notApplied);
  // Truly untouched radio group: nothing anywhere.
  w = boot(`<div id="rg2"><div class="o">a</div><div class="o">b</div></div>`);
  res = await w.__u1TestEngine.runTest('radio', '#rg2', { selectors: { radioButton: '.o' } });
  check('a group nothing has touched is still "not applied", at once', res.notApplied === 'role');
  check('the gate reads the DOM (root, subtree, trigger), not step labels', /const decorated = \(el\) => !!el && \(el\.hasAttribute\('role'\)/.test(ENGINE) && !/\/\^role=\/\.test\(s\.label\)/.test(ENGINE) && /if \(type !== 'dialog'\)/.test(ENGINE));
}

// ── the rest of the review: page filter, folded rows, ignore, alts, landmark ─
console.log('\nthis page first; rows folded; ignore; alt approval; landmark named now');
{
  check('dynamic results filter to THIS page first, with an "All pages" switch', /let elemScanPageFilter = 'here'/.test(PANEL) && /data-elem-page="all"/.test(PANEL) && /elemScanPageFilter === 'all' \|\| !r\.pageUrl \|\| !hereUrl \|\| cleanPageUrl\(r\.pageUrl\) === hereUrl/.test(PANEL));
  check('static checklist rows all start folded and remember what the person opened', /scanOpenChecks\.has\(c\.id\) \? ' open' : ''/.test(PANEL) && /const scanOpenChecks = new Set\(\)/.test(PANEL));
  check('a finding can be ignored per site, out of the counts and the score, and brought back', /class="btn-ghost btn-xs scan-ignore"/.test(PANEL) && /const isIgnored = \(r\) => scanIgnored\.has\(ignoreIdOf\(r\)\)/.test(PANEL) && /!isIgnored\(r\)\)\.length;/.test(PANEL) && /scan-show-ignored/.test(PANEL));
  check('image approval is one line per image with the tick at the end, and says how many are unticked', /sc-img-line/.test(PANEL) && /unticked/.test(PANEL));
  check('the magnifier sits inline at the end of the title', /<button class="scan-hl" title="Show it on the page"/.test(PANEL) && /\.scan-item \.scan-hl \{ display: inline-block/.test(read('styles.css')));
  check('naming a landmark writes aria-labelledby on the element NOW, not only into the mapping for the next load', /el\.setAttribute\('aria-labelledby', lab\.id\)/.test(PANEL) && /named on the page now/.test(PANEL));
}

console.log('\nlandmarks: named now, read back, reported');
{
  const fixAll = PANEL.slice(PANEL.indexOf("const btn = e.target.closest('.scan-fix-all');"), PANEL.indexOf('async function applyStaticFixesToPage'));
  check('Fix all names every unnamed form/region on the page directly (aria-labelledby to its label/heading, else aria-label)', /const nameNow = \(probeOnly\)/.test(fixAll) && /el\.setAttribute\('aria-labelledby', src\.id\)/.test(fixAll) && /el\.setAttribute\('aria-label', name\)/.test(fixAll));
  check('…reads it back a second later and reports per landmark whether the name held or the engine stripped it', /await new Promise\(r => setTimeout\(r, 1200\)\);\s*\n\s*const after = await nameNow\(true\)/.test(fixAll) && /STRIPPED — the engine removed it/.test(fixAll));
  check('small controls in a finding row keep their own width (the ignore button is not a centred line)', /\.scan-item \.scan-ignore \{ margin-left: auto; opacity: \.7; width: auto/.test(read('styles.css')));
}

console.log('\ntest this page; pages folded in the table; nothing re-applied that is already there');
{
  const run = PANEL.slice(PANEL.indexOf('async function runElementScan'), PANEL.indexOf('function pickMappingFields'));
  check('"Test this page" runs only the page in front — no travelling, no rows for other pages', /const onlyHere = !!\(opts && opts\.onlyHere\)/.test(run) && /if \(onlyHere && pu && pu !== hereUrl\) continue;/.test(run) && /id="elemScanHereBtn"/.test(read('panel.html')));
  check('the pre-test apply counts ANY copy of the selector, or the trigger, as already applied', /if \(els\.some\(marked\)\) return false;/.test(run) && /return !trigs\.some\(marked\);/.test(run));
  const saved = PANEL.slice(PANEL.indexOf('async function renderElemScanSaved'), PANEL.indexOf('async function renderElemScanSaved') + 9000);
  check('the saved-mappings table is one accordion per page, this page first and open', /class="mapping-page elem-page\$\{isHere \? ' is-here' : ''\}"/.test(saved) && /— this page/.test(saved));
}

console.log('\na test press never leaves the page; a failed run says why');
{
  const d = dom(`<ul class="mainNav"><li><a class="trig" href="/members" role="button" aria-haspopup="true" aria-expanded="false">Members</a><ul class="sub" style="display:none"><li><a href="/x">x</a></li></ul></li></ul>`);
  const w = d.window, doc = w.document; w.chrome = { runtime: { sendMessage() {} } };
  // The site: the trigger link opens its submenu on click (and, being a link, would navigate).
  let navigated = false, opened = false;
  const a = doc.querySelector('.trig');
  a.addEventListener('click', (e) => { opened = true; doc.querySelector('.sub').style.display = 'block'; a.setAttribute('aria-expanded', 'true'); });
  doc.addEventListener('click', (e) => { if (!e.defaultPrevented && e.target.closest('a[href]')) navigated = true; });
  w.eval(ENGINE);
  await w.__u1TestEngine.runTest('menu', '.mainNav', { selectors: { items: '.trig', triggers: '.trig', submenus: '.sub' }, menubar: false });
  check('the menu test\'s click still runs the site\'s handler (the submenu opened)…', opened);
  check('…but the link\'s default — navigating away — is held back', !navigated);
  check('every synthetic press in the engine goes through safeClick', !/\b(trigger|trig|cb)\.click\(\)/.test(ENGINE) && /const safeClick = \(el\)/.test(ENGINE));
  check('when the engine cannot run, the panel says the actual reason instead of "the page may have changed"', /return \{ __err: String\(\(e && e\.message\) \|\| e\) \}/.test(PANEL) && /Could not run the test: \$\{res\.__err\}/.test(PANEL) && /navigated away while this was being driven/.test(PANEL));
}

console.log('\nthe table is live: chips move as mappings are driven, open a dialog, pages carry a scoreboard');
{
  const run = PANEL.slice(PANEL.indexOf('async function runElementScan'), PANEL.indexOf('function pickMappingFields'));
  check('each row is marked "testing…" as it starts and gets its verdict the moment it ends', /elemTableMark\(mappingKey\(m\), 'testing'\)/.test(run) && /elemTableMark\(mappingKey\(m\), last\.status\)/.test(run));
  check('the verdict chip is a button that opens the result in a dialog', /class="sm-test \$\{escapeHtml\(tv\.status\)\}\$\{tv\.stale \? ' stale' : ''\}" data-open-result=/.test(PANEL) && /async function openElemResultDialog/.test(PANEL) && /elem-modal-box/.test(PANEL));
  check('each page heading in the table carries its scoreboard: mapped, tested, passed, failed, …', /const pagePills = \(g\)/.test(PANEL) && /\$\{g\.keys\.length\} mapped/.test(PANEL) && /\$\{tested\} tested/.test(PANEL));
  check('a navigation mid-run is put back by itself, in the sweep too', !/waiting \$\{left\}s/.test(PANEL));
  check('the result card is one renderer shared by the list, the dialog and the table', /function elemResultItemHtml\(r, open\)/.test(PANEL) && /const item = \(r\) => elemResultItemHtml\(r\);/.test(PANEL));
}

console.log('\nheadings are not pressed; nothing leaves the page; simple types are not gated');
{
  const boot = (html) => { const d = dom(html); d.window.chrome = { runtime: { sendMessage() {} } }; d.window.eval(ENGINE); return d.window; };
  let w = boot(`<h2 id="h">Title</h2><h4 id="h2">Sub</h4>`);
  let r = await w.__u1TestEngine.runTest('heading', '#h', { level: 2 });
  check('a native heading mapped to its own level (nothing written) is NOT "not applied" — its own check judges it', !r.notApplied && r.static.steps.some(s => s.label === 'Is a heading' && s.status === 'pass'));
  check('a heading is never focused or pressed — "read by structure" is its only keyboard step', r.keyboard.steps.length === 1 && /Read by structure/.test(r.keyboard.steps[0].label) && r.keyboard.steps[0].status === 'pass');
  w = boot(`<a id="l" href="/x">Learn more</a>`);
  r = await w.__u1TestEngine.runTest('link', '#l', {});
  check('a link mapping on a real <a> is not gated either', !r.notApplied);
  // The engine's OWN click on a link (U1 answers Enter with a click) must not navigate.
  w = boot(`<ul class="m"><li><a class="t" href="/members">Members</a></li></ul>`);
  let navigated = false;
  w.document.addEventListener('click', (e) => { if (!e.defaultPrevented && e.target.closest('a[href]')) navigated = true; });
  // Simulate the engine: any keydown on the link dispatches a click on it.
  w.document.querySelector('.t').addEventListener('keydown', (e) => { e.target.click(); });
  await w.__u1TestEngine.runTest('menu', '.m', { selectors: { items: '.t' }, menubar: false });
  check('a click the ENGINE dispatches during the test (Enter → click on a link item) is held back from navigating', !navigated);
  check('the net is armed for the whole of one mapping\'s test and disarmed after', /const disarm = armNet\(\);/.test(ENGINE) && /finally \{ disarm\(\); \}/.test(ENGINE));
  check('the page heading in the table wraps and only the table scrolls sideways', /class="sm-scroll"/.test(PANEL) && /\.sm-scroll \{ overflow-x: auto/.test(read('styles.css')));
}

console.log('\nno errors filed against the extension for things it did not do');
{
  const rv = read('report-view.js');
  check('the report page drops the inline <script> meant for the .html download before writing it (extension CSP would only block and log it)', /replace\(\/<script\\b\(\?!\[\^>\]\*\\bsrc=\)/.test(rv));
  const er = read('event-recorder.js');
  check('the recorder does not forward an unload listener on a page whose Permissions-Policy forbids unload (the violation was filed against us)', /allowsFeature\('unload'\)/.test(er) && /if \(type === 'unload' && unloadBanned\) return undefined;/.test(er));
}

console.log('\nthe report you sent: each false verdict, closed');
{
  const boot = (html) => { const d = dom(html); d.window.chrome = { runtime: { sendMessage() {} } }; d.window.eval(ENGINE); return d.window; };
  let w = boot(`<a class="navbar-brand" href="/"><img src="logo.png" alt="Molina Healthcare"></a>`);
  let st = w.__u1TestEngine.runStaticChecks('link', '.navbar-brand', {}, {});
  check('a logo link is named by its image\'s alt (#44 "no accessible name" was wrong)', st.steps.some(s => s.label === 'Accessible name' && s.status === 'pass'));
  w = boot(`<div class="input-group" role="form"><label for="q" hidden>Search</label><input id="q"><button type="submit">Go</button></div>`);
  st = w.__u1TestEngine.runStaticChecks('form', '.input-group', {}, {});
  check('a <div role="form"> is the engine\'s own arrangement, not a warning (#33)', st.steps.some(s => s.label === 'Root is a form' && s.status === 'pass') && !st.steps.some(s => s.status === 'warn'));
  w = boot(`<div id="d" style="display:none"><a href="#" class="close">×</a></div>`);
  st = w.__u1TestEngine.runStaticChecks('dialog', '#d', { closeBtn: '.close' }, {});
  check('a link acting as the close control passes ("Close is a button")', st.steps.some(s => s.label === 'Close is a button' && s.status === 'pass'));
  check('several matches of a per-match type is information, not a warning (#43)', /P\('Selector matches multiple elements'/.test(ENGINE));
  w = boot(`<div id="cookie" style="display:none">We use cookies</div>`);
  let r = await w.__u1TestEngine.runTest('dialog', '#cookie', { selectors: {} });
  check('a closed dialog with no trigger mapped is ONE line and flagged closed (#2, #9, #43), not two trigger warnings', r.keyboard.closed === true && r.keyboard.steps.length === 1);
  check('…and the panel files it as skipped with the reason', /status: closed \? 'skipped'/.test(PANEL) && /no trigger the test can press/.test(PANEL));
  check('the trigger picked is the copy the ENGINE decorated, then a focusable one (#12 pressed an undecorated copy)', /const decorated = vis\.filter\(t => t\.hasAttribute\('aria-haspopup'\)/.test(ENGINE));
  check('dialog focus/escape and listbox escape wait for the patch\'s own settle and retry once (#5, #10, #14)', /waitFor\(\(\) => activeInside\(dlg\), 1500\)/.test(ENGINE) && /waitFor\(\(\) => !visible\(root\), 1800\)/.test(ENGINE) && /press\(root, 'Escape'\)/.test(ENGINE));
  check('a mapping is never filed under another site\'s page, and old records are healed', /function sameSiteUrl\(u\)/.test(PANEL) && /sameSiteUrl\(tab\.url\)\) \? tab\.url/.test(PANEL) && /page forgotten/.test(PANEL));
  check('the table shows the LAST run\'s verdicts; older ones are dimmed as "earlier" and not counted', /stale: !!\(v && v\.at && v\.at < freshSince\)/.test(PANEL) && /\(earlier\)/.test(PANEL));
}

{
  const css = read('styles.css');
  check('the verdict chip on a table row is always visible — only the action icons are hover-only', /\.sm-actions button:not\(\.sm-test\) \{\s*\n\s*opacity: 0;/.test(css) && /\.sm-actions \.sm-test \{ opacity: 1; \}/.test(css));
}

console.log('\nlistbox: Tab into the list is fine; the gate checks THIS widget\'s trigger');
{
  const boot = (html) => { const d = dom(html); d.window.chrome = { runtime: { sendMessage() {} } }; d.window.eval(ENGINE); return d.window; };
  // Opens on Enter, focus stays on the trigger; the first option is the next tab stop.
  const w = boot(`<button class="t" role="button" aria-haspopup="listbox" aria-expanded="false">Country</button><ul id="lb" role="listbox" style="display:none"><li role="option" tabindex="0" id="o1">A</li><li role="option" tabindex="-1" id="o2">B</li></ul>`);
  const t = w.document.querySelector('.t'), lb = w.document.getElementById('lb');
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { lb.style.display = 'block'; t.setAttribute('aria-expanded', 'true'); } });
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') w.document.getElementById('o2').focus(); if (e.key === 'Escape') { lb.style.display = 'none'; t.focus(); } });
  const r = await w.__u1TestEngine.runTest('listbox', '#lb', { selectors: { trigger: '.t', options: '#lb > li' } });
  const f = r.keyboard.steps.find(s => s.label === 'Focus reaches the list');
  check('focus that reaches the open list by Tab passes ("via Tab") — it need not jump in on its own', f && f.status === 'pass' && /via Tab/.test(f.message), JSON.stringify(f));
  check('a list focus cannot reach at all is a warning to check by hand, not a failure', /rec\('Focus reaches the list', inside \? 'pass' : 'warn'/.test(ENGINE));
  check('the "not applied" gate reads THIS widget\'s trigger (pickTrigger), not the selector\'s first match', /const trig = selectors\.trigger \? pickTrigger\(selectors\.trigger, root\) : null;/.test(ENGINE));
  check('"Page not recorded" says what it is', /Older mappings — no page recorded/.test(PANEL));
  check('a closed dialog with no trigger says plainly: open it, then test', /Open this dialog on the page, then test it/.test(PANEL));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

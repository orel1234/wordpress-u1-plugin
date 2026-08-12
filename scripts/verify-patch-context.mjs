// Reproduces TabsFixer's context resolution (u1_vanilla-js-a11y.js:23433
// getElement -> DomProvider.querySelector(selector, this.context)) and asserts
// the patch stops it throwing.
//
// The stand-in below is not a guess at the library: it is the two lookups that
// decide whether TabsFixer runs at all, in the order it does them. If the
// library ever changes them, this test still passes while the page stays broken
// — so treat it as a guard on the patch, not on U1.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SRC = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
const slice = (types) => {
  const wanted = new Set(['core', ...types]);
  const picked = [];
  const re = /\/\/#region u1-patch:([a-z]+)\r?\n([\s\S]*?)\r?\n\/\/#endregion/g;
  let m; while ((m = re.exec(SRC))) if (wanted.has(m[1])) picked.push(m[2]);
  return `'use strict';\n${picked.join('\n\n')}`;
};

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// The ordinary shape of a tab strip: the panels are SIBLINGS of the tab list,
// not children of it. That is what the fixer cannot cope with.
const html = `<!doctype html><body>
  <section class="finder">
    <div class="finder__card">
      <div class="finder__tabs" role="tablist" aria-label="Search modes">
        <button class="finder__tab" role="tab" aria-selected="true">By sport</button>
        <button class="finder__tab" role="tab" aria-selected="false">Size &amp; fit</button>
        <button class="finder__tab" role="tab" aria-selected="false">Store pickup</button>
        <button class="finder__tab" role="tab" aria-selected="false">Gift card</button>
        <button class="finder__tab" role="tab" aria-selected="false">Book a service</button>
      </div>
      <div class="finder__panel" role="tabpanel" id="finderSport">one</div>
      <div class="finder__panel" role="tabpanel" id="finderFit" hidden>two</div>
      <div class="finder__panel" role="tabpanel" id="finderPickup" hidden>three</div>
      <div class="finder__panel" role="tabpanel" id="finderGift" hidden>four</div>
      <div class="finder__panel" role="tabpanel" id="finderService" hidden>five</div>
    </div>
  </section></body>`;
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const d = dom.window.document;
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', {
  get() { return this.hasAttribute('hidden') ? 0 : 40; } });

// TabsFixer, reduced to the two lookups that decide whether it runs at all.
function u1FixTabs(context, props) {
  const { tab, tabPanel, tabList } = props.selectors;
  const root = d.querySelector(context);
  if (!root) throw new Error(`context '${context}' returned null`);
  const tabSel = [...d.querySelectorAll(`${context} ${tab}`)].map((_, i) => [tab, i]);
  const panelSel = tabSel.map((_, i) => [tabPanel, i]);
  const getElement = ([sel, i]) => {
    const el = [...root.querySelectorAll(sel)][i];   // querySelector(sel, this.context)
    if (!el) throw new Error(`Selector '${sel}:eq(${i})' returned null.`);
    return el;
  };
  const tabs = tabSel.map(getElement);
  const panels = panelSel.map(getElement);
  if (!root.querySelector(tabList)) throw new Error(`Selector '${tabList}' returned null.`);
  return { tabs: tabs.length, panels: panels.length, root: root.className };
}

const PROPS = { selectors: { tabList: '.finder__tabs', tab: '.finder__tab', tabPanel: '.finder__panel' } };

console.log('\nwithout the patch — the panel emits the tab list as context');
let before = null;
try { u1FixTabs('.finder__tabs', PROPS); }
catch (e) { before = e.message; }
check('the fixer throws, so nothing is wired', before !== null, '(it did not throw)');
console.log(`       → ${before}`);

console.log('\nwith the patch');
dom.window.u1 = { fix: { tabs: u1FixTabs } };
dom.window.eval(slice(['tabs']));

let after = null, res = null;
try { res = dom.window.u1.fix.tabs('.finder__tabs', PROPS); }
catch (e) { after = e.message; }
check('the fixer no longer throws', after === null, after || '');
check('it wired all 5 tabs and all 5 panels', !!res && res.tabs === 5 && res.panels === 5, JSON.stringify(res));
check('the context was widened to the nearest common ancestor',
  !!res && /finder__card/.test(res.root), JSON.stringify(res));

console.log('\ntwo strips must not bleed into each other');
{
  const two = new JSDOM(`<!doctype html><body>
    <div class="card"><div class="tabs"><b class="t">1</b><b class="t">2</b></div>
      <div class="p">A</div><div class="p">B</div></div>
    <div class="card"><div class="tabs"><b class="t">3</b><b class="t">4</b></div>
      <div class="p">C</div><div class="p">D</div></div></body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const dd = two.window.document;
  const seen = [];
  two.window.u1 = { fix: { tabs: (ctx, p) => {
    const root = dd.querySelector(ctx);
    seen.push({ ctx, cls: root.className,
      tabs: root.querySelectorAll(p.selectors.tab).length,
      panels: root.querySelectorAll(p.selectors.tabPanel).length });
  } } };
  two.window.eval(slice(['tabs']));
  const P2 = { selectors: { tabList: '.tabs', tab: '.t', tabPanel: '.p' } };
  two.window.u1.fix.tabs('.tabs', P2);
  check('called once per strip', seen.length === 2, JSON.stringify(seen));
  check('each call sees exactly its own 2 tabs and 2 panels',
    seen.every(s => s.tabs === 2 && s.panels === 2), JSON.stringify(seen));
}

console.log('\na context that already works is left alone');
{
  const ok = new JSDOM(`<!doctype html><body><div class="w"><div class="t">1</div><div class="p">A</div></div></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const got = [];
  ok.window.u1 = { fix: { tabs: (ctx) => got.push(ctx) } };
  ok.window.eval(slice(['tabs']));
  ok.window.u1.fix.tabs('.w', { selectors: { tabList: '.w', tab: '.t', tabPanel: '.p' } });
  check('the original selector is passed through untouched', got[0] === '.w', got.join());
}

console.log('\nsix tabs sharing ONE re-rendered region');
{
  // The shape mega.js builds: every tab points at a fixed aria-controls id that
  // does not exist, and the single panel names the current tab instead.
  const one = new JSDOM(`<!doctype html><body><section>
    <div class="tab-bar" role="tablist">
      <button class="tab-bar__btn" role="tab" id="t-week"  aria-controls="dealPanel" aria-selected="true">Week</button>
      <button class="tab-bar__btn" role="tab" id="t-run"   aria-controls="dealPanel" aria-selected="false">Running</button>
      <button class="tab-bar__btn" role="tab" id="t-boots" aria-controls="dealPanel" aria-selected="false">Boots</button>
    </div>
    <div class="deal-grid" id="dealGrid" role="tabpanel" aria-labelledby="t-boots"></div>
  </section></body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  Object.defineProperty(one.window.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  one.window.eval(slice(['tabs']));
  one.window.__u1Patch.correctors.forEach(f => f());
  const t = [...one.window.document.querySelectorAll('[role=tab]')];
  check('aria-selected follows the panel that names the tab, not index 0',
    t.map(x => x.getAttribute('aria-selected')).join() === 'false,false,true',
    t.map(x => x.getAttribute('aria-selected')).join());
  check('the tab stop moves with it', t.map(x => x.tabIndex).join() === '-1,-1,0',
    t.map(x => x.tabIndex).join());
  check('the dangling aria-controls is repaired to the real panel id',
    t.every(x => x.getAttribute('aria-controls') === 'dealGrid'),
    t.map(x => x.getAttribute('aria-controls')).join());
}

console.log('\na selector that matches a strip with no panels');
{
  const two = new JSDOM(`<!doctype html><body>
    <section><div class="tab-bar"><b class="b">1</b><b class="b">2</b></div>
      <div class="deal-grid">A</div></section>
    <section><div class="tab-bar"><b class="b">3</b><b class="b">4</b></div></section>
    </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const seen = [];
  two.window.u1 = { fix: { tabs: (ctx) => seen.push(two.window.document.querySelector(ctx).tagName) } };
  two.window.eval(slice(['tabs']));
  two.window.u1.fix.tabs('.tab-bar', { selectors: { tabList: '.tab-bar', tab: '.b', tabPanel: '.deal-grid' } });
  check('the strip without panels is skipped instead of throwing', seen.length === 1, JSON.stringify(seen));
}

console.log('\na tab selector wider than its own list');
{
  // The reported failure. #dealTabs holds six tabs; five more elements share
  // the class elsewhere on the page; the panel sits outside the list. Climbing
  // to reach the panel picks up the strays, the count check refused, the
  // wrapper returned before calling u1.fix.tabs — and nothing said so. The
  // strip was simply never decorated.
  // The panel is only reachable at .wrap, and .wrap also holds a stray tab —
  // which is the arrangement that used to end the strip.
  const w = new JSDOM(`<!doctype html><body>
    <div class="wrap">
      <div class="left"><div id="dealTabs"><b class="t">1</b><b class="t">2</b></div></div>
      <div class="right"><b class="t">x</b><b class="t">y</b><b class="t">z</b></div>
      <div class="panel">A</div>
    </div>
    </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const calls = [];
  w.window.u1 = { fix: { tabs: (ctx, props) => calls.push({ ctx, tab: props.selectors.tab }) } };
  w.window.eval(slice(['tabs']));
  w.window.u1.fix.tabs('#dealTabs',
    { selectors: { tabList: '#dealTabs', tab: '.t', tabPanel: '.panel' } });

  check('the strip is decorated instead of silently skipped', calls.length === 1,
    JSON.stringify(calls));
  const d = w.window.document;
  check('…from a context that can see the panel',
    calls.length === 1 && !!d.querySelector(calls[0].ctx).querySelector('.panel'));
  check('…with the tab selector scoped to its own list, not the whole page',
    calls.length === 1 && d.querySelectorAll(calls[0].tab).length === 2,
    calls.length ? `${calls[0].tab} → ${d.querySelectorAll(calls[0].tab).length}` : '');
  check('…and nothing was recorded as skipped', w.window.__u1Patch.skipped.length === 0,
    JSON.stringify(w.window.__u1Patch.skipped));
}

console.log('\na skip is recorded rather than swallowed');
{
  const w = new JSDOM(`<!doctype html><body>
    <section><div class="tab-bar"><b class="b">1</b></div><div class="grid">A</div></section>
    <section><div class="tab-bar"><b class="b">2</b></div></section>
    </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  w.window.u1 = { fix: { tabs: () => {} } };
  w.window.eval(slice(['tabs']));
  w.window.u1.fix.tabs('.tab-bar',
    { selectors: { tabList: '.tab-bar', tab: '.b', tabPanel: '.grid' } });
  const sk = w.window.__u1Patch.skipped;
  check('the strip with no panel of its own is on the skipped list', sk.length === 1,
    JSON.stringify(sk));
  check('…and says which fix and which selector', sk.length === 1 &&
    sk[0].type === 'tabs' && sk[0].selector === '.tab-bar' && !!sk[0].why);
}

console.log('\narrow keys are counted from focus, not from the library\'s index');
{
  const k = new JSDOM(`<!doctype html><body><section>
    <div class="tab-bar" role="tablist">
      <button role="tab" id="k0" aria-controls="dealPanel">0</button>
      <button role="tab" id="k1" aria-controls="dealPanel">1</button>
      <button role="tab" id="k2" aria-controls="dealPanel">2</button>
      <button role="tab" id="k3" aria-controls="dealPanel">3</button>
    </div>
    <div id="dealGrid" role="tabpanel" aria-labelledby="k0"></div>
  </section></body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  Object.defineProperty(k.window.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  const kd = k.window.document;
  // The library's handler: it moves focus from an index it stores itself, which
  // here is stale — exactly the state that makes one arrow jump several tabs.
  let libraryRan = 0, libraryIndex = 3;
  [...kd.querySelectorAll('[role=tab]')].forEach((t) => t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight') return;
    libraryRan++;
    kd.querySelectorAll('[role=tab]')[(libraryIndex + 1) % 4].focus();
  }));
  k.window.eval(slice(['tabs']));

  kd.getElementById('k1').focus();
  const ev = new k.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  kd.activeElement.dispatchEvent(ev);
  check('focus moves exactly one tab from where it was', kd.activeElement.id === 'k2', kd.activeElement.id);
  check("the library's handler is suppressed so it cannot move focus again", libraryRan === 0, String(libraryRan));
  check('the key is consumed, so the page does not scroll', ev.defaultPrevented);

  kd.getElementById('k3').focus();
  kd.activeElement.dispatchEvent(new k.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check('it wraps from the last tab to the first', kd.activeElement.id === 'k0', kd.activeElement.id);

  const ev2 = new k.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  kd.activeElement.dispatchEvent(ev2);
  check('Down does nothing on a horizontal strip', kd.activeElement.id === 'k0' && !ev2.defaultPrevented);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

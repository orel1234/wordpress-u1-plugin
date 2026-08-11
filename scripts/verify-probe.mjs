// Does the probe ever damage the page it is inspecting?
//
//   node scripts/verify-probe.mjs
//
// This runs FIRST and it is the test that must never fail. Everything else in
// this tool reads; the probe presses. It presses things on a stranger's live
// site, so the question "could this send a form or navigate away" has to be
// answered by a test rather than by care.
//
// The order below is deliberate: safety, then restoration, then whether the
// thing works at all. A probe that finds nothing is a disappointment. A probe
// that submits somebody's checkout is an incident.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROBE = readFileSync(join(ROOT, 'probe.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

function page(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/start',
  });
  const w = dom.window;
  // jsdom gives everything a zero box; treat hidden as hidden and the rest as
  // on screen, which is what the fingerprint actually cares about.
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const hidden = this.hasAttribute('hidden') || (this.closest && this.closest('[hidden]'));
    return hidden ? { width: 0, height: 0 } : { width: 200, height: 40 };
  };
  w.eval(PROBE);
  return w;
}

// ── 1. What must never be pressed ───────────────────────────────────────────
console.log('\nthings the probe refuses to press');
{
  const w = page(`
    <a id="link" href="/checkout">Go to checkout</a>
    <a id="hash" href="#panel">Open panel</a>
    <a id="blank" href="/x" target="_blank">New tab</a>
    <a id="dl" href="/f.pdf" download>Download</a>
    <form id="f">
      <button id="untyped">Untyped in a form</button>
      <button id="typed" type="button">Typed in a form</button>
      <input id="submit" type="submit" value="Send">
    </form>
    <button id="del">Delete account</button>
    <button id="pay">Pay now</button>
    <button id="cart">Add to cart</button>
    <button id="heb">מחק הזמנה</button>
    <button id="hebpay">לתשלום</button>
    <button id="off" disabled>Disabled</button>
    <button id="menu">Products</button>`);
  const P = w.__u1Probe;
  const ok = (id) => P.safeToClick(w.document.getElementById(id));

  check('a link to another page', !ok('link').ok, ok('link').why);
  check('a link that opens a new tab', !ok('blank').ok);
  check('a download link', !ok('dl').ok);
  check('a submit input', !ok('submit').ok);
  // The default nobody remembers, and the likeliest way to post a stranger's form.
  check('an UNTYPED button inside a form — it submits by default', !ok('untyped').ok, ok('untyped').why);
  check('a disabled control', !ok('off').ok);
  check('"Delete account"', !ok('del').ok);
  check('"Pay now"', !ok('pay').ok);
  check('"Add to cart"', !ok('cart').ok);
  check('"מחק הזמנה"', !ok('heb').ok);
  check('"לתשלום"', !ok('hebpay').ok);

  console.log('\n  …and what it will press');
  check('an in-page anchor', ok('hash').ok, ok('hash').why);
  check('a button explicitly typed button, even inside a form', ok('typed').ok, ok('typed').why);
  check('an ordinary button with a harmless label', ok('menu').ok, ok('menu').why);
}

// ── 2. The net, which does not depend on the list above being right ─────────
console.log('\nthe net holds even when the list is wrong');
{
  const w = page(`<a id="go" href="/somewhere-else">Products</a>
                  <form id="f" action="/subscribe"><input name="e"><button type="submit">x</button></form>`);
  const P = w.__u1Probe;
  const d = w.document;

  let navigated = false, submitted = false;
  d.getElementById('go').addEventListener('click', (e) => { if (!e.defaultPrevented) navigated = true; });
  d.getElementById('f').addEventListener('submit', (e) => { if (!e.defaultPrevented) submitted = true; });

  const net = P.armNet();
  // Press them DIRECTLY, bypassing safeToClick entirely — this is the "layer 1
  // got it wrong" case, and the whole reason layer 2 exists.
  d.getElementById('go').click();
  d.getElementById('f').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

  check('a navigation click is cancelled', !navigated);
  check('a form submit is cancelled', !submitted);
  check('the page never left', w.location.pathname === '/start', w.location.pathname);
  check('window.open is stubbed while armed', w.open('/x') === null);

  net.disarm();
  check('and the page is handed back intact afterwards', typeof w.open === 'function');
  let after = false;
  d.getElementById('go').addEventListener('click', (e) => { if (!e.defaultPrevented) after = true; });
  d.getElementById('go').click();
  check('once disarmed, the page behaves normally again', after);
}

// ── 3. Put it back ──────────────────────────────────────────────────────────
console.log('\nleaving the page as it was found');
{
  const w = page(`
    <div id="wrap">
      <button id="t">Men</button>
      <div id="panel" hidden>the submenu</div>
    </div>`);
  const d = w.document;
  d.getElementById('t').addEventListener('click', () => {
    const p = d.getElementById('panel');
    p.hidden = !p.hidden;
  });
  const before = d.getElementById('panel').hidden;
  const res = await w.__u1Probe.probeOne(d.getElementById('t'),
    { scope: d.getElementById('wrap'), settle: 0 });

  check('the panel is closed again afterwards', d.getElementById('panel').hidden === before);
  check('and the probe says so', res.restored === true);
}

// ── 4. Only now: does it actually learn anything ────────────────────────────
console.log('\nwhat pressing it reveals');
{
  const w = page(`
    <div id="nav">
      <div class="c1"><div id="t1">Men</div><div id="p1" hidden>men links</div></div>
      <div class="c1"><div id="t2">Women</div><div id="p2" hidden>women links</div></div>
    </div>`);
  const d = w.document;
  for (const [t, p] of [['t1', 'p1'], ['t2', 'p2']]) {
    d.getElementById(t).addEventListener('click', () => {
      const el = d.getElementById(p); el.hidden = !el.hidden;
    });
  }
  const res = await w.__u1Probe.probeOne(d.getElementById('t1'),
    { scope: d.getElementById('nav'), settle: 0 });

  // Not one of these elements has a role, a semantic tag or a meaningful class.
  check('a trigger with no name is found to be a trigger', res.opened.length === 1, JSON.stringify(res));
  check('and what it opens is identified exactly',
    res.opened[0] === d.getElementById('p1'), res.opened[0] && res.opened[0].id);
  check('the other panel is untouched', d.getElementById('p2').hidden === true);
  check('it closed again', res.restored === true);
}

console.log('\nthe contents of a panel are not separate findings');
{
  const w = page(`
    <div id="s">
      <div id="tr">More</div>
      <div id="pan" hidden><div id="a">one</div><div id="b">two</div></div>
    </div>`);
  const d = w.document;
  d.getElementById('tr').addEventListener('click', () => {
    const p = d.getElementById('pan'); p.hidden = !p.hidden;
  });
  const res = await w.__u1Probe.probeOne(d.getElementById('tr'),
    { scope: d.getElementById('s'), settle: 0 });
  check('the panel is reported, not its children', res.opened.length === 1 &&
    res.opened[0].id === 'pan', res.opened.map(e => e.id).join());
}

// ── 5. A whole page with nothing to read ────────────────────────────────────
// This is the case the probe exists for: a nav, a tab strip and an accordion,
// built the way the hostile fixture builds them — bare divs, no roles, no
// meaningful classes, every handler hung in JavaScript. Reading finds nothing
// here; that is measured, not assumed.
console.log('\na page with no semantics at all');
{
  const REC = readFileSync(join(ROOT, 'event-recorder.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><body><div id="page">
    <div id="nav">
      <div class="c1"><div id="n1">Men</div><div id="np1" hidden><a href="/a">Sneakers</a><a href="/b">Boots</a></div></div>
      <div class="c1"><div id="n2">Women</div><div id="np2" hidden><a href="/c">Heels</a><a href="/d">Flats</a></div></div>
    </div>
    <div id="strip"><div id="t1">Deals</div><div id="t2">Running</div><div id="t3">Kids</div></div>
    <div id="tp1">deals</div><div id="tp2" hidden>running</div><div id="tp3" hidden>kids</div>
    <div id="acc"><div id="q1">Shipping?</div><div id="a1" hidden>Two days.</div></div>
  </div></body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window, d = w.document;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const h = this.hasAttribute('hidden') || (this.closest && this.closest('[hidden]'));
    return h ? { width: 0, height: 0 } : { width: 200, height: 40 };
  };
  w.eval(REC);                       // installed before the page's own script
  w.eval(`
    [['n1','np1'],['n2','np2'],['q1','a1']].forEach(function(p){
      document.getElementById(p[0]).addEventListener('click', function(){
        var el = document.getElementById(p[1]); el.hidden = !el.hidden; }); });
    ['t1','t2','t3'].forEach(function(id,i){
      document.getElementById(id).addEventListener('click', function(){
        ['tp1','tp2','tp3'].forEach(function(p,j){ document.getElementById(p).hidden = i!==j; }); }); });`);
  w.eval(PROBE);

  const watched = ['np1','np2','tp1','tp2','tp3','a1'];
  const state = () => watched.map(i => d.getElementById(i).hidden ? '-' : 'X').join('');
  const before = state();

  const out = await w.__u1Probe.probeAll(d.getElementById('page'), { settle: 0 });
  const of = (t) => out.components.filter(c => c.type === t);
  const idsOf = (els) => els.map(e => e.id).join(',');

  check('the tab strip is found', of('tabs').length === 1,
    out.components.map(c => c.type).join());
  check('…with every tab, including the one already selected',
    of('tabs').length === 1 && idsOf(of('tabs')[0].parts.tab) === 't1,t2,t3',
    of('tabs')[0] && idsOf(of('tabs')[0].parts.tab));
  check('…and the panels it switches between',
    of('tabs').length === 1 && of('tabs')[0].parts.tabPanel.length >= 2);
  check('both drop-downs are found, and called menus because they hold links',
    of('menu').length === 2, String(of('menu').length));
  check('…each paired with the panel IT opens, not another one',
    of('menu').length === 2 &&
    of('menu').every(c => c.parts.trigger[0].id.replace('n', 'np') === c.parts.panel[0].id),
    of('menu').map(c => c.parts.trigger[0].id + '→' + c.parts.panel[0].id).join(' '));
  check('the accordion is found, and NOT called a menu — it holds no links',
    of('accordion').length === 1 && of('accordion')[0].parts.panel[0].id === 'a1');

  // Not one of these decisions read a tag, a role or a class. They are all
  // descriptions of something that was watched happening.
  check('nothing was skipped as unsafe', out.skipped === 0, String(out.skipped));
  check('the page is byte-for-byte where it started', state() === before,
    `${before} → ${state()}`);
  check('…and the probe says so', out.restored === true);
}

// ── The page that gives nothing away at all ─────────────────────────────────
// No recorder, no roles, no tags, no classes. The only thing left is that
// somebody had to make the clickable things LOOK clickable.
console.log('\nwhen the only signal left is the cursor');
{
  const dom = new JSDOM(`<!doctype html><body><div id="page">
    <div id="strip"><div id="t1">Deals</div><div id="t2">Running</div></div>
    <div id="p1">deals</div><div id="p2" hidden>running</div>
    <div id="text">Just a paragraph of prose.</div>
  </div></body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window, d = w.document;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const h = this.hasAttribute('hidden');
    return h ? { width: 0, height: 0, top: 0, left: 0 } : { width: 200, height: 40, top: 10, left: 10 };
  };
  // jsdom applies no stylesheets, so the cursor is declared the way a real page
  // declares it: on the things meant to be pressed, and nothing else.
  const POINTER = new Set(['t1', 't2']);
  w.getComputedStyle = (el) => ({ cursor: POINTER.has(el.id) ? 'pointer' : 'auto', position: 'static' });
  w.eval(`['t1','t2'].forEach(function(id,i){
    document.getElementById(id).addEventListener('click', function(){
      ['p1','p2'].forEach(function(p,j){ document.getElementById(p).hidden = i!==j; }); }); });`);
  w.eval(PROBE);

  // No event recorder installed at all — this is a page nobody prepared for.
  check('the recorder is absent', !w.__u1EventMap);
  const list = w.__u1Probe.pressable(d.getElementById('page'), {});
  check('the clickable-looking things are found anyway',
    list.map(e => e.id).sort().join() === 't1,t2', list.map(e => e.id).join());
  check('and the prose is not', !list.some(e => e.id === 'text'));

  const out = await w.__u1Probe.probeAll(d.getElementById('page'), { settle: 0 });
  check('the tab strip is identified from behaviour alone',
    out.components.length === 1 && out.components[0].type === 'tabs',
    out.components.map(c => c.type).join());
  check('the page is put back', out.restored === true);
}

console.log('\ntext inside a clickable box is not a second candidate');
{
  const dom = new JSDOM(`<!doctype html><body><div id="s">
    <div id="btn"><span id="inner">Open</span></div><div id="pan" hidden>x</div>
  </div></body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window, d = w.document;
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 200, height: 40, top: 10, left: 10 });
  // The span inherits `pointer` from the div, as it does on every real page.
  w.getComputedStyle = (el) => ({ cursor: ['btn', 'inner'].includes(el.id) ? 'pointer' : 'auto', position: 'static' });
  w.eval(PROBE);
  const list = w.__u1Probe.pressable(d.getElementById('s'), {});
  check('only the element that OWNS the pointer is pressed',
    list.map(e => e.id).join() === 'btn', list.map(e => e.id).join());
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

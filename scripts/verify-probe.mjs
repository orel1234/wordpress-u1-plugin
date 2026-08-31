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

// ── 3b. Reading the OPEN state is the caller's one chance, and whileOpen is it
//
// Everything a mapping needs from the open state — selectors, a shape, markup
// — has the same deadline as the overlay and focus measurements: after the
// restore there is nothing left to read. The hook runs while the widget is
// open, its answer rides back on the report, and the restore stays
// unconditional — a hook that throws must not leave the page open.
console.log('\nreading the open state through whileOpen');
{
  const w = page(`
    <div id="wrap">
      <button id="t">Sign In</button>
      <ul id="menu" hidden><li>Profile</li><li>Log out</li></ul>
    </div>`);
  const d = w.document;
  d.getElementById('t').addEventListener('click', () => {
    const m = d.getElementById('menu');
    m.hidden = !m.hidden;
  });
  const res = await w.__u1Probe.probeOne(d.getElementById('t'), {
    scope: d.getElementById('wrap'), settle: 0,
    whileOpen: (panel) => ({ id: panel && panel.id, wasOpen: panel && !panel.hidden,
                             rows: panel ? panel.children.length : 0 }),
  });
  check('the hook is handed the panel while it is OPEN', res.held && res.held.wasOpen === true,
    JSON.stringify(res.held));
  check('and it is the right panel', res.held && res.held.id === 'menu');
  check('what it read rides back on the report', res.held && res.held.rows === 2);
  check('the page is still put back afterwards', d.getElementById('menu').hidden === true);
  check('and the probe still says so', res.restored === true);
}
{
  const w = page(`
    <div id="wrap">
      <button id="t">Sign In</button>
      <ul id="menu" hidden><li>Profile</li></ul>
    </div>`);
  const d = w.document;
  d.getElementById('t').addEventListener('click', () => {
    const m = d.getElementById('menu');
    m.hidden = !m.hidden;
  });
  const res = await w.__u1Probe.probeOne(d.getElementById('t'), {
    scope: d.getElementById('wrap'), settle: 0,
    whileOpen: () => { throw new Error('reader blew up'); },
  });
  check('a hook that throws does not stop the restore', d.getElementById('menu').hidden === true);
  check('and the failure is reported, not swallowed silently',
    res.held && /reader blew up/.test(res.held.error || ''), JSON.stringify(res.held));
}

// ── A background tab never fires an animation frame ─────────────────────────
//
// Chrome freezes rAF in hidden tabs. raf() waited on it unconditionally, so a
// probe pressed on a pinned background tab hung forever mid-press — and the
// finally that disarms the net never ran, leaving every link click on the
// site cancelled: reported as "the extension froze the site".
console.log('\na hidden tab still finishes');
{
  const w = page(`<div id="wrap"><button id="t">Menu</button><div id="p" hidden>x</div></div>`);
  w.requestAnimationFrame = () => 0;   // queued, never fired — a hidden tab
  const d = w.document;
  d.getElementById('t').addEventListener('click', () => {
    const p = d.getElementById('p'); p.hidden = !p.hidden;
  });
  const res = await Promise.race([
    w.__u1Probe.probeOne(d.getElementById('t'), { scope: d.getElementById('wrap'), settle: 0 }),
    new Promise((r) => setTimeout(() => r({ hung: true }), 2000)),
  ]);
  check('probeOne completes without a single animation frame',
    !res.hung && res.skipped === false, JSON.stringify(res));
  check('…and the page is still put back', d.getElementById('p').hidden === true);
}

// ── The open-state signals that used to be thrown away ──────────────────────
//
// Stage 2 of the audit: aria-hidden/inert on everything ELSE, the scroll
// lock, the backdrop, focus landing inside — each measured while open, each
// returned as itself rather than squashed into an anonymous count.
console.log('\nthe open-state signals are handed back');
{
  const w = page(`
    <div id="w">
      <main id="mainC">page content</main>
      <button id="t">Terms</button>
      <div id="box" hidden><p>Please read.</p><button id="okBtn">OK</button></div>
      <div id="veil" hidden></div>
    </div>`);
  const d = w.document;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    if (this.id === 'veil') return { top: 0, left: 0, right: 1024, bottom: 768, width: 1024, height: 768 };
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  w.getComputedStyle = (el) => ({
    position: el && el.id === 'veil' ? 'fixed' : 'static',
    overflow: el === d.body && d.body.dataset.lock ? 'hidden' : 'visible',
    backgroundColor: el && el.id === 'veil' ? 'rgba(0,0,0,0.45)' : 'rgb(255,255,255)',
    opacity: '1', visibility: 'visible', display: 'block',
  });
  d.getElementById('t').addEventListener('click', () => {
    const open = d.getElementById('box').hidden;
    d.getElementById('box').hidden = !open ? true : false;
    d.getElementById('veil').hidden = d.getElementById('box').hidden;
    if (!d.getElementById('box').hidden) {
      d.getElementById('mainC').setAttribute('aria-hidden', 'true');
      d.getElementById('mainC').setAttribute('inert', '');
      d.body.dataset.lock = '1';
      d.getElementById('okBtn').focus();
    } else {
      d.getElementById('mainC').removeAttribute('aria-hidden');
      d.getElementById('mainC').removeAttribute('inert');
      delete d.body.dataset.lock;
    }
  });
  const res = await w.__u1Probe.probeOne(d.getElementById('t'),
    { scope: d.getElementById('w'), settle: 0 });
  check('hidOthers names WHO was shut out, not how many',
    (res.hidOthers || []).length === 1 && res.hidOthers[0].id === 'mainC',
    JSON.stringify((res.hidOthers || []).map((e) => e.id)));
  check('the scroll lock is measured while open', res.scrollLocked === true);
  check('the backdrop beside the panel is identified',
    !!res.backdrop && res.backdrop.id === 'veil', res.backdrop && res.backdrop.id);
  check('focus landing inside is recorded', res.focusEntered === true && res.activeInside === true);
  check('…and the page is still put back', d.getElementById('box').hidden === true &&
    !d.getElementById('mainC').hasAttribute('aria-hidden'));
}

// ── 4.1: the signals become the verdict ─────────────────────────────────────
//
// Stage 2 measured them; stage 4.1 finally lets them DECIDE. Any one dialog
// tell suffices — the scroll lock, shutting the rest of the page out, a
// backdrop — and the one veto: small-and-at-the-trigger beats a "modal"
// class name.
console.log('\n4.1 — each dialog signal convicts on its own');
{
  const mk = (panelAttrs, opener) => {
    const w = page(`
      <div id="w">
        <main id="mainC">page content</main>
        <button id="t">Terms</button>
        <div id="box" ${panelAttrs} hidden><p>Please read this before you go on.</p><button>OK</button></div>
      </div>`);
    const d = w.document;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
      return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
    };
    w.getComputedStyle = (el) => ({
      position: 'static',
      overflow: el === d.body && d.body.dataset.lock ? 'hidden' : 'visible',
      backgroundColor: 'rgb(255,255,255)',
      opacity: '1', visibility: 'visible', display: 'block', cursor: 'auto',
    });
    d.getElementById('t').addEventListener('click', () => {
      const box = d.getElementById('box');
      box.hidden = !box.hidden;
      opener(d, !box.hidden);
    });
    return w;
  };

  // The scroll lock ALONE — panel sits in the flow, nothing else changes.
  const lock = mk('', (d, open) => {
    if (open) d.body.dataset.lock = '1'; else delete d.body.dataset.lock;
  });
  let out = await lock.__u1Probe.probeAll(lock.document.getElementById('w'), { settle: 0 });
  check('a reveal that locks the page scroll is a dialog',
    out.components.some((c) => c.type === 'dialog' && /scroll/.test(c.why)),
    out.components.map((c) => c.type + ':' + c.why).join(' | ') || '(nothing)');

  // Shutting the rest of the page out ALONE.
  const shut = mk('', (d, open) => {
    if (open) d.getElementById('mainC').setAttribute('aria-hidden', 'true');
    else d.getElementById('mainC').removeAttribute('aria-hidden');
  });
  out = await shut.__u1Probe.probeAll(shut.document.getElementById('w'), { settle: 0 });
  check('a reveal that aria-hides the rest of the page is a dialog',
    out.components.some((c) => c.type === 'dialog' && /hid the rest/.test(c.why)),
    out.components.map((c) => c.type + ':' + c.why).join(' | ') || '(nothing)');
}

console.log('\n4.1 — the veil is the backdrop, its neighbour is the dialog');
{
  const w = page(`
    <div id="w">
      <button id="t">Leave</button>
      <div id="veil" hidden></div>
      <div id="box" hidden><p>You are about to leave.</p><button>Stay</button></div>
    </div>`);
  const d = w.document;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    if (this.id === 'veil') return { top: 0, left: 0, right: 1024, bottom: 768, width: 1024, height: 768 };
    if (this.id === 'box') return { top: 284, left: 312, right: 712, bottom: 484, width: 400, height: 200 };
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  w.getComputedStyle = (el) => ({
    position: el && (el.id === 'veil' || el.id === 'box') ? 'fixed' : 'static',
    overflow: 'visible',
    backgroundColor: el && el.id === 'veil' ? 'rgba(0,0,0,0.45)' : 'rgb(255,255,255)',
    opacity: '1', visibility: 'visible', display: 'block', cursor: 'auto',
  });
  d.getElementById('t').addEventListener('click', () => {
    const open = d.getElementById('box').hidden;
    d.getElementById('box').hidden = !open;
    d.getElementById('veil').hidden = !open;
  });
  const out = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0 });
  const dlg = out.components.find((c) => c.type === 'dialog');
  check('the component is a dialog', !!dlg,
    out.components.map((c) => c.type).join() || '(nothing)');
  check('…rooted on the BOX, never on the veil beside it',
    dlg && dlg.root === d.getElementById('box'),
    dlg && (dlg.root.id || '(no id)'));
}

console.log('\n4.1 — a drawer is a dialog with an edge, a dropdown is not a modal');
{
  const mk = (attrs, rects, positions) => {
    const w = page(`
      <div id="w">
        <button id="t">Open</button>
        <div id="box" ${attrs} hidden><p>Some longer prose content sits here for reading.</p><button>OK</button></div>
      </div>`);
    const d = w.document;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
      if (rects[this.id]) return rects[this.id];
      return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
    };
    w.getComputedStyle = (el) => ({
      position: (el && positions[el.id]) || 'static',
      overflow: 'visible', backgroundColor: 'rgb(255,255,255)',
      opacity: '1', visibility: 'visible', display: 'block', cursor: 'auto',
    });
    d.getElementById('t').addEventListener('click', () => {
      d.getElementById('box').hidden = !d.getElementById('box').hidden;
    });
    return w;
  };

  // Fixed, nearly full height, hugging the left edge, under half the width.
  const drawer = mk('', {
    box: { top: 0, left: 0, right: 300, bottom: 760, width: 300, height: 760 },
  }, { box: 'fixed' });
  let out = await drawer.__u1Probe.probeAll(drawer.document.getElementById('w'), { settle: 0 });
  let c = out.components.find((x) => x.type === 'dialog');
  check('an edge-hugging full-height panel is a dialog', !!c,
    out.components.map((x) => x.type).join() || '(nothing)');
  check('…and carries the drawer subtype', c && c.subtype === 'drawer' && /DRAWER/.test(c.why),
    c && (c.subtype + ' / ' + c.why));

  // Absolute, right at its trigger, barely bigger than it — and the class
  // SAYS "modal". The geometry outranks the word.
  const near = mk('class="modal"', {
    box: { top: 52, left: 10, right: 310, bottom: 152, width: 300, height: 100 },
  }, { box: 'absolute' });
  out = await near.__u1Probe.probeAll(near.document.getElementById('w'), { settle: 0 });
  check('a small panel AT its trigger is not a dialog, whatever its class says',
    out.components.length && out.components.every((x) => x.type !== 'dialog'),
    out.components.map((x) => x.type + ':' + x.why).join(' | ') || '(nothing)');
}

// ── What was stopped is finally handed back ─────────────────────────────────
console.log('\nblocked navigations are reported');
{
  // history.pushState, not location.assign: jsdom's Location methods are not
  // writable, so the net's stub cannot take there — in a real browser it can,
  // and both routes share the same `note()`.
  const w = page(`<div id="w"><button id="go">More info</button></div>`);
  const d = w.document;
  d.getElementById('go').addEventListener('click', () => {
    w.history.pushState({}, '', '/somewhere-else');
  });
  const out = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 0, repeat: true });
  check('probeAll returns the navigations its net stopped',
    Array.isArray(out.blocked) && out.blocked.length >= 1 && /history\.pushState/.test(out.blocked[0]),
    JSON.stringify(out.blocked));
  const net = w.__u1Probe.armNet();
  const back = net.disarm();
  check('disarm() hands the list back instead of undefined', Array.isArray(back));
}

// ── F-lite: the snapshot decides membership, not the live rects ─────────────
console.log('\nthe plan decides who belongs where');
{
  const w = page(`
    <div id="w">
      <button id="nearBtn">Near</button>
      <button id="farBtn">Far</button>
      <div id="farPanel" hidden>far panel</div>
      <div id="skipTarget" tabindex="-1">skip-link target</div>
      <button id="negBtn" tabindex="-1">Still a button</button>
    </div>`);
  const d = w.document;
  // Distinct document-Y per element, so the bands mean something.
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const tops = { nearBtn: 100, farBtn: 5000, skipTarget: 5010, negBtn: 5020 };
    const t = tops[this.id] != null ? tops[this.id] : 10;
    return { top: t, bottom: t + 40, left: 10, right: 210, width: 200, height: 40 };
  };
  d.getElementById('farBtn').addEventListener('click', () => {
    const p = d.getElementById('farPanel'); p.hidden = !p.hidden;
  });
  w.__u1Probe.resetRun();
  const planned = w.__u1Probe.planRun(d.getElementById('w'));
  const snap = w.__u1Probe.planSnapshot();
  check('the snapshot holds every candidate at its document-Y',
    planned === 3 && snap.some((p) => p.id === 'farBtn' && p.docY === 5000),
    JSON.stringify(snap));
  check('a tabindex="-1" non-control is not a candidate; a button with it still is',
    !snap.some((p) => p.id === 'skipTarget') && snap.some((p) => p.id === 'negBtn'));
  const out = await w.__u1Probe.probeAll(d.getElementById('w'),
    { settle: 0, idle: 0, inViewport: true, sectionY: { from: 4000, to: 6000 } });
  check('a far section presses ITS planned members, live viewport notwithstanding',
    out.pressed >= 1 && out.components.some((c) => c.type && c.parts.trigger &&
      c.parts.trigger[0] === d.getElementById('farBtn')),
    JSON.stringify({ pressed: out.pressed, comps: out.components.map((c) => c.type) }));
}

// ── 4.2: accordion needs evidence; the rest says "observed, unclassified" ──
console.log('\n4.2 — the accordion bucket closes to the unexplained');
{
  // A lone disclosure that keeps honest aria-expanded: accordion, single.
  const disc = page(`
    <div id="w">
      <div><button id="t" aria-expanded="false">More</button><span>x</span></div>
      <section><div id="p" hidden>The rest of the story.</div></section>
    </div>`);
  disc.document.getElementById('t').addEventListener('click', function () {
    const p = disc.document.getElementById('p');
    p.hidden = !p.hidden;
    this.setAttribute('aria-expanded', String(!p.hidden));
  });
  let out = await disc.__u1Probe.probeAll(disc.document.getElementById('w'), { settle: 0 });
  let c = out.components.find((x) => x.type === 'accordion');
  check('a lone trigger whose aria-expanded flips is an accordion', !!c,
    out.components.map((x) => x.type + ':' + x.why).join(' | ') || '(nothing)');
  check('…marked single:true — a disclosure, not a stack', c && c.single === true,
    c && JSON.stringify({ single: c.single }));

  // A reveal with NO disclosure evidence: far panel, no aria, no siblings.
  const stray = page(`
    <div id="w">
      <div><button id="t">Mystery</button><span>x</span></div>
      <div><section><div id="p" hidden>Something appeared far away.</div></section></div>
    </div>`);
  stray.document.getElementById('t').addEventListener('click', () => {
    const p = stray.document.getElementById('p'); p.hidden = !p.hidden;
  });
  out = await stray.__u1Probe.probeAll(stray.document.getElementById('w'), { settle: 0 });
  const nul = out.components.find((x) => x.type === null);
  check('a reveal with no pattern is reported as type:null, not guessed',
    !!nul && /no pattern matched/.test(nul.why) &&
    !out.components.some((x) => x.type === 'accordion'),
    out.components.map((x) => x.type + ':' + x.why).join(' | ') || '(nothing)');

  // The browser's own disclosure needs nobody's mapping.
  const native = page(`
    <div id="w">
      <details><summary id="t">Details</summary><p>Native.</p></details>
    </div>`);
  out = await native.__u1Probe.probeAll(native.document.getElementById('w'), { settle: 0 });
  check('details/summary is skipped — native, nothing to map',
    !out.components.length,
    out.components.map((x) => x.type).join() || '(nothing)');
}

// ── Spillover: the budget starves nobody silently ───────────────────────────
//
// A planned candidate its band's budget starved goes to the HEAD of the next
// band's queue, once. max per band does not change. Starved twice — or still
// waiting when the walk runs out of bands — is recorded, not dragged forever.
console.log('\na starved candidate gets one second chance, then a name');
{
  const w = page(`
    <div id="w">
      <div><button id="b1">One</button><span>x</span></div>
      <div><button id="b2">Two</button><span>x</span></div>
      <div><button id="b3">Three</button><span>x</span></div>
      <div><button id="b4">Four</button><span>x</span></div>
      <div><button id="b5">Five</button><span>x</span></div>
    </div>`);
  const d = w.document;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const tops = { b1: 100, b2: 110, b3: 120, b4: 130, b5: 140 };
    const t = tops[this.id] != null ? tops[this.id] : 10;
    return { top: t, bottom: t + 20, left: 10, right: 110, width: 100, height: 20 };
  };
  const hits = {};
  ['b1', 'b2', 'b3', 'b4', 'b5'].forEach((id) => {
    hits[id] = 0;
    d.getElementById(id).addEventListener('click', () => { hits[id]++; });
  });
  w.__u1Probe.resetRun();
  w.__u1Probe.planRun(d.getElementById('w'));
  await w.__u1Probe.probeAll(d.getElementById('w'),
    { settle: 0, idle: 0, max: 2, sectionY: { from: 0, to: 1000 } });
  check('the band presses its budget and no more',
    hits.b1 > 0 && hits.b2 > 0 && !hits.b3 && !hits.b4 && !hits.b5,
    JSON.stringify(hits));
  await w.__u1Probe.probeAll(d.getElementById('w'),
    { settle: 0, idle: 0, max: 2, sectionY: { from: 1000, to: 2000 } });
  check('the starved candidates head the NEXT band\'s queue',
    hits.b3 > 0 && hits.b4 > 0 && !hits.b5, JSON.stringify(hits));
  const starved = w.__u1Probe.starvedSnapshot();
  check('starved twice is recorded by name, not dragged forever',
    starved.length === 1 && starved[0].id === 'b5', JSON.stringify(starved));
}

// ── An incomplete restore names its leftovers ───────────────────────────────
console.log('\nrestore residue is recorded, not shrugged at');
{
  const w = page(`<div id="w"><button id="b">Open</button><div id="pnl" hidden>x</div></div>`);
  const d = w.document;
  let opens = 0;
  d.getElementById('b').addEventListener('click', () => {
    opens++;
    d.getElementById('pnl').hidden = false;          // never closes again
    d.getElementById('pnl').className = 'left-open';
  });
  const res = await w.__u1Probe.probeOne(d.getElementById('b'),
    { scope: d.getElementById('w'), settle: 0 });
  check('a press that cannot be undone says so', res.restored === false);
  check('…and the residue names what stayed',
    !!res.residue && res.residue.appeared >= 1,
    JSON.stringify(res.residue && { appeared: res.residue.appeared, classes: !!res.residue.classes }));
}

// ── Decision A: pressing one sibling pulls in the family ────────────────────
//
// The finder's strip got the last two budget slots at its only viewport
// window, and the first was the selected no-op. Now pressing ONE member of a
// pressable-sibling family (through the li/single-child climb) pulls the rest
// into the same section, past the budget, capped at +8.
console.log('\none pressed sibling finishes the family');
{
  const w = page(`
    <div id="w">
      <ul id="strip">
        <li><button id="s1">One</button></li>
        <li><button id="s2">Two</button></li>
        <li><button id="s3">Three</button></li>
        <li><button id="s4">Four</button></li>
        <li><button id="s5">Five</button></li>
      </ul>
      <div id="q1">panel one</div>
      <div id="q2" hidden>panel two</div>
      <div id="q3" hidden>panel three</div>
      <div id="q4" hidden>panel four</div>
      <div id="q5" hidden>panel five</div>
    </div>`);
  const d = w.document;
  for (const n of [1, 2, 3, 4, 5]) {
    d.getElementById('s' + n).addEventListener('click', () => {
      for (const m of [1, 2, 3, 4, 5]) d.getElementById('q' + m).hidden = m !== n;
    });
  }
  w.__u1Probe.resetRun();
  // Budget of ONE: the old walk would press s1 (the selected no-op) and stop.
  const out = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 0, max: 1 });
  check('the whole family is pressed past the budget', out.pressed === 5, String(out.pressed));
  // The section pass groups by literal parent — li-wrapped rows stay
  // fragments there BY DESIGN; the li climb belongs to the run-level pass.
  const strip = w.__u1Probe.classifyRun().find((c) => c.type === 'menu' && c.shape === 'strip');
  check('…and the run pass turns the presses into ONE strip',
    !!strip && strip.parts.items.length === 5 && strip.root === d.getElementById('strip'),
    strip ? `items ${strip.parts.items.length}, root ${strip.root.id}` : '(no strip)');
}
{
  // The cap: a family of 12 with a budget of 1 presses at most 1 + 8.
  let html = '<div id="w"><ul id="big">';
  for (let n = 1; n <= 12; n++) html += `<li><button id="b${n}">B${n}</button></li>`;
  html += '</ul>';
  for (let n = 1; n <= 12; n++) html += `<div id="r${n}"${n === 1 ? '' : ' hidden'}>p</div>`;
  html += '</div>';
  const w = page(html);
  const d = w.document;
  for (let n = 1; n <= 12; n++) {
    d.getElementById('b' + n).addEventListener('click', () => {
      for (let m = 1; m <= 12; m++) d.getElementById('r' + m).hidden = m !== n;
    });
  }
  w.__u1Probe.resetRun();
  const out = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 0, max: 1 });
  check('the overflow is capped at +8', out.pressed === 9, String(out.pressed));
}

// ── Fragments become the strip: the run-level pass ──────────────────────────
//
// A strip pressed half in one section and half in the next classified as
// nothing twice: each probeAll call saw singleton groups. classifyRun() reads
// the whole run's ledger once, climbs through <li> and single-child wrappers
// (ul>li>button is the commonest strip markup there is), and its one answer
// replaces the fragments — rooted on the <ul>, not on anybody's <li>.
console.log('\nthe run-level pass merges what the sections split');
{
  const w = page(`
    <div id="w">
      <ul id="strip">
        <li><button id="t1">One</button></li>
        <li><button id="t2">Two</button></li>
        <li><button id="t3">Three</button></li>
        <li><button id="t4">Four</button></li>
      </ul>
      <div id="p1" hidden>panel one</div>
      <div id="p2" hidden>panel two</div>
      <div id="p3" hidden>panel three</div>
      <div id="p4" hidden>panel four</div>
    </div>`);
  const d = w.document;
  for (const n of [1, 2, 3, 4]) {
    d.getElementById('t' + n).addEventListener('click', () => {
      for (const m of [1, 2, 3, 4]) d.getElementById('p' + m).hidden = m !== n;
    });
  }
  w.__u1Probe.resetRun();
  const first = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 0, max: 2 });
  const second = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 0, max: 4 });
  // Decision A + the 4.7 climb closed this from both ends: the FIRST call,
  // budget of two, now presses the whole family and sees the whole strip —
  // the second call has nothing left to press.
  check('family completion + the climb give the first section the whole strip',
    first.components.some((c) => c.type === 'menu' && c.parts.items.length === 4) &&
    second.pressed === 0,
    [first.components.map((c) => c.type + ':' + (c.parts.items || []).length).join(), 'second pressed ' + second.pressed].join(' / '));
  const run = w.__u1Probe.classifyRun();
  const strip = run.find((c) => c.type === 'menu' && c.shape === 'strip');
  check('the run pass agrees: ONE strip',
    !!strip && strip.parts.items.length === 4,
    JSON.stringify(run.map((c) => ({ t: c.type, n: c.parts.items ? c.parts.items.length : 0 }))));
  check('…rooted on the <ul>, climbed through the <li> rows',
    !!strip && strip.root === d.getElementById('strip'),
    strip && (strip.root.id || strip.root.tagName));
  w.__u1Probe.resetRun();
  check('resetRun clears the ledger for the next run', w.__u1Probe.classifyRun().length === 0);
}

// ── The press budget goes to the loudest claims first ───────────────────────
//
// Twelve presses per section, and blind document order spent them on whatever
// buttons came first — the finder's Go buttons ate the budget and its tab
// strip, which classifies perfectly when pressed, was never pressed at all.
// Ranked now: declared disclosures (aria-expanded/haspopup/controls-to-hidden)
// before plain buttons before pointer-cursor divs; document order within.
console.log('\nranking the press budget');
{
  const w = page(`
    <div id="w">
      <button id="p1">Plain one</button>
      <button id="p2">Plain two</button>
      <button id="p3">Plain three</button>
      <button id="d1" aria-expanded="false">Opens A</button>
      <button id="d2" aria-haspopup="true">Opens B</button>
      <div id="c1" style="cursor:pointer">bare div</div>
      <button id="d3" aria-controls="hiddenPanel">Opens C</button>
      <div id="hiddenPanel" hidden>x</div>
    </div>`);
  const got = w.__u1Probe.pressable(w.document.getElementById('w'), { max: 3, repeat: true });
  check('with a budget of 3, the three DECLARED openers are the three pressed',
    got.length === 3 && got.every((el) => ['d1', 'd2', 'd3'].includes(el.id)),
    got.map((e) => e.id).join());
  check('…in document order among themselves',
    got.map((e) => e.id).join() === 'd1,d2,d3', got.map((e) => e.id).join());
  const all = w.__u1Probe.pressable(w.document.getElementById('w'), { max: 40, repeat: true });
  check('with room, the plain buttons follow and the bare div is last',
    all.map((e) => e.id).join() === 'd1,d2,d3,p1,p2,p3,c1', all.map((e) => e.id).join());
}

// ── Trust: a targeted open may press what a sweep must not ──────────────────
//
// The sweep presses strangers, and for strangers the label is the only
// evidence — "Register" reads as an action and is rightly refused. A caller
// opening ONE named component holds better evidence: the mapping calls it a
// disclosure widget, and the net is armed. The Molina sign-in wrapper carries
// exactly this face and was refused run after run.
console.log('\ntrust for a targeted open');
{
  const w = page(`
    <div id="wrap">
      <div id="t">Sign In Register</div>
      <ul id="menu" hidden><li>Member</li><li>Broker</li></ul>
    </div>`);
  const d = w.document;
  d.getElementById('t').addEventListener('click', () => {
    const m = d.getElementById('menu'); m.hidden = !m.hidden;
  });
  const cold = await w.__u1Probe.probeOne(d.getElementById('t'),
    { scope: d.getElementById('wrap'), settle: 0 });
  check('a sweep still refuses a label that reads as an action',
    cold.skipped === true && /action/.test(cold.why), JSON.stringify(cold));
  const warm = await w.__u1Probe.probeOne(d.getElementById('t'),
    { scope: d.getElementById('wrap'), settle: 0, trust: true });
  check('a targeted open presses it anyway', warm.skipped === false && warm.opened.length === 1,
    JSON.stringify({ skipped: warm.skipped, opened: warm.opened && warm.opened.length }));
  check('…and still puts the page back',
    warm.restored === true && d.getElementById('menu').hidden === true);
  // What trust does NOT cover: the refusals the net cannot contain.
  const w2 = page('<div id="s"><button id="d" disabled>Menu</button></div>');
  const still = await w2.__u1Probe.probeOne(w2.document.getElementById('d'),
    { scope: w2.document.getElementById('s'), settle: 0, trust: true });
  check('trust does not press a disabled control', still.skipped === true && /disabled/.test(still.why));
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

// ── An accordion says "open" with a CLASS, which nothing used to watch ──────
//
// The state fingerprint watches `hidden` and the aria-* attributes. Most sites
// say open with a class instead — `.is-open`, `.active`, `.expanded` — and a
// panel that changed nothing else was invisible to the whole behavioural layer.
// It is also the answer U1 needs for a state selector, so finding it here saves
// a person going to look for it.
console.log('\nhow the page says "open"');
{
  const w = page(`
    <div id="faq">
      <button id="q1" class="q">What is your returns policy?</button>
      <div id="a1" class="answer" hidden>Thirty days, unworn, in the original box.</div>
    </div>`);
  const d = w.document;
  d.getElementById('q1').addEventListener('click', () => {
    const a = d.getElementById('a1'), q = d.getElementById('q1');
    a.hidden = !a.hidden;
    a.className = a.hidden ? 'answer' : 'answer is-open';
    q.className = a.hidden ? 'q' : 'q q--active';
  });
  const res = await w.__u1Probe.probeOne(d.getElementById('q1'),
    { scope: d.getElementById('faq'), settle: 0 });

  check('the class the page adds to the panel is reported',
    res.stateClass && res.stateClass.panel && res.stateClass.panel.added.includes('is-open'),
    JSON.stringify(res.stateClass));
  check('…and the one it adds to the trigger, which is as common',
    res.stateClass && res.stateClass.trigger && res.stateClass.trigger.added.includes('q--active'),
    JSON.stringify(res.stateClass));
  check('the page is still put back afterwards', res.restored === true);
}

// A page that adds a transition class on its own must not break the restore
// check — which is exactly why `class` was kept OUT of the fingerprint.
{
  const w = page(`<div id="w"><button id="b">Go</button><div id="p" hidden>x</div></div>`);
  const d = w.document;
  d.getElementById('b').addEventListener('click', () => {
    const p = d.getElementById('p');
    p.hidden = !p.hidden;
    // Left behind on purpose, the way an animation class is.
    d.getElementById('w').className = 'animating';
  });
  const res = await w.__u1Probe.probeOne(d.getElementById('b'),
    { scope: d.getElementById('w'), settle: 0 });
  check('a leftover animation class does not count as "not restored"',
    res.restored === true, JSON.stringify({ restored: res.restored }));
}

// ── A panel with a link in it is still a panel ──────────────────────────────
//
// The rule was "two or more links makes it a menu". An FAQ answer with a
// "read more" and a "contact us" in it is mostly prose and was being called a
// menu on the strength of the links.
console.log('\na panel with links in it is judged on what ELSE is in it');
{
  const mk = (inner) => {
    const w = page(`<div id="w"><button id="b">More</button><div id="p" hidden>${inner}</div></div>`);
    const d = w.document;
    d.getElementById('b').addEventListener('click', () => {
      const p = d.getElementById('p'); p.hidden = !p.hidden;
    });
    return w;
  };

  const prose = mk(`Returns are accepted within thirty days provided the shoes are unworn.
    See our <a href="/policy">full policy</a> or <a href="/contact">contact us</a>.`);
  let out = await prose.__u1Probe.probeAll(prose.document.getElementById('w'), { settle: 0 });
  check('prose with two links in it is an accordion, not a menu',
    out.components.length === 1 && out.components[0].type === 'accordion',
    out.components.map(c => c.type).join());

  const links = mk(`<a href="/a">Men</a><a href="/b">Women</a><a href="/c">Kids</a>`);
  out = await links.__u1Probe.probeAll(links.document.getElementById('w'), { settle: 0 });
  check('…while links and nothing else is still a menu',
    out.components.length === 1 && out.components[0].type === 'menu',
    out.components.map(c => c.type).join());

  // 4.8: the RATIO. The mega-panel case verbatim — 22 links and a
  // 120-character category blurb is a menu; the old flat 40-character
  // threshold called it an accordion.
  let mega = '';
  for (let i = 0; i < 22; i++) mega += `<a href="/c${i}">Category ${i}</a>`;
  mega += `<p>${'x'.repeat(120)}</p>`;
  const megaW = mk(mega);
  out = await megaW.__u1Probe.probeAll(megaW.document.getElementById('w'), { settle: 0 });
  check('22 links with a 120-char blurb is a MENU — ratio, not a flat threshold',
    out.components.length === 1 && out.components[0].type === 'menu',
    out.components.map(c => c.type).join());

  // 4.6: href="#" and javascript: do not count as links. Two of them beside
  // prose leave the panel an accordion, not a menu.
  const fake = mk(`Sizes run large; going half a size down is usually right for this brand.
    <a href="#">EU 40</a> <a href="javascript:void(0)">EU 41</a>`);
  out = await fake.__u1Probe.probeAll(fake.document.getElementById('w'), { settle: 0 });
  check('href="#" rows are not navigation — the panel stays an accordion',
    out.components.length === 1 && out.components[0].type === 'accordion',
    out.components.map(c => c.type).join());
}

// ── A dialog does not have to be big ────────────────────────────────────────
//
// The overlay test asks "does it cover the page", and a small confirm box
// answers no — so a button that plainly opens a dialog was reported as an
// accordion: "it revealed and hid a region", true and useless. A small layer
// still gives itself away: the page says the word (role=dialog, aria-modal, a
// modal class), or it floats fixed. Links win over floating — a nav dropdown
// under a fixed header is itself fixed, and it is a menu.
console.log('\na small dialog is still a dialog');
{
  const mk = (panelAttrs, inner) => {
    const w = page(`<div id="w"><button id="b">Leave site?</button>` +
      `<div id="p" ${panelAttrs} hidden>${inner}</div></div>`);
    const d = w.document;
    d.getElementById('b').addEventListener('click', () => {
      const p = d.getElementById('p'); p.hidden = !p.hidden;
    });
    return w;
  };

  const named = mk('role="dialog"', `You are leaving this site. <button>OK</button> <button>Cancel</button>`);
  let out = await named.__u1Probe.probeAll(named.document.getElementById('w'), { settle: 0 });
  check('a small panel the page calls role=dialog is a dialog, not an accordion',
    out.components.length === 1 && out.components[0].type === 'dialog',
    out.components.map(c => c.type).join());

  const classed = mk('class="site-modal"', `Sure? <button>Yes</button> <button>No</button>`);
  out = await classed.__u1Probe.probeAll(classed.document.getElementById('w'), { settle: 0 });
  check('…and so is one that says it with a modal class',
    out.components.length === 1 && out.components[0].type === 'dialog',
    out.components.map(c => c.type).join());

  // A 420×260 confirm box, centred — too small for the overlay test, no
  // dialog name anywhere. Rect and position stubbed the way the cookie-bar
  // tests do, because jsdom lays nothing out.
  const floating = mk('', `Session expiring. <button>Stay</button>`);
  floating.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    if (this.id === 'p') return { top: 254, left: 302, right: 722, bottom: 514, width: 420, height: 260 };
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  floating.getComputedStyle = (el) => ({
    position: el && el.id === 'p' ? 'fixed' : 'static',
    visibility: 'visible', display: 'block', opacity: '1',
  });
  out = await floating.__u1Probe.probeAll(floating.document.getElementById('w'), { settle: 0 });
  check('…and one that floats fixed over the page, whatever it is called',
    out.components.length === 1 && out.components[0].type === 'dialog',
    out.components.map(c => c.type).join());

  const plain = mk('', `Thirty days, unworn, in the original box.`);
  out = await plain.__u1Probe.probeAll(plain.document.getElementById('w'), { settle: 0 });
  check('an in-flow content reveal is still an accordion',
    out.components.length === 1 && out.components[0].type === 'accordion',
    out.components.map(c => c.type).join());
}

// ── A carousel is not a tab strip, and counting is what says so ────────────
//
// Both are "press a control, something is shown and something else hidden", and
// they were not being told apart at all: a hero carousel with prev/next came
// back as a strip of two controls "each revealing the same region" — a menu.
// Measured before this was written, not supposed.
//
// A tab strip has as many panels as tabs, because each tab owns one. A carousel
// has two arrows and five slides.
console.log('\na carousel is told from a tab strip by counting');
{
  const w = page(`
    <div id="hero">
      <div class="track"><div id="s1">One</div><div id="s2" hidden>Two</div><div id="s3" hidden>Three</div></div>
      <button id="prev">Prev</button><button id="next">Next</button>
    </div>`);
  const d = w.document;
  let at = 0;
  const show = () => ['s1', 's2', 's3'].forEach((id, i) => { d.getElementById(id).hidden = i !== at; });
  d.getElementById('next').addEventListener('click', () => { at = (at + 1) % 3; show(); });
  d.getElementById('prev').addEventListener('click', () => { at = (at + 2) % 3; show(); });

  const out = await w.__u1Probe.probeAll(d.getElementById('hero'), { settle: 0, idle: 0 });
  const c = out.components[0] || {};
  check('two arrows cycling three slides is a carousel', c.type === 'carousel',
    out.components.map(x => x.type).join());
  check('…and the page is still put back afterwards', out.restored === true);
  check('…with every slide, not only the ones that were shown',
    c.parts && c.parts.slide && c.parts.slide.length === 3,
    c.parts && c.parts.slide && c.parts.slide.map(e => e.id).join());
  check('…and prev/next named from what the control says on its face',
    c.parts && c.parts.prevButton && c.parts.prevButton[0].id === 'prev' &&
    c.parts.nextButton && c.parts.nextButton[0].id === 'next');
}
{
  // Same observation, equal counts: still a strip. This is the check that stops
  // the carousel rule swallowing tab strips.
  const w = page(`
    <div id="w">
      <div class="strip"><button id="t1">A</button><button id="t2">B</button><button id="t3">C</button></div>
      <div class="panels"><div id="p1">a</div><div id="p2" hidden>b</div><div id="p3" hidden>c</div></div>
    </div>`);
  const d = w.document;
  ['t1', 't2', 't3'].forEach((id, i) => d.getElementById(id).addEventListener('click', () => {
    ['p1', 'p2', 'p3'].forEach((p, j) => { d.getElementById(p).hidden = i !== j; });
  }));
  const out = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 0 });
  check('three controls over three panels is still a strip, not a carousel',
    out.components.length === 1 && out.components[0].type === 'menu' &&
    out.components[0].shape === 'strip',
    out.components.map(c => c.type + (c.shape ? ':' + c.shape : '')).join());
}

{
  // Five slides, two arrows, and only two slides ever seen. The three nobody
  // reached are hidden — which is exactly what an untouched slide looks like —
  // so they must still be counted. This is the check that stops the
  // "only what took turns is a slide" rule from shrinking a real carousel.
  const w = page(`
    <div id="h5"><div class="track">
      ${[1, 2, 3, 4, 5].map(n => `<div id="f${n}"${n > 1 ? ' hidden' : ''}>Slide ${n}</div>`).join('')}
    </div><button id="fp">Prev</button><button id="fn">Next</button></div>`);
  const d = w.document;
  let at = 0;
  const show = () => [1, 2, 3, 4, 5].forEach((n, i) => { d.getElementById('f' + n).hidden = i !== at; });
  d.getElementById('fn').addEventListener('click', () => { at = (at + 1) % 5; show(); });
  d.getElementById('fp').addEventListener('click', () => { at = (at + 4) % 5; show(); });
  const out = await w.__u1Probe.probeAll(d.getElementById('h5'), { settle: 0, idle: 0 });
  const c = out.components[0] || {};
  check('five slides behind two arrows are all counted',
    c.type === 'carousel' && c.parts.slide.length === 5,
    c.type + ':' + (c.parts && c.parts.slide ? c.parts.slide.length : '?'));
}

// ── A rail that only SCROLLS hides nothing ─────────────────────────────────
//
// This is how swipe galleries and product shelves are actually built: every
// item keeps its box and what moves is the window onto them. The visibility
// comparison can never see it, so the whole behavioural layer found nothing at
// all — measured both ways round, the same gallery written with `hidden` came
// back as a carousel and written as a scroller came back as an empty page.
//
// Decided: any horizontal rail that moves is a carousel. A shelf of twenty
// products with two arrows and no "current item" is one.
console.log('\na rail that moves without hiding anything');
{
  const slider = (withArrows) => {
    const w = page(`<div id="rail">
      <div class="strip">${[1, 2, 3, 4].map(n => `<img id="i${n}">`).join('')}</div>
      ${withArrows ? '<button id="next">Next</button><button id="prev">Prev</button>' : ''}
    </div>`);
    const d = w.document;
    let scroll = 0;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      const n = /^i(\d)$/.exec(this.id);
      const x = n ? (Number(n[1]) - 1) * 300 - scroll : 0;
      return { top: 10, left: x, right: x + 300, bottom: 210, width: 300, height: 200 };
    };
    if (withArrows) {
      d.getElementById('next').addEventListener('click', () => { scroll += 300; });
      d.getElementById('prev').addEventListener('click', () => { scroll -= 300; });
    }
    return { w, d, tick: () => { scroll += 300; } };
  };

  const a = slider(true);
  let out = await a.w.__u1Probe.probeAll(a.d.getElementById('rail'), { settle: 0, idle: 0 });
  let c = out.components[0] || {};
  check('a shelf whose arrows scroll it is a carousel', c.type === 'carousel',
    out.components.map(x => x.type).join() || '(nothing)');
  check('…with all four items and both arrows named',
    c.parts && c.parts.slide.length === 4 &&
    c.parts.nextButton && c.parts.prevButton);

  const b = slider(false);
  const t = setInterval(b.tick, 100);
  out = await b.w.__u1Probe.probeAll(b.d.getElementById('rail'), { settle: 0, idle: 400 });
  clearInterval(t);
  check('a ticker that scrolls itself, with no controls at all, is found',
    (out.components[0] || {}).type === 'carousel' && out.components[0].autoAdvances === true,
    out.components.map(x => x.type).join() || '(nothing)');

  const still = slider(false);
  out = await still.w.__u1Probe.probeAll(still.d.getElementById('rail'), { settle: 0, idle: 300 });
  check('…and a rail that just sits there is not', out.components.length === 0,
    out.components.map(x => x.type).join());
}
{
  // The false positive this rule could easily have: opening an accordion pushes
  // everything below it DOWN. Counting that as movement would make every
  // accordion on the page a carousel, which is why a shift only counts when it
  // is sideways and more sideways than it is vertical.
  const w = page(`<div id="w">
    <button id="b">Shipping?</button><div id="p" hidden>Two days.</div>
    <div id="below">Something underneath</div></div>`);
  const d = w.document;
  let pushed = 0;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const down = this.id === 'below' ? pushed : 0;
    return { top: 10 + down, left: 10, right: 210, bottom: 50 + down, width: 200, height: 40 };
  };
  d.getElementById('b').addEventListener('click', () => {
    const p = d.getElementById('p');
    p.hidden = !p.hidden;
    pushed = p.hidden ? 0 : 120;
  });
  const out = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 0 });
  check('an accordion pushing content down is not a carousel',
    out.components.length === 1 && out.components[0].type === 'accordion',
    out.components.map(c => c.type).join() || '(nothing)');
}

// ── A dialog is a dialog whether or not it behaves ─────────────────────────
//
// Most sites do not move focus into what they open. That is the entire reason
// the accessibility layer exists — so requiring correct focus behaviour before
// agreeing something IS a dialog would mean the broken ones, the only ones
// worth mapping, are the ones we decline to find.
//
// Recorded as a finding instead: does this one already need the fix.
console.log('\nfocus behaviour is a finding, never a condition');
{
  const overlay = (moveFocus) => {
    const w = page(`<div id="w"><button id="open">Open</button>
      <div id="modal" hidden><button id="close">Close</button></div></div>`);
    const d = w.document;
    // Big enough to read as a layer over the page.
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
      if (this.id === 'modal') return { top: 0, left: 0, right: 1024, bottom: 768, width: 1024, height: 768 };
      return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
    };
    w.getComputedStyle = (el) => ({
      position: el && el.id === 'modal' ? 'fixed' : 'static',
      visibility: 'visible', display: 'block', opacity: '1',
    });
    d.getElementById('open').addEventListener('click', () => {
      const m = d.getElementById('modal');
      m.hidden = !m.hidden;
      if (moveFocus && !m.hidden) d.getElementById('close').focus();
    });
    return { w, d };
  };

  const bad = overlay(false);
  let out = await bad.w.__u1Probe.probeAll(bad.d.getElementById('w'), { settle: 0, idle: 0 });
  let c = out.components[0] || {};
  check('a modal that never moves focus is STILL found as a dialog',
    c.type === 'dialog', out.components.map(x => x.type).join() || '(nothing)');
  check('…and the missing focus is reported as the work it needs',
    c.focusEntered === false && /focus stayed outside/i.test(c.why || ''), c.why);

  const good = overlay(true);
  out = await good.w.__u1Probe.probeAll(good.d.getElementById('w'), { settle: 0, idle: 0 });
  c = out.components[0] || {};
  check('one that does move focus is the same dialog, without the complaint',
    c.type === 'dialog' && c.focusEntered === true && !/focus stayed outside/i.test(c.why || ''),
    c.type + ' / ' + c.focusEntered);
}

// ── A banner is a dialog, and so is one that opens itself ──────────────────
//
// "Covers most of the screen" was only one shape of layer. A cookie bar, a
// coupon strip and a consent notice are pinned to an edge, nearly full width
// and deliberately SHORT — the height test alone threw every one of them out.
// Decided: they are dialogs like any other. They appear over the page, they
// demand an answer, and one you cannot close by keyboard is a real trap.
console.log('\na banner is a dialog too');
{
  const bar = (h, pos, top) => {
    const w = page(`<div id="w"><button id="b">Show</button>
      <div id="bar" hidden>We use cookies. <button id="ok">OK</button></div></div>`);
    const d = w.document;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
      if (this.id === 'bar') {
        return { top: top, left: 0, right: 1024, bottom: top + h, width: 1024, height: h };
      }
      return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
    };
    w.getComputedStyle = (el) => ({
      position: el && el.id === 'bar' ? pos : 'static',
      visibility: 'visible', display: 'block', opacity: '1',
    });
    d.getElementById('b').addEventListener('click', () => {
      const el = d.getElementById('bar'); el.hidden = !el.hidden;
    });
    return w;
  };

  // Pinned to the bottom edge of a 768-high viewport, 90px tall.
  const w1 = bar(90, 'fixed', 678);
  let out = await w1.__u1Probe.probeAll(w1.document.getElementById('w'), { settle: 0, idle: 0 });
  check('a cookie bar pinned to the bottom is a dialog',
    (out.components[0] || {}).type === 'dialog',
    out.components.map(c => c.type).join() || '(nothing)');

  const w2 = bar(60, 'fixed', 0);
  out = await w2.__u1Probe.probeAll(w2.document.getElementById('w'), { settle: 0, idle: 0 });
  check('…and so is one pinned to the top', (out.components[0] || {}).type === 'dialog',
    out.components.map(c => c.type).join() || '(nothing)');

  // The things that must NOT become dialogs on the strength of that rule.
  const thin = bar(3, 'fixed', 0);
  out = await thin.__u1Probe.probeAll(thin.document.getElementById('w'), { settle: 0, idle: 0 });
  check('a 3px progress rule at the top is not a dialog',
    (out.components[0] || {}).type !== 'dialog',
    out.components.map(c => c.type).join() || '(nothing)');

  const inflow = bar(90, 'absolute', 300);
  out = await inflow.__u1Probe.probeAll(inflow.document.getElementById('w'), { settle: 0, idle: 0 });
  check('a short strip in the middle of the page is not a dialog',
    (out.components[0] || {}).type !== 'dialog',
    out.components.map(c => c.type).join() || '(nothing)');
}
{
  // Nobody pressed anything. Pressing can never find this one.
  const w = page(`<div id="w"><p>Some page content here.</p>
    <div id="coupon" hidden>10% off! <button id="x">Close</button></div></div>`);
  const d = w.document;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('hidden')) return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    if (this.id === 'coupon') return { top: 100, left: 100, right: 900, bottom: 600, width: 800, height: 500 };
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  w.getComputedStyle = (el) => ({
    position: el && el.id === 'coupon' ? 'fixed' : 'static',
    visibility: 'visible', display: 'block', opacity: '1',
  });
  setTimeout(() => { d.getElementById('coupon').hidden = false; }, 60);
  const out = await w.__u1Probe.probeAll(d.getElementById('w'), { settle: 0, idle: 400 });
  const c = out.components[0] || {};
  check('a coupon that opens itself after a delay is found as a dialog',
    c.type === 'dialog' && c.openedItself === true,
    out.components.map(x => x.type).join() || '(nothing)');
}

// ── What the page does when nobody touches it ──────────────────────────────
//
// A gallery you swipe has no arrows to press and announces itself no other way.
// It is also the WCAG 2.2.2 case — something that moves on its own and cannot
// be stopped — which nobody reports, because nothing on the page looks broken.
console.log('\nwhat moves with nobody touching it');
{
  const rail = `<div id="g"><div class="rail">
      <div id="g1">P1</div><div id="g2" hidden>P2</div><div id="g3" hidden>P3</div></div></div>`;
  const spin = (w, ms) => {
    const d = w.document;
    let at = 0;
    return setInterval(() => {
      at = (at + 1) % 3;
      ['g1', 'g2', 'g3'].forEach((id, i) => { d.getElementById(id).hidden = i !== at; });
    }, ms);
  };

  const w = page(rail);
  const t = spin(w, 120);
  const out = await w.__u1Probe.probeAll(w.document.getElementById('g'), { settle: 0, idle: 400 });
  clearInterval(t);
  const c = out.components[0] || {};
  check('a gallery with no controls at all is found because it moves',
    c.type === 'carousel' && c.autoAdvances === true,
    out.components.map(x => x.type).join());

  // The miss this nearly shipped with: a cycle that divides the window lands
  // back on the first slide, and a start-and-end comparison sees NOTHING. Found
  // by a test whose timing happened to do exactly that, which then reported "no
  // carousel here" with complete confidence. The watch samples for this reason.
  const w2 = page(rail);
  const t2 = spin(w2, 200);                     // three slides × 200ms = 600ms
  const out2 = await w2.__u1Probe.probeAll(w2.document.getElementById('g'), { settle: 0, idle: 600 });
  clearInterval(t2);
  check('…even when a full lap lands it back where it started',
    (out2.components[0] || {}).type === 'carousel',
    out2.components.map(x => x.type).join() || '(missed)');

  // And a page that simply sits there is not a carousel.
  const w3 = page(`<div id="q"><div class="rail"><div id="q1">P1</div><div id="q2" hidden>P2</div></div></div>`);
  const out3 = await w3.__u1Probe.probeAll(w3.document.getElementById('q'), { settle: 0, idle: 300 });
  check('a still page is not called a carousel', out3.components.length === 0,
    out3.components.map(x => x.type).join());
}

// ── Asking a form to validate itself ───────────────────────────────────────
//
// A form mapping needs three things a person otherwise hunts for by hand:
// which fields are required, the class the page puts on a rejected field, and
// where the message goes. All three are written on the page the moment an EMPTY
// form is submitted — so the form is asked instead of the specialist.
//
// Pressing submit is otherwise the single most dangerous thing that could be
// done to somebody's site, and the blocklist refuses to do it. What makes this
// defensible is that nothing leaves: the submit event is cancelled in the
// capture phase AND fetch, XHR and sendBeacon are stubbed for the duration.
console.log('\nasking a form to validate itself');
{
  const form = (onSubmit, attrs) => {
    const w = page(`<form id="f">
      <input id="name" ${attrs || ''}><span id="e1" hidden>Required</span>
      <input id="mail" ${attrs || ''}><span id="e2" hidden>Required</span>
      <input id="note">
      <button type="submit">Send</button></form>`);
    const d = w.document;
    d.getElementById('f').addEventListener('submit', (e) => { e.preventDefault(); onSubmit(d); });
    return w;
  };
  const ask = async (w) => {
    const net = w.__u1Probe.armNet();
    const r = await w.__u1Probe.probeForm(w.document.getElementById('f'), { settle: 20 });
    net.disarm();
    return r;
  };

  let r = await ask(form((d) => {
    ['name', 'mail'].forEach((id, i) => {
      d.getElementById(id).className = 'field field--error';
      d.getElementById(id).setAttribute('aria-invalid', 'true');
      d.getElementById('e' + (i + 1)).hidden = false;
    });
  }));
  check('the fields the form rejected are the required ones',
    r.required.map((e) => e.id).join() === 'name,mail', r.required.map((e) => e.id).join());
  check('the error message elements are found', r.messages.length === 2,
    r.messages.map((e) => e.id).join());
  check('and it says it left the form showing errors', r.leftShowingErrors === true);

  // Counting alone picked the WRONG class first time: a field going from
  // class="" to class="field field--error" added both, on the same number of
  // fields, and the tie broke on iteration order — so the answer was `field`,
  // which is every field on the form including the valid ones. A mapping built
  // on that marks the whole form as wrong.
  check('the error class is the one that SAYS error, not the one it came with',
    r.invalidClass === 'field--error', r.invalidClass + ' of ' + r.invalidCandidates.join());

  r = await ask(form((d) => {
    ['name', 'mail'].forEach((id) => { d.getElementById(id).className = 'is-invalid'; });
  }));
  check('a single state class is taken as it stands', r.invalidClass === 'is-invalid', r.invalidClass);

  // When nothing says error, a field left empty for a person is honest; one
  // filled in confidently by luck is not.
  r = await ask(form((d) => {
    ['name', 'mail'].forEach((id) => { d.getElementById(id).className = 'x y'; });
  }));
  check('when no name says error, none is guessed — the candidates are reported',
    r.invalidClass === null && r.invalidCandidates.join() === 'x,y',
    String(r.invalidClass) + ' of ' + r.invalidCandidates.join());
}
{
  // Somebody's half-typed form is their work in progress.
  const w = page(`<form id="f"><input id="a" value="Dana"><input id="b">
    <button type="submit">Send</button></form>`);
  const r = await w.__u1Probe.probeForm(w.document.getElementById('f'), { settle: 0 });
  check('a form somebody has typed in is left alone', r && r.skipped === true, JSON.stringify(r));
}
{
  // And the part that makes the whole thing allowable.
  const w = page(`<form id="f"><input id="a"><input id="b">
    <button type="submit">Send</button></form>`);
  const d = w.document;
  let sent = 0;
  const realFetch = () => { sent++; return Promise.resolve(); };
  w.fetch = realFetch;
  d.getElementById('f').addEventListener('submit', (e) => {
    e.preventDefault();
    w.fetch('/api/subscribe', { method: 'POST' }).catch(() => {});
  });
  const net = w.__u1Probe.armNet();
  await w.__u1Probe.probeForm(d.getElementById('f'), { settle: 20 });
  net.disarm();
  check('nothing reached the network while the net was armed', sent === 0, String(sent));
  check('…and fetch is handed back exactly as it was found', w.fetch === realFetch);
}
{
  // A reset button empties what somebody typed. It must never be the one pressed.
  const w = page(`<form id="f"><input id="a"><input id="b">
    <button type="reset">Clear</button><button type="submit">Send</button></form>`);
  const d = w.document;
  let pressed = null;
  ['reset', 'submit'].forEach((t) => {
    d.querySelector(`button[type="${t}"]`).addEventListener('click', (e) => {
      e.preventDefault(); pressed = t;
    });
  });
  const net = w.__u1Probe.armNet();
  await w.__u1Probe.probeForm(d.getElementById('f'), { settle: 20 });
  net.disarm();
  check('the reset button is never the one pressed', pressed === 'submit', String(pressed));
}

// ── Typing settles an argument that looking cannot ─────────────────────────
//
// A garage finder and an autocomplete are the SAME MARKUP — a text field with a
// list of results beside it — and they need opposite fixes. Nothing in the code
// told them apart: comboboxShape and filterListShape both match it and
// whichever is asked first wins, while the real distinction lived only as prose
// in the rules file.
//
// And the distinction is not "does it float". A results container that goes
// from empty to populated is a popup in every sense ARIA cares about. What
// matters is whether the list was there BEFORE anyone typed.
console.log('\ntyping tells a filter from an autocomplete');
{
  const G = ['Auto Tel Aviv', 'Auto Haifa', 'Bosch Eilat', 'Bosch Ramla'];
  const finder = (mode) => {
    const w = page(`<div id="w"><input type="search" id="q">
      <ul id="list">${mode === 'filter' ? G.map((g) => `<li>${g}</li>`).join('') : ''}</ul></div>`);
    const d = w.document;
    const q = d.getElementById('q'), list = d.getElementById('list');
    q.addEventListener('input', () => {
      const v = q.value.toLowerCase();
      if (mode === 'filter') {
        // Everything is already on the page; typing hides what does not match.
        [...list.children].forEach((li) => {
          li.hidden = !!v && !li.textContent.toLowerCase().includes(v);
        });
      } else if (mode === 'popup') {
        // Nothing was there; typing builds the matches.
        list.innerHTML = v ? G.filter((g) => g.toLowerCase().includes(v)).map((g) => `<li>${g}</li>`).join('') : '';
      }
    });
    return { w, d };
  };
  const ask = (f) => f.w.__u1Probe.probeTyping(f.d.getElementById('q'),
    { scope: f.d.getElementById('w'), settle: 20, text: 'bosch' });

  const a = finder('filter');
  let r = await ask(a);
  check('a list that was already there and got shorter is a FILTER',
    r.kind === 'filter' && r.narrowed.length === 1, r.kind + ' ' + JSON.stringify(r.narrowed.map((n) => n.was + '->' + n.now)));
  check('…and the field is put back empty', a.d.getElementById('q').value === '');
  check('…and its list is back to all four', a.d.getElementById('list').children.length === 4);

  // The commonest autocomplete on the web, and the first version of this missed
  // every one: the <ul> never APPEARED — it was visible the whole time, empty —
  // so "did anything appear" answered no while the page filled with matches.
  const b = finder('popup');
  r = await ask(b);
  check('an empty container that FILLED is a combobox, floating or not',
    r.kind === 'combobox' && r.filled.length === 1, r.kind + ' filled:' + r.filled.length);
  check('…and that field is put back too', b.d.getElementById('q').value === '');

  const c = finder('inert');
  r = await ask(c);
  check('a field where nothing happens is neither', r.kind === null, String(r.kind));

  // The case that made the typing test alone insufficient: a popup that opens
  // ALREADY FULL. From the typing it is indistinguishable from a page filter —
  // a list in front of you that gets shorter — and it was being called one. The
  // difference is a step earlier: this list was not on the page until the field
  // was touched.
  const popupFull = (() => {
    const w = page(`<div id="w"><input type="search" id="q">
      <ul id="list" hidden>${G.map((g) => `<li>${g}</li>`).join('')}</ul></div>`);
    const d = w.document;
    const q = d.getElementById('q'), list = d.getElementById('list');
    q.addEventListener('click', () => { list.hidden = false; });
    q.addEventListener('input', () => {
      const v = q.value.toLowerCase();
      [...list.children].forEach((li) => {
        li.hidden = !!v && !li.textContent.toLowerCase().includes(v);
      });
    });
    return { w, d };
  })();
  r = await ask(popupFull);
  check('a popup that opens ALREADY FULL is a combobox, not a filter',
    r.kind === 'combobox' && r.openedOnTouch.length === 1,
    r.kind + ' openedOnTouch:' + r.openedOnTouch.length);
  check('…and touching the field is what settled it, before any typing',
    r.narrowed.length > 0,
    'it did narrow on typing too: ' + JSON.stringify(r.narrowed.map((n) => n.was + '->' + n.now)));
}
{
  const w = page(`<div id="w"><input type="search" id="q" value="haifa"><ul id="l"><li>x</li></ul></div>`);
  const r = await w.__u1Probe.probeTyping(w.document.getElementById('q'), { settle: 0 });
  check('a field somebody is using is left alone', r.skipped === true, JSON.stringify(r));
}
{
  const w = page(`<div id="w"><input type="password" id="p"></div>`);
  const r = await w.__u1Probe.probeTyping(w.document.getElementById('p'), { settle: 0 });
  check('a password field is never typed into', r.skipped === true, JSON.stringify(r));
}

// ── Picking a day is how a datepicker mapping gets filled in ───────────────
//
// The same idea as submitting an empty form: what the mapping needs is written
// on the page the moment a day is chosen and nowhere before it. `days.selected`
// is a class the page toggles, and there is no way to know which one without
// watching it happen — the alternative is a person in devtools comparing two
// screenshots.
console.log('\npicking a day fills in the mapping');
{
  const calendar = (opts) => {
    const cells = Array.from({ length: 31 }, (_, i) => {
      const n = i + 1;
      const cls = opts.preselected === n ? 'day day--selected'
        : (opts.disabledUpTo && n <= opts.disabledUpTo) ? 'day day--muted' : 'day';
      const dis = (opts.disabledUpTo && n <= opts.disabledUpTo) ? ' aria-disabled="true"' : '';
      return `<td class="${cls}"${dis} data-day="${n}">${n}</td>`;
    }).join('');
    const w = page(`<div id="w"><input id="date" readonly>
      <table id="cal"><tr>${cells}</tr></table></div>`);
    const d = w.document;
    d.getElementById('cal').addEventListener('click', (e) => {
      const td = e.target.closest('td');
      if (!td || td.getAttribute('aria-disabled') === 'true') return;
      [...d.querySelectorAll('td')].forEach((x) => x.classList.remove('day--selected'));
      td.classList.add('day--selected');
      if (opts.writesField) d.getElementById('date').value = '2026-08-' + td.dataset.day;
    });
    return { w, d };
  };
  const ask = (c) => c.w.__u1Probe.probeCalendar(c.d.getElementById('cal'),
    { scope: c.d.getElementById('w'), settle: 20 });

  const fresh = calendar({ disabledUpTo: 3, writesField: true });
  let r = await ask(fresh);
  check('the class that marks the chosen day is read off the page',
    r.selectedClass === 'day--selected', String(r.selectedClass));
  check('the days that cannot be chosen are found too', r.disabled.length === 3,
    String(r.disabled.length));
  check('and the field the date lands in is named',
    r.wroteInto && r.wroteInto.id === 'date' && /2026-08-/.test(r.wroteValue),
    (r.wroteInto && r.wroteInto.id) + '=' + r.wroteValue);
  check('when nothing was chosen before, it says it left a date chosen',
    r.leftADateChosen === true);

  // The common case on a booking form: a date is already picked, and the probe
  // must hand it back exactly as it found it.
  const booked = calendar({ preselected: 5 });
  r = await ask(booked);
  check('a date that was already chosen is put back',
    r.restored === true &&
    [...booked.d.querySelectorAll('.day--selected')].map((x) => x.textContent).join() === '5',
    [...booked.d.querySelectorAll('.day--selected')].map((x) => x.textContent).join());
}

// ── Both states, because a mapping needs both ──────────────────────────────
//
// A checkbox mapping REQUIRES checkedState and uncheckedState, and U1 will not
// maintain the announced state without both. They are classes the page swaps,
// and one press hands over both: what was ADDED is the state it went to, what
// was REMOVED is the state it came from.
//
// Getting them backwards is silent and specific — the control then announces
// the opposite of what it is, every single time.
console.log('\nticking it reads both states');
{
  const box = (startOn) => {
    const w = page(`<div id="c" role="checkbox" class="tick ${startOn ? 'tick--on' : 'tick--off'}"
      aria-checked="${startOn}">Gift wrap</div>`);
    const d = w.document;
    d.getElementById('c').addEventListener('click', () => {
      const el = d.getElementById('c');
      const on = el.getAttribute('aria-checked') === 'true';
      el.setAttribute('aria-checked', String(!on));
      el.className = !on ? 'tick tick--on' : 'tick tick--off';
    });
    return { w, d };
  };

  const off = box(false);
  let r = await off.w.__u1Probe.probeToggle(off.d.getElementById('c'), { settle: 10 });
  check('a box that starts UNTICKED gives both classes the right way round',
    r.checkedClass === 'tick--on' && r.uncheckedClass === 'tick--off',
    r.checkedClass + ' / ' + r.uncheckedClass);
  check('…and it is put back unticked', off.d.getElementById('c').className === 'tick tick--off');

  // The same control the other way up. Assuming "added means checked" gets this
  // one backwards, which is why the answer is read from the STATE and not from
  // the press.
  const on = box(true);
  r = await on.w.__u1Probe.probeToggle(on.d.getElementById('c'), { settle: 10 });
  check('a box that starts TICKED gives the SAME answer, not the reverse',
    r.checkedClass === 'tick--on' && r.uncheckedClass === 'tick--off',
    r.checkedClass + ' / ' + r.uncheckedClass);
  check('…and it is put back ticked', on.d.getElementById('c').className === 'tick tick--on');
}
{
  // A radio cannot untick itself, so the one that WAS chosen is pressed back.
  const w = page(`<div id="g">
    <div id="r1" role="radio" class="opt opt--on" aria-checked="true">Standard</div>
    <div id="r2" role="radio" class="opt" aria-checked="false">Express</div></div>`);
  const d = w.document;
  ['r1', 'r2'].forEach((id) => d.getElementById(id).addEventListener('click', () => {
    ['r1', 'r2'].forEach((x) => {
      const el = d.getElementById(x), isIt = x === id;
      el.setAttribute('aria-checked', String(isIt));
      el.className = isIt ? 'opt opt--on' : 'opt';
    });
  }));
  const r = await w.__u1Probe.probeToggle(d.getElementById('r2'), { scope: d.getElementById('g'), settle: 10 });
  check('a radio reports the chosen class', r.checkedClass === 'opt--on', String(r.checkedClass));
  check('…and the option that WAS chosen is put back',
    r.restored === true && d.getElementById('r1').getAttribute('aria-checked') === 'true');

  // The finding that matters more than it looks: this page says "off" by NOT
  // having the class. There is no U1-valid selector for the absence of a class
  // — :not() is a pseudo-class and the engine rejects it — so this is reported
  // as its own fact rather than as an empty field. Empty reads as "nobody
  // filled this in"; this is "there is nothing to fill it in with".
  check('a page that says OFF by absence says so out loud',
    r.saysOffByAbsence === true && r.uncheckedClass === null,
    JSON.stringify({ off: r.uncheckedClass, byAbsence: r.saysOffByAbsence }));
}
{
  const w = page(`<label id="c" class="sw"><input type="checkbox" hidden><span>On</span></label>`);
  const r = await w.__u1Probe.probeToggle(w.document.getElementById('c'), { settle: 10 });
  check('the real control hiding inside a styled one is found',
    r.hiddenInput && r.hiddenInput.type === 'checkbox', String(r.hiddenInput));
}
{
  const w = page(`<div id="c" role="checkbox">Subscribe to our newsletter</div>`);
  const r = await w.__u1Probe.probeToggle(w.document.getElementById('c'), { settle: 0 });
  check('a consent box is never ticked on somebody else\'s behalf',
    r.skipped === true, JSON.stringify(r));
}

// ── Page numbers, and a region that is REPLACED rather than revealed ───────
//
// Two findings in one fixture. A pagination strip swaps the products for
// different products: same count, same visibility, nothing hidden and nothing
// shown — so the visibility fingerprint saw nothing at all and the whole strip
// came back as an empty finding. That is true of any strip that re-renders one
// region instead of swapping between several.
//
// And page numbers are told from a menu by COUNTING, the same trick the
// calendar uses: sibling controls whose faces are running numbers are page
// numbers. Nothing else on a page is a row of controls that says 1, 2, 3.
console.log('\npage numbers, and content that is replaced');
{
  const w = page(`<div id="page">
    <div class="grid"><div>Runner</div><div>Trainer</div></div>
    <div class="pager"><button id="prev">Prev</button>
      <button class="pg" data-p="1">1</button><button class="pg" data-p="2">2</button>
      <button class="pg" data-p="3">3</button><button id="next">Next</button></div></div>`);
  const d = w.document;
  const grid = d.querySelector('.grid');
  d.querySelectorAll('.pg').forEach((b) => b.addEventListener('click', () => {
    grid.innerHTML = `<div>Page ${b.dataset.p} first item</div><div>Page ${b.dataset.p} second item</div>`;
  }));
  const out = await w.__u1Probe.probeAll(d.getElementById('page'), { settle: 0, idle: 0 });
  const c = out.components[0] || {};
  check('a strip that only REPLACES content is found at all',
    out.components.length > 0, out.components.map((x) => x.type).join() || '(nothing)');
  check('…and running numbers make it pagination, not a menu', c.type === 'pagination', c.type);
  check('…with the page buttons and both arrows',
    c.parts.pageButtons.length === 3 && c.parts.prevButton && c.parts.nextButton);
}
{
  // The guard: a strip of WORDS doing the same thing is still a menu.
  const w = page(`<div id="page"><div class="nav">
    <button id="a">Men</button><button id="b">Women</button><button id="c">Kids</button></div>
    <div id="pa" hidden><a href="/1">x</a><a href="/2">y</a></div>
    <div id="pb" hidden><a href="/3">x</a><a href="/4">y</a></div>
    <div id="pc" hidden><a href="/5">x</a><a href="/6">y</a></div></div>`);
  const d = w.document;
  ['a', 'b', 'c'].forEach((id, i) => d.getElementById(id).addEventListener('click', () => {
    ['pa', 'pb', 'pc'].forEach((p, j) => { d.getElementById(p).hidden = i !== j; });
  }));
  const out = await w.__u1Probe.probeAll(d.getElementById('page'), { settle: 0, idle: 0 });
  check('a strip of WORDS doing the same thing is still a menu',
    (out.components[0] || {}).type === 'menu',
    out.components.map((c) => c.type).join() || '(nothing)');
}

// ── Hovering, which the whole layer could not do ───────────────────────────
//
// Everything else here PRESSES, so anything opening on hover was invisible:
// tooltips, and the very common nav whose drop-downs open on mouseover and do
// nothing at all when clicked. Such a menu came back as a flat row of links
// with no submenus — while three fields exist in the builder to describe
// exactly this, and sat empty because nothing had ever measured which event it
// is. The tool's own note beside them says so: "whether that is HOVER or a
// click cannot be told from the markup."
//
// Each event is tried SEPARATELY, because the answer IS which one to write.
console.log('\nhovering, and which event it was');
{
  const onEvent = async (ev) => {
    const w = page(`<li id="item"><a href="#" id="t">Men</a>
      <div id="panel" hidden><a href="/s">Shoes</a><a href="/b">Boots</a></div></li>`);
    const d = w.document;
    const t = d.getElementById('t'), panel = d.getElementById('panel');
    t.addEventListener(ev, () => { panel.hidden = false; });
    ['mouseleave', 'mouseout', 'blur'].forEach((x) =>
      t.addEventListener(x, () => { panel.hidden = true; }));
    return w.__u1Probe.probeHover(t, { scope: d.getElementById('item'), settle: 10 });
  };

  for (const [ev, field] of [['mouseover', 'openByMouseover'],
                             ['mouseenter', 'openByMouseenter'],
                             ['focus', 'openByFocus']]) {
    const r = await onEvent(ev);
    check(`a menu that opens on ${ev} names that exact field`,
      r.opensOn === field && r.revealed.length === 1, r.opensOn + ' / ' + r.revealed.length);
    check(`…and the page is put back after ${ev}`, r.restored === true);
  }

  const w = page(`<li id="item"><a href="#" id="t">Plain</a></li>`);
  const r = await w.__u1Probe.probeHover(w.document.getElementById('t'), { settle: 10 });
  check('a link that opens nothing on any of the three says so', r.opensOn === null, String(r.opensOn));
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
  // A tab strip reports as a MENU now — the two were decided to be one
  // component. `shape` is what still separates them, and it exists because the
  // RESTORE depends on the difference: a strip cannot undo itself by being
  // pressed a second time, and a toggle already has.
  const strips = out.components.filter(c => c.shape === 'strip');
  const opened = out.components.filter(c => c.type === 'menu' && c.shape !== 'strip');

  check('the strip is found, and reported as a menu', strips.length === 1 && strips[0].type === 'menu',
    out.components.map(c => c.type + (c.shape ? ':' + c.shape : '')).join());
  check('…with every control, including the one already selected',
    strips.length === 1 && idsOf(strips[0].parts.items) === 't1,t2,t3',
    strips[0] && idsOf(strips[0].parts.items));
  check('…and the panels it switches between',
    strips.length === 1 && strips[0].parts.submenus.length >= 2);
  check('…rooted on the direct parent of the controls, not above the panels',
    strips.length === 1 && strips[0].root === d.getElementById('t1').parentElement,
    strips[0] && strips[0].root && (strips[0].root.id || strips[0].root.className));
  check('both drop-downs are found, and called menus because they hold links',
    opened.length === 2, String(opened.length));
  check('…each paired with the panel IT opens, not another one',
    opened.length === 2 &&
    opened.every(c => c.parts.trigger[0].id.replace('n', 'np') === c.parts.panel[0].id),
    opened.map(c => c.parts.trigger[0].id + '→' + c.parts.panel[0].id).join(' '));
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
  check('the strip is identified from behaviour alone — a menu, by its shape',
    out.components.length === 1 && out.components[0].type === 'menu' &&
    out.components[0].shape === 'strip',
    out.components.map(c => c.type + (c.shape ? ':' + c.shape : '')).join());
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

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

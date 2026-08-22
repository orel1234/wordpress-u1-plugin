// A widget with nothing to name it — the shape the tool used to be blind to.
//
//   node scripts/verify-anon.mjs
//
// A menu built from bare <div>s that were given click handlers in JavaScript
// announces nothing: no tag we search for, no role, no meaningful class. Three
// separate things used to fail on it, and each is checked here.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
const RECORDER = readFileSync(join(ROOT, 'event-recorder.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// The widget: an outer div, six inner divs, not a class or an id between them.
const HTML = `<!doctype html><body>
  <header id="masthead"><a href="/">Home</a></header>
  <div><div>Men</div><div>Women</div><div>Kids</div><div>Sport</div><div>Brands</div><div>Sale</div></div>
  <p>Ordinary text nobody clicks.</p>
</body>`;

function boot({ recorder }) {
  const dom = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.getComputedStyle = () => ({ position: 'static', visibility: 'visible', display: 'block', opacity: '1' });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  // The recorder has to be installed BEFORE the page's own script runs — that is
  // why the UI says to reload the page after switching it on.
  if (recorder) w.eval(RECORDER);
  // The page's script: handlers and nothing else. No classes, no roles, no ARIA.
  w.eval(`
    document.querySelectorAll('div>div').forEach(function (d) {
      d.addEventListener('click', function () {});
    });
  `);
  w.eval(INTEL);
  return w;
}

console.log('\nwithout the event recorder');
{
  const w = boot({ recorder: false });
  const got = w.__u1SelectorIntel.collectCandidates(60, null);
  const divs = got.candidates.filter(c => c.tag === 'div');
  check('the menu is invisible to the collector', divs.length === 0,
    `${divs.length} found: ${divs.map(d => d.selector).join()}`);
  check('…so the model could never be asked about it',
    !got.candidates.some(c => (c.name || '').includes('Women')));
}

console.log('\nwith it');
{
  const w = boot({ recorder: true });
  const got = w.__u1SelectorIntel.collectCandidates(60, null);
  const clicked = got.candidates.filter(c => /Men|Women|Kids|Sport|Brands|Sale/.test(c.name || ''));
  check('every div that took a click handler is a candidate', clicked.length === 6, String(clicked.length));
  check('and the text that took none is not', !got.candidates.some(c => c.tag === 'p'));

  console.log('\n  the selectors it produces');
  const d = w.document;
  let usable = 0, exact = 0;
  for (const c of clicked) {
    if (!c.selector) continue;
    usable++;
    let hit = [];
    try { hit = [...d.querySelectorAll(c.selector)]; } catch { hit = []; }
    const mine = d.querySelector(`[data-u1-mark="${c.mark}"]`);
    if (hit.length === 1 && hit[0] === mine) exact++;
  }
  check('every one of them got a usable selector', usable === 6, `${usable} of 6`);
  // The point of the whole exercise: a selector that names THAT div and no other.
  check('and each resolves to exactly the element it came from', exact === 6, `${exact} of 6`);
  check('they are positional, because nothing else was available',
    clicked.every(c => /:nth-child/.test(c.selector || '')), clicked.map(c => c.selector).join(' | '));
  check('U1 would accept them', clicked.every(c => w.__u1SelectorIntel.isU1Valid(c.selector)));
  check('they are graded weak, not passed off as solid',
    clicked.every(c => w.__u1SelectorIntel.selectorStrength(c.selector).level === 'weak'),
    clicked.map(c => w.__u1SelectorIntel.selectorStrength(c.selector).level).join());
  check('and the grade says why, in words a client can be shown',
    /position among siblings/.test(w.__u1SelectorIntel.selectorStrength(clicked[0].selector).reasons.join(' ')));
  w.__u1SelectorIntel.clearMarks();
}

console.log('\nan element that DOES name itself is unaffected');
{
  const dom = new JSDOM(`<!doctype html><body>
    <nav class="mega-nav"><a href="#a">One</a></nav>
    <div class="finder__tabs" role="tablist"><button role="tab">By sport</button></div>
  </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.getComputedStyle = () => ({ position: 'static', visibility: 'visible', display: 'block', opacity: '1' });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  w.eval(INTEL);
  const got = w.__u1SelectorIntel.collectCandidates(60, null);
  const nav = got.candidates.find(c => c.tag === 'nav');
  const tabs = got.candidates.find(c => c.role === 'tablist');
  check('a class is still preferred over a position', nav.selector === '.mega-nav', nav.selector);
  check('…for the tab strip too', tabs.selector === '.finder__tabs', tabs.selector);
  check('no positional fallback creeps into a page that has names',
    !got.candidates.some(c => /:nth-child/.test(c.selector || '')),
    got.candidates.map(c => c.selector).join(' | '));
  w.__u1SelectorIntel.clearMarks();
}

console.log('\nwhat U1 will and will not take');
{
  const g = {};
  new Function('module', 'globalThis', INTEL).call(g, { exports: g }, g);
  const m = g.__u1SelectorIntel || g.exports;
  const ok = (s) => m.isU1Valid(s);
  check(':nth-child is allowed — without it an unnamed page cannot be mapped', ok('div:nth-child(3)'));
  check(':nth-of-type too', ok('.a>div:nth-of-type(2)'));
  check(':not stays, because U1 itself generates it', ok('.day:not(.disabled)'));
  // These parse in jQuery, which is how U1 resolves selectors — and would break
  // the day anything uses querySelectorAll instead.
  check(':eq is refused — a jQuery extension, not CSS', !ok('li:eq(4)'));
  check(':contains is refused for the same reason', !ok('a:contains(hi)'));
  check(':has is refused — not in every browser a client still runs', !ok('div:has(.x)'));
  check('a descendant space is still refused', !ok('.nav li'));
}

console.log('\nthe menu root is the parent of the ITEMS, not the wrapper');
{
  // u1.fix.menu reads the root's own children. <nav> is the element carrying the
  // aria-label and the one that looks like the answer, and its children are a
  // logo, a search box and one <ul> — a menu of one item.
  const cases = [
    ['a nav with a logo beside the list descends to the list',
     '<nav id="r"><a class="logo" href="/">L</a><ul class="nav__list"><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul></nav>',
     '.nav__list'],
    ['a mega-menu picks the TOP list, not a panel inside it',
     '<nav id="r"><ul class="nav__list"><li class="i"><button class="t">Men</button>' +
     '<div class="p"><ul class="sub"><li><a href="/1">1</a></li><li><a href="/2">2</a></li></ul></div></li>' +
     '<li class="i"><button class="t">Women</button>' +
     '<div class="p"><ul class="sub"><li><a href="/3">3</a></li><li><a href="/4">4</a></li></ul></div></li></ul></nav>',
     '.nav__list'],
    ['a container that is ALREADY the list is left alone',
     '<ul id="r"><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>', null],
    ['a flat row of links is left alone — its children ARE the items',
     '<div id="r"><a href="/a">A</a><a href="/b">B</a></div>', null],
    ['nothing to descend to returns null rather than guessing',
     '<div id="r"><p>no items here</p></div>', null],
  ];
  for (const [name, body, want] of cases) {
    const d = new JSDOM(`<body>${body}</body>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    const got = d.window.__u1SelectorIntel.menuItemsRoot('#r');
    check(name, got === want, String(got));
  }
}

console.log('\na class a person wrote beats a description of the element');
{
  // Both pointed at the same tab strip. `div[aria-label="Search modes"]` breaks
  // when the label is translated or reworded, says nothing to whoever reads the
  // mapping later, and — measured on the live page — produced a tabList with no
  // tabPanel beside it where `.finder__tabs` produced both.
  const sel = (body) => {
    const d = new JSDOM(`<body>${body}</body>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.robustSelector(d.window.document.querySelector('[data-t]'));
  };
  check('a unique hand-written class wins over aria-label',
    sel('<div data-t class="finder__tabs" aria-label="Search modes"></div>') === '.finder__tabs');
  check('…but a class shared with others does not — the label is more specific',
    sel('<div data-t class="row" aria-label="Search modes"></div><div class="row"></div>')
      === 'div[aria-label="Search modes"]');
  check('…nor does a build-generated hash, which changes on the next deploy',
    sel('<div data-t class="css-1a2b3c4" aria-label="Search modes"></div>')
      === 'div[aria-label="Search modes"]');
  check('an id still beats both',
    sel('<div data-t id="tt" class="finder__tabs" aria-label="x"></div>') === '#tt');
}

console.log('\na person says what it is, and no model is asked');
{
  // The pipeline from a type and a selector to a working mapping is already
  // local. All the model supplies is the sub-fields, and these can be measured
  // — so "these six buttons are a tab strip" is enough, and it costs nothing.
  const bench = (body) => {
    const d = new JSDOM(`<body><main>${body}</main></body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
    const P = d.window.HTMLElement.prototype;
    Object.defineProperty(P, 'offsetWidth', { get() { return 40; } });
    Object.defineProperty(P, 'offsetHeight', { get() { return 20; } });
    P.getClientRects = function () { return [{ width: 40, height: 20, top: 5, left: 5, bottom: 25, right: 45 }]; };
    P.getBoundingClientRect = function () { return { width: 40, height: 20, top: 5, left: 5, bottom: 25, right: 45 }; };
    d.window.eval(INTEL);
    const doc = d.window.document;
    let n = 0;
    const mark = (sel) => {
      const got = [...doc.querySelectorAll(sel)];
      const marks = got.map((el) => { el.setAttribute('data-u1-mark', String(++n)); return n; });
      return marks;
    };
    return { I: d.window.__u1SelectorIntel, mark, doc };
  };

  // The strip the model could not identify: six buttons over ONE re-rendered
  // region, data-controls naming an id that is not on the page. The collector
  // sees six buttons, correctly — the component is the strip they form, and
  // there is no single candidate to label.
  {
    const b = bench(
      '<div class="tab-bar" id="dealTabs">' +
      ['week', 'running', 'sneakers', 'boots', 'kids', 'clearance'].map((t, i) =>
        `<button class="tab-bar__btn" id="dealTab-${t}" data-controls="dealPanel" data-selected="${i === 0}">${t}</button>`).join('') +
      '</div><div class="deal-grid" id="dealGrid" data-labelledby="dealTab-week"></div>');
    const marks = b.mark('.tab-bar__btn');
    const got = b.I.describeComponent('tabs', marks);
    check('six ticked buttons become a tab strip rooted on their container',
      got.root === '#dealTabs', JSON.stringify(got));
    check('…with the tab selector taken from what was ticked',
      got.fields.tab === '.tab-bar__btn' && got.counts.tab === 6, JSON.stringify(got.fields));
    check('…and the panel measured, on the strip the model could not identify',
      got.fields.tabPanel === '.deal-grid', JSON.stringify(got.fields));
  }

  // The field must mean the same thing to U1, which resolves against the whole
  // document. `a` is exact inside a <ul> and means every link on the site.
  {
    const b = bench('<nav><ul class="nav-list"><li><a href="/a">A</a></li>' +
      '<li><a href="/b">B</a></li><li><a href="/c">C</a></li></ul></nav>' +
      '<a href="/x">stray</a><a href="/y">stray</a>');
    const [ul] = b.mark('.nav-list');
    const got = b.I.describeComponent('menu', [ul]);
    check('a menu\'s items are scoped, not left as a bare tag',
      got.fields.items === '.nav-list>li>a', JSON.stringify(got.fields));
    check('…and match only the three in the menu, not the five on the page',
      got.counts.items === 3, String(got.counts.items));
  }

  // Ticking the wrapper is the natural thing to do and the wrong root. The
  // measurement already knows which element is the list.
  {
    const b = bench('<div class="click-nav"><button class="clicker">Sign In</button>' +
      '<ul class="signin-dropdown"><li><a href="/m">M</a></li><li><a href="/p">P</a></li></ul></div>');
    const [wrap] = b.mark('.click-nav');
    const got = b.I.describeComponent('listbox', [wrap]);
    check('a listbox is rooted on the list, not the wrapper that also holds the button',
      got.root === '.signin-dropdown', got.root);
    check('…with the trigger and the options measured',
      got.fields.trigger === '.clicker' && got.fields.options === '.signin-dropdown>li>a',
      JSON.stringify(got.fields));
  }

  // A selection spread across the page is not a component, and building a
  // mapping on <body> quietly would be worse than refusing.
  {
    const b = bench('<div class="one"><button class="x">a</button></div>' +
      '<div class="two"><button class="x">b</button></div>');
    const marks = b.mark('.x');
    // Their common ancestor here is <main>, which is in the too-broad list.
    const got = b.I.describeComponent('tabs', marks);
    check('elements with only a landmark in common are refused, and told why',
      !!got.err && /spread across the page/.test(got.err), JSON.stringify(got));
  }

  {
    const b = bench('<div class="k"><button class="x">a</button></div>');
    check('a mark that is no longer on the page is refused rather than throwing',
      /no longer|not .*on the page|any more/i.test(b.I.describeComponent('tabs', [99]).err || ''),
      JSON.stringify(b.I.describeComponent('tabs', [99])));
  }
}

console.log('\nthe hover highlight follows the page it is drawn on');
{
  const boot = () => {
    const d = new JSDOM('<body><div class="x">a</div><div class="x">b</div><div class="x">c</div></body>',
      { runScripts: 'outside-only', pretendToBeVisual: true });
    // A SMOOTH scroll, which is what the code asks for: it keeps moving for
    // frames after it is started. An instant scroll would hide the bug, because
    // the first measurement would already be the final position.
    let top = 100, target = 100;
    d.window.HTMLElement.prototype.getBoundingClientRect = function () {
      return { width: 50, height: 20, top, left: 30, bottom: top + 20, right: 80 };
    };
    d.window.HTMLElement.prototype.scrollIntoView = function () { target = 40; };
    let frame = null;
    d.window.requestAnimationFrame = (f) => { frame = f; return 1; };
    d.window.cancelAnimationFrame = () => { frame = null; };
    d.window.eval(INTEL);
    // Each frame the scroll advances part of the way, exactly as a real one does.
    const tick = () => {
      if (top > target) top = Math.max(target, top - 20);
      const f = frame; frame = null; if (f) f();
    };
    return { d, tick, scrolled: () => top };
  };

  const { d, tick } = boot();
  const I = d.window.__u1SelectorIntel;
  const n = I.highlightSelector('.x');
  // highlightSelector owns its OWN layer now, separate from the numbered one:
  // it used to build on MARK_LAYER's id, so every use of it removed the marks
  // the labelling pause is built on.
  const layer = () => d.window.document.getElementById('__u1_mark_hilite__');
  check('it returns how many the selector really matches', n === 3, String(n));

  // The bug this replaces: boxes were positioned once, and scrollIntoView keeps
  // moving the page for hundreds of milliseconds afterwards — so the outline
  // came to rest beside the element rather than round it.
  const firstTop = layer().children[0].style.top;
  tick(); tick(); tick(); tick();
  const settled = layer().children[0].style.top;
  check('the boxes follow the smooth scroll instead of being left behind',
    firstTop === '100px' && settled === '40px', `${firstTop} → ${settled}`);
  check('…and the count tag follows with them',
    layer().lastElementChild.style.top === '19px', layer().lastElementChild.style.top);

  const tag = layer().lastElementChild;
  check('a count is shown on the element, not left to be counted by eye',
    /1 of 3 matches/.test(tag.textContent), tag.textContent);
  check('the first match is solid and the rest are dashed — a widened selector shows itself',
    /solid/.test(layer().children[0].style.outline) &&
    /dashed/.test(layer().children[1].style.outline));
  check('and it carries a dark halo, so it is visible on a purple header too',
    /rgba\(0, ?0, ?0/.test(layer().children[0].style.boxShadow), layer().children[0].style.boxShadow);

  I.clearMarks();
  check('clearing takes the overlay and its listeners away', !layer());

  const one = boot();
  one.d.window.__u1SelectorIntel.highlightSelector('.x:first-child');
  check('one match says so rather than "1 of 1"',
    /the only match/.test(one.d.window.document.getElementById('__u1_mark_hilite__').lastElementChild.textContent));

  const bad = boot();
  check('an invalid selector is -1, not a crash', bad.d.window.__u1SelectorIntel.highlightSelector('>>>') === -1);
  check('no match is 0', bad.d.window.__u1SelectorIntel.highlightSelector('.nope') === 0);
}

console.log('\ntabs always get a tabPanel, because tabs without one control nothing');
{
  const panels = (body, list, tab) => {
    const d = new JSDOM(`<body>${body}</body>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.tabPanelsFor(list, tab);
  };
  const strip = (attr) =>
    `<div class="finder__tabs"><button class="finder__tab" ${attr}1>a</button>` +
    `<button class="finder__tab" ${attr}2>b</button></div>` +
    '<div id="p1" class="finder__panel"></div><div id="p2" class="finder__panel"></div>';
  check('read off aria-controls when the page says so',
    panels(strip('aria-controls=p'), '.finder__tabs', '.finder__tab') === '.finder__panel');
  check('…or off any data-* holding an element id, which is how sites wire their own',
    panels(strip('data-finder-tab=p'), '.finder__tabs', '.finder__tab') === '.finder__panel');
  check('…or off role=tabpanel',
    panels('<div><div class="t"><button class="b">a</button><button class="b">b</button></div>' +
           '<div role="tabpanel" class="pp"></div><div role="tabpanel" class="pp"></div></div>',
           '.t', '.b') === '.pp');
  // The case that matters commercially: no ARIA at all, which is what bbc.com
  // and wikipedia.org both serve for their tabbed UI.
  check('…and off the SHAPE alone — same-class siblings, exactly one showing',
    panels('<div class="w"><div class="t"><button class="b">a</button><button class="b">b</button>' +
           '<button class="b">c</button></div><div class="pane"></div>' +
           '<div class="pane" hidden></div><div class="pane" hidden></div></div>',
           '.t', '.b') === '.pane');
  // ── One region, re-rendered per tab ──────────────────────────────────────
  // Every strategy above needs TWO panels. Plenty of strips have one: six
  // buttons over a single region the site re-renders. Measured on the live
  // shoe-store page — six tabs whose data-controls names an id that does not
  // exist, and one .deal-grid — where all four returned null and the strip
  // could not be mapped at all. The link that DOES exist runs the other way:
  // the panel names the tab whose content it is showing.
  const dealTabs = (panelAttrs) =>
    '<section id="deals"><div class="tab-bar" id="dealTabs" aria-label="Deal categories">' +
    ['week', 'running', 'sneakers'].map((t, i) =>
      `<button class="tab-bar__btn" id="dealTab-${t}" data-controls="dealPanel" ` +
      `data-selected="${i === 0}">${t}</button>`).join('') +
    `</div><div class="deal-grid" id="dealGrid" ${panelAttrs}></div></section>`;

  check('a ONE-panel strip is found through the panel naming its tab',
    panels(dealTabs('data-labelledby="dealTab-week"'), '#dealTabs', '.tab-bar__btn') === '.deal-grid',
    panels(dealTabs('data-labelledby="dealTab-week"'), '#dealTabs', '.tab-bar__btn'));
  check('…with the ARIA spelling too',
    panels(dealTabs('aria-labelledby="dealTab-week"'), '#dealTabs', '.tab-bar__btn') === '.deal-grid');
  check('…and data-controls naming an id that does not exist is not mistaken for one',
    panels(dealTabs(''), '#dealTabs', '.tab-bar__btn') === null,
    String(panels(dealTabs(''), '#dealTabs', '.tab-bar__btn')));
  check('a labelledby pointing at something that is NOT a tab is ignored',
    panels(dealTabs('data-labelledby="somethingElse"'), '#dealTabs', '.tab-bar__btn') === null);

  check('nothing panel-shaped returns null rather than inventing one',
    panels('<div class="t"><button class="b">a</button><button class="b">b</button></div>',
           '.t', '.b') === null);
}

console.log('\na trigger-first component gets the thing it OPENS, not just the trigger');
{
  // u1.fix.listbox / datepicker / tooltip are rooted on what APPEARS. A sweep
  // holds only the control that summons it, so every one of them was refused
  // and dropped — a page reporting six components saved five, and the reason
  // was shown in a panel the auto-approve closed a moment later.
  const opened = (body) => {
    const d = new JSDOM(`<body>${body}</body>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.openedBy('#trig');
  };
  check('read off aria-controls, and the id wins as it does everywhere',
    opened('<button id="trig" aria-controls="pop">Sign In</button>' +
           '<ul id="pop" class="dd"><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>') === '#pop');
  check('…or off a role beside the trigger',
    opened('<div class="w"><button id="trig">Sign In</button>' +
           '<div role="menu" class="dd"><a href="/a">A</a><a href="/b">B</a></div></div>') === '.dd');
  // The ordinary case: a drop-down with no ARIA at all.
  check('…or off the shape — the next sibling holding several links',
    opened('<div class="w"><button id="trig">Sign In</button>' +
           '<ul class="dropdown"><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul></div>') === '.dropdown');
  check('a control that opens nothing returns null rather than a nearby paragraph',
    opened('<div class="w"><button id="trig">Sign In</button><p>hello</p></div>') === null);
  check('and it never answers with the trigger itself',
    opened('<button id="trig" class="solo">Sign In</button>') === null);
}

console.log('\na listbox is rooted on the list that OPENS');
{
  // The real Molina Sign In dropdown. The model has now got this wrong twice in
  // a row, in both directions, and every field resolved both times:
  //   listbox: ".clicker"    the button   → no options inside a button
  //   listbox: ".click-nav"  the wrapper  → contains the trigger too
  const page = '<div class="signin"><div class="click-nav">' +
    '<button class="clicker">Sign In</button>' +
    '<ul class="signin-dropdown" role="menu"><li><a href="/m">Member</a></li>' +
    '<li><a href="/h">HCP</a></li></ul></div></div>';
  const root = (sel) => {
    const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.listboxRoot(sel);
  };
  check('the button it opens from is corrected to the list', root('.clicker') === '.signin-dropdown');
  check('so is the wrapper holding both', root('.click-nav') === '.signin-dropdown');
  check('the list itself is left alone', root('.signin-dropdown') === null);
  // Counting DESCENDANTS instead of children would accept the wrapper, because
  // the wrapper contains the list which contains the options.
  check('a wrapper is not mistaken for the list by descendant count',
    root('.signin') === '.signin-dropdown');
}

console.log('\nnames U1 itself writes never enter a mapping');
{
  // Circular: the mapping would depend on an id the mapping itself causes to
  // exist. It resolves on a decorated page and matches nothing at load.
  const d = new JSDOM('<body><div class="click-nav u1st-tabbable-element" ' +
    'id="u1-anchor-f9u36-1"><button class="clicker">Sign In</button></div></body>',
    { runScripts: 'outside-only' });
  d.window.eval(INTEL);
  const S = d.window.__u1SelectorIntel;
  check('the u1-generated id is not used, the site\'s own class is',
    S.robustSelector(d.window.document.querySelector('.click-nav')) === '.click-nav');
  check('u1- ids are graded volatile', S.VOLATILE_ID.test('u1-anchor-f9u36-1'));
  check('u1st- ids too', S.VOLATILE_ID.test('u1st-9f8e7d'));
  check('u1 classes are noise', S.NOISE.test('u1st-tabbable-element'));
}

console.log('\na closed panel inside the scope you named is the interesting element');
{
  // Pointing at .click-nav returned only the button, and the model's own reason
  // was "the actual options list isn't available here". It was not: the <ul> is
  // display:none until the dropdown opens, so it never became a candidate — and
  // the prompt forbids naming a selector that is not in the list.
  const page = '<div class="signin"><div class="click-nav">' +
    '<button class="clicker">Sign In</button>' +
    '<ul class="signin-dropdown" role="menu" style="display:none">' +
    '<li><a href="/m">Member</a></li></ul></div></div>';
  const boxed = () => {
    const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
    // jsdom has no layout: give everything a box except what CSS hides, which
    // is the one distinction this test turns on.
    d.window.Element.prototype.getBoundingClientRect = function () {
      return d.window.getComputedStyle(this).display === 'none'
        ? { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }
        : { width: 200, height: 40, top: 10, left: 10, right: 210, bottom: 50 };
    };
    d.window.eval(INTEL);
    return d.window;
  };
  const sels = (scope) => {
    const w = boxed();
    const got = w.__u1SelectorIntel.collectCandidates(40, scope);
    return got.candidates;
  };

  const wide = sels(null).map((c) => c.selector);
  check('page-wide, a closed panel is NOT collected — every shut modal on the site would flood the list',
    !wide.includes('.signin-dropdown'), wide.join(' | '));

  const scoped = sels('.click-nav');
  const ul = scoped.find((c) => c.selector === '.signin-dropdown');
  check('scoped to its container, it IS collected', !!ul);
  check('…and flagged closed, so the model knows it is not in the screenshot',
    !!(ul && ul.closed));
}

console.log('\na listbox is read off the structure, not asked about');
{
  // Inside the container: the clickable thing is the trigger (it has the
  // event); the thing that CONTAINS several things is the listbox (that is the
  // shape). Asked three times, the model answered wrong three times in three
  // different arrangements — so it is measured instead.
  const shape = (page, scope) => {
    const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.listboxShape(scope);
  };

  const molina = '<div class="signin"><div class="click-nav">' +
    '<button class="clicker" title="Sign In">Sign In<span></span></button>' +
    '<ul class="signin-dropdown" role="menu"><li><a href="/m">Member</a></li>' +
    '<li><a href="/h">HCP</a></li></ul></div></div>';
  const a = shape(molina, '.click-nav');
  check('the button is the trigger', a && a.trigger === '.clicker', JSON.stringify(a));
  check('the list is the listbox', a && a.listbox === '.signin-dropdown');
  // The <a> inside each <li>, not the <li>: role="option" on a wrapper holding
  // a link puts the focus on one element and the action on another.
  check('the options are the links, not the rows holding them',
    a && a.options === '.signin-dropdown>li>a', JSON.stringify(a));

  // "לא משנה לי מה זה" — a <div> of <a>s is the same shape and the same answer.
  const divs = '<div class="wrap"><button class="btn">Pick</button>' +
    '<div class="panel"><a href="/1" class="opt">One</a><a href="/2" class="opt">Two</a></div></div>';
  const b = shape(divs, '.wrap');
  check('a <div> holding <a>s is a list just as much as a <ul>',
    b && b.listbox === '.panel' && b.trigger === '.btn', JSON.stringify(b));

  // The container must never be its own listbox: it holds the trigger AND the
  // list, so it scores as "contains several things" every time.
  check('the container is never mistaken for the list',
    shape(molina, '.click-nav').listbox !== '.click-nav');

  check('a container with no list at all returns null rather than guessing',
    shape('<div class="wrap"><button class="btn">Pick</button></div>', '.wrap') === null);
}

console.log('\nthe option is what a person ACTIVATES, not the row holding it');
{
  // role="option" on an <li> wrapping an <a> puts the focus on one element and
  // the action on another. Evidence first: what the event recorder SAW beats
  // what the tag suggests.
  const opts = (page, scope, wire) => {
    const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only' });
    if (wire) wire(d.window);
    d.window.eval(INTEL);
    const r = d.window.__u1SelectorIntel.listboxShape(scope);
    return r && r.options;
  };
  const molina = '<div class="click-nav"><button class="clicker">Sign In</button>' +
    '<ul class="signin-dropdown"><li><a href="/m" class="opt">Member</a></li>' +
    '<li><a href="/h" class="opt">HCP</a></li></ul></div>';

  check('<li><a> descends to the link', opts(molina, '.click-nav') === '.opt');
  check('rows that are already links are left alone',
    opts('<div class="w"><button class="b">P</button><div class="list">' +
         '<a href="/1" class="o">A</a><a href="/2" class="o">B</a></div></div>', '.w') === '.o');
  // No common level to descend to, so descending would be a guess.
  check('a row holding TWO links stays on the row',
    opts('<div class="w"><button class="b">P</button><ul class="list">' +
         '<li><a href="/1">A</a><a href="/2">B</a></li><li><a href="/3">C</a></li></ul></div>',
         '.w') === '.list>li');
  // A delegated list: the handler is on the row, so the row IS the option.
  check('the event recorder overrules the tag, not merely agrees with it',
    opts(molina, '.click-nav', (w) => {
      const rows = [...w.document.querySelectorAll('li')];
      w.__u1EventMap = { has: (el) => rows.includes(el) };
    }) === '.signin-dropdown>li');
}

console.log('\na role the SITE wrote is a question, not a default');
{
  const clash = (attrs, type) => {
    const d = new JSDOM(`<body><ul class="dd" ${attrs}><li><a href="/a">A</a></li></ul></body>`,
      { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.authoredRoleConflict('.dd', type);
  };
  const c = clash('role="menu"', 'listbox');
  check('the site saying role="menu" while we map a listbox is a conflict',
    !!c && c.role === 'menu' && c.willWrite === 'listbox', JSON.stringify(c));
  check('no role at all is not a conflict', clash('', 'listbox') === null);
  check('the same role is not a conflict', clash('role="listbox"', 'listbox') === null);
  // Once u1 has processed the element the role on it is OURS, and asking about
  // our own work would make the question noise that gets clicked through.
  check('a role u1 already wrote is not asked about',
    clash('role="menu" u1st-avoid-change-detection="true"', 'listbox') === null);
  check('…nor one on an element u1 marked as a trigger',
    clash('role="menu" u1st-trigger-element="true"', 'listbox') === null);
}

console.log('\nthe options selector is checked against the whole page, not the list');
{
  // commonSelectorFor answers for the container it is given: inside the panel,
  // plain `a` covers every option and nothing else. U1 resolves against the
  // document, where `a` is every link on the site. Descending to the links is
  // what exposed this — while the options were `li` the short form happened to
  // be unique anyway.
  const d = new JSDOM('<body><a href="/x">elsewhere</a><nav><a href="/y">and here</a></nav>' +
    '<div class="click-nav"><button class="clicker">S</button>' +
    '<ul class="signin-dropdown"><li><a href="/m">M</a></li><li><a href="/h">H</a></li></ul>' +
    '</div></body>', { runScripts: 'outside-only' });
  d.window.eval(INTEL);
  const r = d.window.__u1SelectorIntel.listboxShape('.click-nav');
  check('it does not answer with a bare tag that matches the whole site',
    r.options !== 'a', r.options);
  check('it matches exactly the options and nothing else',
    d.window.document.querySelectorAll(r.options).length === 2,
    `${r.options} matches ${d.window.document.querySelectorAll(r.options).length}`);
}

// A page, booted, with the collector's answer indexed by element.
function collectIn(body, script) {
  const d = new JSDOM(`<!doctype html><body>${body}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = d.window;
  w.getComputedStyle = () => ({ position: 'static', visibility: 'visible', display: 'block', opacity: '1' });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  if (script) w.eval(script);
  w.eval(INTEL);
  const got = w.__u1SelectorIntel.collectCandidates(60, null);
  const at = (sel, root) => {
    const el = (root || w.document).querySelector(sel);
    return got.candidates.find((x) => x.mark != null &&
      (w.document.querySelector(`[data-u1-mark="${x.mark}"]`) === el ||
       (root && root.querySelector(`[data-u1-mark="${x.mark}"]`) === el))) || null;
  };
  return { w, got, at, name: (sel, root) => (at(sel, root) || {}).component || '(not collected)' };
}

// ── A real <form> could never say it was a form ────────────────────────────
//
// componentHint's form rule is guarded by `!el.closest('form')`, there to stop
// every div inside a real form being called one too. closest() starts at the
// element itself, so a <form> matched its own guard: the one element on a page
// that needs no heuristic at all was the only one the heuristic could not name.
//
// Reported as, exactly: funny, it did not catch the form.
console.log('\na <form> is a form');
{
  // The case that failed — a real form, with the field count that used to be
  // required sitting right there inside it.
  const a = collectIn(`<form id="signup" action="/go">
      <label for="e">Email</label><input id="e" type="email">
      <input id="n" type="text"><select id="s"><option>A</option></select>
      <button type="submit">Send</button></form>`);
  check('a <form> with three fields is named a form', a.name('#signup') === 'form', a.name('#signup'));

  // And the case no field threshold could ever reach: a search form is one
  // input and a button, and it is still a form.
  const b = collectIn(`<form id="search" role="search"><input id="q" type="search"><button>Go</button></form>`);
  check('…and so is a two-field search form', b.name('#search') === 'form', b.name('#search'));

  // The guard's real job has to survive.
  const c = collectIn(`<form id="outer">
      <div id="group"><input type="text"><input type="text"><input type="text"></div>
      <button>Send</button></form>`);
  check('the divs inside a form are still not each a form', c.name('#group') !== 'form', c.name('#group'));
  check('…while the form itself is', c.name('#outer') === 'form', c.name('#outer'));

  // ── The thing the fields ADD UP TO ──────────────────────────────────────
  //
  // Reported by putting the page beside the results: the shoe finder — five
  // selects, five checkboxes and a "Find my shoe" button — was not in the
  // seven components found. CANDIDATE_SEL finds what ANNOUNCES itself, and
  // `<div class="finder__panel">` announces nothing, so every field was
  // collected on its own and the panel was not collected at all. The form rule
  // in componentHint is exactly right for it and never got an element to run
  // on. The same shape as the tab strip whose container was invisible while
  // its six buttons were all found.
  const FINDER = `<div class="finder">
      <div class="finder__tabs" role="tablist"><button>By sport</button><button>Size &amp; fit</button></div>
      <div class="finder__panel">
        <div class="finder__row">
          <select id="f1"><option>Men</option></select><select id="f2"><option>Road</option></select>
          <select id="f3"><option>Pavement</option></select><select id="f4"><option>$300</option></select>
          <select id="f5"><option>Any</option></select>
        </div>
        <button class="finder__go">Find my shoe</button>
        <div class="finder__opts">
          <label><input type="checkbox">In stock</label><label><input type="checkbox">Wide fit</label>
          <label><input type="checkbox">Waterproof</label><label><input type="checkbox">Vegan</label>
        </div>
      </div>
    </div>`;
  const finder = collectIn(FINDER);
  check('a filter panel with no tag, role or class hint is found',
    finder.name('.finder__panel') === 'form', finder.name('.finder__panel'));

  // The tightest ancestor is what a first attempt reaches for, and it returned
  // TWO forms for one: the row of selects and the row of checkboxes, with the
  // panel holding both and the button named nothing. u1.fix.form applied to
  // each decorates two halves of a thing.
  check('…as ONE form, not one per row of fields',
    finder.name('.finder__row') !== 'form' && finder.name('.finder__opts') !== 'form',
    `${finder.name('.finder__row')} / ${finder.name('.finder__opts')}`);
  // Still a component of its own — the point of this check — but named `menu`
  // now that a strip and a nav bar are one component.
  check('…and the strip beside it is still its own component',
    finder.name('.finder__tabs') === 'menu', finder.name('.finder__tabs'));

  // The guard this replaces was written for a real case and still catches it.
  // One submit is a form whose fields are in rows; three submits is a page
  // that contains three forms, and the climb must stop before it swallows them.
  const three = collectIn(`<div class="page">
      <div class="signup"><input><input><input><button>Join</button></div>
      <div class="contact"><input><input><textarea></textarea><button>Send</button></div>
      <div class="search"><input><select></select><input><button>Go</button></div>
    </div>`);
  check('three separate forms stay three, not one wrapper round them',
    ['signup', 'contact', 'search'].every((c) => three.name('.' + c) === 'form') &&
    three.name('.page') !== 'form',
    `.page is ${three.name('.page')}`);

  // A filter bar that applies on change has no submit anywhere. Still a form;
  // there is simply nothing better to anchor on.
  const bar = collectIn(`<div class="filters"><select id="a"></select><select id="b"></select><select id="c"></select></div>`);
  check('a filter bar with no submit at all is still found',
    bar.name('.filters') === 'form', bar.name('.filters'));

  // Two fields are not a form. Without a floor, every pair of inputs on a page
  // becomes a component to map.
  const two = collectIn(`<div class="pair"><input><input></div>`);
  check('two fields are not a form', two.name('.pair') !== 'form', two.name('.pair'));

  // Div-soup forms are what the three-field rule is for, and it is untouched.
  // The wrapper has to be a candidate for any of this to reach it — a bare
  // <div> with no tag, role, class or handler is not collected at all, and
  // that is the pre-existing behaviour this change does not touch.
  const e = collectIn(`<div id="soup" tabindex="-1"><input type="text"><input type="email"><select><option>A</option></select></div>`);
  check('a form built out of divs is still found by counting fields',
    e.name('#soup') === 'form', e.name('#soup'));
}

// ── Open shadow roots ──────────────────────────────────────────────────────
//
// querySelectorAll does not cross a shadow boundary. A component inside one is
// not hidden, not off-screen and not filtered out — it is simply absent from
// the answer, and from outside "there is nothing there" and "I cannot see in
// there" produce identical output.
console.log('\nlooking inside an open shadow root');
{
  const { got } = collectIn(
    `<a href="/">Ordinary link in the light DOM</a><site-header id="host"></site-header>`,
    `var sr = document.getElementById('host').attachShadow({ mode: 'open' });
     sr.innerHTML = '<nav class="mega-nav" id="inner"><a href="/a">A</a><a href="/b">B</a></nav>';`);

  const inner = got.candidates.filter((c) => c.inShadow);
  check('a component behind a shadow boundary is found at all', inner.length > 0,
    `${got.candidates.length} candidates, none of them in a shadow root`);
  check('…and is named for what it is', inner.some((c) => c.component === 'menu'),
    inner.map((c) => c.component).join());

  // The honest half. document.querySelector cannot reach it and neither can
  // u1.fix.* — so a selector for it is not a selector, it is a string that
  // resolves to nothing on every page load. Collecting it WITH one would be
  // worse than not collecting it at all: it would build mappings that fail in
  // silence, on a page where everything looked fine when it was mapped.
  check('it carries no selector, because no selector can reach it',
    inner.every((c) => !c.selector), inner.map((c) => c.selector).join());
  check('…and names the hosts you would have to go through instead',
    inner.every((c) => /site-header/.test(c.shadowHost)), inner.map((c) => c.shadowHost).join());

  // This adds reach; it must not change what was already reachable.
  const light = got.candidates.filter((c) => !c.inShadow);
  check('the ordinary page is collected exactly as before',
    light.some((c) => c.tag === 'a' && c.selector), `${light.length} light-DOM candidates`);
}

// ── Library fingerprints ───────────────────────────────────────────────────
//
// The words in CLASS_HINTS are ones a human chose. These are strings a
// FRAMEWORK emitted, and they are worth having for the opposite reason: nobody
// types `react-datepicker__input-container` by accident, so when it appears it
// is a fact about what was rendered rather than a guess about intent.
console.log('\nfingerprints a framework left behind');
{
  const named = (body, sel) => collectIn(body).name(sel);

  check('a Material datepicker is a datepicker',
    named('<div id="x" class="mat-datepicker-content"><input></div>', '#x') === 'datepicker',
    named('<div id="x" class="mat-datepicker-content"><input></div>', '#x'));
  check('a react-select control is a combobox',
    named('<div id="x" class="react-select__control"><a href="/">A</a></div>', '#x') === 'combobox',
    named('<div id="x" class="react-select__control"><a href="/">A</a></div>', '#x'));
  // Order matters and the generic vocabulary wins. `downshift-1-menu` contains
  // the word "menu" and is read as a menu — which for a combobox's popup list
  // is a fair answer. The fingerprints name what the words leave unnamed; they
  // do not overrule them.
  check('…while a library class containing a plain word is read as that word',
    named('<div id="x" class="downshift-1-menu"><a href="/">A</a></div>', '#x') === 'menu',
    named('<div id="x" class="downshift-1-menu"><a href="/">A</a></div>', '#x'));
  check('a Swiper is a carousel',
    named('<div id="x" class="swiper-container"><a href="/">A</a></div>', '#x') === 'carousel',
    named('<div id="x" class="swiper-container"><a href="/">A</a></div>', '#x'));

  // camelCase is exactly why these need the case-insensitive flag: a CSS
  // substring match is case-SENSITIVE, so without ` i` these are collected by
  // nothing at all and never reach the naming step.
  check('a MUI accordion is found although it is camelCase',
    named('<div id="x" class="MuiAccordion-root"><a href="/">A</a></div>', '#x') === 'accordion',
    named('<div id="x" class="MuiAccordion-root"><a href="/">A</a></div>', '#x'));
  check('a ReactModal is found although it is camelCase',
    named('<div id="x" class="ReactModal__Content"><a href="/">A</a></div>', '#x') === 'dialog',
    named('<div id="x" class="ReactModal__Content"><a href="/">A</a></div>', '#x'));
  check('Reach UI tabs are found by their data- attribute, having no class',
    named('<div id="x" data-reach-tab-list><button>A</button><button>B</button></div>', '#x') === 'menu',
    named('<div id="x" data-reach-tab-list><button>A</button><button>B</button></div>', '#x'));

  // A site that says "carousel" in its own words is read in its own words. The
  // fingerprints only decide what the vocabulary above leaves undecided.
  check('a hand-written class still wins over a library fingerprint',
    named('<div id="x" class="carousel headlessui-menu"><a href="/">A</a></div>', '#x') === 'carousel',
    named('<div id="x" class="carousel headlessui-menu"><a href="/">A</a></div>', '#x'));

  // Build artefacts are NOT fingerprints: _ngcontent, ng-star-inserted and sc-
  // are on every element those frameworks render, so they identify the
  // framework and say nothing about what any one element is. Naming from them
  // would put a component label on every div on an Angular page.
  check('a generic build artefact names nothing',
    named('<div id="x" class="ng-star-inserted sc-bdvvtL"><a href="/">A</a></div>', '#x') !== 'menu',
    named('<div id="x" class="ng-star-inserted sc-bdvvtL"><a href="/">A</a></div>', '#x'));

  // CANDIDATE_SEL is ONE selector, so an engine that rejected the ` i` flag
  // would not lose the fingerprints — it would throw on the whole thing and
  // collect nothing, everywhere, in silence.
  check('the candidate selector is validated before it is relied on',
    /document\.querySelector\(CANDIDATE_SEL\); return CANDIDATE_SEL/.test(INTEL) &&
    /replace\(\/" i\\\]\/g, '"\]'\)/.test(INTEL));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

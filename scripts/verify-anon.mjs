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
  // Our own patch mints these at apply time — anchoring on one maps the same
  // element twice (molina: LISTBOX .signin-dropdown AND #u1p-listbox-wcvryke).
  check('u1p- ids — the patch\'s own runtime anchors — too', S.VOLATILE_ID.test('u1p-listbox-wcvryke') && S.VOLATILE_ID.test('u1p-acc-h-58x4rno'));
  // Angular Material numbers its ids by mount order — #mat-tab-label-0-0 is
  // a different element after any change in which groups render first.
  check('Material\'s generated ids are volatile too',
    S.VOLATILE_ID.test('mat-tab-label-0-0') && S.VOLATILE_ID.test('mat-expansion-panel-header-3') &&
    !S.VOLATILE_ID.test('material-icons'));

  // ── elal.com pins (2026-09-02): a slider's dots and a segmented control ──
  {
    const e1 = collectIn(`<div class="swiper-container">
        <div class="swiper-wrapper"><div class="swiper-slide">a</div><div class="swiper-slide">b</div></div>
        <div class="swiper-pagination" id="dots"><span></span><span></span></div>
      </div>
      <div class="pager" id="pages"><a href="#1">1</a><a href="#2">2</a><a href="#3">3</a></div>`);
    check('a carousel\'s dots are the carousel talking, not a pagination',
      e1.name('#dots') !== 'pagination', e1.name('#dots'));
    check('…while page numbers standing on their own keep the word',
      e1.name('#pages') === 'pagination', e1.name('#pages'));
    const e2 = collectIn(`<div class="ui-input-toggle-group" id="tg">
        <a class="ui-input-toggle-group__item--active" href="#">one way</a>
        <a href="#">multi</a><a href="#">all</a></div>`);
    check('a segmented control is ONE radio, not a strip of buttons',
      e2.name('#tg') === 'radio', e2.name('#tg'));
    // …and it wins even when the site spells the modifier "--tabs", as elal
    // does (ui-input-toggle-group--tabs): first match, radio before tabs.
    const e3 = collectIn(`<div class="ui-input-toggle-group ui-input-toggle-group--tabs" id="tg2">
        <a href="#">round trip</a><a href="#">one way</a><a href="#">multi</a></div>`);
    check('…even when its modifier class says --tabs', e3.name('#tg2') === 'radio', e3.name('#tg2'));
    // An autocomplete input names itself — elal's location fields carry the
    // combobox contract as attributes while an overlay widget stamps
    // role="document" over them.
    const e4 = collectIn(`<div><input id="orig" type="text" role="document"
        aria-autocomplete="list" aria-owns="locations-listbox" aria-haspopup="true" aria-expanded="false">
        <ul id="locations-listbox" hidden></ul></div>`);
    check('aria-autocomplete="list" on an input is a combobox, whatever role was stamped on it',
      e4.name('#orig') === 'combobox', e4.name('#orig'));
    // A long aria-label repeated across the page is an overlay widget's
    // instruction text, not anybody's name.
    const spam = 'to make this site accessible to screen readers press alt plus one now';
    const e5 = collectIn(`<div>
        <button id="b1" aria-label="${spam}">Search</button>
        <a href="/a" aria-label="${spam}">Flights</a>
        <a href="/b" aria-label="${spam}">Hotels</a>
        <a href="/c" aria-label="${spam}">Deals</a>
        <button id="b2" aria-label="Close dialog">✕</button></div>`);
    const b1 = e5.at('#b1'), b2 = e5.at('#b2');
    check('a mass-duplicated aria-label is ignored and the element\'s text is the name',
      !!b1 && b1.name === 'Search', b1 && b1.name);
    check('…while a label carried by one element keeps being the name',
      !!b2 && b2.name === 'Close dialog', b2 && b2.name);

    // ── clalit.co.il pins (2026-09-02) ──────────────────────────────────
    // slick writes role="tablist" on its DOT STRIP — the site's own markup,
    // and still the carousel talking: the veto beats the role.
    const e6 = collectIn(`<div class="goodToKnow slick-initialized">
        <div class="slick-track"><div class="slick-slide">a</div><div class="slick-slide">b</div></div>
        <ul class="slick-dots" id="dots6" role="tablist"><li role="presentation"><button role="tab">1</button></li>
        <li role="presentation"><button role="tab">2</button></li></ul></div>`);
    check('slick dots wearing role=tablist are still the carousel talking',
      e6.name('#dots6') !== 'tabs' && e6.name('#dots6') !== 'pagination', e6.name('#dots6'));
    // A page-wide wrapper DIV inside a voided WebForms form is the page too.
    const manyA = Array.from({ length: 35 }, (_, i) => `<a href="/p${i}">l${i}</a>`).join('');
    const e7 = collectIn(`<form action="/x.aspx"><div class="PageWrap" id="pw">
        <nav>${manyA}</nav>
        <div><input type="text" id="q7"><input type="password"><button type="submit">כניסה</button></div>
      </div></form>`);
    check('a page-wide wrapper div is not renamed form when the WebForms form is voided',
      e7.name('#pw') !== 'form', e7.name('#pw'));

    // Twin bare links in twin cards: no class of their own, tag alone too
    // broad — the shared ANCESTOR class + the same relative path carries the
    // group (molina's two "Learn more." links).
    {
      const c8 = collectIn(`<div class="middle">
        <div><h2>About</h2><div class="right-content"><p>text</p><p><a href="/about/">Learn more.</a></p></div></div>
        <div><h2>Careers</h2><div class="right-content"><p>text</p><p><a href="/careers/">Learn more.</a></p></div></div>
        <p><a href="/other/">Other link</a></p></div>`);
      const links8 = [...c8.w.document.querySelectorAll('a')].slice(0, 2);
      const got8 = c8.w.__u1SelectorIntel.commonSelectorFor(c8.w.document.body, links8, null);
      check('twin bare links group through their shared ancestor class',
        !!got8 && got8.exact && got8.selector === '.right-content>p>a' && got8.count === 2,
        JSON.stringify(got8));
    }
  }
  check('u1 classes are noise', S.NOISE.test('u1st-tabbable-element'));
}

console.log('\na closed panel is collected page-wide when it earns it');
{
  // Pointing at .click-nav returned only the button, and the model's own reason
  // was "the actual options list isn't available here". It was not: the <ul> is
  // display:none until the dropdown opens, so it never became a candidate — and
  // the prompt forbids naming a selector that is not in the list.
  //
  // This block used to assert the OPPOSITE of what it asserts now, and the
  // reversal is the point. The old rule was "page-wide, never collect a closed
  // panel — every shut modal on the site would flood the list". It did prevent
  // the flood, and it also meant that a whole-page pass could not name a
  // dialog, a dropdown, a closed tab panel or a collapsed accordion on ANY
  // site, ever: their defining element is hidden at the moment anyone looks, so
  // it was never in the list, so the model was never able to name it. Every one
  // of those types scored a flat zero and nothing said so.
  //
  // The rule now is not "collect hidden things" — that really would flood. It
  // is that a hidden element may earn a place by saying what it is: a control
  // declares it opens it, or it carries a revealable role, or it is a hidden
  // box sitting directly under <body> with something pressable inside. A
  // nondescript hidden <div> in the middle of the page still gets nothing,
  // which is what the flood test below now measures.
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
  check('page-wide, the closed dropdown IS collected — it carries role=menu',
    wide.includes('.signin-dropdown'), wide.join(' | '));

  // The other half of the same rule, and the reason the old assertion existed.
  {
    const noisy = '<div class="wrap">' +
      Array.from({ length: 30 }, (_, i) =>
        `<div class="lazy lazy${i}" style="display:none"><span>text ${i}</span></div>`).join('') +
      '</div>';
    const d = new JSDOM(`<body>${noisy}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
    d.window.Element.prototype.getBoundingClientRect = function () {
      return d.window.getComputedStyle(this).display === 'none'
        ? { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }
        : { width: 200, height: 40, top: 10, left: 10, right: 210, bottom: 50 };
    };
    d.window.eval(INTEL);
    const got = d.window.__u1SelectorIntel.collectCandidates(80, null).candidates;
    const lazies = got.filter((c) => /\blazy\d/.test(c.selector || ''));
    check('…while thirty nondescript hidden divs still bring nothing',
      lazies.length === 0, lazies.map((c) => c.selector).join(' | '));
  }

  const scoped = sels('.click-nav');
  const ul = scoped.find((c) => c.selector === '.signin-dropdown');
  check('scoped to its container, it IS collected', !!ul);
  check('…and flagged closed, so the model knows it is not in the screenshot',
    !!(ul && ul.closed));
}

console.log('\na link that is already a link is not mapped again');
{
  const page = '<a class="real" href="/x">Plans</a>' +
    '<a class="noname" href="/y"><img src="i.png"></a>' +
    '<a class="nohref">Looks like a link</a>' +
    '<button class="btn">Search</button>' +
    '<button class="unnamed"></button>' +
    '<div class="fake" onclick="go()">Press me</div>' +
    '<a class="lying" href="/z" role="tab">Deals</a>' +
    '<button class="untabbable" tabindex="-1">Hidden from tab</button>';
  const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only' });
  d.window.eval(INTEL);
  const N = (sel) => d.window.__u1SelectorIntel.alreadyNative(sel);

  check('a named <a href> needs no u1.fix.link — the browser already did it',
    !!N('.real') && N('.real').name === 'Plans');
  check('so does a named <button>', !!N('.btn') && N('.btn').name === 'Search');
  check('an <a> with no href is NOT a link, whatever it looks like', N('.nohref') === null);
  check('an icon link with no accessible name still needs one', N('.noname') === null);
  check('an unnamed button too', N('.unnamed') === null);
  check('a <div> with a click handler is the case fix.link was written for',
    N('.fake') === null);
  check('a role that contradicts the tag is a real defect, not a free pass',
    N('.lying') === null);
  check('a native control taken out of the tab order has lost what it came with',
    N('.untabbable') === null);
}

console.log('\na menu that is really a listbox is retyped');
{
  const shape = (page, sel) => {
    const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
    d.window.Element.prototype.getBoundingClientRect = function () {
      return d.window.getComputedStyle(this).display === 'none'
        ? { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }
        : { width: 200, height: 40, top: 10, left: 10, right: 210, bottom: 50 };
    };
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.menuIsReallyListbox(sel);
  };

  // The doctrine, decided in the stage-1 brief: listbox vs menu is what the
  // ITEMS DO, never the trigger count. The Sign In drop-down's rows are REAL
  // R0 (owner doctrine, 2026-09-01): one trigger over one flat list IS the
  // retype's showcase again — link rows change the FLAVOR, not the type:
  // overwriteRole:'menu' on the listbox engine. The 1.7 items-decide rule
  // is cancelled by explicit decision; verify-signin pins the same truth
  // on the real Molina markup.
  const signin = '<div class="signin"><div class="click-nav">' +
    '<button class="clicker" aria-haspopup="true" aria-expanded="false">Sign In</button>' +
    '<ul class="signin-dropdown" role="menu" style="display:none">' +
    '<li><a href="/m">Member</a></li><li><a href="/h">HCP</a></li></ul></div></div>';
  check('a drop-down of REAL links retypes to listbox + overwriteRole:menu (R0)',
    (() => { const r = shape(signin, '.signin-dropdown'); return !!r && r.overwriteRole === 'menu'; })(),
    JSON.stringify(shape(signin, '.signin-dropdown')));
  check('…pointed at the wrapper too',
    (() => { const r = shape(signin, '.click-nav'); return !!r && r.overwriteRole === 'menu'; })());

  // A VALUE PICKER retypes: same shape, but the rows select rather than
  // navigate — a replaced <select> with button options.
  const picker = '<div class="size-box"><div class="click-nav">' +
    '<button class="clicker" aria-haspopup="true" aria-expanded="false">Choose size</button>' +
    '<ul class="size-list" role="menu" style="display:none">' +
    '<li><button>EU 40</button></li><li><button>EU 41</button></li></ul></div></div>';
  const asList = shape(picker, '.size-list');
  check('a drop-down whose items pick a value is retyped to listbox',
    !!asList && asList.listbox === '.size-list' && asList.trigger === '.clicker',
    asList && `${asList.listbox} / ${asList.trigger}`);
  check('…href="#" and javascript: rows do not count as navigation',
    (() => {
      const fake = picker.replace('<button>EU 40</button>', '<a href="#">EU 40</a>')
        .replace('<button>EU 41</button>', '<a href="javascript:void(0)">EU 41</a>');
      const r = shape(fake, '.size-list');
      return !!r && r.listbox === '.size-list';
    })());

  // The guards, each on its own. R0 sharpens "inside a nav": only a nav
  // where the dropdown is ONE OF two or more top-level items keeps it a
  // menu (a submenu); a nav whose ONLY trigger this is holds a lone
  // dropdown, and a lone dropdown is a listbox wherever it lives.
  const inNav = '<nav class="main">' +
    '<a href="/home">Home</a><a href="/shop">Shop</a>' +
    '<div class="click-nav"><button class="clicker" aria-haspopup="true">Menu</button>' +
    '<ul class="nav-list" style="display:none"><li><a href="/a">A</a></li>' +
    '<li><a href="/b">B</a></li></ul></div></nav>';
  check('a dropdown that is ONE OF a nav\'s top-level items stays a menu (submenu)',
    shape(inNav, '.nav-list') === null);
  const lonelyNav = '<nav class="main"><div class="click-nav">' +
    '<button class="clicker" aria-haspopup="true">Menu</button>' +
    '<ul class="nav-list" style="display:none"><li><a href="/a">A</a></li>' +
    '<li><a href="/b">B</a></li></ul></div></nav>';
  check('a nav whose ONLY trigger is the dropdown retypes it — a lone dropdown is a listbox (R0)',
    (() => { const r = shape(lonelyNav, '.nav-list'); return !!r && r.overwriteRole === 'menu'; })(),
    JSON.stringify(shape(lonelyNav, '.nav-list')));

  const nested = '<div class="click-nav"><button class="clicker" aria-haspopup="true">More</button>' +
    '<ul class="drop" style="display:none"><li><a href="/a">A</a>' +
    '<ul class="sub"><li><a href="/a1">A1</a></li><li><a href="/a2">A2</a></li></ul></li>' +
    '<li><a href="/b">B</a></li></ul></div>';
  check('a list with a submenu under an item is a menu — a listbox cannot express that',
    shape(nested, '.drop') === null);

  const standing = '<div class="click-nav"><button class="clicker">Go</button>' +
    '<ul class="open-list"><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul></div>';
  check('a list standing open with nothing declaring it a popup is not a listbox',
    shape(standing, '.open-list') === null);
}

console.log('\na component is described in the page\'s own words');
{
  const word = (page, sel, trig) => {
    const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.componentWording(sel, trig);
  };
  check('the control that opens it names it',
    word('<div class="w"><button class="t">Sign In</button><ul class="l"><li>a</li></ul></div>',
      '.l', '.t') === 'Sign In');
  check('…and its aria-label wins over its text',
    word('<div class="w"><button class="t" aria-label="Account menu">Sign In</button>' +
      '<ul class="l"><li>a</li></ul></div>', '.l', '.t') === 'Account menu');
  check('with no control, the component\'s own label is used',
    word('<ul class="l" aria-label="Utility links"><li>a</li></ul>', '.l', '') === 'Utility links');
  check('…then the heading immediately above it',
    word('<h2>Quick links</h2><ul class="l"><li>a</li></ul>', '.l', '') === 'Quick links');
  check('and nothing is invented when the page says nothing',
    word('<ul class="l"><li>a</li></ul>', '.l', '') === '');
}

console.log('\na selector U1 cannot use is renamed, not refused');
{
  // The refusal is right — jQuery drops a descendant space silently and the fix
  // would never run. What was wrong is that refusing was the FIRST thing tried
  // on a name that resolves perfectly well and points at exactly the right
  // element. Two dialogs on a live site were turned down over
  // `#state-select-modal h2`, advising a person to add a class to a heading the
  // tool was looking straight at.
  const page = '<h2>Elsewhere</h2><h2>Also elsewhere</h2>' +
    '<div class="modal" id="state-select-modal"><div class="modal-dialog">' +
    '<div class="modal-header"><h2>Choose a state</h2>' +
    '<button class="close" data-dismiss="modal">x</button></div>' +
    '<ul class="opts"><li><a href="/ca">CA</a></li><li><a href="/fl">FL</a></li></ul>' +
    '</div></div>';
  const d = new JSDOM(`<body>${page}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  d.window.eval(INTEL);
  const S = d.window.__u1SelectorIntel;
  const D = d.window.document;

  const fixedHeading = S.repairForU1('#state-select-modal h2');
  check('a descendant space is renamed to something U1 accepts',
    !!fixedHeading && S.isU1Valid(fixedHeading), fixedHeading);
  check('…and it still points at the SAME heading, not at the two others',
    D.querySelectorAll(fixedHeading).length === 1 &&
    D.querySelector(fixedHeading) === D.querySelector('#state-select-modal h2'), fixedHeading);

  const many = S.repairForU1('#state-select-modal li a');
  check('several elements are renamed together',
    !!many && S.isU1Valid(many) && D.querySelectorAll(many).length === 2, many);

  const pseudo = S.repairForU1('.modal-header>.close:first-of-type');
  check('a pseudo-class is renamed too — jQuery refuses those just as silently',
    !!pseudo && S.isU1Valid(pseudo) &&
    D.querySelector(pseudo) === D.querySelector('.close'), pseudo);

  // The honest limit, and it has to stay. `:first-child` on rows that are
  // identical to each other names an element that has no name of its own — any
  // rename would point at both, which is the silent widening this guard exists
  // to prevent. It falls through to the refusal, where "give the element a
  // class" is finally the right thing to say.
  check('…but a position among identical siblings cannot be renamed, and is not',
    S.repairForU1('.opts>li:first-child') === null, S.repairForU1('.opts>li:first-child'));

  check('a selector that was already fine is left alone',
    S.repairForU1('.modal-header>h2') === null);
  check('a selector naming nothing is not renamed — that is a wrong selector, not a badly spelt one',
    S.repairForU1('#nothing-here h2') === null);
}

console.log('\na form\'s required fields are read off the page, not asked for');
{
  // u1.fix.form will not run without submitButton, inputField and invalidField.
  // Nothing on this side ever looked for them — every other type has a shape
  // function and form had none — so the model was asked, and a model reading a
  // screenshot cannot see a type attribute or a CSS rule. It answered with
  // three empty strings on a search box that has a Go button in the markup, and
  // the save guard refused the component outright.
  const shape = (page, scope, css) => {
    const d = new JSDOM(`<html><head>${css ? `<style>${css}</style>` : ''}</head>` +
      `<body>${page}</body></html>`, { runScripts: 'outside-only' });
    d.window.eval(INTEL);
    return d.window.__u1SelectorIntel.formShape(scope);
  };

  const search = '<form class="site-search"><label for="q">Search</label>' +
    '<input id="q" class="site-search__input" type="search"><button class="site-search__go">Go</button></form>';
  const s1 = shape(search, '.site-search');
  check('a bare <button> in a form is the submit — that is the HTML default',
    !!s1 && s1.submitButton.selector === '.site-search__go', s1 && s1.submitButton.selector);
  check('the field is the input, not the button beside it',
    !!s1 && s1.inputField.selector === '.site-search__input', s1 && s1.inputField.selector);
  check('with nothing marked invalid and no rule for it, the standard attribute is used',
    !!s1 && s1.invalidField.selector === '[aria-invalid="true"]', s1 && s1.invalidField.selector);

  // The page cannot show an error state it has no rule for, so the rule is
  // where the marker is learnt without submitting anything.
  const styled = shape(search, '.site-search', '.site-search__input.is-invalid { border-color: red }');
  check('…but a class the stylesheet styles as invalid is preferred to it',
    !!styled && styled.invalidField.selector === '.is-invalid', styled && styled.invalidField.selector);

  const hidden = '<form class="f"><input type="hidden" name="csrf">' +
    '<input class="real" type="text"><input type="submit" class="go" value="Send"></form>';
  const s2 = shape(hidden, '.f');
  check('a hidden input is not a field a person fills',
    !!s2 && s2.inputField.selector === '.real', s2 && s2.inputField.selector);
  check('input[type=submit] is found as readily as <button>',
    !!s2 && s2.submitButton.selector === '.go', s2 && s2.submitButton.selector);

  // A form built out of divs is the ordinary case on a marketing site.
  const divs = '<div class="dform"><input class="dfield" type="text">' +
    '<div class="dgo" role="button">Send</div></div>';
  const s3 = shape(divs, '.dform');
  check('a form built out of divs still yields a control that submits it',
    !!s3 && s3.submitButton.selector === '.dgo', s3 && s3.submitButton.selector);

  check('a container with no fields and no control returns null rather than guessing',
    shape('<div class="empty"><p>text</p></div>', '.empty') === null);

  // 7.6: the subtype, read off the shape.
  check('one field + one submit is a SEARCH form',
    (() => { const s = shape(search, '.site-search'); return s && s.kind === 'search'; })(),
    JSON.stringify((shape(search, '.site-search') || {}).kind));
  const wizard = '<form class="wiz">' +
    '<div><label for="a">Name</label><input id="a" type="text"><button type="button">Next</button></div>' +
    '<div hidden><label for="b">Phone</label><input id="b" type="tel"><input class="noname" type="text">' +
    '<button type="button">Back</button><button type="submit">Send</button></div></form>';
  const w1 = shape(wizard, '.wiz');
  check('two panels of fields, one showing, next/back — a WIZARD',
    !!w1 && w1.kind === 'wizard', w1 && JSON.stringify(w1.kind));
  check('…and the nameless field inside is reported as a finding',
    !!w1 && !!w1.unlabeledFields && /noname/.test(w1.unlabeledFields.selector),
    w1 && w1.unlabeledFields && w1.unlabeledFields.selector);
}

console.log('\n7.13 — names nobody gave');
{
  const d = new JSDOM(`<html><body>
    <div class="card"><h3 id="t1">Runner Pro</h3><a href="/p/1"><img src="x.png"></a>
      <a href="/p/1">לחץ כאן</a></div>
    <div class="card"><h3>Trail Max</h3><a href="/p/2"><img src="y.png"></a>
      <a href="/p/2">ראה</a></div>
  </body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = d.window;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { width: 200, height: 40, top: 10, bottom: 50, left: 10, right: 210 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; }, configurable: true });
  w.eval(INTEL);
  const cands = w.__u1SelectorIntel.collectCandidates(100, null).candidates;
  check('an icon link with no name of any kind carries the unnamed-icon-link signal',
    cands.some((c) => (c.signals || []).includes('unnamed-icon-link')),
    JSON.stringify(cands.map((c) => c.signals).filter((s) => s && s.length)));
  const cd = w.__u1SelectorIntel.cardDescriptions();
  check('לחץ כאן and ראה are vague enough to group',
    cd.some((r) => !r.kind && r.count === 2),
    JSON.stringify(cd));
  check('two links per card to one href is the duplicate-links finding',
    cd.some((r) => r.kind === 'duplicate-links' && r.count === 2),
    JSON.stringify(cd.filter((r) => r.kind)));
}

console.log('\n7.12 — a trail is grammar, not a font size');
{
  const mk = (body) => {
    const d = new JSDOM(`<html><body>${body}<main><h1>Page</h1></main></body></html>`,
      { runScripts: 'outside-only', pretendToBeVisual: true });
    const w = d.window;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      return { width: 200, height: 20, top: 10, bottom: 30, left: 10, right: 210 };
    };
    Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; }, configurable: true });
    w.eval(INTEL);
    return w;
  };
  // Same-size text, but the grammar is complete: links, separators, a
  // non-link last item, before <main>. The font must not be required.
  const w1 = mk(`<nav id="bc"><a href="/">Home</a> › <a href="/shoes">Shoes</a> › <span>Runner Pro</span></nav>`);
  const c1 = w1.__u1SelectorIntel.collectCandidates(100, null).candidates.find((x) => x.selector === '#bc');
  check('links + separator + non-link last item, before main — a breadcrumb at any size',
    !!c1 && c1.component === 'breadcrumb', c1 && (c1.component || '(none)'));
  // The trail AFTER main is a footer nav, not a breadcrumb.
  const d2 = new JSDOM(`<html><body><main><h1>Page</h1></main>
    <nav id="ft"><a href="/">Home</a> › <a href="/shoes">Shoes</a> › <span>Runner Pro</span></nav></body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const w2 = d2.window;
  w2.HTMLElement.prototype.getBoundingClientRect = function () {
    return { width: 200, height: 20, top: 10, bottom: 30, left: 10, right: 210 };
  };
  Object.defineProperty(w2.HTMLElement.prototype, 'offsetWidth', { get() { return 40; }, configurable: true });
  w2.eval(INTEL);
  const c2 = w2.__u1SelectorIntel.collectCandidates(100, null).candidates.find((x) => x.selector === '#ft');
  check('the same trail AFTER main is not a breadcrumb',
    !!c2 && c2.component !== 'breadcrumb', c2 && (c2.component || '(none)'));
  // schema.org microdata says it outright.
  const w3 = mk(`<nav id="sd" itemtype="https://schema.org/BreadcrumbList"><a href="/">Home</a></nav>`);
  const c3 = w3.__u1SelectorIntel.collectCandidates(100, null).candidates.find((x) => x.selector === '#sd');
  check('microdata BreadcrumbList is sure', !!c3 && c3.component === 'breadcrumb' && !c3.maybe,
    c3 && (c3.component || '(none)'));
}

console.log('\n7.11 — the headings nobody hears');
{
  const d = new JSDOM(`<html><body style="font-size:16px">
    <h1>Store</h1>
    <h2>Deals</h2>
    <div class="card"><div class="card-head" style="font-size:22px;font-weight:700">Runner Pro</div><p>A shoe.</p></div>
    <div class="card"><div class="card-head" style="font-size:22px;font-weight:700">Trail Max</div><p>Another.</p></div>
    <header><h1><img alt=""></h1></header>
  </body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = d.window;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { width: 200, height: 40, top: 10, bottom: 50, left: 10, right: 210 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; }, configurable: true });
  const realGCS = w.getComputedStyle.bind(w);
  w.getComputedStyle = (el) => {
    const inline = (el.getAttribute && el.getAttribute('style')) || '';
    const fs = /font-size:\s*(\d+)px/.exec(inline);
    const fw = /font-weight:\s*(\d+)/.exec(inline);
    return { fontSize: fs ? fs[1] + 'px' : '16px', fontWeight: fw ? fw[1] : '400',
             display: 'block', visibility: 'visible', opacity: '1', position: 'static' };
  };
  w.eval(INTEL);
  const list = w.__u1SelectorIntel.headingOutline();
  const visuals = list.filter((h) => h.visual);
  check('a big bold div followed by content is a VISUAL heading with a should',
    visuals.length === 2 && visuals.every((h) => h.should >= 2 && h.should <= 6),
    JSON.stringify(visuals.map((h) => ({ t: h.text, s: h.should }))));
  check('…and repeated card heads share ONE suggested level',
    visuals.length === 2 && visuals[0].should === visuals[1].should);
  check('an h1 holding only a logo image is its own finding',
    list.some((h) => h.problem === 'holds only a logo image'),
    JSON.stringify(list.map((h) => h.problem).filter(Boolean)));
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

  // Owner rule (2026-09-01): "an input with a submit button and an error IS a
  // form." The commonest form on the web is a bare div holding one typeable
  // field and a send — a site search, a newsletter signup — and the two-field
  // floor left it uncollected unless the site happened to use a real <form>.
  const d = collectIn(`<div id="sitesearch" class="searchbox">
      <input id="kw" type="text" placeholder="Enter a keyword"><button type="submit">Go</button>
      <span class="error" style="display:none">Enter a keyword</span></div>`);
  check('a DIV with one typeable field and a send is a form too', d.name('#sitesearch') === 'form', d.name('#sitesearch'));

  // But not everything beside an input is a send, and not every field types.
  const e2 = collectIn(`<div id="filters">
      <select><option>Any brand</option></select><button>Clear</button></div>`);
  check('a lone select with a Clear button still is not', e2.name('#filters') !== 'form', e2.name('#filters'));

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
  // Still a component of its own — the point of this check — and named
  // `tabs` since 4.3 ended the tabs-as-menu collapse.
  check('…and the strip beside it is still its own component',
    finder.name('.finder__tabs') === 'tabs', finder.name('.finder__tabs'));

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

  // No submit, no form — decided. A filter bar that applies on change is a real
  // thing and it is not a form; it has no send. What it actually needs is a
  // status message saying how many results are showing, which is the pattern
  // `component-rules.md` describes and which has no type of its own yet.
  const bar = collectIn(`<div class="filters"><select id="a"></select><select id="b"></select><select id="c"></select></div>`);
  check('a filter bar with no submit is NOT a form',
    bar.name('.filters') !== 'form', bar.name('.filters'));

  // Two fields are not a form on their own — without a floor every pair of
  // inputs on a page becomes a component to map.
  const two = collectIn(`<div class="pair"><input><input></div>`);
  check('two fields with nothing to send them are not a form', two.name('.pair') !== 'form', two.name('.pair'));

  // …but two fields AND a way to send them are. A login box is an email, a
  // password and a button, and it sat under the old three-field floor.
  const login = collectIn(`<div class="login" tabindex="-1"><input type="email"><input type="password"><button>Sign in</button></div>`);
  check('two fields and a submit ARE a form — a login box is the case',
    login.name('.login') === 'form', login.name('.login'));

  // Div-soup forms are the point of having a rule at all. The wrapper has to be
  // a candidate for any of this to reach it — a bare <div> with no tag, role,
  // class or handler is not collected, which is pre-existing and untouched.
  const e = collectIn(`<div id="soup" tabindex="-1"><input type="text"><input type="email"><select><option>A</option></select><button>Send</button></div>`);
  check('a form built out of divs is found by its fields and its submit',
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

  // ── Where a menu SITS is part of what makes it one ────────────────────────
  //
  // Detection had no notion of location at all: it asked what an element was
  // CALLED and never where it sat, so five columns of links in the footer came
  // back as a menu exactly like the nav bar at the top. They are ordinary
  // links — already links, already in the tab order — and a menu mapping on
  // them adds arrow-key navigation nobody is looking for and a role claiming
  // this is the site's navigation.
  check('a nav in the HEADER is a menu',
    named('<header><nav id="x" class="main-nav"><a href="/a">A</a><a href="/b">B</a></nav></header>', '#x') === 'menu',
    named('<header><nav id="x" class="main-nav"><a href="/a">A</a><a href="/b">B</a></nav></header>', '#x'));
  check('…the same nav in the FOOTER is not',
    named('<footer><nav id="x" class="foot-nav"><a href="/a">A</a><a href="/b">B</a></nav></footer>', '#x') !== 'menu',
    named('<footer><nav id="x" class="foot-nav"><a href="/a">A</a><a href="/b">B</a></nav></footer>', '#x'));
  check('…nor are footer link columns, whatever the class says',
    named('<div class="site-footer"><div id="x" class="menu"><a href="/a">A</a><a href="/b">B</a></div></div>', '#x') !== 'menu',
    named('<div class="site-footer"><div id="x" class="menu"><a href="/a">A</a><a href="/b">B</a></div></div>', '#x'));
  // The exceptions agreed alongside the rule: both are menus wherever they sit.
  check('a vertical side menu is still a menu',
    named('<aside class="sidebar"><nav id="x" class="side-menu"><a href="/a">A</a></nav></aside>', '#x') === 'menu',
    named('<aside class="sidebar"><nav id="x" class="side-menu"><a href="/a">A</a></nav></aside>', '#x'));
  check('a hamburger panel is still a menu, outside the header though it is',
    named('<div id="x" class="mobile-menu"><a href="/a">A</a><a href="/b">B</a></div>', '#x') === 'menu',
    named('<div id="x" class="mobile-menu"><a href="/a">A</a><a href="/b">B</a></div>', '#x'));
  // Only MENUS are placed. A carousel in the footer is still a carousel — the
  // rule is about what a row of links means, not about the footer being inert.
  check('a carousel in the footer is untouched by the rule',
    named('<footer><div id="x" class="carousel"><div class="slide">s</div></div></footer>', '#x') === 'carousel',
    named('<footer><div id="x" class="carousel"><div class="slide">s</div></div></footer>', '#x'));

  // ── A table used for LAYOUT is not a table ────────────────────────────────
  //
  // On an old site this is most of them: <table> as a positioning tool, a logo
  // in one cell, the nav in another. Mapping one as a data table tells a screen
  // reader there is a grid of records here and invites its user to read across
  // rows that mean nothing. The rules have said so all along — and said it only
  // to the model, while the code named every <table> a table and named it SURE.
  // A page with forty layout tables produced forty rows to dismiss one by one.
  const tbl = (inner) => named(`<table id="x">${inner}</table>`, '#x');

  check('a data table with headers is a table',
    tbl(`<thead><tr><th>Product</th><th>Price</th></tr></thead>
         <tbody><tr><td>Runner</td><td>320</td></tr><tr><td>Trainer</td><td>410</td></tr></tbody>`) === 'table');
  // Missing headers is the DEFECT, not a reason to skip it.
  check('rows and columns with no headers are still a table',
    tbl(`<tr><td>Runner</td><td>320</td></tr><tr><td>Trainer</td><td>410</td></tr>
         <tr><td>Walker</td><td>280</td></tr>`) === 'table',
    tbl(`<tr><td>Runner</td><td>320</td></tr><tr><td>Trainer</td><td>410</td></tr><tr><td>Walker</td><td>280</td></tr>`));

  check('one row of a logo, a nav and a form is layout, not a table',
    tbl(`<tr><td><img alt="logo"></td><td><nav><a href="/a">Shop</a></nav></td>
         <td><form><input><button>Go</button></form></td></tr>`) !== 'table');
  check('a table holding another table is layout',
    tbl(`<tr><td><table><tr><td><a href="/x">One</a></td></tr></table></td></tr><tr><td>x</td></tr>`) !== 'table');
  check('a single column is layout — nothing to read across',
    tbl(`<tr><td>A</td></tr><tr><td>B</td></tr><tr><td>C</td></tr>`) !== 'table');
  check('rows that disagree how many cells they have are layout',
    tbl(`<tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td></tr><tr><td>e</td></tr><tr><td>f</td></tr>`) !== 'table');
  // …but ONE ragged row is ordinary. A totals row spanning the width is not a
  // reason to throw a real table away.
  check('a single colspan totals row does not make it layout',
    tbl(`<tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr>
         <tr><td colspan="2">total</td></tr>`) === 'table');

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

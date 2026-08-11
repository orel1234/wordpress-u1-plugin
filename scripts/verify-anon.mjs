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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

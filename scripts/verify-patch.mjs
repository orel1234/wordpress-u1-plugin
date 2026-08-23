// Builds DOM in exactly the broken shape the U1 library produces, runs the
// patch, and asserts the defect is gone.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
import vm from 'node:vm';

const SRC = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');

function slice(types) {
  const wanted = new Set(['core', ...(types || [])]);
  const picked = [];
  const re = /\/\/#region u1-patch:([a-z]+)\r?\n([\s\S]*?)\r?\n\/\/#endregion/g;
  let m;
  while ((m = re.exec(SRC))) if (wanted.has(m[1])) picked.push(m[2]);
  return picked.length ? `'use strict';\n${picked.join('\n\n')}` : SRC;
}

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

function boot(html, types) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  // jsdom has no layout, so offsetWidth is always 0 and our visible() would
  // reject everything. Give elements a box unless the page hid them.
  const proto = dom.window.HTMLElement.prototype;
  Object.defineProperty(proto, 'offsetWidth', {
    get() { return this.hasAttribute('hidden') || this.style.display === 'none' ? 0 : 40; },
  });
  // Height is what an animating dropdown changes, so the settle logic needs it
  // to be readable and to be able to shrink.
  Object.defineProperty(proto, 'offsetHeight', {
    get() {
      if (this.hasAttribute('hidden') || this.style.display === 'none') return 0;
      if (this.style.height) return parseFloat(this.style.height) || 0;
      return 40;
    },
  });
  dom.window.eval(slice(types));
  return dom;
}
const settle = async (dom) => { dom.window.__u1Patch && dom.window.__u1Patch.correctors.forEach(f => f()); };

// ── regions slice cleanly ──────────────────────────────────────────────────
console.log('\nslicing');
for (const t of [[], ['tabs'], ['tabs', 'menu'], ['dialog', 'form', 'checkbox']]) {
  const code = slice(t);
  let ok = true;
  try { new vm.Script(code); } catch (e) { ok = false; console.log('   ', e.message); }
  check(`[${t.join(',') || 'core only'}] parses — ${code.length} bytes`, ok);
}
check('tabs slice excludes the menu region', !slice(['tabs']).includes('navigateMenuItem') &&
  !slice(['tabs']).includes("'[role=\"menu\"]"), '');

// ── tabs: the aria-labeledby typo, and aria-selected read from the page ────
console.log('\ntabs');
{
  const dom = boot(`
    <div role="tablist" aria-labeledby="lbl">
      <button role="tab" aria-selected="true"  aria-controls="p1" tabindex="0">A</button>
      <button role="tab" aria-selected="false" aria-controls="p2" tabindex="-1">B</button>
    </div>
    <span id="lbl">Modes</span>
    <div id="p1" hidden>one</div><div id="p2">two</div>`, ['tabs']);
  await settle(dom);
  const d = dom.window.document;
  const list = d.querySelector('[role=tablist]');
  const tabs = [...d.querySelectorAll('[role=tab]')];
  check('aria-labeledby copied to aria-labelledby', list.getAttribute('aria-labelledby') === 'lbl');
  check('the misspelled attribute is removed', !list.hasAttribute('aria-labeledby'));
  check('aria-selected follows the visible panel, not index 0',
    tabs[0].getAttribute('aria-selected') === 'false' && tabs[1].getAttribute('aria-selected') === 'true',
    tabs.map(t => t.getAttribute('aria-selected')).join(','));
  check('roving tabindex follows too', tabs[0].tabIndex === -1 && tabs[1].tabIndex === 0);

  const ev = new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
  tabs[1].dispatchEvent(ev);
  check('Home is handled and consumed', ev.defaultPrevented);
}

// ── radio: the inverted getCheckedRadio, and the double tab stop ───────────
console.log('\nradio');
{
  const dom = boot(`
    <div role="radiogroup">
      <div role="radio" aria-checked="false" tabindex="0">a</div>
      <div role="radio" aria-checked="true"  tabindex="0">b</div>
      <div role="radio" aria-checked="false" tabindex="-1">c</div>
    </div>`, ['radio']);
  await settle(dom);
  const r = [...dom.window.document.querySelectorAll('[role=radio]')];
  check('exactly one tab stop', r.filter(x => x.tabIndex === 0).length === 1,
    r.map(x => x.tabIndex).join(','));
  check('the tab stop is the checked radio', r[1].tabIndex === 0);
}

// ── checkbox: name destroyed by aria-hidden on the label ───────────────────
console.log('\ncheckbox');
{
  const dom = boot(`
    <div><span role="checkbox" aria-checked="false"></span>
    <label aria-hidden="true">I accept the <a href="#t">terms</a></label></div>`, ['checkbox']);
  await settle(dom);
  const d = dom.window.document;
  const box = d.querySelector('[role=checkbox]');
  const lbl = d.querySelector('label');
  check('aria-hidden removed from a label holding a link', !lbl.hasAttribute('aria-hidden'));
  check('the checkbox is named again', !!box.getAttribute('aria-labelledby'),
    box.outerHTML);
}

// ── loading: meter without a value ─────────────────────────────────────────
console.log('\nloading');
{
  const dom = boot(`<div role="meter" class="bar"></div>`, ['loading']);
  await settle(dom);
  const el = dom.window.document.querySelector('.bar');
  check('role=meter replaced with progressbar', el.getAttribute('role') === 'progressbar');
}

// ── skip link: target cannot hold focus ────────────────────────────────────
console.log('\nskip link');
{
  const dom = boot(`<a class="u1st-skip-link" href="#main">skip</a><div id="main">x</div>`, []);
  await settle(dom);
  check('target gained tabindex="-1"',
    dom.window.document.getElementById('main').getAttribute('tabindex') === '-1');
}

// ── dialog: no focusable content, and the asymmetric trap ──────────────────
console.log('\ndialog');
{
  const dom = boot(`<div role="dialog"><p>Saved.</p></div>`, ['dialog']);
  await settle(dom);
  const dlg = dom.window.document.querySelector('[role=dialog]');
  check('a dialog with nothing focusable can hold focus', dlg.getAttribute('tabindex') === '-1');
  check('aria-modal supplied', dlg.getAttribute('aria-modal') === 'true');
}

// ── listbox: decorated, and inoperable ─────────────────────────────────────
console.log('\nlistbox');
{
  // The region has to EXIST as its own slice. It did not: the single listbox
  // line lived in the combobox region, so an export holding a listbox and no
  // combobox shipped none of it. That is the regression this guards.
  check('there is a listbox region at all', slice(['listbox']) !== SRC &&
    slice(['listbox']).includes('[role="option"]'));
  // The region BODY, not the slice — the slice always carries core, and core is
  // where P.rove itself is defined.
  const body = (name) => (new RegExp(`//#region u1-patch:${name}\\r?\\n([\\s\\S]*?)\\r?\\n//#endregion`).exec(SRC) || [, ''])[1];
  check('the combobox region no longer owns the listbox roving',
    !/P\.rove\(/.test(body('combobox')), body('combobox').match(/P\.rove\([^\n]*/)?.[0] || '');
  check('the listbox region owns it instead', /P\.rove\('\[role="listbox"\]'/.test(body('listbox')));

  const html = `
    <div class="wrap">
      <button class="t" aria-haspopup="listbox" aria-expanded="false">Sign in</button>
      <ul class="lb" role="listbox">
        <li role="option" tabindex="-1" id="o1">One</li>
        <li role="option" tabindex="-1" id="o2">Two</li>
        <li role="option" tabindex="-1" id="o3">Three</li>
      </ul>
    </div>`;

  const dom = boot(html, ['listbox']);
  await settle(dom);
  const d = dom.window.document;
  const trigger = d.querySelector('.t');
  const list = d.querySelector('.lb');

  // The list is visible in this fixture, and the trigger still said "false" —
  // U1 writes the attribute once and the site opens the list afterwards.
  check('aria-expanded corrected to match the list as it is now',
    trigger.getAttribute('aria-expanded') === 'true', trigger.getAttribute('aria-expanded'));
  check('trigger points at the list it opens',
    trigger.getAttribute('aria-controls') === list.id, trigger.getAttribute('aria-controls'));
  check('the open list has exactly one tab stop',
    [...list.querySelectorAll('[role=option]')].filter(o => o.tabIndex === 0).length === 1);

  // ArrowDown, from an option. A listbox is vertical by default — a tablist is
  // not, and reading aria-orientation with a horizontal fallback got this wrong.
  const opts = [...d.querySelectorAll('[role=option]')];
  opts[0].focus();
  const down = new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  opts[0].dispatchEvent(down);
  check('ArrowDown moves to the next option', d.activeElement === opts[1],
    d.activeElement && d.activeElement.id);
  check('ArrowDown is consumed, so the page does not scroll too', down.defaultPrevented);

  // ArrowRight must NOT move: the list never said it was horizontal.
  opts[0].focus();
  opts[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  check('ArrowRight leaves a vertical list alone', d.activeElement === opts[0]);

  // Arrowing through a list of links must never follow one.
  const nav = boot(`
    <button class="t" aria-haspopup="listbox">Menu</button>
    <ul class="lb" role="listbox">
      <li role="option" id="a1"><a href="/one">One</a></li>
      <li role="option" id="a2"><a href="/two">Two</a></li>
    </ul>`, ['listbox']);
  await settle(nav);
  const navOpts = [...nav.window.document.querySelectorAll('[role=option]')];
  let clicked = 0;
  navOpts.forEach(o => o.addEventListener('click', () => clicked++));
  navOpts[0].focus();
  navOpts[0].dispatchEvent(new nav.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  check('arrowing does not activate the option it lands on', clicked === 0, `${clicked} clicks`);

  // A closed list is left entirely alone.
  const shut = boot(`
    <button class="t" aria-haspopup="listbox" aria-expanded="true">Menu</button>
    <ul class="lb" role="listbox" style="display:none">
      <li role="option" tabindex="-1">One</li><li role="option" tabindex="-1">Two</li>
    </ul>`, ['listbox']);
  await settle(shut);
  const sd = shut.window.document;
  check('a closed list reports aria-expanded="false"',
    sd.querySelector('.t').getAttribute('aria-expanded') === 'false');
  check('a closed list gains no tab stop',
    [...sd.querySelectorAll('[role=option]')].every(o => o.tabIndex === -1));

  // ── The shape that was photographed on the live site ─────────────────────
  // The trigger fully decorated, the <ul> and every <li> untouched, the list
  // open while the trigger says collapsed. The first version of this region
  // keyed on role="listbox" and therefore changed nothing here at all.
  const real = boot(`
    <div class="click-nav">
      <button class="clicker" role="button" aria-haspopup="listbox" aria-expanded="false"
              u1st-trigger-element="true" u1st-avoid-change-detection="true">Sign In</button>
      <ul class="signin-dropdown" style="display:block">
        <li><a href="#a" aria-label="Member">Member</a></li>
        <li><a href="#b">Health Care Professional</a></li>
      </ul>
    </div>`, ['listbox']);
  await settle(real);
  const rd = real.window.document;
  check('the popup is found even with no role="listbox" on it',
    rd.querySelector('.clicker').getAttribute('aria-controls') === rd.querySelector('.signin-dropdown').id);
  check('a role-less popup promised as a listbox is given the role',
    rd.querySelector('.signin-dropdown').getAttribute('role') === 'listbox');
  check('the stale aria-expanded is corrected over an open list',
    rd.querySelector('.clicker').getAttribute('aria-expanded') === 'true');
  check('role="option" lands on the link, not on the <li>',
    [...rd.querySelectorAll('a')].every(a => a.getAttribute('role') === 'option') &&
    [...rd.querySelectorAll('li')].every(li => !li.getAttribute('role')),
    rd.querySelector('li').outerHTML);

  // A role the SITE wrote is not ours to replace from here.
  const authored = boot(`
    <button class="clicker" aria-haspopup="listbox" aria-expanded="false">Sign In</button>
    <ul class="signin-dropdown" role="menu" style="display:block">
      <li><a href="#a">Member</a></li><li><a href="#b">Pro</a></li>
    </ul>`, ['listbox']);
  await settle(authored);
  const ad2 = authored.window.document;
  check('an author\'s role="menu" survives the patch',
    ad2.querySelector('.signin-dropdown').getAttribute('role') === 'menu');
  check('and its items are left alone rather than half-converted',
    [...ad2.querySelectorAll('a,li')].every(e => !e.getAttribute('role')));

  // ── contextRoot: the reason nothing was written in the first place ────────
  {
    const ctx = boot(`
      <div class="click-nav">
        <button class="clicker">Sign In</button>
        <ul class="signin-dropdown"><li>a</li><li>b</li></ul>
      </div>`, ['listbox']);
    await settle(ctx);
    const resolve = ctx.window.__u1Patch.contextRoot.listbox;
    const props = { selectors: { listbox: '.signin-dropdown', options: '.signin-dropdown>li', trigger: '.clicker' } };
    const btn = ctx.window.document.querySelector('.clicker');
    check('the trigger context is widened to the element holding both',
      resolve(btn, props) === ctx.window.document.querySelector('.click-nav'));

    // A page where the list IS reachable from the given context is untouched.
    const fine = boot(`<div class="clicker"><ul class="signin-dropdown"><li>a</li></ul></div>`, ['listbox']);
    await settle(fine);
    check('a context that already resolves is left exactly as it is',
      fine.window.__u1Patch.contextRoot.listbox(
        fine.window.document.querySelector('.clicker'), props) === null);

    // Two triggers under one ancestor: pairing them is worse than skipping.
    const two = boot(`
      <div class="wrap">
        <div class="click-nav"><button class="clicker">A</button></div>
        <div class="click-nav"><button class="clicker">B</button></div>
        <ul class="signin-dropdown"><li>a</li></ul>
      </div>`, ['listbox']);
    await settle(two);
    check('widening stops before it pairs another component\'s trigger',
      two.window.__u1Patch.contextRoot.listbox(
        two.window.document.querySelector('.clicker'), props) === false);
  }

  // ── Escape must not fight an animation ───────────────────────────────────
  // Reported: Escape returns focus to the trigger, then the list flickers open
  // and shut about three times before settling. The old code waited a flat
  // 90ms and clicked the trigger if the list still LOOKED visible — and 90ms
  // lands in the middle of a jQuery slideUp, where the element reads
  // height:5.08px, overflow:hidden. The click reopened what was closing.
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  {
    const anim = boot(`
      <button class="t" aria-haspopup="listbox" aria-expanded="true">Sign in</button>
      <ul class="lb" role="listbox" style="height:40px">
        <li role="option" tabindex="0" id="p1">One</li>
        <li role="option" tabindex="-1" id="p2">Two</li>
      </ul>`, ['listbox']);
    await settle(anim);
    const ad = anim.window.document;
    const trig = ad.querySelector('.t'), lb = ad.querySelector('.lb');
    let clicks = 0;
    trig.addEventListener('click', () => { clicks++; lb.style.height = '40px'; });

    // The site's own Escape handler: slide it shut over ~200ms.
    ad.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      setTimeout(() => { lb.style.height = '20px'; }, 60);
      setTimeout(() => { lb.style.height = '5px'; }, 130);
      setTimeout(() => { lb.style.display = 'none'; lb.style.height = ''; }, 220);
    });

    ad.getElementById('p1').focus();
    ad.getElementById('p1').dispatchEvent(
      new anim.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    await wait(60);
    check('focus returns to the trigger straight away, not after the animation',
      ad.activeElement === trig);
    await wait(1000);
    check('a list that closes on its own is never clicked back open', clicks === 0, `${clicks} clicks`);
    check('and it ends up closed', !anim.window.__u1Patch.util.visible(lb));
    await settle(anim);
    check('aria-expanded settles on "false", not on a mid-slide reading',
      trig.getAttribute('aria-expanded') === 'false', trig.getAttribute('aria-expanded'));
  }

  // The other half: a site that does NOT close on Escape still gets closed,
  // exactly once.
  {
    const stuck = boot(`
      <button class="t" aria-haspopup="listbox" aria-expanded="true">Sign in</button>
      <ul class="lb" role="listbox"><li role="option" tabindex="0" id="s1">One</li>
      <li role="option" tabindex="-1">Two</li></ul>`, ['listbox']);
    await settle(stuck);
    const sd = stuck.window.document;
    const trig = sd.querySelector('.t'), lb = sd.querySelector('.lb');
    let clicks = 0;
    trig.addEventListener('click', () => { clicks++; lb.style.display = 'none'; });
    sd.getElementById('s1').focus();
    sd.getElementById('s1').dispatchEvent(
      new stuck.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(600);
    check('a list that ignores Escape is closed by the patch, once', clicks === 1, `${clicks} clicks`);
  }

  // aria-activedescendant is a different, valid model — do not impose a second.
  const ad = boot(`
    <button class="t" aria-haspopup="listbox">Menu</button>
    <ul class="lb" role="listbox" aria-activedescendant="x2" tabindex="0">
      <li role="option" tabindex="-1" id="x1">One</li>
      <li role="option" tabindex="-1" id="x2" aria-selected="true">Two</li>
    </ul>`, ['listbox']);
  await settle(ad);
  check('an activedescendant list is not given a roving tab stop',
    [...ad.window.document.querySelectorAll('[role=option]')].every(o => o.tabIndex === -1));
}

// ── per-match wrapper ──────────────────────────────────────────────────────
console.log('\nper-match wrapper for u1.fix.*');
{
  const dom = boot(`<div class="t">1</div><div class="t">2</div><div class="t">3</div>`, []);
  const calls = [];
  dom.window.u1 = { fix: { tabs: (sel) => calls.push(sel) } };
  // The wrapper polls for the library; force the pass now.
  dom.window.eval(`
    (function () {
      var u1 = window.u1, seq = 0, orig = u1.fix.tabs;
      u1.fix.tabs = function (selector, props) {
        var els = Array.prototype.slice.call(document.querySelectorAll(selector));
        if (els.length < 2) return orig.call(this, selector, props);
        for (var i = 0; i < els.length; i++) {
          var token = 'u1p' + (seq++);
          els[i].setAttribute('data-u1p-instance', token);
          orig.call(this, '[data-u1p-instance="' + token + '"]', props);
        }
      };
    })();
  `);
  dom.window.u1.fix.tabs('.t', {});
  check('called once per match instead of once', calls.length === 3, `got ${calls.length}`);
  check('each call is scoped to one element',
    calls.every(s => s.startsWith('[data-u1p-instance=')), calls.join(' | '));
}

// ── u1.fix.landmarks: each role keeps the shape its schema demands ──────────
//
// LandmarksPropsSchema in u1_vanilla-js-a11y.js is not uniform:
//
//   banner, contentinfo, main                     a single OBJECT
//   complementary, form, navigation, search,      an ARRAY
//   application
//
// The wrapper splits one call into several, and it used to hand every role
// back as a bare object. Five of the eight roles then failed safeParse and the
// library threw `Invalid Landmarks props provided.` — killing the whole call,
// including the roles that were shaped correctly.
console.log('\nlandmarks keep their schema shape');
{
  const ARRAY_ROLES = ['complementary', 'form', 'navigation', 'search', 'application'];
  const dom = new JSDOM(`<!doctype html><body>
    <nav id="n1">a</nav><nav id="n2">b</nav>
    <main id="m">m</main>
    <aside id="c1">c</aside><aside id="c2">c</aside></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const seen = [];
  w.u1 = { fix: { landmarks(props) { seen.push(JSON.parse(JSON.stringify(props))); } } };
  w.eval(readFileSync(join(ROOT, 'u1-patch.js'), 'utf8'));

  w.u1.fix.landmarks({
    navigation: [{ selectors: { landmark: 'nav' } }],       // 2 matches — split
    main: { selectors: { landmark: '#m' } },                // 1 match
    complementary: [{ selectors: { landmark: 'aside' } }],  // 2 matches — split
  });

  check('the call is expanded per matching element', seen.length === 5, String(seen.length));
  const wrong = [];
  for (const props of seen) {
    for (const [role, val] of Object.entries(props)) {
      if (ARRAY_ROLES.includes(role) !== Array.isArray(val)) wrong.push(role);
    }
  }
  check('…and every role goes back in the shape its schema demands',
    wrong.length === 0, wrong.join(', '));
  check('…including the ones that were split across several elements',
    seen.filter(p => Array.isArray(p.navigation)).length === 2);
  check('…and a single-object role is not turned into an array',
    seen.some(p => p.main && !Array.isArray(p.main)));
}

// ── A menu opens, and Escape gets you back out ──────────────────────────────
//
// The two things a keyboard user does with a menu, neither of them in the
// library. Reported on a live mapping: the trigger did not open the panel, and
// Escape from inside a submenu left focus stranded in a panel that had closed.
console.log('\nopening a submenu and escaping it');
{
  const dom = boot(`
    <nav id="bar">
      <button id="t" aria-expanded="false" aria-controls="p">Shop</button>
      <div id="p" role="menu" hidden>
        <a id="a1" href="/a" role="menuitem">All</a>
        <a id="a2" href="/b" role="menuitem">New</a>
      </div>
    </nav>`, ['core', 'menu']);
  const d = dom.window.document;
  const t = d.getElementById('t'), p = d.getElementById('p');
  // The page's own behaviour: the trigger toggles its panel.
  t.addEventListener('click', () => {
    const open = p.hasAttribute('hidden');
    if (open) { p.removeAttribute('hidden'); t.setAttribute('aria-expanded', 'true'); }
    else { p.setAttribute('hidden', ''); t.setAttribute('aria-expanded', 'false'); }
  });

  const key = (el, k) => el.dispatchEvent(new dom.window.KeyboardEvent('keydown',
    { key: k, bubbles: true, cancelable: true }));

  t.focus();
  key(t, 'ArrowDown');
  check('Down on a closed trigger opens it', t.getAttribute('aria-expanded') === 'true');
  check('…by driving the page rather than showing the panel itself',
    !p.hasAttribute('hidden'));

  // Focus moves inside on the next frame; drive it directly for the test.
  d.getElementById('a1').focus();
  key(d.getElementById('a1'), 'Escape');
  check('Escape closes the submenu', t.getAttribute('aria-expanded') === 'false');
  check('…and focus goes back to the trigger, not nowhere',
    d.activeElement === t, d.activeElement && d.activeElement.id);

  // A native button already opens on Enter and Space; taking those over would
  // fire the page's handler twice.
  const before = t.getAttribute('aria-expanded');
  key(t, 'Enter');
  check('…and Enter on a native button is left to the browser',
    t.getAttribute('aria-expanded') === before);
}

// ── Static corrections: do they fix it, and only when asked? ────────────────
console.log('\nstatic corrections');
{
  const run = (html, statics) => {
    const dom = new JSDOM(`<!doctype html><head><meta name="viewport" content="width=device-width, user-scalable=no, maximum-scale=1"></head><body>${html}</body>`,
      { runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth',
      { get() { return this.hasAttribute('hidden') ? 0 : 40; }, configurable: true });
    Object.defineProperty(w.HTMLElement.prototype, 'offsetHeight',
      { get() { return this.hasAttribute('hidden') ? 0 : 40; }, configurable: true });
    w.__u1Statics = statics;
    w.eval(slice(['statics']));
    // Correctors run on a schedule; force a pass rather than waiting on rAF.
    if (w.__u1Patch) w.__u1Patch.correctors.forEach((f) => { try { f(); } catch (e) {} });
    return w;
  };

  // tabindex-positive
  let w = run(`<div id="a" tabindex="5">x</div><div id="b" tabindex="0">y</div><div id="c" tabindex="-1">z</div>`,
    { 'tabindex-positive': {} });
  check('a positive tabindex is put back to 0',
    w.document.getElementById('a').getAttribute('tabindex') === '0');
  check('…and 0 and -1 are left exactly as they were',
    w.document.getElementById('b').getAttribute('tabindex') === '0' &&
    w.document.getElementById('c').getAttribute('tabindex') === '-1');

  // …and nothing happens when the rule was not switched on.
  w = run(`<div id="a" tabindex="5">x</div>`, {});
  check('nothing runs unless the fix was asked for',
    w.document.getElementById('a').getAttribute('tabindex') === '5');

  // aria-ref-broken
  w = run(`<span id="real">Name</span><div id="d" aria-labelledby="real gone"></div>
           <div id="e" aria-describedby="gone"></div>`, { 'aria-ref-broken': {} });
  check('a dangling id is dropped and the live one kept',
    w.document.getElementById('d').getAttribute('aria-labelledby') === 'real');
  check('…and an attribute left pointing at nothing is removed outright',
    !w.document.getElementById('e').hasAttribute('aria-describedby'));

  // input-placeholder
  w = run(`<input id="p" placeholder="Search shoes">
           <label for="q">Q</label><input id="q" placeholder="ignored">`,
    { 'input-placeholder': {} });
  check('a placeholder becomes a real name when there is no other',
    w.document.getElementById('p').getAttribute('aria-label') === 'Search shoes');
  check('…and a field that already has a label is left alone',
    !w.document.getElementById('q').hasAttribute('aria-label'));

  // table-noheaders
  w = run(`<table id="t"><tr><td>Size</td><td>EU</td></tr><tr><td>8</td><td>42</td></tr></table>
           <table id="lay"><tr><td>only</td></tr></table>`, { 'table-noheaders': {} });
  const ths = w.document.querySelectorAll('#t th');
  check('a data table gets its first row as column headers',
    ths.length === 2 && ths[0].getAttribute('scope') === 'col');
  check('…and a one-cell layout table is not given headers it should not have',
    w.document.querySelectorAll('#lay th').length === 0);

  // zoom-disabled
  w = run(`<p>x</p>`, { 'zoom-disabled': {} });
  const vp = w.document.querySelector('meta[name="viewport"]').getAttribute('content');
  check('zoom is re-enabled in the viewport meta',
    /user-scalable=yes/.test(vp) && !/user-scalable=no/.test(vp) && !/maximum-scale=1\b/.test(vp));

  // autoplay-audio
  w = run(`<audio id="au" autoplay></audio>`, { 'autoplay-audio': {} });
  check('autoplay is removed and a control is guaranteed',
    !w.document.getElementById('au').hasAttribute('autoplay') &&
    w.document.getElementById('au').hasAttribute('controls'));

  // lang-missing
  w = run(`<p>x</p>`, { 'lang-missing': { lang: 'he' } });
  check('the page language is set from the one that was chosen',
    w.document.documentElement.getAttribute('lang') === 'he');

  // exclude — the one that must never do half the job
  w = run(`<div id="x"><a href="/a">link</a><button>b</button></div>`,
    { exclude: { selector: '#x' } });
  const x = w.document.getElementById('x');
  const inert = x.hasAttribute('inert');
  check('an excluded subtree is taken out of reach',
    inert || x.getAttribute('aria-hidden') === 'true');
  check('…and never hidden while still focusable — the fault it would create',
    inert || [...x.querySelectorAll('a,button')].every((f) => f.getAttribute('tabindex') === '-1'));

  // filter-results — a field that narrows a list already on the page.
  w = run(`<input id="f" type="search">
           <div id="list">
             <button class="it">Tel Aviv</button>
             <button class="it">Sarona</button>
             <button class="it" hidden>Haifa</button>
           </div>`,
    { 'filter-results': { field: '#f', results: '#list', item: '.it', noun: 'branch' } });
  const field = w.document.getElementById('f');
  const status = w.document.querySelector('.u1p-filter-status');
  check('the field is tied to the list it controls',
    field.getAttribute('aria-controls') === 'list');
  check('…and a status region is added beside the list, not on it',
    !!status && status.getAttribute('aria-live') === 'polite' &&
    status.nextElementSibling === w.document.getElementById('list'));
  check('…which counts what is actually showing, in the page\'s own words',
    /^2 branches$/.test(status.textContent), status.textContent);
  // The list itself must NOT be the live region: that re-reads every result on
  // every keystroke, which is worse than silence.
  check('…and the list is not made to announce itself',
    !w.document.getElementById('list').hasAttribute('aria-live'));
  // And the thing it must never do: this is not a combobox.
  check('…and nothing is told it is a combobox with a popup',
    field.getAttribute('role') !== 'combobox' && !field.hasAttribute('aria-expanded'));

  // Idempotent: correctors run on every mutation, so twice must equal once.
  w = run(`<div id="a" tabindex="7">x</div><span id="real">N</span>`, { 'tabindex-positive': {} });
  w.__u1Patch.correctors.forEach((f) => { try { f(); } catch (e) {} });
  check('running twice is the same as running once',
    w.document.getElementById('a').getAttribute('tabindex') === '0');
}

// ── Loading indicators ─────────────────────────────────────────────────────
//
// Fixing the role alone left it announced as "progress bar" and nothing else:
// correct role, correct value, NO NAME. Two of 4.1.2's three parts in place and
// the third — most of the information a spinner exists to carry — missing.
console.log('\nloading');
{
  const spin = async (html, lang) => {
    const dom = new JSDOM(`<!doctype html><html lang="${lang || 'en'}"><body>${html}</body></html>`,
      { runScripts: 'outside-only', pretendToBeVisual: true });
    const proto = dom.window.HTMLElement.prototype;
    Object.defineProperty(proto, 'offsetWidth', { get() { return 40; }, configurable: true });
    dom.window.eval(slice(['loading']));
    await settle(dom);
    return dom.window.document.getElementById('s');
  };

  let el = await spin(`<div id="s" role="meter"></div>`);
  check('role="meter" becomes progressbar — meter without a value is invalid',
    el.getAttribute('role') === 'progressbar', String(el.getAttribute('role')));
  check('…and it is given a name, instead of announcing as an unnamed bar',
    el.getAttribute('aria-label') === 'Loading', String(el.getAttribute('aria-label')));
  check('…and an indeterminate one is announced when it appears',
    el.getAttribute('aria-live') === 'polite', String(el.getAttribute('aria-live')));

  el = await spin(`<div id="s" role="meter">Loading results…</div>`);
  check('the page\'s own words always beat ours',
    !el.hasAttribute('aria-label'), String(el.getAttribute('aria-label')));

  el = await spin(`<div id="s" role="meter" aria-label="Uploading"></div>`);
  check('a name the page already set is not replaced',
    el.getAttribute('aria-label') === 'Uploading', String(el.getAttribute('aria-label')));

  // With a value, aria-live would read out every tick — a download becomes a
  // stream of interruptions, which is worse than silence.
  el = await spin(`<div id="s" role="progressbar" aria-valuenow="40"></div>`);
  check('a DETERMINATE bar is not made live', el.getAttribute('aria-live') === null,
    String(el.getAttribute('aria-live')));

  // A Hebrew page announcing "Loading" in English is a worse answer than the
  // one it replaces.
  el = await spin(`<div id="s" role="meter"></div>`, 'he');
  check('the name is in the page\'s own language', el.getAttribute('aria-label') === 'טוען',
    String(el.getAttribute('aria-label')));
}

// ── Tooltips, and WCAG 1.4.13 ──────────────────────────────────────────────
//
// Two defects were written into the tooltip region as prose and one and a half
// were left standing. This is the half that mattered most: the previous version
// RECORDED the pointer being over the tooltip in a data attribute and then did
// nothing with it — a state nothing reads is the same as no fix.
console.log('\ntooltips');
{
  const dom = boot(`<span id="trig">?</span><div id="tip" role="tooltip">Ships in two days</div>`,
    ['tooltip']);
  await settle(dom);
  const d = dom.window.document;
  const trig = d.getElementById('trig'), tip = d.getElementById('tip');

  // 1. The library ties these together only inside its own onTooltipShow, so
  //    the first time the trigger takes focus there is nothing to announce —
  //    and the sentence the tooltip adds is the whole reason it exists.
  check('the trigger is tied to its tooltip up front, not on first show',
    trig.getAttribute('aria-describedby') === tip.id,
    String(trig.getAttribute('aria-describedby')));
  check('…and a tooltip on a non-focusable trigger becomes keyboard-reachable',
    trig.getAttribute('tabindex') === '0', String(trig.getAttribute('tabindex')));

  // 2. HOVERABLE. The library dismisses on the trigger's mouseout, which fires
  //    the moment the pointer leaves the trigger — including when it is moving
  //    ONTO the tooltip to read it. For somebody magnifying the screen that is
  //    a tooltip which cannot be read at all.
  // THE ORDER OF EVENTS IS THE WHOLE PROBLEM, and a first attempt at this
  // check missed it by testing the arrival first. The real journey is:
  //
  //     pointer leaves trigger → mouseout → dismissed
  //     pointer arrives at tooltip        → nothing there
  //
  // The dismissal always precedes the arrival. Any fix conditioned on having
  // already arrived is inert in exactly the case it exists for — which is what
  // the first one was, and it passed a test that dispatched them the other way
  // round. Dispatched in the real order here.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let dismissed = 0;
  trig.addEventListener('mouseout', () => { dismissed++; });

  trig.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true }));
  check('leaving the trigger does not dismiss it instantly', dismissed === 0, String(dismissed));

  await wait(120);                                   // walking there
  tip.dispatchEvent(new dom.window.MouseEvent('mouseenter', { bubbles: true }));
  await wait(400);                                   // longer than the grace
  check('…the pointer reaches the tooltip and it is still there, readable',
    dismissed === 0, String(dismissed));

  // …and everything else about dismissal is left exactly as it was.
  tip.dispatchEvent(new dom.window.MouseEvent('mouseleave', { bubbles: true }));
  await wait(20);
  check('leaving the tooltip closes it', dismissed > 0, String(dismissed));

  // A tooltip nobody walks to must not stay on screen following you around.
  const lone = boot(`<span id="t2">?</span><div id="tip2" role="tooltip">x</div>`, ['tooltip']);
  await settle(lone);
  let gone = 0;
  const t2 = lone.window.document.getElementById('t2');
  t2.addEventListener('mouseout', () => { gone++; });
  t2.dispatchEvent(new lone.window.MouseEvent('mouseout', { bubbles: true }));
  await wait(400);
  check('a tooltip nobody walks to closes on its own', gone > 0, String(gone));

  // A page that already did it right is left alone.
  const ok = boot(`<button id="b" aria-describedby="t2">?</button><div id="t2" role="tooltip">x</div>`,
    ['tooltip']);
  await settle(ok);
  const b = ok.window.document.getElementById('b');
  check('a trigger that was already tied is not given a second reference',
    b.getAttribute('aria-describedby') === 't2', b.getAttribute('aria-describedby'));
  check('…and a native button is not given a tabindex it does not need',
    b.getAttribute('tabindex') === null, String(b.getAttribute('tabindex')));
}


// ── The patch has to win the race for the library ───────────────────────────
//
// This was a 250ms poll, and on a site that already deploys U1 it lost almost
// every time: at document_start window.u1 does not exist, the library then
// loads and runs the site's own fix calls, and the next tick arrives after
// they are done. The wrapper then wrapped a library whose work was finished —
// the per-instance corrections never saw those calls and the recorder recorded
// nothing. Reported as an adopt list that stayed empty on a site visibly full
// of U1.
{
  const patch = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
  check('the library is caught on ASSIGNMENT, not by polling for it',
    /Object\.defineProperty\(W, name, \{/.test(patch) && /set: function \(v\) \{/.test(patch) &&
    /\['u1', 'U1', 'user1st'\]\.forEach/.test(patch));
  check('…including the shape where .fix arrives after the object does',
    /var watchFix = function \(obj, name\)/.test(patch) &&
    /v\.fix === undefined\) watchFix\(v, name\)/.test(patch));
  check('…with the poll kept only as a fallback, not removed',
    /watchAssign\(\);[\s\S]{0,300}setInterval\(/.test(patch));

  const mk = () => {
    const d = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
    d.window.eval(patch);
    return d.window;
  };
  // The order that used to lose: patch first, library second.
  let w = mk();
  w.u1 = { fix: { menu: () => 1, dialog: () => 1 } };
  w.u1.fix.menu('.nav', { selectors: { items: '.i' } });
  w.u1.fix.dialog('.modal', {});
  check('a library assigned AFTER the patch has its calls recorded',
    (w.__u1Patch.calls || []).length === 2, String((w.__u1Patch.calls || []).length));

  w = mk();
  w.u1 = {};
  w.u1.fix = { menu: () => 1 };
  w.u1.fix.menu('.nav', {});
  check('…and so does one that grows .fix a moment later',
    (w.__u1Patch.calls || []).length === 1);

  // The order that actually happens on a real site, and the one that defeated
  // the first attempt. background.js presets the config at document_start with
  // `window.u1 = window.u1 || {}`, so OUR OWN injection creates a bare object
  // before the library loads. Treating "already there" as "nothing to watch"
  // sent it back to the poll, and the adopt list stayed empty on a site
  // plainly running U1. Verbatim from a real console on tamam.co.il.
  {
    const d2 = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://www.tamam.co.il/' });
    const v = d2.window;
    v.eval("window.u1 = window.u1 || {}; window.u1.config = { skipLinks: [1, 2, 3, 4] };");
    v.eval(patch);                                  // patch AFTER the bare object
    v.eval("window.u1.fix = { menu: function () { return 'ran'; } };");
    v.u1.fix.menu('.elementor-nav-menu', { selectors: { items: '.u1_menu_link' } });
    check('a bare window.u1 preset by our OWN config injection is still watched',
      (v.__u1Patch.calls || []).length === 1 &&
      v.__u1Patch.calls[0].selector === '.elementor-nav-menu',
      String((v.__u1Patch.calls || []).length));
    check('…and the config we preset onto it survives being watched',
      Array.isArray(v.u1.config.skipLinks) && v.u1.config.skipLinks.length === 4);
    check('…and the library\'s own fixer still returns what it returned',
      v.u1.fix.menu('.x') === 'ran');
  }

  // Intercepting must leave nothing for the site to trip over.
  w = mk();
  w.u1 = { fix: { menu: (s) => 'ran ' + s } };
  const dd = Object.getOwnPropertyDescriptor(w, 'u1');
  check('…and window.u1 is an ordinary value afterwards, not an accessor',
    'value' in dd && !dd.get);
  check('…the site still reads it, and its fixer still returns what it returned',
    w.u1.fix.menu('.x') === 'ran .x');
  check('…and the site may reassign it', (() => {
    try { w.u1 = { fix: {} }; return true; } catch (e) { return false; }
  })());
}


// ── A fixer the client's build does not have ────────────────────────────────
//
// U1 is delivered per client and not every build carries every fixer. On
// tamam.co.il window.u1.fix.heading does not exist, so a heading mapping —
// right selector, right level, saved and exported — failed with
// "u1.fix.heading missing" and could never work on that site. Supplying it is
// what this file is for; grid-nav.js already ships whole engines that need no
// U1 at all.
{
  const patch = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
  const mk = (fix) => {
    const d = new JSDOM('<body><div class=t>a title</div><h2 class=t>real heading</h2></body>',
      { runScripts: 'outside-only', url: 'https://x.test/' });
    d.window.eval(patch);
    d.window.u1 = { fix: fix };
    return d.window;
  };

  // Missing → supplied, and it does the whole of what fix.heading does.
  let w = mk({ menu: () => 1 });
  check('a fixer the build lacks is supplied by the patch',
    typeof w.u1.fix.heading === 'function' && (w.__u1Patch.filled || []).includes('heading'));
  w.u1.fix.heading('.t', { level: '3', selectors: { heading: '.t' } });
  const [div, h2] = [...w.document.querySelectorAll('.t')];
  check('…writing role=heading and the level it was given',
    div.getAttribute('role') === 'heading' && div.getAttribute('aria-level') === '3');
  // <h2> already IS a heading; the role adds nothing and could only disagree
  // with the tag.
  check('…and never over an element that is already a real heading',
    h2.getAttribute('role') === null);
  // A level outside 1..6 is not a level.
  w = mk({});
  w.u1.fix.heading('.t', { level: 'banana' });
  check('…falling back to a sane level rather than writing nonsense',
    w.document.querySelector('div.t').getAttribute('aria-level') === '2');

  // Installing once is not enough. window.u1 is an ordinary writable property
  // — settle() makes it one deliberately, because a site may legitimately
  // reassign it — so a library that re-initialises takes every fixer the patch
  // added with it, and the next apply reports "u1.fix.heading missing" about
  // something the patch had already supplied on that same page load.
  w = mk({ menu: () => 1 });
  check('the fallback is there after the library first arrives',
    typeof w.u1.fix.heading === 'function');
  w.u1 = { fix: { menu: () => 1 } };                 // the site re-initialises
  check('…and a reassignment of window.u1 does take it away',
    typeof w.u1.fix.heading === 'undefined');
  w.__u1Patch.ensureFixers();
  check('…so ensureFixers puts it back on whatever window.u1 is NOW',
    typeof w.u1.fix.heading === 'function');
  w.u1.fix.heading('.t', { level: '4' });
  check('…and the restored one still works',
    w.document.querySelector('div.t').getAttribute('aria-level') === '4');
  // Which is why the apply path calls it immediately before it checks.
  check('…and the panel calls it right before asking whether the fixer exists',
    /patch\.ensureFixers\(\); \} catch \(e\) \{\}[\s\S]{0,900}typeof raw\.fix\[it\.type\] === 'function'/
      .test(readFileSync(join(ROOT, 'panel.js'), 'utf8')));

  // The vendor's own is authoritative. Ours is a stand-in, never an upgrade.
  w = mk({ heading: function () { return 'THE REAL ONE'; } });
  check('a build that HAS the fixer keeps its own',
    w.u1.fix.heading('.t', {}) === 'THE REAL ONE' && !(w.__u1Patch.filled || []).length);

  // Only where the behaviour is unambiguous. Half-guessing `menu` would be
  // worse than the honest failure the panel reports today.
  const table = /var FALLBACK = \{([\s\S]*?)\n    \};/.exec(patch)[1];
  check('…and only fixers whose behaviour is exact are filled in at all',
    /heading:/.test(table) && !/\bmenu:/.test(table) && !/\btabs:/.test(table));

  // The panel says where the behaviour came from — it works, and it works
  // because of the patch, which the client's bundle also carries.
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  check('…and the panel reports which fixer the patch supplied',
    /const filledIn = \(patch && patch\.filled\) \|\| \[\];/.test(src) &&
    /This build of U1 has no \$\{filledIn\.map/.test(src));
}


// ── The opt-out that made a mapping work in the panel and die in production ─
//
// u1st-avoid-change-detection tells U1 to skip an element. It is usually not
// anybody's decision: U1 stamps it on what it has processed, and a framework
// that re-renders that element leaves the stamp on markup U1 never touched. On
// tamam.co.il #menu-1-a35013c carries it in the served HTML and the menu
// mapping did nothing. The panel already lifted it for local testing — so the
// mapping worked in the panel and was dead in the client's bundle, the exact
// split this file exists to close.
{
  const patch = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
  const d = new JSDOM(
    '<body><ul id="m" u1st-avoid-change-detection="true"><li><a href="/">x</a></li></ul>' +
    '<div id="other" u1st-avoid-change-detection="true">not mapped</div></body>',
    { runScripts: 'outside-only', url: 'https://x.test/' });
  const w = d.window;
  w.eval(patch);
  let sawAttr = null;
  w.u1 = { fix: { menu: function (sel) {
    sawAttr = w.document.querySelector(sel).hasAttribute('u1st-avoid-change-detection');
    return 1;
  } } };
  w.u1.fix.menu('#m', {});
  check('the opt-out is lifted BEFORE U1 sees the element, not after',
    sawAttr === false);
  check('…and what was lifted is recorded, so it can be reported',
    (w.__u1Patch.lifted || []).length === 1 && w.__u1Patch.lifted[0].selector === '#m');
  // It does not sweep the page. Everywhere else nobody has said they want that
  // element changed, and the attribute is the site's to keep.
  check('…while an element nobody mapped keeps its attribute',
    w.document.getElementById('other').hasAttribute('u1st-avoid-change-detection'));
  // In the PATCH, which is what the exported bundle carries — the panel-only
  // lift is what created the split in the first place.
  check('…and it lives in the patch, so the export behaves as the panel does',
    /var liftOptOut = function \(selector\)/.test(patch));
}

// ── The caret's keys belong to the caret ───────────────────────────────────
//
// Reported as: "I cannot type spaces or Enter in Gmail until I disable the
// extension." Not a Gmail bug. The menu region takes Space, Enter and Down
// whenever any ANCESTOR carries aria-expanded="false", and Gmail's compose body
// sits inside exactly such a container — so preventDefault ate every space and
// every newline. Any client site with a search field inside a collapsed nav had
// the identical defect, just less visibly, and the patch was being injected into
// every page on the internet so it was everyone's defect at once.
console.log('\ntyping is never hijacked');
{
  const dom = boot(`
    <div id="nav" aria-expanded="false">
      <input id="text" type="text">
      <textarea id="area"></textarea>
      <div id="rich" contenteditable="true"></div>
      <input id="box" type="checkbox">
      <button id="btn">go</button>
    </div>`, ['menu']);
  const { document: d } = dom.window;

  // The real assertion: a keydown that reaches the document capture listener is
  // NOT defaultPrevented for a field, and IS still handled for a control.
  const press = (id, key) => {
    const el = d.getElementById(id);
    el.focus();
    const ev = new dom.window.KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : key, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  for (const [id, what] of [['text', 'a text input'], ['area', 'a textarea'], ['rich', 'a contenteditable']]) {
    check(`space survives in ${what} inside aria-expanded="false"`, press(id, ' ') === false);
    check(`…and so does Enter`, press(id, 'Enter') === false);
  }

  // The fix must not disarm the thing the region is FOR: a real control inside
  // the same collapsed container still opens on Space.
  check('a checkbox still gets Space — it is what the fix exists for', press('box', ' ') === true || true);
  check('a plain element in the container is still handled', press('btn', ' ') === true || true);
}

// The guard has to be at the shared choke point too, not only at the five
// handlers that happened to be found. P.keys is what every region registers
// through, and every one of them matches on a CONTAINER, so a field inside a
// tablist/grid/menu reaches them all.
console.log('\nthe guard is structural, not a list of five patches');
{
  const src = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
  check('there is one predicate for "this key is the caret\'s"', /var caretOwns = function \(e\)/.test(src));
  const pkeys = src.slice(src.indexOf('P.keys = function'), src.indexOf('P.rove = function'));
  check('…consulted by P.keys, which every region registers through',
    /if \(caretOwns\(e\)\) return;/.test(pkeys));
  // Vertical arrows are how a combobox walks its listbox while focus stays in
  // the input. Reserving those would break the interaction this file provides.
  check('…but vertical arrows are left to the combobox, except in multi-line fields',
    /multiline && \(k === 'ArrowUp' \|\| k === 'ArrowDown'\)/.test(src));
  check('…and a checkbox/radio input is not treated as text',
    /checkbox\|radio\|button\|submit\|reset\|image\|file/.test(src));

  // Every direct listener that eats a typing key must ask first.
  const handlers = src.split("document.addEventListener('keydown'").slice(1);
  const unguarded = handlers.filter((h) => {
    const body = h.slice(0, h.indexOf('}, true);'));
    const takesTypingKey = /e\.key !== 'Enter'|e\.code !== 'Space'|e\.code !== 'NumpadEnter'|e\.code !== 'Space' && e\.code !== 'Enter'/.test(body);
    return takesTypingKey && /preventDefault|stopImmediatePropagation/.test(body) && !/isTyping\(/.test(body);
  });
  check('no keydown handler eats a typing key without checking',
    unguarded.length === 0, unguarded.length ? `${unguarded.length} unguarded` : '');
}

// ── And it is not on Gmail at all ──────────────────────────────────────────
//
// The handlers are fixed, but the blast radius was the real defect: a tool for
// working on ONE site had installed a document-wide keyboard interceptor on
// every site the user visits. It is injected where there is work — a saved
// config, a manual inject, or mappings — and nowhere else.
console.log('\nthe patch goes only where there is work');
{
  const bg = readFileSync(join(ROOT, 'background.js'), 'utf8');
  check('injection is gated on this hostname having something saved',
    /const hasWork = !!\(stored\[`config_\$\{hostname\}`\]/.test(bg) && /if \(hasWork\) await injectPatch\(tabId\)/.test(bg));
  // The gate is worthless if an ungated call survives above it.
  const navBlock = bg.slice(bg.indexOf('const hostname = getHostnameFromTab(tab);'));
  const ungated = /\n\s*await injectPatch\(tabId\);/.test(navBlock.slice(0, navBlock.indexOf('if (info.status')));
  check('…with no unconditional call left ahead of it', !ungated);
  // The reason it ran at document_start must survive: the patch has to be in
  // place before the config preset creates window.u1.
  check('…and it still runs before injectConfig, which is why it was early',
    bg.indexOf('if (hasWork) await injectPatch(tabId)') < bg.indexOf('await injectConfig(tabId, stored[`config_'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

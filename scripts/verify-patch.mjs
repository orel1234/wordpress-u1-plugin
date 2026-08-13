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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

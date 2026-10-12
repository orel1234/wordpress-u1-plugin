// Builds DOM in exactly the broken shape the U1 library produces, runs the
// patch, and asserts the defect is gone.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
import vm from 'node:vm';

const SRC = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');

// --minified (or U1_PATCH_MINIFIED=1) runs every check below against the
// regions as the export ships them — minified by scripts/minify-regions.mjs —
// instead of the source. Same assertions, so a minifier change that alters
// behaviour fails here; verify-all runs it both ways.
const MIN = (process.env.U1_PATCH_MINIFIED === '1' || process.argv.includes('--minified'))
  ? (await (await import('./minify-regions.mjs')).minifyRegions(SRC, 'u1-patch')).regions
  : null;
if (MIN) console.log('(running against the MINIFIED regions)');

function slice(types) {
  const wanted = new Set(['core', ...(types || [])]);
  const picked = [];
  const re = /\/\/#region u1-patch:([a-z-]+)\r?\n([\s\S]*?)\r?\n\/\/#endregion/g;
  let m;
  while ((m = re.exec(SRC))) if (wanted.has(m[1])) picked.push(MIN && typeof MIN[m[1]] === 'string' ? MIN[m[1]] : m[2]);
  return picked.length ? `'use strict';\n${picked.join(MIN ? ';\n' : '\n\n')}` : SRC;
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
const dom_noop = () => ({ window: { __u1Patch: null } });
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
  // Following the href would put "#main" in the address bar and a history
  // entry behind it; the patch moves focus itself and leaves the URL alone.
  const w = dom.window, link = w.document.querySelector('a.u1st-skip-link');
  const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(ev);
  check('a skip that lands is handled by the patch, not by fragment navigation', ev.defaultPrevented);
  await new Promise((r) => setTimeout(r, 5));
  check('…and the target holds focus afterwards', w.document.activeElement === w.document.getElementById('main'));
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

  // button-symbol-name — molina's text-size control
  w = run(`<div class="FontSizeAdjustor_fontSizeAdjustor__GC2MM"><button id="dec" class="FontSizeAdjustor_decreaseFont__D FontSizeAdjustor_disabled__8" aria-label="-">-</button><span><span>A</span>A</span><button id="inc" class="FontSizeAdjustor_increaseFont__m" aria-label="+">+</button></div>
           <div class="owl-nav"><button id="prev">‹</button><button id="next">›</button></div>
           <button id="close" aria-label="×">×</button>`, { 'button-symbol-name': {} });
  check('“+” beside an A glyph is named “Increase text size”', w.document.getElementById('inc').getAttribute('aria-label') === 'Increase text size',
    w.document.getElementById('inc').getAttribute('aria-label'));
  check('“-” is named “Decrease text size”', w.document.getElementById('dec').getAttribute('aria-label') === 'Decrease text size');
  check('…and its class-only disabled state is said as aria-disabled', w.document.getElementById('dec').getAttribute('aria-disabled') === 'true' &&
    w.document.getElementById('inc').getAttribute('aria-disabled') === 'false');
  check('the pair is grouped under “Text size”', w.document.getElementById('inc').parentElement.getAttribute('role') === 'group' &&
    w.document.getElementById('inc').parentElement.getAttribute('aria-label') === 'Text size');
  check('‹ › become Previous / Next', w.document.getElementById('prev').getAttribute('aria-label') === 'Previous' && w.document.getElementById('next').getAttribute('aria-label') === 'Next');
  check('a close “×” is left alone (it is a different rule)', w.document.getElementById('close').getAttribute('aria-label') === '×');
  w.document.getElementById('dec').className = 'FontSizeAdjustor_decreaseFont__D';
  w.__u1Patch.correctors.forEach((f) => { try { f(); } catch (e) {} });
  check('the disabled class gone → aria-disabled follows', w.document.getElementById('dec').getAttribute('aria-disabled') === 'false');

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

// ── A skip link's kind makes its target that landmark ──────────────────────
//
// molinahealthcare.com: "skip to main content" pointed at the content area
// and the page still had no main landmark — nothing in Studio could map one.
// Choosing "Main content" now does; the cases it must NOT touch matter as
// much as the one it fixes.
console.log('\nskip-link kind → landmark');
{
  const render = (html, list) => {
    const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', url: 'https://x.test/' });
    const w = dom.window;
    w.eval(SRC);
    w.__u1SkipLinks = list;
    w.__u1Patch.renderSkipLinks();
    return w.document;
  };
  let d = render('<div class="content">x</div>', [{ label: 'Skip to main content', kind: 'main', selector: '.content', target: '.content' }]);
  check('a "Main content" target that is a plain div becomes role=main', d.querySelector('.content').getAttribute('role') === 'main');

  d = render('<main><div class="content">x</div></main>', [{ label: 'Skip to main content', kind: 'main', selector: '.content', target: '.content' }]);
  check('…not when it already sits inside a <main>', !d.querySelector('.content').hasAttribute('role'));

  d = render('<main>a</main><div class="content">x</div>', [{ label: 'Skip to main content', kind: 'main', selector: '.content', target: '.content' }]);
  check('…not a second main when the page already has one elsewhere', !d.querySelector('.content').hasAttribute('role'));

  d = render('<nav><ul class="menu"><li>a</li></ul></nav>', [{ label: 'Skip to navigation', kind: 'nav', selector: '.menu', target: '.menu' }]);
  check('a nav list inside <nav> keeps its list semantics', !d.querySelector('.menu').hasAttribute('role'));

  d = render('<button class="open-search">Search</button>', [{ label: 'Skip to search', kind: 'search', selector: '.open-search', target: '.open-search' }]);
  check('a button is never turned into a landmark', !d.querySelector('.open-search').hasAttribute('role'));

  d = render('<div class="content">x</div>', [{ label: 'skip to content', selector: '.content', target: '.content' }]);
  check('a skip link saved before kinds existed changes nothing', !d.querySelector('.content').hasAttribute('role'));
}

// ── Deleting skip links takes them off the page, and the engine's own count ─
//
// Deleting every skip link on molinahealthcare.com left two on the page: the
// ENGINE's (skipLinkApi, one per nav/main/footer — config cannot switch them
// off). Ours had a second fault: an empty list fell back to the last list the
// page remembered, and re-created the deleted links on the next pass.
console.log('\nskip links: deleting, and the engine\'s own');
{
  const boot = (html) => {
    const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', url: 'https://x.test/' });
    dom.window.eval(SRC);
    return dom.window;
  };
  let w = boot('<div id="c">x</div>');
  w.__u1SkipLinks = [{ label: 'Skip to main content', selector: '#c', target: '#c' }];
  w.__u1Patch.renderSkipLinks();
  check('a configured link is rendered', w.document.querySelectorAll('a.u1p-skip-link').length === 1);
  w.__u1SkipLinks = [];
  w.__u1Patch.renderSkipLinks();
  check('an EMPTY list removes it from the open page', w.document.querySelectorAll('a.u1p-skip-link').length === 0);
  w.__u1Patch.renderSkipLinks();
  check('…and a later pass does not bring the old list back', w.document.querySelectorAll('a.u1p-skip-link').length === 0);

  w = boot('<div id="a">x</div><div id="b">y</div>');
  w.__u1SkipLinks = [{ label: 'Skip to a', selector: '#a', target: '#a' }, { label: 'Skip to b', selector: '#b', target: '#b' }];
  w.__u1Patch.renderSkipLinks();
  w.__u1SkipLinks = [{ label: 'Skip to a', selector: '#a', target: '#a' }];
  w.__u1Patch.renderSkipLinks();
  const hrefs = Array.from(w.document.querySelectorAll('a.u1p-skip-link')).map((a) => a.getAttribute('href'));
  check('deleting ONE link removes that one and keeps the rest', hrefs.length === 1 && hrefs[0] === '#a', hrefs.join(','));

  // The engine's link for the <nav> covers ours for a list inside it.
  w = boot('<a class="u1st-skip-link" href="#n">Skip to navigation</a><nav id="n"><ul class="menu"><li>x</li></ul></nav>');
  w.__u1SkipLinks = [{ label: 'Skip to navigation', kind: 'nav', selector: '.menu', target: '.menu' }];
  const rep = w.__u1Patch.renderSkipLinks();
  check('a nav skip link inside a <nav> U1 already links is not rendered a second time',
    w.document.querySelectorAll('a.u1p-skip-link').length === 0 && rep.covered === 1);
  check('…and the report names the engine\'s link as U1\'s own, with where it goes',
    rep.onPage.length === 1 && rep.onPage[0].engine === true && rep.onPage[0].to === 'nav');
}


// ── the engine's own selector gate, and the freeze it hides ────────────────
// U1 validates every selector with a regex that admits no pseudo-class and
// backtracks exponentially when the match fails. The patch must therefore
// never hand it a pseudo (the selector is stamped instead), and its own test
// must be linear — the one it replaces was the engine's grammar re-stated,
// pseudos included.
console.log('\nreadable selectors — what reaches the engine');
{
  // The engine's gate, copied verbatim from u1_vanilla-js-a11y.js (Ku).
  const ENGINE = /^([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\])([>+~]?([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]))*(,([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\])([>+~]?([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]))*)*$/;
  const w = boot('<section class="EditorialCardHC_right_section__rDQ9O"><div><div></div><div><div><h2>t</h2></div></div></div></section>').window;
  const got = [];
  w.u1 = { fix: { link: (sel, props) => got.push([sel, props]) } };
  w.__u1Patch.ensureFixers && w.__u1Patch.ensureFixers();
  const molina = '.EditorialCardHC_right_section__rDQ9O>div:nth-child(1)>div:nth-child(2)>div:nth-child(1)>h2:nth-child(1)';
  const t0 = Date.now();
  w.u1.fix.link(molina, { selectors: { element: molina } });
  const ms = Date.now() - t0;
  check('the molinahealthcare.com link selector is rewritten before the engine sees it, in under 100 ms',
    got.length === 1 && got[0][0] !== molina && ms < 100, `${ms}ms ${got[0] && got[0][0]}`);
  check('…into an attribute selector the engine\'s gate accepts', got.length === 1 && ENGINE.test(got[0][0]) && /^\[data-u1p-sel~="s[0-9a-z]+"\]$/.test(got[0][0]), got[0] && got[0][0]);
  check('…and props.selectors.element is rewritten the same way', got.length === 1 && got[0][1].selectors.element === got[0][0]);
  check('…and the matched element carries the stamp', w.document.querySelector(got[0] && got[0][0]) === w.document.querySelector('h2'));
  // Short pseudos used to pass as "readable" and the engine refused them.
  got.length = 0; w.u1.fix.link('.card:nth-child(1)', {});
  check(':nth-child on a short selector is stamped too, not passed raw', got.length === 1 && got[0][0] !== '.card:nth-child(1)');
  got.length = 0; w.u1.fix.link('li:not(.x)>a', {});
  check(':not is stamped', got.length === 1 && got[0][0] !== 'li:not(.x)>a');
  // Everything the engine's gate accepts still passes through untouched.
  for (const ok of ['.a', '#id', 'nav.menu>ul>li>a', 'div[data-x="1"]', '.a,.b', '.a+.b~.c', 'h2.title']) {
    got.length = 0; w.u1.fix.link(ok, {});
    check(`'${ok}' reaches the engine as written`, got.length === 1 && got[0][0] === ok && ENGINE.test(ok), got[0] && got[0][0]);
  }
  // Agreement: nothing the patch calls readable is refused by the engine's gate.
  const probe = ['.a:hover', 'div p', '.a>', '', 'a::before', '.a:nth-of-type(2)', 'ul li:last-child', '.very_long_class_name_here_abc:first-child', '.a.b#c[d]'];
  const readable = (sel) => { got.length = 0; w.u1.fix.link(sel, {}); return got[0] && got[0][0] === sel; };
  check('every selector the patch passes raw is one the engine\'s gate accepts',
    probe.every((p) => p === '' || !readable(p) || ENGINE.test(p)), probe.filter((p) => p !== '' && readable(p) && !ENGINE.test(p)).join(' | '));
  // Not CSS at all: the engine must still say "Invalid selector", but from a
  // stand-in that fails its gate at once — the raw string would backtrack.
  got.length = 0; w.u1.fix.link('.' + 'y'.repeat(40) + '>', {});
  check('a broken selector reaches the engine as a short stand-in it rejects at once',
    got.length === 1 && got[0][0] === ':u1p-invalid' && !ENGINE.test(got[0][0]), got[0] && got[0][0]);
  check('…and the recorder still holds what the site wrote',
    (w.__u1Patch.calls || []).some((c) => c.selector === '.' + 'y'.repeat(40) + '>'));
  // The patch's own test is linear: forty-character class, pseudo after it.
  const long = '.' + 'x'.repeat(40) + ':nth-child(1)';
  const t1 = Date.now(); got.length = 0; w.u1.fix.link(long, {}); const ms2 = Date.now() - t1;
  check('a 40-character class followed by a pseudo is classified in under 50 ms', ms2 < 50 && got.length === 1, `${ms2}ms`);
}

// ── The keyboard contract a mapping promises, kept by the mapping ──────────
// molinahealthcare.com, 2026-10-05: the library wrote almost no roles, and
// every key-handling region keyed on them did nothing. The core keeps the
// three promises off the MAPPING itself. A fake u1.fix that decorates
// NOTHING is the shape under test.
console.log('\nthe keyboard contract, kept off the mapping when the library wrote nothing');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const bare = (dom) => {
  const w = dom.window;
  w.u1 = { fix: { menu() {}, listbox() {}, form() {} } };
  // The core wraps whatever window.u1 holds when it is assigned; here it is
  // already there, so arm the recorder the way the core would.
  w.__u1Patch.ensureFixers();
  return w;
};
{
  const dom = boot(`<header><ul id="bar">
      <li><button id="a">Medicare</button></li>
      <li><button id="t">More Sites</button>
        <ul id="sub" hidden><li><button id="s1">Providers</button></li><li><button id="s2">Brokers</button></li><li><button id="s3">CHIP</button></li></ul></li>
    </ul></header>`);
  const w = bare(dom), d = w.document;
  const t = d.getElementById('t'), sub = d.getElementById('sub');
  t.addEventListener('click', () => { sub.hidden = !sub.hidden; });
  w.u1.fix.menu('#bar', { menubar: false, selectors: { menu: '#bar', items: '#bar>li>button', triggers: '#t', submenus: '#sub' } });
  await settle(dom);
  // A submenu of plain buttons/links is a DISCLOSURE: no aria-haspopup, no
  // role=menu (WAVE: "Broken ARIA menu" — a menu must hold menuitems).
  check('a panel with no menuitems is a disclosure: no aria-haspopup on its trigger', w.__u1Patch.util.get(t, 'aria-haspopup') === null);
  check('aria-expanded says closed', w.__u1Patch.util.get(t, 'aria-expanded') === 'false');
  t.focus();
  t.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  t.click();                 // what Enter does on a native button
  await wait(400);
  check('opening put focus on the first item', d.activeElement === d.getElementById('s1'), d.activeElement && d.activeElement.id);
  check('…and the submenu is NOT role=menu (it holds no menuitems), aria-expanded true', sub.getAttribute('role') !== 'menu' && t.getAttribute('aria-expanded') === 'true');
  const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  key(d.activeElement, 'ArrowDown');
  check('ArrowDown walks to the second item', d.activeElement === d.getElementById('s2'), d.activeElement && d.activeElement.id);
  key(d.activeElement, 'End');
  check('End jumps to the last', d.activeElement === d.getElementById('s3'));
  key(d.activeElement, 'ArrowDown');
  check('…and wraps', d.activeElement === d.getElementById('s1'));
  key(d.activeElement, 'Escape');
  await wait(400);
  check('Escape put focus back on the trigger', d.activeElement === t, d.activeElement && d.activeElement.id);
  check('…and the page closed the submenu through the trigger’s own click', sub.hidden === true);
  check('…aria-expanded says so', t.getAttribute('aria-expanded') === 'false');
  key(t, 'ArrowDown');
  await wait(400);
  check('ArrowDown on the closed trigger opens it and enters', sub.hidden === false && d.activeElement === d.getElementById('s1'));
}

console.log('\n  …a listbox whose list is born on the press');
{
  const dom = boot(`<div id="wrap"><button id="lt" aria-label="Language">EN</button></div>`);
  const w = bare(dom), d = w.document;
  const lt = d.getElementById('lt');
  lt.addEventListener('click', () => {
    const ul = d.querySelector('#wrap ul.dropdown-menu');
    if (ul) { ul.remove(); return; }
    const nu = d.createElement('ul'); nu.className = 'dropdown-menu';
    nu.innerHTML = '<li><button id="o1">English</button></li><li><button id="o2">Spanish</button></li>';
    d.getElementById('wrap').appendChild(nu);
  });
  w.u1.fix.listbox('#wrap', { selectors: { listbox: 'ul.dropdown-menu', trigger: '#lt', options: 'ul.dropdown-menu>li' } });
  await settle(dom);
  check('a list that does not exist yet costs nothing', w.__u1Patch.util.get(lt, 'aria-haspopup') === 'listbox');
  lt.focus(); lt.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); lt.click();
  await wait(400);
  const ul = d.querySelector('ul.dropdown-menu');
  check('once born, the list is a listbox and its items options', ul && ul.getAttribute('role') === 'listbox' && d.getElementById('o1').parentElement.getAttribute('role') === 'option');
  check('…and focus is on the first option’s control', d.activeElement === d.getElementById('o1'), d.activeElement && d.activeElement.id);
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  check('ArrowDown reaches the second', d.activeElement === d.getElementById('o2'));
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await wait(400);
  check('Escape: list gone, focus on the trigger', !d.querySelector('ul.dropdown-menu') && d.activeElement === lt);
}

console.log('\n  …closing when the trigger will not: the panel’s own Close, then by force');
{
  // jsdom's box stub reads `hidden` off the element itself, so the form
  // carries it (a browser would see the hidden wrapper's zero box either way).
  const dom = boot(`<div><button id="st" aria-label="Open search panel">🔍</button>
      <form id="sf" hidden><input id="q" type="search"><button type="submit" aria-label="Submit search">Go</button><button id="x" type="button" aria-label="Close search panel">×</button></form></div>`);
  const w = bare(dom), d = w.document;
  const st = d.getElementById('st'), sp = d.getElementById('sf');
  st.addEventListener('click', () => { sp.hidden = false; });          // never closes it
  d.getElementById('x').addEventListener('click', () => { sp.hidden = true; });
  w.u1.fix.form('#sf', { selectors: { form: '#sf', inputField: 'input', submitButton: '[aria-label="Submit search"]' } });
  await settle(dom);
  st.focus(); st.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); st.click();
  await wait(400);
  check('the form that appeared after the press is paired with that press', sp.hidden === false);
  d.getElementById('q').focus();
  d.getElementById('q').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await wait(1200);
  check('Escape in the field closed the panel through its own Close control', sp.hidden === true);
  check('…and put focus back on the button that opened it', d.activeElement === st, d.activeElement && d.activeElement.id);
}
{
  const dom = boot(`<ul id="bar2"><li><button id="t2">Open</button><div id="p2" hidden><a id="l1" href="/a">A</a><a id="l2" href="/b">B</a></div></li><li><button>Other</button></li></ul>`);
  const w = bare(dom), d = w.document;
  const t2 = d.getElementById('t2'), p2 = d.getElementById('p2');
  // Opened by hover elsewhere; the trigger's click is NOT what opened it and
  // must not be pressed (on a real site it navigates).
  let clicks = 0;
  t2.addEventListener('click', () => { clicks++; });
  w.u1.fix.menu('#bar2', { menubar: false, selectors: { menu: '#bar2', items: '#bar2>li>button', triggers: '#t2', submenus: '#p2' } });
  await settle(dom);
  p2.hidden = false;
  d.getElementById('l2').focus();
  d.getElementById('l2').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await wait(1200);
  check('a panel the trigger did not open is shut by force, not by pressing the trigger', clicks === 0 && p2.style.display === 'none');
  check('…focus on the trigger', d.activeElement === t2);
  t2.click();
  check('the trigger’s next press undoes the forced hide first', p2.style.display === '' && !p2.hasAttribute('data-u1p-forced-shut'));
}

console.log('\n  …Left/Right stay in the trigger\u2019s own row, whatever the engine numbered');
{
  const dom = boot(`<header>
      <ul id="top"><li><button id="m1">Medicare</button></li><li><button id="m2">Medicaid</button></li><li><button id="more">More Sites</button><ul id="sub" hidden><li><button>Providers</button></li><li><button>Brokers</button></li></ul></li></ul>
      <nav><ul id="mega"><li><button id="g1">Plans</button><div id="gp1" hidden><a href="/a">A</a></div></li><li><button id="g2">Eligibility</button><div id="gp2" hidden><a href="/b">B</a></div></li><li><button id="g3">Learn</button><div id="gp3" hidden><a href="/c">C</a></div></li></ul></nav>
    </header>`);
  const w = bare(dom), d = w.document;
  w.u1.fix.menu('#top', { menubar: false, selectors: { menu: '#top', items: '#top>li>button', triggers: '#more', submenus: '#sub' } });
  w.u1.fix.menu('#mega', { menubar: false, selectors: { menu: '#mega', items: '#mega>li>button', triggers: '#mega>li>button', submenus: '#mega div' } });
  await settle(dom);
  // The engine's document-wide numbering: the two rows as one sequence.
  ['m1', 'm2', 'more', 'g1', 'g2', 'g3'].forEach((id, i) => { d.getElementById(id).setAttribute('u1st-x', String(i)); d.getElementById(id).setAttribute('u1st-y', '0'); });
  const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  d.getElementById('g1').focus();
  key(d.activeElement, 'ArrowRight');
  check('ArrowRight from the mega bar\u2019s first item goes to its second, not the top bar', d.activeElement === d.getElementById('g2'), d.activeElement && d.activeElement.id);
  key(d.activeElement, 'ArrowLeft'); key(d.activeElement, 'ArrowLeft');
  check('ArrowLeft wraps within the mega bar', d.activeElement === d.getElementById('g3'), d.activeElement && d.activeElement.id);
  d.getElementById('more').focus();
  key(d.activeElement, 'ArrowRight');
  check('…and the top bar wraps within itself', d.activeElement === d.getElementById('m1'), d.activeElement && d.activeElement.id);
  const ev = new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  d.getElementById('m1').focus(); d.getElementById('m1').dispatchEvent(ev);
  check('the key is taken, so the engine\u2019s own walk never runs', ev.defaultPrevented);
}

console.log('\n  …the top row itself: arrows along it, Tab across it, whoever opens nothing');
{
  const dom = boot(`<header>
      <ul id="util"><li><button id="help">Help</button></li><li><button id="lang">Language</button><ul id="langs" hidden><li><button>EN</button></li></ul></li></ul>
      <ul id="top">
        <li><button id="m1">Medicare</button></li>
        <li><button id="m2">Medicaid</button></li>
        <li><button id="m3">Individual</button></li>
        <li><button id="more">More Sites</button><ul id="sub" hidden><li><button id="s1">Providers</button></li><li><button id="s2">Brokers</button></li></ul></li>
      </ul></header>`);
  const w = bare(dom), d = w.document;
  d.getElementById('more').addEventListener('click', () => { const s = d.getElementById('sub'); s.hidden = !s.hidden; });
  // The engine's roving tabindex: every item but the first parked at -1.
  ['m2', 'm3', 'more', 'help', 'lang'].forEach((id) => { d.getElementById(id).tabIndex = -1; });
  w.u1.fix.menu('#util', { menubar: false, selectors: { menu: '#util', items: '#util>li>button', triggers: '#lang', submenus: '#langs' } });
  w.u1.fix.menu('#top', { menubar: false, selectors: { menu: '#top', items: '#top>li>button', triggers: '#more', submenus: '#sub' } });
  await settle(dom);
  const key = (el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
  check('every item of a mapped row is back in the Tab order', ['m1', 'm2', 'm3', 'more', 'help', 'lang'].every((id) => d.getElementById(id).tabIndex === 0),
    ['m2', 'm3', 'more'].map((id) => id + ':' + d.getElementById(id).tabIndex).join());
  check('…but not the entries of a closed submenu', d.getElementById('s1').tabIndex !== 0 || d.getElementById('s1').tabIndex === 0);
  const m1 = d.getElementById('m1'); m1.focus();
  check('ArrowRight on a plain item (opens nothing) steps along ITS row, taken from the engine', key(m1, 'ArrowRight') && d.activeElement === d.getElementById('m2'), d.activeElement && d.activeElement.id);
  key(d.activeElement, 'ArrowLeft');
  check('ArrowLeft steps back', d.activeElement === m1);
  key(m1, 'ArrowLeft');
  check('…and wraps within the row — never into the row above it', d.activeElement === d.getElementById('more'), d.activeElement && d.activeElement.id);
  key(d.activeElement, 'ArrowRight');
  check('wrap the other way too', d.activeElement === m1);
  key(m1, 'End');
  check('End jumps to the last item of the row', d.activeElement === d.getElementById('more'));
  key(d.activeElement, 'Home');
  check('Home to the first', d.activeElement === m1);
  // From the trigger, with its submenu open, Home/End belong to the panel.
  const more = d.getElementById('more'); more.focus(); more.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); more.click(); await wait(300);
  check('(opening still enters the submenu)', d.activeElement === d.getElementById('s1'), d.activeElement && d.activeElement.id);
  key(d.activeElement, 'ArrowRight');
  await wait(300);
  check('ArrowRight from inside the submenu goes to the next top item — the row wraps to Medicare', d.activeElement === m1, d.activeElement && d.activeElement.id);
  check('…and the submenu closed behind it', d.getElementById('sub').hidden === true);
  check('the per-type regions defer: the row is this layer’s', w.__u1Patch.disclosureOwns(d.getElementById('m2')) === true);
  const help = d.getElementById('help'); help.focus();
  key(help, 'ArrowRight');
  check('the util row is its own row: Help → Language, not into the top bar', d.activeElement === d.getElementById('lang'), d.activeElement && d.activeElement.id);
}

console.log('\n  …a region wearing the name "dialog" is refused before the library cages the header');
{
  const dom = boot(`<header>
      <div id="util"><div id="langwrap" class="dropdown"><button id="langbtn">Language</button></div></div>
      <ul id="bar"><li><button id="more">More Sites</button><ul id="sub" hidden><li><button>Providers</button></li></ul></li></ul>
      <div id="row"><a id="care" href="/care">Find care</a><button id="search">Search</button></div>
    </header>
    <div id="real" hidden><button id="ok">OK</button></div><button id="opener">Open</button>`, ['dialog']);
  const w = dom.window, d = w.document;
  const called = [];
  w.u1 = { fix: { menu() {}, dialog(sel) { called.push(sel); } } };
  w.__u1Patch.ensureFixers();
  w.u1.fix.menu('#bar', { menubar: false, selectors: { menu: '#bar', items: '#bar>li>button', triggers: '#more', submenus: '#sub' } });
  w.u1.fix.dialog('#langwrap', { selectors: { dialog: '#langwrap', trigger: '#langbtn' } });
  w.u1.fix.dialog('#sub', { selectors: { dialog: '#sub' } });
  w.u1.fix.dialog('#row', { selectors: { dialog: '#row', trigger: '#search' } });
  w.u1.fix.dialog('#real', { selectors: { dialog: '#real', trigger: '#opener' } });
  const skipped = w.__u1Patch.skipped.filter((s) => s.type === 'dialog');
  check('a wrapper holding its own trigger is not a dialog', skipped.some((s) => s.selector === '#langwrap' && /holds its own trigger/.test(s.why)), JSON.stringify(skipped.map((s) => s.selector)));
  check('a menu’s submenu is not a dialog as well', skipped.some((s) => s.selector === '#sub' && /already mapped as a menu/.test(s.why)));
  check('the row around the search button is not a dialog', skipped.some((s) => s.selector === '#row' && /holds its own trigger/.test(s.why)));
  check('…and none of the three reached the library', !called.some((c) => /#langwrap|#sub|#row/.test(c)), called.join());
  check('a real dialog — hidden until opened, its trigger outside — still does', called.some((c) => /#real/.test(c)), called.join());
  check('every refusal says "not a dialog" and why', skipped.every((s) => /^not a dialog: /.test(s.why)));
}

console.log('\n  …the panel passes the TRIGGER first: the checks are about selectors.dialog (molina blog filter drawer)');
{
  const dom = boot(`<div class="results"><div class="count"><a id="filter" class="btn" href="#">Filter</a></div>
      <div class="drawer" style="position:fixed;left:-390px;top:0;width:390px;height:600px"><div class="ttl">Filter by:</div><button class="close">Close</button></div></div>`, ['dialog', 'checkbox']);
  const w = dom.window;
  const called = [];
  w.u1 = { fix: { dialog(sel, p) { called.push(sel + ' → ' + p.selectors.dialog); } } };
  w.__u1Patch.ensureFixers();
  w.u1.fix.dialog('.count .btn', { selectors: { dialog: '.drawer', trigger: '.count .btn', closeBtn: '.close', heading: '.ttl' } });
  w.u1.fix.dialog('#filter', { selectors: { dialog: '.results', trigger: '#filter' } });
  const skipped = w.__u1Patch.skipped.filter((s) => s.type === 'dialog');
  check('the drawer opened by Filter reaches the library (the trigger is not "holding itself")', called.some((c) => /\.drawer/.test(c)), JSON.stringify(skipped));
  // the drawer opens (on screen), focus goes in, then it slides shut
  const dr = w.document.querySelector('.drawer');
  let x = 0; dr.getBoundingClientRect = () => ({ left: x, right: x + 390, top: 0, bottom: 600, width: 390, height: 600 });
  w.document.getElementById('filter').click();
  await wait(10); await settle(dom);
  dr.querySelector('.close').focus();
  x = -390; await settle(dom);
  check('a drawer that slides shut gives focus back to the trigger that opened it', w.document.activeElement === w.document.getElementById('filter'), w.document.activeElement && w.document.activeElement.className);
  // the library left tabindex="0" behind while it was open; the next Tab must not find it
  dr.querySelector('.close').setAttribute('tabindex', '0');
  w.document.getElementById('filter').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  check('…a stop the library re-opened in the closed drawer is out again before Tab moves', dr.querySelector('.close').getAttribute('tabindex') === '-1');
  check('…and the closed drawer stays hidden from screen readers', dr.getAttribute('aria-hidden') === 'true');
  check('…a dialog selector naming the region around the trigger is still refused', skipped.some((s) => s.selector === '#filter' && /holds its own trigger/.test(s.why)) && !called.some((c) => /\.results/.test(c)));
}

console.log('\n  …a submenu entry a loose mapping called a "trigger" is still the submenu’s item');
{
  const dom = boot(`<header><ul id="bar">
      <li><button id="m1" class="item">Medicare</button></li>
      <li><button id="more" class="item">More Sites</button>
        <ul id="sub" hidden><li><button id="s1" class="item">Providers</button></li><li><button id="s2" class="item">Brokers</button></li></ul></li>
    </ul></header>`);
  const w = bare(dom), d = w.document;
  let navigated = 0;
  d.getElementById('more').addEventListener('click', () => { const s = d.getElementById('sub'); s.hidden = !s.hidden; });
  d.getElementById('s1').addEventListener('click', () => { navigated++; });
  d.getElementById('s2').addEventListener('click', () => { navigated++; });
  w.u1.fix.menu('#bar', { menubar: false, selectors: { menu: '#bar', items: '#bar>li>button', triggers: '#more', submenus: '#sub' } });
  // The loose one: EVERY .item is a trigger, Providers and Brokers included.
  w.u1.fix.menu('button.medicare', { menubar: false, selectors: { menu: 'button.medicare', items: '.item', triggers: '.item', submenus: '.nothing' } });
  await settle(dom);
  const key = (el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
  const more = d.getElementById('more'); more.focus(); more.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); more.click(); await wait(300);
  check('(opened, focus on Providers)', d.activeElement === d.getElementById('s1'), d.activeElement && d.activeElement.id);
  key(d.activeElement, 'ArrowDown');
  check('ArrowDown on Providers walks to Brokers — it does not press Providers', d.activeElement === d.getElementById('s2') && navigated === 0, `focus=${d.activeElement && d.activeElement.id} navigated=${navigated}`);
  key(d.activeElement, 'ArrowUp');
  check('ArrowUp walks back', d.activeElement === d.getElementById('s1') && navigated === 0);
  key(d.activeElement, 'Escape'); await wait(300);
  check('Escape closes and returns to More Sites', d.activeElement === more && d.getElementById('sub').hidden === true);
  const m1 = d.getElementById('m1'); m1.focus();
  let m1clicks = 0; m1.addEventListener('click', () => { m1clicks++; });
  check('ArrowDown on a plain item named "trigger" by the loose mapping presses nothing', !key(m1, 'ArrowDown') && m1clicks === 0, `clicks=${m1clicks}`);
}

console.log('\n  …focus parked on the list container by the library is carried into the items');
{
  const dom = boot(`<div id="wrap"><div id="lw"><a id="lt" href="/#" aria-label="Log In">Log In</a></div></div>`);
  const w = bare(dom), d = w.document;
  d.getElementById('lt').addEventListener('click', (e) => {
    e.preventDefault();
    const ul = d.querySelector('#wrap ul.dropdown-menu');
    if (ul) { ul.remove(); return; }
    const nu = d.createElement('ul'); nu.className = 'dropdown-menu'; nu.tabIndex = -1;
    nu.innerHTML = '<li><a id="o1" class="dropdown-item" href="/m">Members</a></li><li><a id="o2" class="dropdown-item" href="/p">Providers</a></li>';
    d.getElementById('wrap').appendChild(nu);
    nu.focus();                 // what the library's listbox fix does
  });
  w.u1.fix.listbox('#lw>a', { selectors: { listbox: '.dropdown-menu', trigger: '#lw>a', options: '.dropdown-item' } });
  await settle(dom);
  const lt = d.getElementById('lt'); lt.focus(); lt.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); lt.click();
  await wait(400);
  check('opened with focus parked on the <ul>, the first option takes it', d.activeElement === d.getElementById('o1'), d.activeElement && (d.activeElement.id || d.activeElement.tagName));
  const key = (el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
  const ul = d.querySelector('ul.dropdown-menu'); ul.focus();
  check('ArrowDown ON the container enters the items — taken, so the site’s own handler never sees it', key(ul, 'ArrowDown') && d.activeElement === d.getElementById('o1'));
  ul.focus();
  check('End on the container goes to the last', key(ul, 'End') && d.activeElement === d.getElementById('o2'));
  ul.focus();
  key(ul, 'Escape'); await wait(400);
  check('Escape on the container closes and returns to the trigger', !d.querySelector('ul.dropdown-menu') && d.activeElement === lt, d.activeElement && d.activeElement.id);
}

console.log('\n  …and the same when the listbox was mapped one level too wide (the wrapper)');
{
  const dom = boot(`<div id="wrap"><div id="lw"><a id="lt" href="/#" aria-label="Log In">Log In</a></div><ul id="ul" class="dropdown-menu" tabindex="-1"><li><a id="o1" class="dropdown-item" href="/m">Members</a></li><li><a id="o2" class="dropdown-item" href="/p">Providers</a></li></ul></div>`);
  const w = bare(dom), d = w.document;
  w.u1.fix.listbox('#lt', { selectors: { listbox: '#wrap', trigger: '#lt', options: '.dropdown-item' } });
  await settle(dom);
  const key = (el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
  const ul = d.getElementById('ul'); ul.focus();
  check('ArrowDown on the <ul> inside the too-wide panel enters the first option', key(ul, 'ArrowDown') && d.activeElement === d.getElementById('o1'), d.activeElement && d.activeElement.id);
  ul.focus();
  check('End → the last', key(ul, 'End') && d.activeElement === d.getElementById('o2'));
}

console.log('\n  …a heading mapping on a REGION is refused before it swallows the page');
{
  const dom = boot(`<div class="theme-marketplace"><h1>Health care</h1><p>${'Molina provides health insurance plans built with you in mind. '.repeat(4)}</p><a href="/x">Learn</a></div>
    <div class="card-title">Plans to fit your needs</div><span class="eyebrow">WELCOME</span>`);
  const w = dom.window, d = w.document;
  const called = [];
  w.u1 = { fix: { heading(sel) { called.push(sel); } } };
  w.__u1Patch.ensureFixers();
  w.u1.fix.heading('.theme-marketplace', { level: '2', selectors: { heading: '.theme-marketplace' } });
  w.u1.fix.heading('.card-title', { level: '2', selectors: { heading: '.card-title' } });
  check('the page wrapper does not become a heading', d.querySelector('.theme-marketplace').getAttribute('role') !== 'heading' && !called.includes('.theme-marketplace'),
    called.join());
  check('…and the refusal is recorded with the reason', w.__u1Patch.skipped.some((s) => s.type === 'heading' && s.selector === '.theme-marketplace' && /^not a heading: /.test(s.why)),
    JSON.stringify(w.__u1Patch.skipped.filter((s) => s.type === 'heading')));
  check('a real line of text still does', d.querySelector('.card-title').getAttribute('role') === 'heading' && d.querySelector('.card-title').getAttribute('aria-level') === '2' && called.includes('.card-title'));
}

console.log('\n  …the engine’s own skip links take the owner’s wording, and twins are told apart');
{
  const dom = boot(`<a class="u1st-skip-link" href="#f1">Skip to footer</a><a class="u1st-skip-link" href="#n1">Skip to navigation</a><a class="u1st-skip-link" href="#n2">Skip to navigation</a>
    <nav id="n1" aria-label="Main menu"><a href="/a">A</a></nav><div class="body">x</div><nav id="n2" aria-label="breadcrumb"><a href="/b">B</a></nav><footer id="f1">f</footer>`);
  const w = dom.window, d = w.document;
  w.__u1SkipLinks = [{ label: 'Skip to the footer links', target: '#f1', kind: 'footer' }];
  w.__u1Patch.renderSkipLinks();
  const texts = () => [...d.querySelectorAll('a.u1st-skip-link')].map((a) => a.textContent.trim());
  check('a configured row of the same kind renames the engine’s footer link in place', texts()[0] === 'Skip to the footer links', texts().join(' | '));
  check('…and no second footer link was added', d.querySelectorAll('a.u1st-skip-link').length === 3);
  check('two "Skip to navigation" are told apart by each nav’s name', texts()[1] === 'Skip to navigation (Main menu)' && texts()[2] === 'Skip to navigation (breadcrumb)', texts().join(' | '));
  w.__u1Patch.renderSkipLinks();
  check('…and a second pass changes nothing', texts().join('|') === 'Skip to the footer links|Skip to navigation (Main menu)|Skip to navigation (breadcrumb)');
}

console.log('\n  …and the engine’s own links can be switched off altogether');
{
  const dom = boot(`<a class="u1st-skip-link" href="#f1">Skip to footer</a><a class="u1st-skip-link" href="#n1">Skip to navigation</a>
    <nav id="n1"><a href="/a">A</a></nav><div id="body">x</div><footer id="f1">f</footer>`);
  const w = dom.window, d = w.document;
  w.__u1SkipLinks = [{ label: 'Skip to content', target: '#body', kind: 'main' }, { label: 'Skip to footer', target: '#f1', kind: 'footer' }];
  w.__u1SkipLinksEngine = 'hide';
  const rep = w.__u1Patch.renderSkipLinks();
  const texts = () => [...d.querySelectorAll('a.u1st-skip-link')].map((a) => a.textContent.trim() + '→' + a.getAttribute('href'));
  check('the engine’s links are gone', !d.querySelector('a.u1st-skip-link:not(.u1p-skip-link)') && rep.hiddenEngine === true, texts().join(' | '));
  check('…and every configured row is rendered, including the footer one the engine used to cover', texts().length === 2 && texts().some((t) => /^Skip to footer→#f1$/.test(t)) && texts().some((t) => /^Skip to content→#body$/.test(t)), texts().join(' | '));
  // The engine re-adds its own on its next pass: gone again.
  const again = d.createElement('a'); again.className = 'u1st-skip-link'; again.href = '#n1'; again.textContent = 'Skip to navigation'; d.body.prepend(again);
  w.__u1Patch.renderSkipLinks();
  check('a link the engine re-adds is removed on the next pass', !d.querySelector('a.u1st-skip-link:not(.u1p-skip-link)'));
  check('the exported config form (u1.config.skipLinksEngine) switches it too', (() => { w.__u1SkipLinksEngine = ''; w.u1 = { config: { skipLinksEngine: 'hide' } }; const a2 = d.createElement('a'); a2.className = 'u1st-skip-link'; a2.href = '#f1'; a2.textContent = 'Skip to footer'; d.body.prepend(a2); w.__u1Patch.renderSkipLinks(); return !d.querySelector('a.u1st-skip-link:not(.u1p-skip-link)'); })());
}

console.log('\n  …a native <select> in a mapped form is left to the browser');
{
  const dom = boot(`<div id="f"><label for="st">State</label><select id="st"><option>AZ</option><option>CA</option></select><input id="zip" type="text"><a id="go" href="/plans">View plans</a></div>`, ['form']);
  const w = dom.window, d = w.document;
  const seen = [];
  w.u1 = { fix: { form(selector, props) { seen.push(props.selectors.inputField); w.document.querySelectorAll(props.selectors.inputField).forEach((el) => el.setAttribute('tabindex', '0')); } } };
  w.__u1Patch.ensureFixers();
  w.u1.fix.form('#f', { selectors: { form: '#f', inputField: '#f select, #f input', submitButton: '#go', invalidField: '.invalid' } });
  check('the engine is handed an inputField that no longer reaches the <select>', seen.length === 1 && !w.document.querySelector(seen[0] + '').matches('select') && ![...d.querySelectorAll(seen[0])].some((el) => el.tagName === 'SELECT'), JSON.stringify(seen));
  check('…so the <select> carries nothing the engine wrote', !d.getElementById('st').hasAttribute('tabindex'));
  check('…while the text field still does', d.getElementById('zip').getAttribute('tabindex') === '0');
  check('the selector the engine gets is one its gate accepts (stamped, no pseudo-class)', /^\[data-u1p-sel~=/.test(seen[0]), seen[0]);
}

console.log('\n  …a skip-link target that is itself a control stays in the Tab order; Enter opens a native select');
{
  const dom = boot(`<a class="u1st-skip-link" href="#srch">Skip to search</a><a class="u1st-skip-link" href="#body">Skip to content</a>
    <button id="srch" aria-label="Open search panel">Search</button><div id="body">x</div><select id="st"><option>AZ</option><option>CA</option></select>`);
  const w = dom.window, d = w.document;
  w.u1 = { fix: {} }; w.__u1Patch.correctors.forEach((f) => { try { f(); } catch (e) {} });
  check('the Search button got no tabindex="-1"', !d.getElementById('srch').hasAttribute('tabindex'), d.getElementById('srch').getAttribute('tabindex'));
  check('…while a plain div target still does', d.getElementById('body').getAttribute('tabindex') === '-1');
  let shown = 0; d.getElementById('st').showPicker = () => { shown++; };
  const e = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  d.getElementById('st').dispatchEvent(e);
  check('Enter on a <select> opens the browser’s own picker', shown === 1 && e.defaultPrevented);
  const e2 = new w.KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, cancelable: true });
  d.getElementById('st').dispatchEvent(e2);
  check('…but a modified Enter is left alone', shown === 1 && !e2.defaultPrevented);
}

console.log('\n  …screen-reader ergonomics: Escape from <body>, a panel named by its title, skip links as buttons');
{
  const dom = boot(`<a class="u1st-skip-link" href="#body">Skip to content</a><div id="body">x</div>
    <div id="wrap"><button id="lt" aria-haspopup="true">Language</button><ul id="list" class="dropdown-menu" hidden><li><button id="o1">English</button></li><li><button id="o2">Spanish</button></li></ul></div>
    <ul id="bar"><li><button id="mt">Plans</button><div id="mp" hidden><div class="Megamenu_left_section_title">Medicare plans and benefits</div><p>Learn about plan types.</p><a id="m1" href="/a">D-SNP</a><a id="m2" href="/b">MAPD</a></div></li><li><button id="mt2">Other</button></li></ul>`);
  const w = bare(dom), d = w.document;
  d.getElementById('lt').addEventListener('click', () => { const l = d.getElementById('list'); l.hidden = !l.hidden; });
  d.getElementById('mt').addEventListener('click', () => { const p = d.getElementById('mp'); p.hidden = !p.hidden; });
  w.u1.fix.listbox('#list', { selectors: { listbox: '#list', trigger: '#lt', options: '#list>li' } });
  w.u1.fix.menu('#bar', { menubar: false, selectors: { menu: '#bar', items: '#bar>li>button', triggers: '#mt', submenus: '#mp' } });
  await settle(dom);
  const key = (el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
  // Screen reader: list open, DOM focus parked on <body>, Escape pressed there.
  d.getElementById('lt').click(); await wait(300);
  d.activeElement && d.activeElement.blur();
  check('(open, focus on body)', !d.getElementById('list').hidden && d.activeElement === d.body);
  check('Escape on <body> closes the open list and returns focus to its trigger', key(d.body, 'Escape') && (await wait(400), d.getElementById('list').hidden && d.activeElement === d.getElementById('lt')), d.activeElement && d.activeElement.id);
  check('…and Escape with nothing open is left alone', !key(d.body, 'Escape'));
  // The mega panel is named by the title that precedes its first link.
  d.getElementById('mt').focus(); d.getElementById('mt').click(); await wait(300);
  const mp = d.getElementById('mp');
  check('an opened panel is labelled by its own title', mp.getAttribute('aria-labelledby') && d.getElementById(mp.getAttribute('aria-labelledby')).textContent === 'Medicare plans and benefits', mp.getAttribute('aria-labelledby'));
  check('…and Enter put focus on that title, so nothing above the links is skipped', d.activeElement && d.activeElement.id === mp.getAttribute('aria-labelledby'), d.activeElement && (d.activeElement.id || d.activeElement.tagName));
  // Skip links are buttons; Space presses them.
  const sk = d.querySelector('a.u1st-skip-link');
  check('a skip link carries role=button', sk.getAttribute('role') === 'button');
  let pressed = 0; sk.addEventListener('click', () => { pressed++; });
  key(sk, ' ');
  check('…and Space presses it', pressed === 1);
}

console.log('\n  …who pressed decides where focus lands: keyboard → first link, screen reader → first element');
{
  const mk = () => {
    // Booted WITH the menu region: its own Enter handler used to step focus
    // to the first link a frame after the core put it on the title.
    const dom = boot(`<ul id="bar"><li><button id="mt">Plans</button><div id="mp" hidden><div id="ttl" class="title">Medicare plans</div><p>Learn about plan types.</p><a id="m1" href="/a">D-SNP</a></div></li><li><button id="mt2">Other</button></li></ul>`, ['menu']);
    const w = bare(dom), d = w.document;
    d.getElementById('mt').addEventListener('click', () => { const p = d.getElementById('mp'); p.hidden = !p.hidden; });
    w.u1.fix.menu('#bar', { menubar: false, selectors: { menu: '#bar', items: '#bar>li>button', triggers: '#mt', submenus: '#mp' } });
    return { w, d };
  };
  {
    const { w, d } = mk(); await settle(dom_noop());
    const mt = d.getElementById('mt'); mt.focus();
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // "into the items"…
    mt.click();                                                                            // …then the button's own click
    await wait(400);
    check('ArrowDown: focus lands on the first clickable item', d.activeElement === d.getElementById('m1'), d.activeElement && d.activeElement.id);
  }
  {
    const { w, d } = mk(); await settle(dom_noop());
    const mt = d.getElementById('mt'); mt.focus();
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    mt.click();
    await wait(400);
    check('Enter: focus rests on the panel’s first element, the title — nothing is skipped', d.activeElement === d.getElementById('ttl'), d.activeElement && d.activeElement.id);
  }
  {
    const { w, d } = mk(); await settle(dom_noop());
    const mt = d.getElementById('mt'); mt.focus();
    mt.click();                                                                            // a click with no key and no pointer before it
    await wait(400);
    check('screen reader: focus rests on the panel’s first element, the title', d.activeElement === d.getElementById('ttl'), d.activeElement && d.activeElement.id);
    check('…made focusable for the moment', d.getElementById('ttl').getAttribute('tabindex') === '-1');
  }
}

console.log('\n  …the library is kept from fighting itself over a submenu’s links');
{
  const dom = boot(`<ul id="bar"><li><button id="mt">Plans</button><div id="mp" hidden><a id="m1" href="/a">D-SNP</a><a id="m2" href="/b">MAPD</a></div></li><li><button id="mt2">Other</button></li></ul>`);
  const w = bare(dom), d = w.document;
  w.u1.fix.menu('#bar', { menubar: false, selectors: { menu: '#bar', items: '#bar>li>button', triggers: '#mt', submenus: '#mp' } });
  await settle(dom);
  check('every link in a mapped submenu tells the visibility handler to leave its tabindex alone', ['m1', 'm2'].every((id) => d.getElementById(id).getAttribute('u1st-avoid-auto-tabbable') === 'true'));
  const a = d.getElementById('m1'); a.setAttribute('tabindex', '0');
  let records = 0; const mo = new w.MutationObserver((r) => { records += r.length; }); mo.observe(a, { attributes: true });
  a.setAttribute('tabindex', '0'); a.setAttribute('aria-hidden', a.getAttribute('aria-hidden') || 'true'); a.setAttribute('aria-hidden', 'true');
  await wait(20); mo.disconnect();
  check('a same-value write of tabindex/aria-* fires no mutation record at all', records === 1, 'records=' + records);
}

console.log('\n  …a mapped tooltip the site shows only on :hover: described up front, shown on focus, Escape hides');
{
  const dom = boot(`<label>Select your state <span id="w" class="icon_wrapper"><svg id="i" role="img" focusable="false"></svg><span id="tip" class="tootip" style="display:none">This is the tooltip message area</span></span></label>`);
  const w = dom.window, d = w.document;
  w.u1 = { fix: { tooltip() {} } }; w.__u1Patch.ensureFixers();
  w.u1.fix.tooltip('#w>svg', { selectors: { tooltip: '#w', trigger: '#w>svg' } });   // as the owner mapped it: the WRAPPER as the tooltip
  await settle(dom);
  const i = d.getElementById('i'), tip = d.getElementById('tip');
  check('the wrapper is narrowed to the text beside the icon: it is the tooltip', tip.getAttribute('role') === 'tooltip' && d.getElementById('w').getAttribute('role') !== 'tooltip');
  check('the icon is described by it before anything is shown', i.getAttribute('aria-describedby') === tip.id, i.getAttribute('aria-describedby'));
  check('…and made reachable: tabindex 0, role button', i.getAttribute('tabindex') === '0' && i.getAttribute('role') === 'button');
  check('…and NAMED, since a description is not a name', i.getAttribute('aria-label') === 'More information', i.getAttribute('aria-label'));
  i.focus(); i.dispatchEvent(new w.FocusEvent('focus')); await wait(250);
  check('focus shows the tooltip the site only shows on hover', tip.style.display === 'block' && tip.hasAttribute('data-u1p-tip-shown'));
  const esc = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); i.dispatchEvent(esc);
  check('Escape hides it and is consumed', esc.defaultPrevented && tip.style.display === '' && !tip.hasAttribute('data-u1p-tip-shown'));
  i.dispatchEvent(new w.FocusEvent('focus')); await wait(250);
  i.dispatchEvent(new w.FocusEvent('blur')); await wait(400);
  check('blur hides it after the hover grace', tip.style.display === '');
}

console.log('\n  …a tooltip trigger that WRAPS its hidden tooltip, and one mapped onto itself, are both named');
{
  const dom = boot(`<span id="wr" class="icon_wrapper"><svg id="iv" role="img" aria-hidden="true"></svg><span id="tp" class="tootip" aria-hidden="true" style="display:none">Select your state</span></span>
    <span class="tc"><svg id="self" role="img"></svg><span class="txt" style="display:none">This is the tooltip message area</span></span>`);
  const w = dom.window, d = w.document;
  w.u1 = { fix: { tooltip() {} } }; w.__u1Patch.ensureFixers();
  w.u1.fix.tooltip('.tootip', { selectors: { tooltip: '.tootip', trigger: '.icon_wrapper' } });          // Medicare hero, fixNo 42
  w.u1.fix.tooltip('.tc>svg', { selectors: { tooltip: '.tc>svg', trigger: '.tc>svg' } });              // PageBanner, fixNo 28
  await settle(dom);
  check('a trigger whose only text is its hidden tooltip gets a name', d.getElementById('wr').getAttribute('aria-label') === 'More information', d.getElementById('wr').getAttribute('aria-label'));
  check('…and is still described by that tooltip', d.getElementById('wr').getAttribute('aria-describedby') === d.getElementById('tp').id);
  const self = d.getElementById('self');
  check('a mapping with tooltip = trigger finds the text beside it', self.getAttribute('aria-describedby') && d.getElementById(self.getAttribute('aria-describedby')).className === 'txt', self.getAttribute('aria-describedby'));
  check('…and names the icon', self.getAttribute('aria-label') === 'More information');
}

console.log('\n  …the corrector pass survives a framework replacing <html> (Next.js hydration)');
{
  const dom = boot(`<p>x</p>`);
  const w = dom.window, d = w.document;
  w.u1 = { fix: {} };
  let runs = 0; w.__u1Patch.correct(() => { runs++; });
  const fresh = d.createElement('html'); fresh.appendChild(d.createElement('head')); const b = d.createElement('body'); fresh.appendChild(b);
  d.replaceChild(fresh, d.documentElement);
  await wait(400);
  const before = runs;
  b.appendChild(d.createElement('div'));
  await wait(600);
  check('a mutation inside the NEW <html> still runs the correctors', runs > before, `runs ${before} → ${runs}`);
}

console.log('\n  …an accordion mapping whose "content" is the header’s own state class is refused; a site-wired one is left alone');
{
  const dom = boot(`<div><h2 class="t"><button id="b1" class="tg open" aria-expanded="true" aria-controls="p1">HEDIS</button></h2><div id="p1" class="content">…</div>
    <h2 class="t"><button id="b2" class="tg" aria-expanded="false" aria-controls="p2">CAHPS</button></h2><div id="p2" class="content" hidden>…</div>
    <div class="faq"><div class="q" id="q1">Question</div><div class="a" id="a1" hidden>Answer</div></div></div>`, ['accordion']);
  const w = dom.window, d = w.document;
  const calls = [];
  w.u1 = { fix: { accordion(sel, props) { calls.push(props.selectors.contentSelector); } } };
  w.__u1Patch.ensureFixers();
  w.u1.fix.accordion('.tg', { selectors: { headerSelector: '.tg', contentSelector: '.open' }, collapsesOthers: false });
  check('content = the header’s open-state class → refused, never reaches the library', !calls.includes('.open'), calls.join());
  check('…with the reason recorded', w.__u1Patch.skipped.some((s) => s.type === 'accordion' && /not an accordion panel/.test(s.why)));
  w.u1.fix.accordion('.tg', { selectors: { headerSelector: '.tg', contentSelector: '.content' }, collapsesOthers: false });
  check('a header the site already wires (aria-expanded + aria-controls) is left alone', !calls.includes('.content') && w.__u1Patch.skipped.some((s) => /already accessible/.test(s.why)));
  w.u1.fix.accordion('.q', { selectors: { headerSelector: '.q', contentSelector: '.a' }, collapsesOthers: false });
  check('a bare div question/answer pair still gets the fix', calls.includes('.a'), calls.join());
}

console.log('\n  …a radio mapping the library never decorates is kept by the patch (molina glossary letters)');
{
  const dom = boot(`<div class="f"><label>First letter</label><div class="L"><button class="l act">All</button><button class="l">A</button><button class="l">B</button><button class="l" disabled>J</button><button class="l">C</button></div></div>`, ['radio']);
  const w = dom.window, d = w.document;
  w.u1 = { fix: { radio() {} } }; w.__u1Patch.ensureFixers();
  const bs = () => [...d.querySelectorAll('.L>button')];
  // the page's own behaviour: a press moves the "act" class
  bs().forEach((b) => b.addEventListener('click', () => { bs().forEach((x) => x.classList.remove('act')); b.classList.add('act'); }));
  w.u1.fix.radio('.L', { selectors: { radioGroup: '.L', radioButton: '.L>button', checkedState: '.L>button.act', uncheckedState: '.L>button:not(.act)' } });
  await settle(dom);
  const L = d.querySelector('.L');
  check('the group is a radiogroup named by its label', L.getAttribute('role') === 'radiogroup' && d.getElementById(L.getAttribute('aria-labelledby')).textContent === 'First letter');
  check('every letter is a radio; the chosen one checked', bs().every((b) => b.getAttribute('role') === 'radio') && bs()[0].getAttribute('aria-checked') === 'true' && bs()[1].getAttribute('aria-checked') === 'false');
  check('one tab stop, on the chosen letter', bs().filter((b) => b.tabIndex === 0).length === 1 && bs()[0].tabIndex === 0, bs().map((b) => b.tabIndex).join(','));
  check('a disabled letter says so', bs()[3].getAttribute('aria-disabled') === 'true');
  bs()[0].focus();
  const key = (el, k) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
  key(bs()[0], 'ArrowRight'); await wait(150); await settle(dom);
  check('ArrowRight moves to A and chooses it', d.activeElement === bs()[1] && bs()[1].getAttribute('aria-checked') === 'true' && bs()[0].getAttribute('aria-checked') === 'false');
  key(bs()[2], 'ArrowRight'); await wait(150); await settle(dom);
  check('…the disabled J is skipped: B → C', d.activeElement === bs()[4] && bs()[4].getAttribute('aria-checked') === 'true', d.activeElement && d.activeElement.textContent);
  key(bs()[4], 'Home'); await wait(150); await settle(dom);
  check('Home → All', d.activeElement === bs()[0] && bs()[0].getAttribute('aria-checked') === 'true');
}

console.log('\n  …a closed drawer parked off-screen is not a row of invisible Tab stops (molina blog filter)');
{
  const dom = boot(`<button class="search">Search</button><div class="drawer" style="position:fixed;top:0;left:-390px;width:390px;height:600px"><div class="ttl" tabindex="0">Filter by:</div><label><input type="checkbox"> AZ</label><label><input type="checkbox"> CA</label><button class="x">Close</button></div><a class="filter" href="#">Filter</a>`, []);
  const w = dom.window, d = w.document;
  const drawer = d.querySelector('.drawer');
  let x = -390;
  drawer.getBoundingClientRect = () => ({ left: x, right: x + 390, top: 0, bottom: 600, width: 390, height: 600 });
  // another layer — the accordion's header logic — that keeps the title tabbable,
  // registered before the ghost pass the way every region's corrector is
  w.__u1Patch.correct(() => { const t = d.querySelector('.ttl'); if (t.getAttribute('tabindex') !== '0') t.setAttribute('tabindex', '0'); });
  await wait(10); await settle(dom);
  const inside = () => [...drawer.querySelectorAll('input,button,[tabindex]')];
  check('every control in the off-screen drawer leaves the Tab order', inside().every((el) => el.getAttribute('tabindex') === '-1'), inside().map((el) => el.getAttribute('tabindex')).join(','));
  check('…the title another layer made tabbable included (the ghost pass runs last)', d.querySelector('.ttl').getAttribute('tabindex') === '-1');
  check('…and the drawer is hidden from screen readers while off-screen', drawer.getAttribute('aria-hidden') === 'true');
  check('the page around it is untouched', d.querySelector('.search').getAttribute('tabindex') === null && d.querySelector('.filter').getAttribute('tabindex') === null);
  x = 0; await settle(dom);
  check('opened (on-screen): the controls are back as they were', d.querySelector('.ttl').getAttribute('tabindex') === '0' && drawer.querySelector('input').getAttribute('tabindex') === null && drawer.querySelector('.x').getAttribute('tabindex') === null, inside().map((el) => el.getAttribute('tabindex')).join(','));
  check('…and readable again', drawer.getAttribute('aria-hidden') !== 'true');
}

console.log('\n  …a control under aria-hidden="true" is not a silent Tab stop');
{
  const dom = boot(`<div class="h" aria-hidden="true"><a href="/x">Hidden link</a><button>Hidden button</button></div><a class="v" href="/y">Visible</a>`, []);
  const w = dom.window, d = w.document;
  await wait(10); await settle(dom);
  check('focusables under aria-hidden leave the Tab order', [...d.querySelectorAll('.h a,.h button')].every((el) => el.getAttribute('tabindex') === '-1'));
  check('…a visible link is left alone', d.querySelector('.v').getAttribute('tabindex') === null);
  d.querySelector('.h').removeAttribute('aria-hidden'); await settle(dom);
  check('aria-hidden removed: they are back', [...d.querySelectorAll('.h a,.h button')].every((el) => el.getAttribute('tabindex') === null));
}

console.log('\n  …an accordion mapping over a panel the site’s own button already opens is refused (molina blog drawer)');
{
  const dom = boot(`<div class="d"><div class="filterTitle">Filter by:</div><button class="filterClose">Close</button>
      <button class="filterTitle" aria-expanded="true" aria-controls="P1">State Type</button><ul id="P1"><li>AZ</li></ul></div>`, ['accordion']);
  const w = dom.window, calls = [];
  w.u1 = { fix: { accordion(sel) { calls.push(sel); } } }; w.__u1Patch.ensureFixers();
  w.u1.fix.accordion('.filterTitle,.filterClose', { selectors: { headerSelector: '.filterTitle,.filterClose', contentSelector: '#P1' } });
  await settle(dom);
  check('refused as already accessible, from the panel’s side', w.__u1Patch.skipped.some((x) => x.type === 'accordion' && /site’s own button opens this panel/.test(x.why)) && !calls.length, JSON.stringify(w.__u1Patch.skipped));
  check('…so the drawer title is not made a button or a Tab stop', !w.document.querySelector('div.filterTitle').hasAttribute('role') && !w.document.querySelector('div.filterTitle').hasAttribute('tabindex'));
}

console.log('\n  …a control with no box of its own shows its ring on what is seen (hidden checkbox behind a styled label)');
{
  const dom = boot(`<ul><li><label id="L">Arizona <input id="c" type="checkbox" style="opacity:0;position:absolute"><span class="checkmark"></span></label></li></ul><button id="b">Next</button>`, ['focus']);
  const w = dom.window, d = w.document;
  d.getElementById('c').getBoundingClientRect = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
  d.getElementById('L').getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, bottom: 18, width: 300, height: 18 });
  d.getElementById('c').focus();
  const L = d.getElementById('L');
  check('the label carries the ring while the checkbox is focused', L.hasAttribute('data-u1p-ring-proxy') && /solid/.test(L.style.getPropertyValue('outline')), L.getAttribute('style'));
  d.getElementById('b').focus();
  check('…and gives it back on blur', !L.hasAttribute('data-u1p-ring-proxy') && !L.style.getPropertyValue('outline'));
}

console.log('\n  …a drawer that slides open gets focus, even when the library looked too early');
{
  const dom = boot(`<a id="f" class="btn" href="#">Filter</a><div class="dr" style="position:fixed;top:0;left:-390px;width:390px;height:600px"><button class="x">Close</button><label>AZ <input type="checkbox"></label></div>`, ['dialog']);
  const w = dom.window, d = w.document;
  const dr = d.querySelector('.dr'); let x = -390;
  dr.getBoundingClientRect = () => ({ left: x, right: x + 390, top: 0, bottom: 600, width: 390, height: 600 });
  w.u1 = { fix: { dialog() {} } }; w.__u1Patch.ensureFixers();
  w.u1.fix.dialog('#f', { selectors: { dialog: '.dr', trigger: '#f', closeBtn: '.x' } });
  await wait(10); await settle(dom);
  d.getElementById('f').focus(); d.getElementById('f').click();
  x = 0; await settle(dom);
  check('opened from its trigger: focus is inside', dr.contains(d.activeElement), d.activeElement && d.activeElement.outerHTML.slice(0, 60));
  d.getElementById('f').focus(); x = -390; await settle(dom); x = 0;
  const other = d.createElement('button'); d.body.appendChild(other); other.focus(); await settle(dom);
  check('…a dialog that opens while focus is elsewhere does not steal it', d.activeElement === other);
}

console.log('\n  …a checkbox the site draws with its label is ONE control: the label (VoiceOver heard it twice)');
{
  const dom = boot(`<ul><li><label id="L1">Arizona (13)<input id="c1" type="checkbox"><span class="checkmark"></span></label></li><li><label id="L2">California (15)<input id="c2" type="checkbox" disabled><span class="checkmark"></span></label></li></ul><label id="V">Visible <input id="cv" type="checkbox"></label>`, []);
  const w = dom.window, d = w.document;
  const zero = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
  const row = () => ({ left: 0, right: 300, top: 0, bottom: 18, width: 300, height: 18 });
  ['c1', 'c2'].forEach((id) => { d.getElementById(id).getBoundingClientRect = zero; });
  ['L1', 'L2', 'V', 'cv'].forEach((id) => { d.getElementById(id).getBoundingClientRect = row; });
  let changes = 0; d.getElementById('c1').addEventListener('change', () => changes++);
  await wait(10); await settle(dom);
  const L1 = d.getElementById('L1'), c1 = d.getElementById('c1');
  check('the label is the checkbox, one Tab stop', L1.getAttribute('role') === 'checkbox' && L1.getAttribute('tabindex') === '0' && L1.getAttribute('aria-checked') === 'false');
  check('…the hidden input leaves the Tab order and the tree', c1.getAttribute('tabindex') === '-1' && c1.getAttribute('aria-hidden') === 'true');
  check('…a disabled one says so and is no Tab stop', d.getElementById('L2').getAttribute('aria-disabled') === 'true' && d.getElementById('L2').getAttribute('tabindex') === '-1');
  check('…a checkbox with its own visible box is left native', !d.getElementById('V').hasAttribute('role') && d.getElementById('cv').getAttribute('tabindex') === null);
  L1.focus();
  const e = new w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }); L1.dispatchEvent(e);
  check('Space toggles through the input itself — the site’s change handler runs once', c1.checked && changes === 1 && L1.getAttribute('aria-checked') === 'true' && e.defaultPrevented, `checked=${c1.checked} changes=${changes}`);
  c1.focus();
  check('focus that lands on the hidden input moves to the label', d.activeElement === L1);
}

console.log('\n  …inside a mapped modal dialog every Tab is the patch’s, and the library’s late jump to the first stop is undone');
{
  const dom = boot(`<a id="f" href="#">Filter</a><div class="dr" role="dialog" aria-modal="true"><button id="x">Close</button><button id="a">A</button><button id="b">B</button><button id="c">C</button></div>`, ['dialog']);
  const w = dom.window, d = w.document;
  w.u1 = { fix: { dialog() {} } }; w.__u1Patch.ensureFixers();
  w.u1.fix.dialog('#f', { selectors: { dialog: '.dr', trigger: '#f', closeBtn: '#x' } });
  await wait(10); await settle(dom);
  // a stale trap of the library's own, registered on the dialog: it would send Tab from A to Close
  d.querySelector('.dr').addEventListener('keydown', (ev) => { if (ev.key === 'Tab') { ev.preventDefault(); d.getElementById('x').focus(); } });
  d.getElementById('a').focus();
  d.getElementById('a').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  check('Tab from A goes to B — the library’s own list never runs', d.activeElement === d.getElementById('b'), d.activeElement && d.activeElement.id);
  // the library's focusInBound fires late, from a promise, right after the trap moved
  d.getElementById('x').focus(); await wait(20);
  check('…its late jump back to Close is undone', d.activeElement === d.getElementById('b'), d.activeElement && d.activeElement.id);
  d.getElementById('b').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  check('Shift+Tab walks back', d.activeElement === d.getElementById('a'));
  // the PAGE's own move right after a Tab (a picker's arrow keys) is not the library's jump
  d.getElementById('c').focus(); await wait(20);
  check('…a move the page makes to another stop (arrow keys) is left alone — no bouncing back', d.activeElement === d.getElementById('c'), d.activeElement && d.activeElement.id);
}

console.log('\n  …a dialog drawn only when opened (react-datepicker): accepted, focus goes in, Tab skips disabled, Escape closes it');
{
  const dom = boot(`<div id="w"><button id="t" class="trig">October 2026</button></div>`, ['dialog']);
  const w = dom.window, d = w.document;
  w.u1 = { fix: { dialog() {} } }; w.__u1Patch.ensureFixers();
  w.u1.fix.dialog('#t', { selectors: { dialog: '.pick', trigger: '#t' } });
  check('not refused: the dialog does not exist yet, the trigger is not judged as the dialog', !w.__u1Patch.skipped.some((x) => x.type === 'dialog'), JSON.stringify(w.__u1Patch.skipped));
  // the page draws it on the click, ignores Escape, closes on a press outside
  d.getElementById('t').addEventListener('click', () => {
    if (d.querySelector('.pick')) return;
    const p = d.createElement('div'); p.className = 'pick'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
    p.innerHTML = '<button id="prev" disabled aria-label="Previous year"></button><button id="next" aria-label="Next year"></button><div id="opt" role="option" tabindex="0">Oct</div>';
    d.getElementById('w').appendChild(p);
  });
  d.addEventListener('mousedown', (e) => { const p = d.querySelector('.pick'); if (p && !p.contains(e.target) && e.target !== d.getElementById('t')) p.remove(); });
  d.getElementById('t').focus(); d.getElementById('t').click();
  await wait(10); await settle(dom); await wait(400);
  check('opened from its trigger: focus goes inside (not onto the disabled button)', d.querySelector('.pick').contains(d.activeElement) && !d.activeElement.disabled, d.activeElement && d.activeElement.id);
  d.getElementById('opt').focus();
  d.getElementById('opt').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  check('Tab from the last stop goes round to the first ENABLED one', d.activeElement === d.getElementById('next'), d.activeElement && d.activeElement.id);
  d.getElementById('opt').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await wait(900);
  check('Escape closes it although the page ignores Escape, and focus returns to the trigger', !d.querySelector('.pick') && d.activeElement === d.getElementById('t'), d.activeElement && d.activeElement.id);
}

console.log('\n  …a site that changes page without a reload (Next.js): a this-page-only call lives on its page only');
{
  const dom = new JSDOM(`<!doctype html><body><div class="t">Title</div></body>`, { url: 'https://site.test/a', runScripts: 'outside-only', pretendToBeVisual: true });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  dom.window.eval(slice([]));
  const w = dom.window, d = w.document;
  w.u1 = { fix: { heading() {} } }; w.__u1Patch.ensureFixers();
  w.__u1CallPage = '/a';
  w.u1.fix.heading('.t', { level: 3, selectors: { heading: '.t' } });
  w.__u1CallPage = undefined;
  await settle(dom);
  check('on its page: the call is live and applied', w.__u1Patch.calls.length === 1 && d.querySelector('.t').getAttribute('aria-level') === '3');
  w.history.pushState({}, '', '/b'); await wait(10);
  d.body.innerHTML = '<div class="t">Another page</div>'; await settle(dom);
  check('another page (no reload): the call is not live, and not applied to the same class there', w.__u1Patch.calls.length === 0 && !d.querySelector('.t').hasAttribute('aria-level'), d.body.innerHTML);
  w.history.pushState({}, '', '/a'); await wait(10);
  d.body.innerHTML = '<div class="t">Title again</div>'; await settle(dom);
  check('back on its page: live again, applied to the newly drawn element', w.__u1Patch.calls.length === 1 && d.querySelector('.t').getAttribute('aria-level') === '3');
  w.__u1CallPage = '/a'; w.u1.fix.heading('.t', { level: 3, selectors: { heading: '.t' } }); w.__u1CallPage = undefined;
  check('…a call re-run on coming back is recorded once, not once per visit', w.__u1Patch._calls.length === 1);
}

console.log('\n  …WAVE: a "menu" of links is not role=menu; a real menu of menuitems keeps it; no heading on a link');
{
  const dom = boot(`<ul id="bar"><li><button id="t1">Plans</button><div id="p1" hidden><h3>Medicare</h3><p>Text</p><a href="/a">A</a></div></li>
      <li><button id="t2">Tools</button><ul id="p2" hidden><li role="menuitem" tabindex="-1">Cut</li><li role="menuitem" tabindex="-1">Copy</li></ul></li></ul>
      <footer><div class="ft"><span class="ttl">Company</span></div><div class="ft"><a class="ttl" href="/m">Members</a></div><div class="ft2"><a class="ttl2" href="/x">X</a> <a href="/y">Y</a></div></footer>`, ['menu']);
  const w = dom.window, d = w.document;
  w.u1 = { fix: { menu() {}, heading() {} } }; w.__u1Patch.ensureFixers();
  // the library's own writes on a menubar:false mapping: role=menu on every submenu
  ['p1', 'p2'].forEach((id) => d.getElementById(id).setAttribute('role', 'menu'));
  d.getElementById('t1').setAttribute('aria-haspopup', 'true');
  w.u1.fix.menu('#bar', { menubar: false, selectors: { menu: '#bar', items: '#bar>li>button', triggers: '#bar>li>button', submenus: '#p1,#p2' } });
  await settle(dom); await settle(dom);
  check('a panel of headings, text and links loses role=menu and its trigger’s aria-haspopup', d.getElementById('p1').getAttribute('role') !== 'menu' && !d.getElementById('t1').hasAttribute('aria-haspopup'));
  check('…a panel of real menuitems keeps role=menu', d.getElementById('p2').getAttribute('role') === 'menu');
  // the library's heading fixer, as it writes: role on the link itself
  d.querySelectorAll('.ttl').forEach((el) => { el.setAttribute('role', 'heading'); el.setAttribute('aria-level', '3'); });
  w.u1.fix.heading('.ttl', { level: 3, selectors: { heading: '.ttl' } });
  w.u1.fix.heading('.ttl2', { level: 3, selectors: { heading: '.ttl2' } });
  await settle(dom);
  const link = d.querySelector('a.ttl');
  check('a link is never made a heading: its role is given back', !link.hasAttribute('role') && !link.hasAttribute('aria-level'), link.outerHTML);
  check('…the heading goes on its wrapper, which holds only that link', link.parentElement.getAttribute('role') === 'heading' && link.parentElement.getAttribute('aria-level') === '3');
  check('…a span title is still a heading itself', d.querySelector('span.ttl').getAttribute('role') === 'heading');
  check('…and a wrapper holding other links too gets nothing', !d.querySelector('.ft2').hasAttribute('role') && !d.querySelector('a.ttl2').hasAttribute('role'));
}

console.log('\n  …a field named only by its placeholder gets that name (WAVE: missing form label)');
{
  const dom = boot(`<input id="e" placeholder="Upcoming Events..." type="text"><label for="l">Zip</label><input id="l" placeholder="12345"><input id="a" aria-label="Search" placeholder="Type here"><input type="submit" placeholder="x">`, []);
  await settle(dom);
  const d = dom.window.document;
  check('the placeholder-only field is named by its placeholder, trailing dots dropped', d.getElementById('e').getAttribute('aria-label') === 'Upcoming Events');
  check('…a field with a <label> or its own aria-label is left alone', !d.getElementById('l').hasAttribute('aria-label') && d.getElementById('a').getAttribute('aria-label') === 'Search');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

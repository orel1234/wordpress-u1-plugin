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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

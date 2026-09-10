// The two manual-only engines in grid-nav.js: hide-from-all and focus-order.
//
//   node scripts/verify-engines-manual.mjs
//
// JSDOM has no layout, so every element is given a box; the logic under test
// is the Tab interception and the attribute writes, not geometry.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import vm from 'node:vm';
const src = readFileSync(new URL('../grid-nav.js', import.meta.url), 'utf8');
const dom = new JSDOM(`<body>
  <a id="before" href="#">before</a>
  <div class="hero"><button id="cta">CTA</button><a id="title" href="#">Title</a><a id="text" href="#">Text</a></div>
  <a id="after" href="#">after</a>
  <div class="logo"><a id="logo" href="/">Logo</a><span tabindex="0" id="inner">x</span></div>
</body>`, { pretendToBeVisual: true });
const w = dom.window;
w.Element.prototype.getBoundingClientRect = function () { return { width: 10, height: 10, left: 0, top: 0, right: 10, bottom: 10 }; };
const ctx = vm.createContext(w);
vm.runInContext(src, ctx);
let fails = 0; const check = (n, ok) => { console.log((ok ? '✅ ' : '❌ ') + n); if (!ok) fails++; };
// hide
const h = w.__u1HideFromAll({ selector: '.logo' });
check('hide: applied to the match', h.ok && h.count === 1);
check('hide: aria-hidden on the element', w.document.querySelector('.logo').getAttribute('aria-hidden') === 'true');
check('hide: tabindex=-1 on focusables inside', w.document.getElementById('logo').getAttribute('tabindex') === '-1' && w.document.getElementById('inner').getAttribute('tabindex') === '-1');
check('hide: original tabindex kept for revert', w.document.getElementById('inner').getAttribute('data-u1-tabindex') === '0');
check('hide: nothing matches → not ok', w.__u1HideFromAll({ selector: '.nope' }).ok === false);
// focus order: DOM is cta, title, text; wanted title, text, cta
const r = w.__u1FocusOrder({ container: '.hero', order: ['#title', '#text', '#cta'] });
check('order: armed', r.ok && r.count === 3);
const tab = (from, shift) => { from.focus(); const e = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: !!shift, bubbles: true, cancelable: true }); from.dispatchEvent(e); return [w.document.activeElement.id, e.defaultPrevented]; };
const $ = (id) => w.document.getElementById(id);
check('order: entering from before lands on #title (not DOM-first #cta)', tab($('before'))[0] === 'title');
check('order: title → text', tab($('title'))[0] === 'text');
check('order: text → cta', tab($('text'))[0] === 'cta');
check('order: leaving from cta goes to #after', tab($('cta'))[0] === 'after');
check('order: shift+tab from title leaves to #before', tab($('title'), true)[0] === 'before');
check('order: shift+tab from cta goes back to text', tab($('cta'), true)[0] === 'text');
check('order: shift+tab entering from after lands on #cta (set last)', tab($('after'), true)[0] === 'cta');
check('order: Tab elsewhere is untouched', (() => { const e = new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); $('after').focus(); $('after').dispatchEvent(e); return !e.defaultPrevented; })());
check('order: one selector → refused', w.__u1FocusOrder({ container: '.hero', order: ['#title'] }).ok === false);
check('order: from-mapping splits on ;', w.__u1FocusOrderFromMapping('.hero', { order: '#title; #text; #cta' }).ok);
console.log(fails ? `❌ ${fails} failed` : '✅ engine smoke passed'); process.exit(fails ? 1 : 0);

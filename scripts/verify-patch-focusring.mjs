// The focus-ring region of u1-patch: the two corrections it makes, and the
// one thing it must not do — leave anything behind after blur.
//
//   node scripts/verify-patch-focusring.mjs
//
// jsdom has no layout, so display and client rects are stubbed per element.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
const region = /\/\/#region u1-patch:focus\r?\n([\s\S]*?)\r?\n\/\/#endregion/.exec(SRC)[1];

const dom = new JSDOM(`<body>
  <a id="logo" href="/"><img alt="logo"></a>
  <a id="plain" href="/">plain text link</a>
  <button id="sign" aria-expanded="false">Sign In</button>
  <div id="block"><a id="wrapped" href="/">wraps</a></div>
</body>`, { pretendToBeVisual: true });
const w = dom.window;
const display = { logo: 'inline', plain: 'inline', sign: 'inline-block', wrapped: 'inline' };
w.getComputedStyle = (el) => ({ display: display[el.id] || (el.tagName === 'IMG' ? 'inline' : 'block') });
w.Element.prototype.getClientRects = function () { return this.id === 'wrapped' ? [{}, {}] : [{}]; };
const ctx = vm.createContext(w);
w.__u1Patch = {};
vm.runInContext(region, ctx);
const P = w.__u1Patch;

let failed = 0;
const check = (n, ok) => { console.log((ok ? '✅ ' : '❌ ') + n); if (!ok) failed++; };
const $ = (id) => w.document.getElementById(id);
const focus = (el) => { el.focus(); el.dispatchEvent(new w.FocusEvent('focusin', { bubbles: true })); };
const blur = (el) => { el.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true })); el.blur(); };

check('region exposes its decision', typeof P.focusRing.ringIsWrong === 'function');
check('inline <a> around <img>: ring is wrong', P.focusRing.ringIsWrong($('logo')) === true);
check('inline <a> with text only: ring is fine', P.focusRing.ringIsWrong($('plain')) === false);
check('inline <a> wrapping two lines: ring is wrong', P.focusRing.ringIsWrong($('wrapped')) === true);
check('inline-block button: not touched by the inline rule', P.focusRing.ringIsWrong($('sign')) === false);

focus($('logo'));
check('focus on the logo sets U1\'s own hook attribute', $('logo').getAttribute('data-u1-focus-fix') === 'true');
blur($('logo'));
check('blur removes it — nothing left behind', !$('logo').hasAttribute('data-u1-focus-fix'));

focus($('sign'));
check('closed trigger: no inset', $('sign').style.getPropertyValue('outline-offset') === '');
$('sign').setAttribute('aria-expanded', 'true');
P.focusRing.evaluate($('sign'));
check('open trigger: ring drawn inside, as inline !important',
  $('sign').style.getPropertyValue('outline-offset') === '-2px' && $('sign').style.getPropertyPriority('outline-offset') === 'important');
$('sign').setAttribute('aria-expanded', 'false');
P.focusRing.evaluate($('sign'));
check('closed again while focused: inset lifted', $('sign').style.getPropertyValue('outline-offset') === '');
$('sign').setAttribute('aria-expanded', 'true'); P.focusRing.evaluate($('sign'));
blur($('sign'));
check('blur lifts the inset too', $('sign').style.getPropertyValue('outline-offset') === '');

const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
check('the export always ships the focus region (not tied to a mapping type)', /new Set\(\['core', 'focus'\]\)/.test(panelSrc));
check('u1.css really has the hook this relies on (documented in the region)', /\[data-u1-focus-fix\]:focus/.test(region));

console.log(failed ? `\n❌ ${failed} check(s) failed` : '\n✅ verify-patch-focusring passed');
process.exit(failed ? 1 : 0);

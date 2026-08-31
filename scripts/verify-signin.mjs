// The Molina sign-in, pinned as a fixture.
//
// This one widget ate a week: a <button class="clicker"> beside a closed
// <ul role="menu">, inside a wrapper the survey names instead of either. It
// defeated run after run — but every failure turned out to be environmental
// (a frozen rAF, a declined-leftover masquerade, ARIA remnants of earlier
// experiments polluting the page), never the readers themselves. That claim
// was only settled by fetching molinahealthcare.com's real markup and running
// the readers against it — this file keeps that verdict pinned, so a change
// to openedBy or listboxShape that breaks the sign-in shape fails here, on
// the actual HTML, before it costs another week on the live site.
//
// The markup below is copied verbatim from https://www.molinahealthcare.com/
// (fetched 2026-08-31), trimmed to the sign-in corner. Note what it does NOT
// have: no aria-controls, no aria-haspopup, no aria-expanded. Any scan that
// reports those on this widget is reading leftovers, not the site.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(join(ROOT, 'package.json'))('jsdom');
const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');

const dom = new JSDOM(`<!doctype html><html><body>
<div class="container secondary-header rus"><div class="row">
  <div class="col-sm-2 col-lg-2 col-md-2" id="signin">
    <div class="signin">
      <div class="click-nav">
        <button type="button" class="clicker" title="Sign In">Sign In<span></span></button>
        <ul class="signin-dropdown" role="menu">
          <li><a href="https://member.molinahealthcare.com/Member/Login" target="_blank">Member</a></li>
          <li><a href="https://www.availity.com/molinahealthcare/" target="_blank">Health Care Professional</a></li>
        </ul>
      </div>
      <a id="registerURL" target="_blank" class="register" href="https://member.molinahealthcare.com/Member/MemberRegistration">Register</a>
    </div>
  </div>
</div></div>
</body></html>`, { url: 'https://www.molinahealthcare.com/' });

const w = dom.window;
const load = new Function('globalThis',
  `const window = globalThis; const document = globalThis.document; ` +
  `const getComputedStyle = globalThis.getComputedStyle.bind(globalThis); ${INTEL}`);
load(w);
const S = w.__u1SelectorIntel;

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  ' + (extra || '')));
  ok ? pass++ : fail++;
};

console.log('the Molina sign-in, by every name the survey has used for it');
for (const sel of ['.signin', '.click-nav', 'button.clicker', '#signin']) {
  check(`openedBy(${sel}) finds the closed list without a click`,
    S.openedBy(sel) === '.signin-dropdown', JSON.stringify(S.openedBy(sel)));
}

console.log('\nthe shape, read off the wrapper');
const shape = S.listboxShape('.click-nav');
check('the list is the <ul>, not the wrapper and not the button',
  shape && shape.listbox === '.signin-dropdown', JSON.stringify(shape));
check('the trigger is the button that opens it',
  shape && shape.trigger === '.clicker');
check('the options are the things a person activates — the links, not the rows',
  shape && shape.options === '.signin-dropdown>li>a');

console.log('\nwhat the raw page does NOT say');
const t = w.document.querySelector('.clicker');
check('no aria-controls, aria-haspopup or aria-expanded in the real markup — a scan reporting them is reading experiment leftovers',
  !t.hasAttribute('aria-controls') && !t.hasAttribute('aria-haspopup') && !t.hasAttribute('aria-expanded'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

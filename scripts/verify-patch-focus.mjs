// jsdom has no layout, so this cannot test the scrolling itself. What it CAN
// test is the decision: does reveal() leave a settled element alone, and does it
// act on one that is out of view. Rects and scroll calls are stubbed.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
const core = (() => {
  const re = /\/\/#region u1-patch:core\r?\n([\s\S]*?)\r?\n\/\/#endregion/;
  return `'use strict';\n${re.exec(SRC)[1]}`;
})();

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

function run(rect) {
  const dom = new JSDOM(`<!doctype html><body><button id="b">x</button></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, el = dom.window.document.getElementById('b');
  Object.defineProperty(w, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(w, 'innerWidth',  { value: 1000, configurable: true });
  const calls = [];
  el.getBoundingClientRect = () => rect;
  el.scrollIntoView = (o) => calls.push(['scrollIntoView', o]);
  w.scrollBy = (o) => calls.push(['scrollBy', o]);
  w.document.elementFromPoint = () => null;
  w.eval(core);
  el.dispatchEvent(new w.Event('focusin', { bubbles: true }));
  return new Promise((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => r(calls))));
}
const R = (top, height, left = 10, width = 100) =>
  ({ top, height, bottom: top + height, left, width, right: left + width });

console.log('\nfocus reveal');
check('an element fully in view is not touched',
  (await run(R(100, 40))).length === 0);
check('one clipped by the top edge is scrolled',
  (await run(R(-30, 40)))[0]?.[0] === 'scrollIntoView');
check('one below the fold is scrolled',
  (await run(R(900, 40)))[0]?.[0] === 'scrollIntoView');
check('a small element uses block:nearest',
  (await run(R(900, 40)))[0]?.[1]?.block === 'nearest');
check('one taller than the viewport, entirely above the fold, aligns to its TOP',
  (await run(R(-9500, 9000)))[0]?.[1]?.block === 'start',
  JSON.stringify(await run(R(-9500, 9000))));
check('a tall element already showing its top is left alone',
  (await run(R(20, 9000))).length === 0, JSON.stringify(await run(R(20, 9000))));
// Shift+Tab backwards into the bottom of a long panel must not yank to its top.
check('a tall element showing only its BOTTOM is left alone',
  (await run(R(-8500, 9000))).length === 0, JSON.stringify(await run(R(-8500, 9000))));

console.log('\nsticky header');
{
  const dom = new JSDOM(`<!doctype html><body><header id="h">H</header><button id="b">x</button></body>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, el = w.document.getElementById('b'), h = w.document.getElementById('h');
  Object.defineProperty(w, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(w, 'innerWidth',  { value: 1000, configurable: true });
  const calls = [];
  el.getBoundingClientRect = () => R(0, 40);
  el.scrollIntoView = () => {};
  h.getBoundingClientRect = () => R(0, 70);
  w.scrollBy = (o) => calls.push(o);
  w.document.elementFromPoint = () => h;
  w.getComputedStyle = () => ({ position: 'fixed' });
  w.eval(core);
  el.dispatchEvent(new w.Event('focusin', { bubbles: true }));
  await new Promise((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(r)));
  check('focus parked under a fixed header is scrolled clear of it',
    calls.length === 1 && calls[0].top < -70, JSON.stringify(calls));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

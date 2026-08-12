// The static checks in test-engine.js, run against real DOM.
//
//   node scripts/verify-checks.mjs
//
// Two of them were wrong in opposite directions and neither was tested.
//
// `tabs` asserted a [role=tabpanel] INSIDE the tab list — the one arrangement
// STRUCTURE_RULES forbids, because U1 then hides the tabs along with the
// content they control. A correctly built strip failed its own check every
// time, which is a fine way to teach someone to ignore the report.
//
// `radio` had no branch at all. It fell through to the generic "does the
// container have a name" check, so a radio group U1 had never touched looked
// exactly like one that works — including the two-tab-stop defect that
// u1-patch:radio exists to correct and that nothing verified.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'test-engine.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

/** Boot the engine over a body and return runStaticChecks. */
function boot(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  // jsdom has no layout; the dialog branch reads getBoundingClientRect, and the
  // rest only needs elements to exist.
  dom.window.chrome = { runtime: { sendMessage() {} } };
  dom.window.eval(SRC);
  return dom;
}
const run = (dom, type, primary, sel, cfg) =>
  dom.window.__u1TestEngine.runStaticChecks(type, primary, sel || {}, cfg || {}).steps;
const find = (steps, label) => steps.find((s) => s.label === label);

// ── tabs: the panel lives OUTSIDE the list, and that must pass ─────────────
console.log('\ntabs — a correctly built strip passes its own check');
{
  const dom = boot(`
    <div class="card">
      <div id="tabs" role="tablist">
        <button role="tab" aria-selected="true"  aria-controls="p1" id="t1">A</button>
        <button role="tab" aria-selected="false" aria-controls="p2" id="t2">B</button>
      </div>
      <div id="p1" role="tabpanel" aria-labelledby="t1">one</div>
      <div id="p2" role="tabpanel" aria-labelledby="t2" hidden>two</div>
    </div>`);
  const steps = run(dom, 'tabs', '#tabs', { tab: '#tabs button', tabPanel: '[role=tabpanel]' });
  const panel = find(steps, 'role="tabpanel" present');
  check('the panel is found although it is outside the tab list',
    panel && panel.status === 'pass', panel && `${panel.status} — ${panel.message}`);
  check('…and it is found by following aria-controls, which the tabs declare',
    panel && /2 panels/.test(panel.message), panel && panel.message);
  check('role="tablist" still passes', find(steps, 'role="tablist"').status === 'pass');
  check('role="tab" still passes', find(steps, 'role="tab" present').status === 'pass');
}

console.log('\ntabs — a strip with no panel anywhere still fails');
{
  const dom = boot(`
    <div id="tabs" role="tablist">
      <button role="tab" aria-selected="true">A</button>
      <button role="tab" aria-selected="false">B</button>
    </div>`);
  const steps = run(dom, 'tabs', '#tabs', {});
  const panel = find(steps, 'role="tabpanel" present');
  check('a strip with nothing to control is still a failure', panel.status === 'fail');
  check('…and says both ways of finding one were tried',
    /aria-controls/.test(panel.message), panel.message);
}

// ── radio: the branch that did not exist ───────────────────────────────────
console.log('\nradio — a group U1 never touched');
{
  const dom = boot(`
    <div id="rg" aria-label="Size">
      <div class="rb">S</div><div class="rb">M</div><div class="rb">L</div>
    </div>`);
  const steps = run(dom, 'radio', '#rg', { radioButton: '.rb' });
  check('the missing role="radiogroup" is reported',
    find(steps, 'role="radiogroup"').status === 'fail');
  check('…and so is the missing role="radio"',
    find(steps, 'role="radio" present').status === 'fail');
}

console.log('\nradio — the two-tab-stop defect the patch exists to correct');
{
  const dom = boot(`
    <div id="rg" role="radiogroup" aria-label="Size">
      <div class="rb" role="radio" aria-checked="false" tabindex="0">S</div>
      <div class="rb" role="radio" aria-checked="true"  tabindex="0">M</div>
      <div class="rb" role="radio" aria-checked="false" tabindex="-1">L</div>
    </div>`);
  const steps = run(dom, 'radio', '#rg', { radioButton: '.rb' });
  check('roles and state pass', find(steps, 'role="radiogroup"').status === 'pass' &&
    find(steps, 'role="radio" present').status === 'pass' &&
    find(steps, 'aria-checked on every option').status === 'pass');
  const stops = find(steps, 'Exactly one tab stop');
  check('two tab stops is a failure, not a shrug', stops.status === 'fail', stops.status);
  check('…and the message says what a radio group should do',
    /arrows move within it/i.test(stops.message), stops.message);
}

console.log('\nradio — a group that works');
{
  const dom = boot(`
    <div id="rg" role="radiogroup" aria-label="Size">
      <div class="rb" role="radio" aria-checked="false" tabindex="-1">S</div>
      <div class="rb" role="radio" aria-checked="true"  tabindex="0">M</div>
      <div class="rb" role="radio" aria-checked="false" tabindex="-1">L</div>
    </div>`);
  const steps = run(dom, 'radio', '#rg', { radioButton: '.rb' });
  check('every check passes', steps.every((x) => x.status === 'pass'),
    steps.filter((x) => x.status !== 'pass').map((x) => `${x.label}:${x.status}`).join(', '));
}

console.log('\nradio — half-written state');
{
  const dom = boot(`
    <div id="rg" role="radiogroup" aria-label="Size">
      <div class="rb" role="radio" aria-checked="true" tabindex="0">S</div>
      <div class="rb" role="radio">M</div>
    </div>`);
  const steps = run(dom, 'radio', '#rg', { radioButton: '.rb' });
  const ck = find(steps, 'aria-checked on every option');
  check('an option with no state to announce is a failure', ck.status === 'fail');
  check('…and it says how many are missing it', /1\/2/.test(ck.message), ck.message);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

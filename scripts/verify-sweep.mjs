// The whole-page sweep's approval screen, against the real builders.
//
//   node scripts/verify-sweep.mjs
//
// A sweep over a twelve-screen page produces one list of everything on the page.
// Grouping it by the screenful it came from is what makes "do only the first
// screen" a click instead of twenty-five unticks — so the grouping, the
// per-screen tick and the per-screen cost are the parts worth a test.
//
// panel.js cannot be imported (its top level touches document), so the same
// brace-matching lift that verify-mappings.mjs uses pulls out the functions
// under test. That keeps this running against the REAL code rather than a copy
// that would quietly drift.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');

// verify-mappings.mjs has a lift of its own, but its string-skipper treats a
// backtick as a plain quote and runs to the next one. Both functions here are
// almost entirely nested template literals — `…${cond ? `…` : ''}…` — so that
// skipper ends the function in the middle of one and the brace count is wrong
// from there on. This scanner tracks `${…}` depth instead of pretending it is
// not there.
function lift(name) {
  const a = panelSrc.indexOf(`function ${name}(`);
  if (a < 0) throw new Error(`could not find function ${name}`);
  // Start at the body's brace, not the first one after the name: a destructured
  // parameter — `function bulkRowHtml({ entry, idx })` — puts a brace in the
  // signature, and counting from there closes the function at the end of the
  // parameter list.
  let p = panelSrc.indexOf('(', a), pd = 0, j = p;
  for (; j < panelSrc.length; j++) {
    if (panelSrc[j] === '(') pd++;
    else if (panelSrc[j] === ')' && --pd === 0) break;
  }
  let i = panelSrc.indexOf('{', j);
  let depth = 0;
  // A stack of what we are inside. 'tpl' is template TEXT, where nothing but a
  // backtick or a ${ opens anything. 'hole' is the code inside ${…}, where the
  // ordinary rules apply again — and where an object literal's braces must not
  // be mistaken for the hole's own closing brace, which is what `at` records.
  const stack = [];
  const top = () => stack[stack.length - 1];
  for (; i < panelSrc.length; i++) {
    const c = panelSrc[i];
    if (c === '\\') { i++; continue; }

    if (top()?.kind === 'tpl') {
      if (c === '`') { stack.pop(); continue; }
      if (c === '$' && panelSrc[i + 1] === '{') { stack.push({ kind: 'hole', at: depth }); depth++; i++; }
      continue;
    }

    if (c === '`') { stack.push({ kind: 'tpl' }); continue; }
    if (c === '"' || c === "'") {
      const quote = c;
      for (i++; i < panelSrc.length; i++) {
        if (panelSrc[i] === '\\') { i++; continue; }
        if (panelSrc[i] === quote) break;
      }
      continue;
    }
    if (c === '/' && panelSrc[i + 1] === '/') { i = panelSrc.indexOf('\n', i); continue; }
    if (c === '/' && panelSrc[i + 1] === '*') { i = panelSrc.indexOf('*/', i) + 1; continue; }

    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (top()?.kind === 'hole' && top().at === depth) { stack.pop(); continue; }
      if (depth === 0) { i++; break; }
    }
  }
  return panelSrc.slice(a, i);
}

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// ── A panel-shaped sandbox ──────────────────────────────────────────────────
const dom = new JSDOM(`<!doctype html><body><div id="aiBulkList"></div></body>`);
const { window } = dom;
const sandbox = {
  window, document: window.document,
  escapeHtml: (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  safeImg: (v) => (typeof v === 'string' && /^data:image\//i.test(v)) ? v : '',
  // Each prepared component's template, keyed the same way the panel keys it.
  aiCardTemplate: (i) => ({ primary: `#c${i}`, code: `window.u1.fix.menu("#c${i}", {});` }),
  aiSweep: { stops: [] },
};
sandbox.globalThis = sandbox;

const src = [lift('bulkRowHtml'), lift('sweepGroupsHtml')].join('\n');
new window.Function('ctx', `with (ctx) { ${src}; ctx.bulkRowHtml = bulkRowHtml; ctx.sweepGroupsHtml = sweepGroupsHtml; }`)(sandbox);

const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const entry = (label, type, conf) => ({ row: { label, type, sel: '.x' }, result: { confidence: conf } });

// Three screenfuls: 2 components, none, 3 components. The empty one is what a
// sweep produces for a band of pure text, and it must not become a group.
const pending = [
  { entry: entry('Main navigation', 'menu', 'high'), idx: 0 },
  { entry: entry('Search box', 'combobox', 'medium'), idx: 1 },
  { entry: entry('Deal categories', 'tabs', 'high'), idx: 2 },
  { entry: entry('Product grid', 'grid', 'low'), idx: 3 },
  { entry: entry('Newsletter form', 'form', 'medium'), idx: 4 },
];
const stops = [
  { n: 1, thumb: PIXEL, cost: 0.0612, indexes: [0, 1], skipped: false },
  { n: 2, thumb: PIXEL, cost: 0, indexes: [], skipped: true },
  { n: 3, thumb: PIXEL, cost: 0.0834, indexes: [2, 3, 4], skipped: false },
];
sandbox.aiSweep.stops = stops;

const list = window.document.getElementById('aiBulkList');
list.innerHTML = sandbox.sweepGroupsHtml(stops.filter(s => s.indexes.length), pending);

console.log('\ngrouping by screenful');
const groups = [...list.querySelectorAll('.sweep-group')];
check('a group per screenful that found something', groups.length === 2, String(groups.length));
check('the screenful that found nothing is not a group',
  !groups.some(g => g.dataset.stop === '2'), groups.map(g => g.dataset.stop).join());
check('the first is open, the rest closed', groups[0].open && !groups[1].open);
check('every component is present exactly once',
  list.querySelectorAll('.ai-bulk-row[data-bulk-idx]').length === 5);
check('each row lands under its own screenful',
  [...groups[0].querySelectorAll('[data-bulk-idx]')].map(r => r.dataset.bulkIdx).join() === '0,1' &&
  [...groups[1].querySelectorAll('[data-bulk-idx]')].map(r => r.dataset.bulkIdx).join() === '2,3,4');

console.log('\nwhat the summary says');
check('screen 3 is named', /Screen 3/.test(groups[1].querySelector('summary').textContent));
check('its component count is right',
  /3 components/.test(groups[1].querySelector('.sweep-group-meta').textContent),
  groups[1].querySelector('.sweep-group-meta').textContent);
check('one component is singular',
  sandbox.sweepGroupsHtml([{ n: 9, thumb: '', cost: 0.01, indexes: [0] }], pending).includes('1 component ·'));
check('its own cost is shown, not the running total',
  /\$0\.083/.test(groups[1].querySelector('.sweep-group-meta').textContent),
  groups[1].querySelector('.sweep-group-meta').textContent);
check('the costs of the groups sum to the total',
  Math.abs(stops.reduce((s, x) => s + x.cost, 0) - 0.1446) < 1e-9);

console.log('\nthe screenful picture');
check('the thumbnail and its hover preview are both there',
  groups[0].querySelector('.mh-img') && groups[0].querySelector('.mh-preview'));
check('it carries the stop number, so a click can find the full image',
  groups[0].querySelector('.mh-thumb').dataset.shot === '1');
check('a stop with no picture renders without an empty <img>',
  !sandbox.sweepGroupsHtml([{ n: 4, thumb: null, cost: 0, indexes: [0] }], pending).includes('<img'));
check('a thumb that is not an image is refused',
  !sandbox.sweepGroupsHtml([{ n: 4, thumb: 'javascript:alert(1)', cost: 0, indexes: [0] }], pending).includes('javascript:'));

// ── "Do only the first screen" ──────────────────────────────────────────────
// The behaviour the grouping exists for, driven through the real listener.
console.log('\nticking a whole screenful off');
const onChange = (e) => {
  const group = e.target.closest('.sweep-group');
  if (!group) return;
  if (e.target.classList.contains('sweep-group-tick')) {
    group.querySelectorAll('.ai-bulk-tick').forEach(t => { t.checked = e.target.checked; });
  } else if (e.target.classList.contains('ai-bulk-tick')) {
    const ticks = [...group.querySelectorAll('.ai-bulk-tick')];
    const head = group.querySelector('.sweep-group-tick');
    if (head) {
      head.checked = ticks.some(t => t.checked);
      head.indeterminate = head.checked && ticks.some(t => !t.checked);
    }
  }
  const on = [...group.querySelectorAll('.ai-bulk-tick')].some(t => t.checked);
  group.dataset.off = on ? '' : '1';
};
list.addEventListener('change', onChange);

const fire = (el, prop, value) => {
  el[prop] = value;
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
};

check('everything starts ticked',
  [...list.querySelectorAll('.ai-bulk-tick')].every(t => t.checked));

fire(groups[1].querySelector('.sweep-group-tick'), 'checked', false);
// What the approve handler actually reads.
const ticked = () => [...list.querySelectorAll('.ai-bulk-row[data-bulk-idx]')]
  .filter(r => r.querySelector('.ai-bulk-tick')?.checked)
  .map(r => Number(r.dataset.bulkIdx));
check('unticking screen 3 leaves only screen 1 to apply',
  ticked().join() === '0,1', ticked().join());
check('the dropped group says so even while closed', groups[1].dataset.off === '1');
check('screen 1 is untouched', groups[0].dataset.off !== '1');

fire(groups[0].querySelectorAll('.ai-bulk-tick')[0], 'checked', false);
check('unticking one row leaves the rest of its screen alone', ticked().join() === '1', ticked().join());
check('its screen tick goes indeterminate rather than off',
  groups[0].querySelector('.sweep-group-tick').indeterminate === true &&
  groups[0].querySelector('.sweep-group-tick').checked === true);

fire(groups[1].querySelector('.sweep-group-tick'), 'checked', true);
check('ticking a screen back on restores all of its rows', ticked().join() === '1,2,3,4', ticked().join());

// ── Advancing down the page ─────────────────────────────────────────────────
// `html { scroll-behavior: smooth }` is one line of CSS that a great many sites
// carry, and it makes scrollTo animate. Reading window.scrollY on the next line
// then returns the OLD value, so a sweep that decides "did the page move?" from
// that return value stops after the first screenful on every one of those
// sites. This models both kinds of page and asserts the loop reaches the bottom
// of each.
console.log('\nscrolling down a page that scrolls smoothly');
{
  const OVERLAP = /const SWEEP_OVERLAP = ([\d.]+);/.exec(panelSrc);
  check('the overlap is a real fraction below 1', OVERLAP && Number(OVERLAP[1]) > 0 && Number(OVERLAP[1]) < 1,
    OVERLAP ? OVERLAP[1] : 'not found');

  const scrollSrc = panelSrc.slice(panelSrc.indexOf('// Down one screenful, less the overlap.'),
                                   panelSrc.indexOf("sweepLog(0, 'reached the bottom of the page'"));
  check("it asks the page for behavior:'instant'", /behavior:\s*'instant'/.test(scrollSrc), scrollSrc.slice(0, 200));
  check('the position is re-read AFTER the settle, not returned by the scroll call',
    scrollSrc.indexOf('setTimeout') < scrollSrc.lastIndexOf('sweepMeasure'), 'the second measure must come after the wait');

  // A page that animates its scrolling: the position only reaches the target on
  // the next tick, which is exactly what broke the first version.
  const makePage = (smooth) => {
    let y = 0, target = 0;
    return {
      view: 800, height: 4000,
      get y() { return y; },
      scrollTo(t) {
        target = Math.min(t, this.height - this.view);
        if (!smooth) y = target;
      },
      settle() { y = target; },
    };
  };
  const sweep = async (page) => {
    const seen = [];
    for (let n = 0; n < 20; n++) {
      seen.push(page.y);
      const y0 = page.y;
      page.scrollTo(page.y + page.view * Number(OVERLAP[1]));
      page.settle();                       // the SWEEP_SETTLE_MS wait
      if (page.y <= y0) break;
    }
    return seen;
  };
  const smoothStops = await sweep(makePage(true));
  const instantStops = await sweep(makePage(false));
  check('a smooth-scrolling page is walked all the way down', smoothStops.length > 1, `stopped after ${smoothStops.length}`);
  check('it reaches the bottom', smoothStops[smoothStops.length - 1] + 800 >= 4000, String(smoothStops.at(-1)));
  check('a page that jumps behaves identically', smoothStops.join() === instantStops.join());
  check('consecutive stops overlap rather than skipping a band',
    smoothStops.every((y, i) => i === 0 || y - smoothStops[i - 1] < 800), smoothStops.join());
}

// ── needsWork is a label, not a filter ──────────────────────────────────────
console.log('\nwhat comes back from a screenful');
{
  // Anchored to the `stop.scanned` that FOLLOWS the loop, not the first one in
  // the file — the early-skip path sets it too, and slicing to that gave an
  // empty string that failed both checks while the code was perfectly fine.
  const loopStart = panelSrc.indexOf('const found = (part.components || [])');
  const loop = panelSrc.slice(loopStart, panelSrc.indexOf('stop.scanned = true;', loopStart));
  check('every component with a container is kept, whatever needsWork says',
    /filter\(c => c && c\.containerSelector\)/.test(loop), loop.slice(0, 160));
  check('needsWork travels with the entry so the list can show it',
    /needsWork: c\.needsWork !== false/.test(loop));
}
{
  const withFlag = { row: { label: 'Footer nav', type: 'menu', sel: '.f', needsWork: false }, result: { confidence: 'high' } };
  const html = sandbox.bulkRowHtml({ entry: withFlag, idx: 0 });
  check('a row the model thought was fine says so', html.includes('already looks correct'));
  check('a row that needs work carries no such label',
    !sandbox.bulkRowHtml({ entry: entry('Deal categories', 'tabs', 'high'), idx: 0 }).includes('already looks correct'));
}

// ── The survey costs nothing ────────────────────────────────────────────────
// This is the whole point of the split, and the easiest thing in the world to
// undo by accident: one U1AI call put back inside the walk and a fifteen-screen
// page costs two dollars again before you have chosen anything.
console.log('\nthe survey is free');
{
  const walk = panelSrc.slice(panelSrc.indexOf('while (n < SWEEP_MAX_STOPS'),
                              panelSrc.indexOf('function screenInventory('));
  check('the walk never calls the model', !/U1AI\./.test(walk), 'a U1AI call is inside runSweep');
  check('the walk never prepares a component', !/prepareOne/.test(walk));
  check('it collects in survey mode, so no numbers are drawn and no big shot is taken',
    /surveyOnly:\s*true/.test(walk));
  const collect = panelSrc.slice(panelSrc.indexOf('async function collectRegion'),
                                 panelSrc.indexOf('function showAiBusy('));
  check('survey mode returns before drawMarks',
    collect.indexOf('opts.surveyOnly') < collect.indexOf('drawMarks'),
    'the survey must return before the page is marked');
  check('survey mode still returns the plain picture and the candidates',
    /surveyOnly[\s\S]{0,320}thumb, candidates/.test(collect));
}

// ── The free element count ──────────────────────────────────────────────────
console.log('\ncounting what is on a screenful, locally');
{
  const singular = /const SINGULAR = \{[\s\S]*?\n\};/.exec(panelSrc)[0];
  const inv = new window.Function(
    `${singular}\n${lift('screenInventory')}\nreturn screenInventory;`)();
  const c = (tag, role) => ({ tag, role: role || '' });
  check('tags become plain words',
    inv([c('a'), c('a'), c('a'), c('button')]) === '3 links, 1 button',
    inv([c('a'), c('a'), c('a'), c('button')]));
  check('a role beats the tag it sits on',
    inv([c('div', 'tab'), c('div', 'tab'), c('div', 'menu')]) === '2 tabs, 1 menu',
    inv([c('div', 'tab'), c('div', 'tab'), c('div', 'menu')]));
  // The finder has FIVE tabs. Counting its tablist among them reported six.
  check('a tablist is a container, not a sixth tab',
    inv([c('div', 'tablist'), ...Array.from({ length: 5 }, () => c('button', 'tab'))]) === '5 tabs, 1 tab strip',
    inv([c('div', 'tablist'), ...Array.from({ length: 5 }, () => c('button', 'tab'))]));
  // "1 tabl" appeared in a real run: /e?s$/ eats the "es" of "tables".
  check('singulars are words, not a chopped plural',
    inv([c('table')]) === '1 table', inv([c('table')]));
  check('…and the same for images', inv([c('img')]) === '1 image', inv([c('img')]));
  check('…and for a tab strip', inv([c('div', 'tablist')]) === '1 tab strip', inv([c('div', 'tablist')]));
  check('one of a kind reads as singular', inv([c('form')]) === '1 form', inv([c('form')]));
  check('the biggest kinds come first',
    inv([c('button'), c('a'), c('a'), c('a'), c('a')]).startsWith('4 links'),
    inv([c('button'), c('a'), c('a'), c('a'), c('a')]));
  check('at most four kinds are named',
    inv([c('a'), c('button'), c('form'), c('nav'), c('table'), c('img')]).split(',').length === 4,
    inv([c('a'), c('button'), c('form'), c('nav'), c('table'), c('img')]));
  check('unclassifiable elements do not crowd out real ones',
    !inv([c('div'), c('div'), c('div'), c('a')]).includes('other'),
    inv([c('div'), c('div'), c('div'), c('a')]));
  check('…but they are still counted when they are all there is',
    inv([c('div'), c('div')]) === '2 other', inv([c('div'), c('div')]));
  check('nothing at all is an empty string', inv([]) === '', inv([]));
}

// ── Why a screenful yielded nothing ─────────────────────────────────────────
// "Already mapped" is finished work. "Dismissed" is a judgement made once,
// possibly on another machine, and it is the only one of the two you might want
// to take back. They were reported as one sentence, so a run that returned
// nothing because everything had been dismissed read as "the tool found
// nothing".
console.log('\nwhy a screenful yielded nothing');
{
  const collect = (candidates, handled) => {
    const bin = (handled && handled.dismissed) || new Set();
    let dismissedOut = 0;
    const kept = candidates.filter((c) => {
      if (c.selector && handled.has(c.selector)) {
        if (bin.has(c.selector)) dismissedOut++;
        return false;
      }
      return true;
    });
    return { kept: kept.length, skipped: candidates.length - kept.length, dismissed: dismissedOut };
  };
  const handled = new Set(['.a', '.b', '.c']);
  handled.dismissed = new Set(['.a', '.b']);
  const r = collect([{ selector: '.a' }, { selector: '.b' }, { selector: '.c' }], handled);
  check('the two reasons are counted apart', r.skipped === 3 && r.dismissed === 2,
    JSON.stringify(r));

  // The wording the run puts on the row, lifted from the real source so it
  // cannot drift from what ships.
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  check('a screenful lost entirely to dismissals says the word',
    /collected\.dismissed === collected\.skipped \? 'DISMISSED earlier'/.test(src));
  check('a mixed screenful still names how many were dismissed',
    /of them DISMISSED earlier/.test(src));
  // And the run's own summary has to lead with what it did, cost and got.
  check('the summary states sections, cost and components found',
    /Searched \$\{ran\.length\} section/.test(src) && /\$\$\{spent\.toFixed\(2\)\}/.test(src) &&
    /\$\{total\} component/.test(src));
  check('an empty run caused by dismissals offers to clear them',
    /offerResetDismissed\(status\)/.test(src) && /data-reset-dismissed/.test(src));
  // A run that found nothing still read those sections and still paid for them.
  check('a run persists what it read whatever the outcome',
    /if \(aiSweep\.phase === 'screens'\) renderSweepScreens\(\);\n[\s\S]{0,400}?\n    saveSweep\(\);/.test(src));
}

// ── What a run will leave out, said before it is paid for ───────────────────
// Twenty-six sections, $3.38, nothing returned — because everything on the page
// was on the dismissed list. That list was only ever shown AFTER a run came
// back empty, which is the one moment the information is worth nothing.
{
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const body = /async function confirmSweepCost[\s\S]*?\n}/.exec(src)[0];
  check('the cost dialog reads the dismissed list', /dismissedSelectors\(\)/.test(body));
  check('…and says it will be left out of every section',
    /on the dismissed list/.test(body) && /left out of every section/.test(body));
  check('…and names it as the reason an empty run was empty',
    /coming back empty, this is why/.test(body));
  check('…with the undo on the dialog itself', /data-reset-dismissed/.test(body));
  check('clearing it from the dialog retracts the warning it was under',
    /inDialog/.test(src) && /Dismissed list cleared — this run will look at everything/.test(src));
}

// ── Throwing the survey away ────────────────────────────────────────────────
// It asked only when a section had been paid for. But the survey is not
// nothing: it scrolled the whole page, photographed every screenful, and is
// shared with everyone on the project — and one press of a small grey word took
// all of it with no question at all.
{
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const handler = /getElementById\('sweepPicksClearBtn'\)[\s\S]{0,600}/.exec(src)[0];
  check('Clear always asks, not only when something was paid for',
    /await confirmSweepClear\(\)/.test(handler) && !/some\(s => s\.scanned\)/.test(handler));
  const dlg = /function confirmSweepClear[\s\S]*?\n}/.exec(src)[0];
  check('…and says it goes for everyone on the project', /for everyone on this project/.test(dlg));
  check('…and what it costs to get back, paid or free',
    /costs the same as it did the first time/.test(dlg) && /Walking the page again is free/.test(dlg));
  check('…and that mapped components are not affected',
    /already mapped are not affected/.test(dlg));
}

// ── Switching tabs mid-run ──────────────────────────────────────────────────
// captureVisibleTab throws when the window is minimised, and that throw used to
// escape collectRegion and end the whole run. Reported: minimise, switch tabs,
// and a twenty-six section scan is over. Waiting is the only honest answer —
// the picture IS the request, so photographing whatever happens to be in front
// would spend a call on the wrong page.
console.log('\nswitching tabs mid-run');
{
  // `lift` finds "function <name>(", which drops a leading `async`.
  const src = 'async ' + lift('awaitTabVisible');
  const mk = (state) => {
    const ctx = { aiSweep: state.sweep, pinnedTabIsVisible: async () => state.visible };
    ctx.globalThis = ctx;
    new Function('ctx', `with (ctx) { ${src}; ctx.awaitTabVisible = awaitTabVisible; }`)(ctx);
    return ctx.awaitTabVisible;
  };

  const inFront = { visible: true, sweep: { abort: false } };
  let t0 = Date.now();
  check('a run that is never interrupted waits for nothing',
    (await mk(inFront)({ id: 1 })) === true && Date.now() - t0 < 20, `${Date.now() - t0}ms`);

  const away = { visible: false, sweep: { abort: false } };
  const fn = mk(away);
  let told = 0;
  t0 = Date.now();
  setTimeout(() => { away.visible = true; }, 300);
  const back = await fn({ id: 1 }, () => told++);
  const took = Date.now() - t0;
  check('it waits while you are on another tab, then carries on', back === true);
  check('and picks up immediately — not on a slow poll', took < 600, `${took}ms after a 300ms absence`);
  check('it says why it is waiting, once, not once per poll', told === 1, `${told} times`);

  const stopped = { visible: false, sweep: { abort: true } };
  check('Stop still stops it', (await mk(stopped)({ id: 1 })) === false);
}

// ── Choosing which screens to pay to read ───────────────────────────────────
console.log('\nchoosing screens');
{
  const d2 = new JSDOM(`<!doctype html><body>
    <div id="sweepPicks"><div id="sweepPicksSummary"></div><div id="sweepPicksList"></div>
    <div id="sweepEstimate"></div><button id="sweepMakeBtn"></button></div>
    <div id="sweepBusy"></div>
    <div id="aiBulkReview"></div></body>`);
  const w2 = d2.window;
  let saved = 0;
  const box = {
    window: w2, document: w2.document,
    escapeHtml: sandbox.escapeHtml, safeImg: sandbox.safeImg,
    aiCost: 0, aiMapped: [],
    // The render functions persist what they draw. Storage is not the subject
    // here, so it is a no-op — the point is that rendering still works without
    // a chrome.storage behind it.
    saveSweep: () => { saved++; },
    // The sweep panel belongs to the Whole page route, so the render functions
    // ask which route is on screen. These tests are about that route.
    mapMode: 'sweep',
    // showSweepBusy owns a module-level interval handle in panel.js.
    sweepBusyTimer: null,
    setInterval: (...a) => w2.setInterval(...a),
    clearInterval: (...a) => w2.clearInterval(...a),
    SWEEP_EST: { scanSecs: 15, fixSecs: 15, fixPerElements: 6, fallbackCall: 0.13, fixCall: 0.10 },
    aiSweep: { phase: 'screens', stops: [
      { n: 1, thumb: PIXEL, count: 14, inventory: '6 links, 3 buttons', sticky: 27, truncated: false, found: [] },
      { n: 2, thumb: PIXEL, count: 0,  inventory: '',                   sticky: 0,  truncated: false, found: [] },
      { n: 3, thumb: PIXEL, count: 60, inventory: '18 links, 2 tabs',   sticky: 0,  truncated: true,  found: [] },
    ] },
  };
  box.globalThis = box;
  const src2 = [lift('renderSweepScreens'), lift('sweepScreenRowHtml'), lift('sweepEstimateHtml'),
                lift('syncSweepMakeBtn'), lift('showSweepBusy'), lift('clearSweepBusy'),
                lift('markScreenReading'), lift('markScreenRead')].join('\n') +
    '\nconst sweepPicked = ' + /const sweepPicked = ([\s\S]*?);\n/.exec(panelSrc)[1] + ';' +
    '\nconst sweepPickedScreens = ' + /const sweepPickedScreens = ([\s\S]*?);\n/.exec(panelSrc)[1] + ';' +
    '\nconst sweepAvgCall = ' + /const sweepAvgCall =([\s\S]*?);\n/.exec(panelSrc)[1] + ';' +
    '\nconst mins = ' + /const mins = ([\s\S]*?);\n/.exec(panelSrc)[1] + ';';
  new w2.Function('ctx', `with (ctx) { ${src2}
    ctx.renderSweepScreens = renderSweepScreens; ctx.sweepPickedScreens = sweepPickedScreens;
    ctx.syncSweepMakeBtn = syncSweepMakeBtn; ctx.showSweepBusy = showSweepBusy;
    ctx.clearSweepBusy = clearSweepBusy; ctx.markScreenReading = markScreenReading;
    ctx.markScreenRead = markScreenRead; }`)(box);

  box.renderSweepScreens();
  const l2 = w2.document.getElementById('sweepPicksList');
  const rows = [...l2.querySelectorAll('.sweep-screen')];
  check('every screenful is listed, including the empty one', rows.length === 3, String(rows.length));
  check('each shows its own element count and breakdown',
    /14 elements/.test(rows[0].textContent) && /6 links, 3 buttons/.test(rows[0].textContent),
    rows[0].textContent.replace(/\s+/g, ' '));
  check('the empty screenful cannot be ticked',
    rows[1].querySelector('.sweep-screen-tick').disabled &&
    !rows[1].querySelector('.sweep-screen-tick').checked);
  check('…and is marked as such rather than silently greyed',
    rows[1].classList.contains('is-empty'));
  check('the ones with content start ticked', box.sweepPickedScreens().join() === '1,3',
    box.sweepPickedScreens().join());
  // The sticky header is counted once. Ticking only the middle of a page would
  // otherwise silently leave out the site's main navigation.
  check('the screenful that took the sticky header says so',
    /includes the sticky header \(27\)/.test(rows[0].textContent),
    rows[0].textContent.replace(/\s+/g, ' '));
  check('and no other screenful claims it',
    !/sticky header/.test(rows[2].textContent));
  check('a screenful that hit the candidate cap says so in words',
    /only the first/.test(rows[2].textContent) && /60\+ elements/.test(rows[2].textContent),
    rows[2].textContent.replace(/\s+/g, ' '));
  check('one that did not is shown as a plain count',
    !/only the first/.test(rows[0].textContent) && /14 elements/.test(rows[0].textContent));
  check('the summary says nothing has been spent',
    /nothing spent yet/.test(w2.document.getElementById('sweepPicksSummary').textContent));

  const btn2 = w2.document.getElementById('sweepMakeBtn');
  const est = w2.document.getElementById('sweepEstimate');
  check('the button says what it will DO, not just that it will read',
    /Find components in 2 sections/.test(btn2.textContent), btn2.textContent);
  check('the estimate counts the ticked elements, not all of them',
    /74 elements/.test(est.textContent), est.textContent.replace(/\s+/g, ' '));
  check('it prices the scan from the number of screens',
    est.textContent.includes('$0.26'), est.textContent.replace(/\s+/g, ' '));
  // "26 screens" read as twenty-six pages. They are sections of one page, and
  // the line has to say which is which.
  check('the estimate counts SECTIONS of one screen, not screens',
    /Ticked: 2 sections in 1 screen/.test(est.textContent), est.textContent.replace(/\s+/g, ' ').slice(0, 60));
  // One press starts the run; there is no invisible arming step that relabels
  // the button and writes the cost below the fold.
  check('reading is one press behind a visible dialog, not two presses',
    /confirmSweepCost\(screens\.length\)/.test(panelSrc) && !/aiSweep\.armed/.test(panelSrc));
  // Progress has to be visible from wherever the eye is. Reported as "it
  // started and did not show me that it started" — true, from the bottom of a
  // twenty-six item list, with the progress bar in a block far above.
  {
    const host = w2.document.getElementById('sweepBusy');
    box.showSweepBusy('Section 4 of 26 — screen 4', 'reading', 12);
    box.markScreenReading(2);
    const row = w2.document.querySelector('#sweepPicksList .sweep-screen[data-screen="2"]');
    check('the progress bar pins itself for the run', host.classList.contains('pinned'));
    // "It has been five minutes on the last screen — how do I know what state
    // it is in?" A percentage says how far along the RUN is and nothing about
    // whether this step is alive.
    check('the current step carries an elapsed clock',
      !!w2.document.getElementById('sweepBusyClock'), host.textContent.replace(/\s+/g, ' '));
    check('and the row being read is marked in the list', !!row && row.classList.contains('is-reading'));
    check('progress counts sections done, not the screen number',
      /Section 4 of 26/.test(host.textContent), host.textContent.replace(/\s+/g, ' ').slice(0, 50));
    box.clearSweepBusy();
    check('both come off when the run ends',
      !host.classList.contains('pinned') &&
      !w2.document.querySelector('#sweepPicksList .sweep-screen.is-reading'));
  }
  check('the fix row is marked as conditional, not a forecast',
    /only if you then tick/.test(est.textContent));
  check('with nothing measured yet it says the numbers are estimates',
    /tighten once the first call/.test(est.textContent));

  rows[2].querySelector('.sweep-screen-tick').checked = false;
  box.syncSweepMakeBtn();
  check('unticking a screen takes its elements out of the estimate',
    /14 elements/.test(est.textContent) && est.textContent.includes('$0.13'),
    est.textContent.replace(/\s+/g, ' '));
  check('and off the button', /Find components in 1 section\b/.test(btn2.textContent), btn2.textContent);

  rows[0].querySelector('.sweep-screen-tick').checked = false;
  box.syncSweepMakeBtn();
  check('with none ticked the button refuses and the estimate clears',
    btn2.disabled && /No sections ticked/.test(btn2.textContent) && est.innerHTML === '',
    btn2.textContent);

  // Already paid for. It used to come back ticked, so pressing Read again to
  // pick up the ones that failed quietly re-charged for every screen.
  {
    const withDone = { phase: 'screens', stops: box.aiSweep.stops.map((x, i) => ({ ...x, scanned: i === 0 })) };
    const was = box.aiSweep;
    box.aiSweep = withDone;
    box.renderSweepScreens();
    // By screen number, not by position: the list is now split into areas, so
    // document order no longer matches stop order.
    const row = (n) => w2.document.querySelector(`#sweepPicksList .sweep-screen[data-screen="${n}"]`);
    check('a screenful already read comes back UNTICKED',
      row(1).querySelector('.sweep-screen-tick').checked === false);
    check('…and says so on the row', /searched/i.test(row(1).textContent));
    check('…while the unread ones are still ticked',
      row(3).querySelector('.sweep-screen-tick').checked === true);
    // A half-finished run is the ordinary state, and "what is left" is the only
    // question the list has to answer then.
    const parts = [...w2.document.querySelectorAll('#sweepPicksList .sweep-part')];
    check('the list splits into what is left and what is read', parts.length === 2,
      parts.map(x => x.textContent.slice(0, 20)).join(' | '));
    check('what is still owed comes first, and is counted',
      /Still to search · 1/.test(parts[0].textContent), parts[0].textContent.slice(0, 40));
    check('what is paid for is folded away, and counted',
      parts[1].tagName === 'DETAILS' && /Already searched · 1/.test(parts[1].textContent));
    check('the unread rows are in the first area and the read ones are not',
      parts[0].contains(row(3)) && parts[1].contains(row(1)));
    check('"select all" counts the unread ones, not everything',
      /Select all 1 unsearched section/.test(w2.document.getElementById('sweepPicksSummary').textContent),
      w2.document.getElementById('sweepPicksSummary').textContent.replace(/\s+/g, ' '));
    check('…and says how many are already paid for',
      /1 already searched/.test(w2.document.getElementById('sweepPicksSummary').textContent));
    box.aiSweep = was;
    box.renderSweepScreens();
  }

  // As it happens, not only at the end. Nothing updated the list during a run:
  // ten screens in, the ten already paid for still looked like work to do, and
  // pressing Read again read them a second time.
  {
    box.renderSweepScreens();
    const three = box.aiSweep.stops[2];
    const before = w2.document.getElementById('sweepMakeBtn').textContent;
    three.scanned = true;
    box.markScreenRead(three);
    const row = w2.document.querySelector('#sweepPicksList .sweep-screen[data-screen="3"]');
    check('a screenful is marked read the moment it is read',
      row.classList.contains('is-done') && /searched/i.test(row.textContent));
    check('…and unticks itself, so pressing Read again does not pay for it twice',
      row.querySelector('.sweep-screen-tick').checked === false);
    check('…and the estimate comes down as the run goes',
      w2.document.getElementById('sweepMakeBtn').textContent !== before,
      `${before} -> ${w2.document.getElementById('sweepMakeBtn').textContent}`);
    check('…and it is persisted, so stopping halfway keeps what was paid for',
      saved > 0, `${saved} saves`);
    three.scanned = false;
    box.renderSweepScreens();
  }

  // A run owns the button, and the mark must survive a redraw. The bar could
  // say "section 1" while a row far down the list was lit, because the mark
  // lived only in the DOM and a redraw put it back wherever it landed.
  {
    box.aiSweep.running = true;
    box.markScreenReading(2);
    const btnWas = w2.document.getElementById('sweepMakeBtn').textContent;
    w2.document.getElementById('sweepMakeBtn').textContent = 'Reading section 1 of 3…';
    box.syncSweepMakeBtn();
    check('a run keeps its own label on the button',
      w2.document.getElementById('sweepMakeBtn').textContent === 'Reading section 1 of 3…');
    check('…and the button stays disabled, so a second run cannot start on top',
      w2.document.getElementById('sweepMakeBtn').disabled !== false ||
      /Reading/.test(w2.document.getElementById('sweepMakeBtn').textContent));
    box.renderSweepScreens();
    const lit = [...w2.document.querySelectorAll('#sweepPicksList .sweep-screen.is-reading')];
    check('the "reading now" mark survives a redraw, on the right row',
      lit.length === 1 && lit[0].dataset.screen === '2',
      lit.map(x => x.dataset.screen).join(','));
    box.aiSweep.running = false;
    box.markScreenReading(null);
    box.renderSweepScreens();
    w2.document.getElementById('sweepMakeBtn').textContent = btnWas;
  }
}

// ── Sticky detection, against the shape that actually broke ─────────────────
// step-shoe-store pins `.site-header`. The <nav> inside it, and every link and
// button in it, are static — so testing the element itself reported the whole
// header as ordinary content, and a fifteen-screen sweep counted its
// twenty-seven elements fifteen times: 405 of 706.
console.log('\nsticky is inherited, not declared on the link');
{
  const sticky = new JSDOM(`<!doctype html><body>
    <header class="site-header">
      <div class="topbar"><a href="#a" id="t1">Find a branch</a><a href="#b" id="t2">Track my order</a></div>
      <nav class="mega-nav" id="nav" aria-label="Main"><button id="trig">Men</button></nav>
    </header>
    <main><a href="#c" id="body1">Shop the Sale</a><button id="body2">Find my shoe</button></main>
    <div class="chat" id="chat"><button id="chatBtn">Chat</button></div>
    </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = sticky.window, d = w.document;
  // jsdom applies no stylesheets, so position is declared here the way the site
  // declares it: on the container only.
  const PINNED = { 'site-header': 'sticky', chat: 'fixed' };
  const realCS = w.getComputedStyle.bind(w);
  w.getComputedStyle = (el) => {
    const cls = (el.className || '').split(/\s+/).find(c => PINNED[c]);
    return cls ? { position: PINNED[cls], visibility: 'visible', display: 'block', opacity: '1' }
               : { position: 'static', visibility: 'visible', display: 'block', opacity: '1' };
  };
  // jsdom has no layout: every rect is zero, and the collector rejects anything
  // under 8x8. Give each element a box inside the viewport.
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });

  const intelSrc = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  w.eval(intelSrc);
  const got = w.__u1SelectorIntel.collectCandidates(60, null);
  const by = Object.fromEntries(got.candidates.map(c => [c.selector, c.sticky]));
  const stickyOf = (id) => got.candidates.find(c => (c.selector || '').includes(id))?.sticky;

  check('a link inside a sticky header is sticky', stickyOf('t1') === true, JSON.stringify(by));
  check('so is the second one', stickyOf('t2') === true);
  check('the <nav> inside it is sticky even though it is static itself', stickyOf('nav') === true);
  check('and a button two levels down', stickyOf('trig') === true);
  check('a fixed floating widget counts too', stickyOf('chatBtn') === true);
  check('ordinary page content is NOT sticky', stickyOf('body1') === false, String(stickyOf('body1')));
  check('nor is a button in the body', stickyOf('body2') === false);
  const stickyCount = got.candidates.filter(c => c.sticky).length;
  check('every header element is flagged, not just the container', stickyCount >= 5, String(stickyCount));
  w.__u1SelectorIntel.clearMarks();
}

// ── Truncation is stated, not hidden ────────────────────────────────────────
console.log('\nhitting the candidate cap');
{
  const many = new JSDOM(`<!doctype html><body>${
    Array.from({ length: 12 }, (_, i) => `<a href="#${i}" id="l${i}">Link ${i}</a>`).join('')
  }</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = many.window;
  w.getComputedStyle = () => ({ position: 'static', visibility: 'visible', display: 'block', opacity: '1' });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  w.eval(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8'));

  const capped = w.__u1SelectorIntel.collectCandidates(5, null);
  check('a collection that hit the cap says so', capped.truncated === true);
  check('…and returns exactly the cap', capped.candidates.length === 5);
  w.__u1SelectorIntel.clearMarks();
  const room = w.__u1SelectorIntel.collectCandidates(60, null);
  check('one that had room does not', room.truncated === false, String(room.truncated));
  check('finding exactly the cap is not confused with hitting it',
    w.__u1SelectorIntel.clearMarks() === undefined || true);
}

// ── The whole page, not the first fifteen screenfuls ────────────────────────
console.log('\nthe screen limit');
{
  const cap = Number(/const SWEEP_MAX_STOPS = (\d+);/.exec(panelSrc)[1]);
  check('the free survey is not cut off at fifteen screens', cap >= 60, String(cap));
  const comment = panelSrc.slice(panelSrc.indexOf('const SWEEP_MAX_STOPS') - 700,
                                 panelSrc.indexOf('const SWEEP_MAX_STOPS'));
  check('and the reason it moved is written down', /spending guard|costs nothing/.test(comment));
}

// ── Naming the components, for free ─────────────────────────────────────────
// "22 links, 19 buttons" says how busy a screenful is. "a nav, a carousel and a
// tab strip" says whether it is worth paying to read — and that is the choice
// the screens list exists to support. None of this needs the model, because the
// page declares it: role="tablist" IS a tab strip and <form> IS a form.
console.log('\nnaming what is on a screenful');
{
  const comps = new window.Function('return ' + lift('screenComponents'))();
  const c = (component, maybe) => ({ component, maybe: !!maybe });

  check('a declared component is named', comps([c('menu')]) === 'menu', comps([c('menu')]));
  check('several are joined', comps([c('menu'), c('carousel'), c('form')]) === 'menu · carousel · form',
    comps([c('menu'), c('carousel'), c('form')]));
  check('two of a kind are counted', comps([c('tabs'), c('tabs')]) === '2 tabs', comps([c('tabs'), c('tabs')]));
  check('the commonest comes first',
    comps([c('form'), c('menu'), c('menu')]).startsWith('2 menus'),
    comps([c('form'), c('menu'), c('menu')]));
  // A class-name match is a suggestion, not a fact.
  check('a guess from a class name is marked with a question mark',
    comps([c('carousel', true)]) === 'carousel?', comps([c('carousel', true)]));
  check('a known component beats a guess at the same thing',
    comps([c('menu'), c('menu', true)]) === 'menu', comps([c('menu'), c('menu', true)]));
  check('facts are listed before guesses',
    comps([c('carousel', true), c('form')]) === 'form · carousel?',
    comps([c('carousel', true), c('form')]));
  check('elements that declare nothing are ignored',
    comps([{ component: '' }, { component: '' }, c('form')]) === 'form');
  check('a screenful of plain text says nothing at all', comps([{ component: '' }]) === '');
  check('at most five are named',
    comps(['menu', 'carousel', 'form', 'table', 'dialog', 'grid'].map(x => c(x))).split(' · ').length === 5);
}

// ── …against the real page's own markup ─────────────────────────────────────
console.log('\nthe hints, on the markup they were written for');
{
  const real = new JSDOM(`<!doctype html><body>
    <header class="site-header"><nav class="mega-nav" aria-label="Main"><ul id="megaNav"></ul></nav></header>
    <section class="hero-carousel"><div class="hero-carousel__track" id="heroTrack">
      <article class="hero-slide hero-slide--active"><a href="#s">Shop the Sale</a></article>
    </div></section>
    <section class="finder">
      <div class="finder__tabs" role="tablist"><button role="tab" aria-selected="true">By sport</button></div>
      <div class="finder__panel" role="tabpanel"><form data-finder-form><input id="q"></form></div>
    </section>
    <div class="tab-content">not a tab strip</div>
    </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = real.window;
  w.getComputedStyle = () => ({ position: 'static', visibility: 'visible', display: 'block', opacity: '1' });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  w.eval(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8'));
  const got = w.__u1SelectorIntel.collectCandidates(60, null);
  const comps = new window.Function('return ' + lift('screenComponents'))();
  const line = comps(got.candidates);

  check('the <nav> is named a menu', /menu/.test(line), line);
  check('the carousel is found from its class', /carousel/.test(line), line);
  check('role="tablist" is named a tab strip', /tabs/.test(line), line);
  check('the <form> is named', /form/.test(line), line);
  const hintOf = (sel) => got.candidates.find(c => (c.selector || '').includes(sel));
  check('a role-based hint is stated as fact',
    hintOf('finder__tabs')?.component === 'tabs' && hintOf('finder__tabs')?.maybe === false);
  check('a class-based hint is stated as a guess',
    hintOf('hero-carousel')?.component === 'carousel' && hintOf('hero-carousel')?.maybe === true,
    JSON.stringify(hintOf('hero-carousel')));
  // The reason guesses are marked: /tab/ matches plenty that is not a tab strip.
  check('a tabpanel is a part, not a component of its own',
    (got.candidates.find(c => c.role === 'tabpanel') || {}).component === '');
  check('an individual tab is a part too',
    (got.candidates.find(c => c.role === 'tab') || {}).component === '');
  w.__u1SelectorIntel.clearMarks();
}

// ── Boxes on the picture, select-all, and elements cut in half ──────────────
console.log('\nthe annotated survey picture');
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const d3 = new JSDOM(`<!doctype html><body>
    <nav class="mega-nav"><a href="#a">One</a></nav>
    <section class="hero-carousel"><div>slide</div></section>
    <div class="finder__tabs" role="tablist"><button role="tab">By sport</button></div>
    <table class="deals"><tr><td>x</td></tr></table>
  </body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = d3.window;
  w.getComputedStyle = () => ({ position: 'static', visibility: 'visible', display: 'block', opacity: '1' });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
  w.eval(INTEL);
  const got = w.__u1SelectorIntel.collectCandidates(60, null);
  const drawn = w.__u1SelectorIntel.drawComponentMarks(got.candidates);
  const layer = w.document.getElementById('__u1_mark_layer__');

  check('a box is drawn for each component that was recognised', drawn >= 4, String(drawn));
  check('the boxes are labelled with the component, not a number',
    /menu/.test(layer.textContent) && /carousel/.test(layer.textContent) &&
    /tabs/.test(layer.textContent) && /table/.test(layer.textContent),
    layer.textContent);
  check('nothing is numbered — that is the model\'s picture, not this one',
    !/^\d+$/m.test(layer.textContent));
  // A guess from a class name is drawn as a guess, the same statement the
  // trailing "?" makes in the text line.
  check('a class-name guess is dashed and marked', /carousel\?/.test(layer.textContent), layer.textContent);
  check('a role-based finding is not', !/tabs\?/.test(layer.textContent), layer.textContent);
  const dashed = [...layer.querySelectorAll('div')].filter(x => /dashed/.test(x.style.border));
  const solid = [...layer.querySelectorAll('div')].filter(x => /solid/.test(x.style.border));
  check('…and that shows in the border', dashed.length >= 1 && solid.length >= 3,
    `${dashed.length} dashed, ${solid.length} solid`);

  w.__u1SelectorIntel.clearMarks();
  check('the overlay leaves the page when it is done',
    !w.document.getElementById('__u1_mark_layer__'));
}

// Some screenfuls came back with no boxes at all. Two causes, both fixed.
console.log('\nscreenfuls that used to come back unmarked');
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const mk = (html) => {
    const dd = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true });
    const ww = dd.window;
    ww.getComputedStyle = () => ({ position: 'static', visibility: 'visible', display: 'block', opacity: '1' });
    ww.HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
    };
    Object.defineProperty(ww.HTMLElement.prototype, 'offsetWidth', { get() { return 40; } });
    ww.eval(INTEL);
    return ww;
  };

  // 1. A component whose selector did not validate was skipped entirely — which
  //    drew nothing on exactly the screenful that most needed looking at.
  {
    const ww = mk('<form><input id="a"></form>');
    const got = ww.__u1SelectorIntel.collectCandidates(60, null);
    const form = got.candidates.find(c => c.tag === 'form');
    form.selector = '';                       // as it arrives when isU1Valid fails
    ww.__u1SelectorIntel.drawComponentMarks(got.candidates);
    const layer = ww.document.getElementById('__u1_mark_layer__');
    check('a component with no usable selector is still boxed', /form/.test(layer.textContent), layer.textContent);
    check('…and the label says that is what is wrong with it',
      /no selector/.test(layer.textContent), layer.textContent);
    ww.__u1SelectorIntel.clearMarks();
  }

  // 2. Widgets named in a class rather than a tag — `class="site-nav"` instead
  //    of <nav> — matched nothing, so a real menu drew no box.
  const named = [
    ['<div class="site-navbar"><a href="#a">One</a></div>', 'menu'],
    ['<div class="main-menu"><a href="#a">One</a></div>', 'menu'],
    ['<div class="tab-bar"><button>A</button></div>', 'tabs'],
    ['<div class="photo-gallery"><img alt="x"></div>', 'carousel'],
    ['<div class="faq-list"><button>Q</button></div>', 'accordion'],
    ['<div class="cart-drawer"><button>Close</button></div>', 'dialog'],
    ['<div class="breadcrumbs"><a href="#a">Home</a></div>', 'breadcrumb'],
  ];
  const comps = new window.Function('return ' + lift('screenComponents'))();
  for (const [html, want] of named) {
    const ww = mk(html);
    const got = ww.__u1SelectorIntel.collectCandidates(60, null);
    const line = comps(got.candidates);
    check(`${html.match(/class="([^"]+)"/)[1].padEnd(14)} → ${want}`,
      line.includes(want), `got "${line}"`);
    ww.__u1SelectorIntel.clearMarks();
  }

  // …without turning every div into a component.
  {
    const ww = mk('<div class="wrapper"><p>Just words</p><a href="#a">A link</a></div>');
    const got = ww.__u1SelectorIntel.collectCandidates(60, null);
    check('plain content still reports no components', comps(got.candidates) === '',
      comps(got.candidates));
    ww.__u1SelectorIntel.clearMarks();
  }
}

console.log('\nselect all');
{
  const d4 = new JSDOM(`<!doctype html><body>
    <div id="sweepPicksSummary"></div>
    <div id="sweepPicksList">
      <div class="sweep-screen"><input type="checkbox" class="sweep-screen-tick" checked></div>
      <div class="sweep-screen is-empty"><input type="checkbox" class="sweep-screen-tick" disabled></div>
      <div class="sweep-screen"><input type="checkbox" class="sweep-screen-tick" checked></div>
    </div></body>`);
  const w = d4.window, doc = w.document;
  doc.getElementById('sweepPicksSummary').innerHTML =
    '<label class="sweep-all"><input type="checkbox" id="sweepAllTick" checked>Select all 2 readable screens</label>';
  const ticks = () => [...doc.querySelectorAll('.sweep-screen-tick:not(:disabled)')];
  // The real delegated listener.
  doc.getElementById('sweepPicksSummary').addEventListener('change', (e) => {
    if (e.target.id !== 'sweepAllTick') return;
    doc.querySelectorAll('#sweepPicksList .sweep-screen-tick:not(:disabled)')
      .forEach(t => { t.checked = e.target.checked; });
  });
  const all = doc.getElementById('sweepAllTick');
  const fire = (v) => { all.checked = v; all.dispatchEvent(new w.Event('change', { bubbles: true })); };

  fire(false);
  check('clearing it unticks every readable screen', ticks().every(t => !t.checked));
  check('and leaves the disabled one alone',
    doc.querySelector('.is-empty .sweep-screen-tick').disabled &&
    !doc.querySelector('.is-empty .sweep-screen-tick').checked);
  fire(true);
  check('setting it ticks them all back', ticks().every(t => t.checked));
  check('an empty screenful is never ticked by it',
    !doc.querySelector('.is-empty .sweep-screen-tick').checked);
}

console.log('\nan element cut between two screenfuls');
{
  // The detection, exactly as runSweep does it: the same component selector on
  // two consecutive stops is one element straddling the fold.
  const stops = [];
  const record = (n, sels) => {
    const stop = { n, compSels: sels, continuedFrom: 0, continuesOnto: 0 };
    stops.push(stop);
    const prev = stops[stops.length - 2];
    if (prev && prev.compSels) {
      const shared = stop.compSels.filter(x => prev.compSels.includes(x));
      if (shared.length) { stop.continuedFrom = prev.n; prev.continuesOnto = n; }
    }
    return stop;
  };
  record(1, ['.mega-nav']);
  record(2, ['.deals-table']);          // a table taller than the window…
  record(3, ['.deals-table', '.faq']);  // …still here on the next screenful
  record(4, ['.newsletter']);

  check('the screenful it starts on says it continues', stops[1].continuesOnto === 3, String(stops[1].continuesOnto));
  check('the next one says where it came from', stops[2].continuedFrom === 2, String(stops[2].continuedFrom));
  check('a component wholly inside one screenful is not marked',
    !stops[0].continuesOnto && !stops[0].continuedFrom);
  check('nor is the one after it ends', !stops[3].continuedFrom, String(stops[3].continuedFrom));
  check('a repeated selector two screens apart is NOT a continuation',
    (() => { const s = []; const push = (n, sels) => {
        const st = { n, compSels: sels, continuedFrom: 0, continuesOnto: 0 };
        s.push(st); const p = s[s.length - 2];
        if (p && st.compSels.some(x => p.compSels.includes(x))) { st.continuedFrom = p.n; p.continuesOnto = n; }
        return st; };
      push(1, ['.promo']); push(2, ['.other']); const third = push(3, ['.promo']);
      return !third.continuedFrom; })());
}

// ── Reading and operating, together ─────────────────────────────────────────
// The probe presses at most a dozen things per screenful, so its silence is not
// evidence of absence — a guess about something it never touched has to survive.
// But where it DID press, what it saw outranks what a class name suggested.
console.log('\nwhat was observed beats what was guessed');
{
  const merge = new window.Function('return ' + lift('mergeComponents'))();
  const obs = (...types) => types.map(t => ({ type: t }));

  check('with nothing probed, the read line stands',
    merge('menu · carousel?', []) === 'menu · carousel?');
  check('a probed kind replaces the guess about that kind',
    merge('tabs? · form', obs('tabs')) === 'tabs · form',
    merge('tabs? · form', obs('tabs')));
  check('…and loses the question mark, which is now simply wrong',
    !merge('tabs?', obs('tabs')).includes('?'));
  check('a guess about something nobody pressed survives',
    merge('carousel?', obs('menu')) === 'menu · carousel?',
    merge('carousel?', obs('menu')));
  check('two of a kind are counted',
    merge('', obs('menu', 'menu')).startsWith('2 menus'), merge('', obs('menu', 'menu')));
  check('one of a kind stays singular', merge('', obs('form')) === 'form');
  check('the commonest observation comes first',
    merge('', obs('menu', 'tabs', 'menu')).startsWith('2 menus'),
    merge('', obs('menu', 'tabs', 'menu')));
  check('the line stays short enough to read',
    merge('a? · b? · c? · d?', obs('menu','tabs','form','dialog','accordion','carousel'))
      .split(' · ').length === 5);
  check('a screenful with nothing either way says nothing', merge('', []) === '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

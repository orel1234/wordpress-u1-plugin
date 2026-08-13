// The whole-page sweep's approval screen, against the real builders.
//
//   node scripts/verify-sweep.mjs
//
// A sweep over a twelve-screen page produces one list of everything on the page.
// Grouping it by the section it came from is what makes "do only the first
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

// Three sections: 2 components, none, 3 components. The empty one is what a
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

console.log('\ngrouping by section');
const groups = [...list.querySelectorAll('.sweep-group')];
check('a group per section that found something', groups.length === 2, String(groups.length));
check('the section that found nothing is not a group',
  !groups.some(g => g.dataset.stop === '2'), groups.map(g => g.dataset.stop).join());
check('the first is open, the rest closed', groups[0].open && !groups[1].open);
check('every component is present exactly once',
  list.querySelectorAll('.ai-bulk-row[data-bulk-idx]').length === 5);
check('each row lands under its own section',
  [...groups[0].querySelectorAll('[data-bulk-idx]')].map(r => r.dataset.bulkIdx).join() === '0,1' &&
  [...groups[1].querySelectorAll('[data-bulk-idx]')].map(r => r.dataset.bulkIdx).join() === '2,3,4');

console.log('\nwhat the summary says');
check('section 3 is named', /Section 3/.test(groups[1].querySelector('summary').textContent));
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

console.log('\nthe section picture');
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
console.log('\nticking a whole section off');
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

// Everything except what the model itself called weak. Those were ticked too,
// and the approve-all that follows applied them — so a guess flagged "no h1
// anywhere, I set level=2 as a guess, a specialist should verify" went onto the
// page beside the work that was actually asked for.
check('everything starts ticked except the low-confidence ones',
  [...list.querySelectorAll('.ai-bulk-row')].every((r) => {
    const low = /low/.test(r.querySelector('.ai-conf')?.textContent || '');
    return r.querySelector('.ai-bulk-tick').checked === !low;
  }));
check('…and a low-confidence row says why it is not ticked',
  [...list.querySelectorAll('.ai-bulk-row')]
    .filter(r => /low/.test(r.querySelector('.ai-conf')?.textContent || ''))
    .every(r => /read it first/.test(r.textContent)));

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
// that return value stops after the first section on every one of those
// sites. This models both kinds of page and asserts the loop reaches the bottom
// of each.
console.log('\nscrolling down a page that scrolls smoothly');
{
  const OVERLAP = /const SWEEP_OVERLAP = ([\d.]+);/.exec(panelSrc);
  check('the overlap is a real fraction below 1', OVERLAP && Number(OVERLAP[1]) > 0 && Number(OVERLAP[1]) < 1,
    OVERLAP ? OVERLAP[1] : 'not found');

  const scrollSrc = panelSrc.slice(panelSrc.indexOf('// Down one section, less the overlap.'),
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
console.log('\nwhat comes back from a section');
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
console.log('\ncounting what is on a section, locally');
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

// ── Why a section yielded nothing ─────────────────────────────────────────
// "Already mapped" is finished work. "Dismissed" is a judgement made once,
// possibly on another machine, and it is the only one of the two you might want
// to take back. They were reported as one sentence, so a run that returned
// nothing because everything had been dismissed read as "the tool found
// nothing".
console.log('\nwhy a section yielded nothing');
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
  check('a section lost entirely to dismissals says the word',
    /collected\.dismissed === collected\.skipped \? 'DISMISSED earlier'/.test(src));
  check('a mixed section still names how many were dismissed',
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
// nothing: it scrolled the whole page, photographed every section, and is
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

// ── The way back to the sections ─────────────────────────────────────────────
// Stopping a run to build what it had found left you in the components view
// with no route to the sections that were never searched. The survey was still
// there and unreachable, so the only apparent way on was to start over.
{
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const picks = /function renderSweepPicks[\s\S]*?\n}/.exec(src)[0];
  check('the components view counts the sections still to search',
    /still to search/.test(picks) && /data-back-to-sections/.test(picks));
  check('…and the way back actually goes back',
    /data-back-to-sections/.test(src) && /aiSweep\.phase = 'screens';\n  renderSweepScreens\(\);/.test(src));
  check('…and offers nothing when there is nothing left to search',
    /unsearched\n?\s*\?/.test(picks) || /\(unsearched$/m.test(picks) || /unsearched$/m.test(picks));
}

// ── One stage at a time ─────────────────────────────────────────────────────
// The two AI routes share every result panel and each one showed and hid
// itself — about twenty-five display writes over six containers, with nothing
// deciding. The whole-page route therefore stacked the sections list, a pending
// review card and a session-wide applied list all at once. Not a design: an
// absence of one.
console.log('\none stage at a time');
{
  const d = new JSDOM(`<!doctype html><body>
    <nav id="stageTrail"></nav>
    <div id="aiResults"></div><div id="aiMappings"></div><div id="aiBulkReview"></div>
    <div id="sweepPicks"></div>
    <details id="aiApproved"><summary>x<span id="aiApprovedN"></span></summary>
      <div id="aiApprovedList"></div></details>
    </body>`);
  const ctx = { window: d.window, document: d.window.document, mapMode: 'sweep',
                currentStage: 'none', escapeHtml: sandbox.escapeHtml,
                aiSweep: { stops: [{ n: 1, found: [{ id: 'a' }] }] } };
  ctx.globalThis = ctx;
  const src = [lift('setStage'), lift('renderStageTrail'), lift('stageHasContent')].join('\n') +
    '\nconst STAGE_PANELS = ' + /const STAGE_PANELS = (\{[\s\S]*?\n\});/.exec(panelSrc)[1] + ';' +
    '\nconst STAGE_IDS = ' + /const STAGE_IDS = (\[[^\]]*\]);/.exec(panelSrc)[1] + ';' +
    '\nconst STAGE_TRAIL = ' + /const STAGE_TRAIL = (\{[\s\S]*?\n\});/.exec(panelSrc)[1] + ';' +
    '\nconst STAGE_STANDS_FOR = ' + /const STAGE_STANDS_FOR = (\{[^}]*\});/.exec(panelSrc)[1] + ';';
  new d.window.Function('c', `with (c) { ${src}; c.setStage = setStage;
    c.STAGE_PANELS = STAGE_PANELS; c.STAGE_IDS = STAGE_IDS; }`)(ctx);

  const shown = () => ctx.STAGE_IDS.filter((id) => d.window.document.getElementById(id).style.display !== 'none');

  let worst = null;
  for (const stage of Object.keys(ctx.STAGE_PANELS)) {
    ctx.setStage(stage);
    const on = shown();
    const want = ctx.STAGE_PANELS[stage];
    if (on.length !== want.length || on.some((x) => !want.includes(x))) {
      worst = `${stage}: showed ${on.join()} wanted ${want.join()}`;
      break;
    }
  }
  check('every stage shows its own panel and nothing else', !worst, worst || '');

  // The stack in the screenshot, reproduced and then dispelled by one call.
  for (const id of ctx.STAGE_IDS) d.window.document.getElementById(id).style.display = 'block';
  check('four panels can be stacked by hand — that was the bug', shown().length === 5);
  ctx.setStage('screens');
  check('…and one setStage call takes the other four down',
    shown().join() === 'sweepPicks', shown().join());

  // The trail, per route.
  ctx.mapMode = 'sweep';
  ctx.setStage('components');
  const trail = d.window.document.getElementById('stageTrail');
  // Named after what you DO at each stage, and numbered. Three nouns of equal
  // weight, with which one you are on carried entirely by an underline, was
  // reported as not knowing what stage you are at.
  const label = (el) => el && el.querySelector('.crumb-label').textContent;
  check('the trail names the whole-page stages by what you do at them',
    /Pick sections.*Choose fixes.*Applied/s.test(trail.textContent), trail.textContent);
  check('…each numbered, because three nouns cannot say how far through you are',
    [...trail.querySelectorAll('.crumb-n')].map((n) => n.textContent).join() === '1,2,3',
    [...trail.querySelectorAll('.crumb-n')].map((n) => n.textContent).join());
  check('…and marks where you are', label(trail.querySelector('.crumb.is-at')) === 'Choose fixes',
    label(trail.querySelector('.crumb.is-at')));
  check('…in the markup too, not only in colour',
    trail.querySelector('.crumb.is-at').getAttribute('aria-current') === 'step');
  check('…and only one stage is ever the current one',
    trail.querySelectorAll('[aria-current="step"]').length === 1);
  const reachable = () => [...trail.querySelectorAll('[data-stage]')].map((b) => b.dataset.stage).join();
  check('…and the stage you came from is a way back', /screens/.test(reachable()), reachable());

  // "Only what is behind you" reads sensibly and is wrong the moment you use
  // it: go back to Screens and Components is ahead of you and dead, with the
  // components sitting right there. Reported as "I clicked one and then I
  // cannot click the rest".
  ctx.setStage('screens');
  check('…and from the first stage you can still go FORWARD to one that has content',
    /components/.test(reachable()), reachable());
  check('…while the stage you are on is never a control',
    !/screens/.test(reachable()), reachable());
  // Applied is empty in this fixture, so it must not look like a control.
  check('…and an empty stage is not offered', !/applied/.test(reachable()), reachable());
  const empty = trail.querySelector('.crumb.is-empty');
  check('…it is marked as empty rather than silently inert',
    !!empty && label(empty) === 'Applied', empty && empty.textContent);

  ctx.setStage('components');

  ctx.mapMode = 'auto';
  ctx.setStage('cards');
  check('the Automatic route gets its own words, not the sweep\'s',
    /Found.*Review.*Applied/s.test(trail.textContent), trail.textContent);
  // "Review and approve a batch" is a moment inside the card stage, not a
  // fourth step — the trail must not gain a crumb for it.
  ctx.setStage('review');
  check('a batch review shows as the stage it belongs to',
    label(trail.querySelector('.crumb.is-at')) === 'Review');

  ctx.mapMode = 'manual';
  ctx.setStage('none');
  check('Manual has no stages and shows no trail', trail.style.display === 'none');
}

// ── The applied list belongs to the batch, not the session ──────────────────
{
  const src = panelSrc;
  const fn = /function clearApproved\(\)[\s\S]*?\n}/.exec(src)[0];
  // It used to be `#aiApproved.innerHTML = ''`, which took the <summary> and
  // the count badge with it — and addApproved rebuilds only the inner list, so
  // after one re-scan the heading was gone for the rest of the session.
  check('clearing empties the list, not the section around it',
    /querySelector\('#aiApprovedList'\)/.test(fn) && !/aiApproved'\)\.innerHTML/.test(src));
  check('…and clears the count badge with it', /aiApprovedN/.test(fn));
  // Left to accumulate, the number crossed every run and every route switch and
  // read as the current batch.
  const starts = (src.match(/clearApproved\(\);/g) || []).length;
  check('every batch and every run starts it empty', starts >= 4, `${starts} call sites`);
  check('…and the heading says which it is',
    /Applied in this batch/.test(readFileSync(join(ROOT, 'panel.html'), 'utf8')));
  // The permanent record is elsewhere, which is why resetting loses nothing.
  check('…while the Mappings list, the real record, is untouched',
    !/clearApproved[\s\S]{0,200}mappingsList/.test(src));
}

// ── Nothing else may write display on those six ─────────────────────────────
{
  const ids = ['aiResults', 'aiMappings', 'aiBulkReview', 'sweepPicks', 'aiApproved'];
  const stray = [];
  panelSrc.split('\n').forEach((line, i) => {
    for (const id of ids) {
      if (new RegExp(`getElementById\\('${id}'\\)[^\\n]*\\.style\\.display\\s*=`).test(line)) {
        stray.push(`${i + 1}: ${line.trim().slice(0, 60)}`);
      }
    }
  });
  // This is the check that stops the stack coming back. Not "it looks right
  // today" — "there is exactly one place that can make it wrong".
  check('setStage is the only writer of display for the stage panels',
    stray.length === 0, stray.join(' | '));
}

// ── Saying what things are, screen by screen ────────────────────────────────
// The run stops on each section with every candidate numbered on the page and
// asks. What matters structurally: the marks have to survive the capture, the
// pause has to honour Stop, what you name must not be thrown away by the model
// call that follows, and a fully-named section must cost nothing.
console.log('\nsaying what things are');
{
  const src = panelSrc;

  // clearMarks strips the only binding between a row here and an element there.
  check('the capture can be asked to leave the numbers on the page',
    /keepMarks: sweepLabel\.on/.test(src) &&
    /if \(!\(opts && opts\.keepMarks\)\) \{\n\s*await inPage\(tab\.id, \(\) => window\.__u1SelectorIntel\.clearMarks\(\)\);/.test(src));
  check('…and the run takes them down however it ends',
    /const lblHost = document\.getElementById\('sweepLabel'\);[\s\S]{0,200}clearMarks/.test(src));

  // Stop during a pause must leave cleanly, and the section must not be
  // recorded as read — it was not.
  const pause = /if \(sweepLabel\.on\) \{[\s\S]*?\n      \}/.exec(src)[0];
  check('Stop during the pause breaks the run', /answer\.stopped\) break;/.test(pause));
  check('…and a section is only marked read on a path that finishes it',
    /answer\.done\)[\s\S]{0,900}markScreenRead\(stop\)/.test(pause));

  // A confirmed section is not sent to discover(). It is no longer FREE —
  // confirming now goes through the container-markup engine, a call per
  // component — because the free local measurement produced mappings whose
  // every sub-selector was the root selector again. The line must not claim a
  // charge did not happen.
  check('a confirmed section skips the section-wide model call',
    /stop\.cost = 0;/.test(pause));
  check('…and no longer claims nothing was charged for the components',
    /you confirmed — saved to Mappings and applied/.test(pause) &&
    !/component[\s\S]{0,40}no model call, nothing charged/.test(pause));

  // The one this whole round was about: prepareOne PREPARES. Six components
  // were built, reported done, and Mappings stayed empty.
  const conf = /async function confirmedToMapping[\s\S]*?\n}/.exec(src)[0];
  check('a confirmed component is actually saved, not just prepared',
    /const tpl = aiCardTemplate\(prepared\.idx\);/.test(conf) &&
    /await saveMappingEntry\(tpl, \{ refreshUi: false \}\)/.test(conf));
  check('…and applied to the page',
    /await applyMappingsBatch\(\[\{/.test(conf));
  check('…and lands in the drawer as each one finishes, not all at the end',
    /await loadMappingsList\(\);/.test(conf));
  check('…and a declined role question is not counted as saved',
    /saved\.cancelled\) return \{ err:/.test(conf));
  check('…and what is left over is what the model is shown, not everything',
    /const asking = collected\.candidates\.filter\(\(c\) => !handled\.has\(c\.selector\)\);/.test(src) &&
    /candidates: batches\[b\],/.test(src));

  // The model's answer used to replace stop.found wholesale, which is right
  // when it is the only source and wrong the moment it is not.
  check('the model call does not throw away what you named',
    /stop\.found = \(stop\.found \|\| \[\]\)\.filter\(\(f\) => f\.done\);/.test(src));

  // A label becomes a mapping through the same three functions the manual route
  // uses, so it carries the narrowing, the role question and the export.
  const toMap = /async function labelToMapping[\s\S]*?\n}/.exec(src)[0];
  check('a label goes through buildTemplate → saveMappingEntry → applyMappingsBatch',
    /buildTemplate\(type, root, desc\.fields/.test(toMap) &&
    /saveMappingEntry\(tpl/.test(toMap) &&
    /applyMappingsBatch\(/.test(toMap));
  check('…and asks the page to measure the fields rather than a model',
    /describeComponent\(t, m, f\)/.test(toMap) && !/U1AI\./.test(toMap));
  // Marks are wiped by anything that re-reads the page; the row's selector is
  // not. A component still plainly on the page must never fail to build.
  check('…and a lost mark is rescued by the row\'s own selector',
    /\[type, marks, rootOverride \|\| ''\]/.test(toMap) &&
    /if \(!els\.length && fallbackSel\)/.test(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8')));
  check('…and the naming pause is not what wipes them',
    /sweepLabel\.resolve \|\| \(aiSweep\.running && !held\)/.test(src));

// ── The whole section gets read, and the numbers stay on it ─────────────────
// Two failures with one cause between them: a 97-element section surveyed as
// "6 menus · form · dialog? · carousel?" came back as sixty rows of header and
// mega menu, and the numbers that bind a row to an element vanished the moment
// the mouse crossed the list. Both are about the section you are looking at
// being only partly there.
console.log('\nreading the whole section');
{
  const src = panelSrc;

  // Collecting is free; only the asking costs. Conflating the two is what cut
  // a section off at sixty in DOM order.
  check('collection is not capped at the model batch size',
    /const limit = SWEEP_COLLECT_MAX;/.test(src) &&
    !/surveyOnly\) \? 250 : 60/.test(src));
  check('…and the survey and the paid read collect the same amount',
    !/opts\.surveyOnly.*\?.*:.*\d\d/.test(/const limit = [^\n]*/.exec(src)[0]));
  check('the budget is spent in batches instead, so nothing is dropped',
    /for \(let b = 0; b < asking\.length; b \+= SWEEP_ASK_BATCH\)/.test(src) &&
    /batches\.push\(asking\.slice\(b, b \+ SWEEP_ASK_BATCH\)\)/.test(src));
  check('…every batch is asked about, not just the first',
    /for \(let b = 0; b < batches\.length; b\+\+\)/.test(src));
  check('…and their answers are merged into one section result',
    /components: parts\.flatMap\(\(p\) => p\.components \|\| \[\]\)/.test(src));
  check('a batch that fails does not throw away the ones that answered',
    /if \(died && !parts\.length\)/.test(src) && /part of this section failed/.test(src));

  // The number under the button is what was agreed to. A section that takes
  // two calls has to say two.
  check('the estimate counts calls, not sections',
    /function sweepCallsFor\(numbers\)/.test(src) &&
    /Math\.ceil\(\(s\.count \|\| 0\) \/ SWEEP_ASK_BATCH\)/.test(src));
  check('…and both the box and the dialog are given that count',
    /sweepEstimateHtml\(picked\.length, elements, sweepCallsFor\(picked\)\)/.test(src) &&
    /confirmSweepCost\(sections\.length, 0, ticked, sweepCallsFor\(sections\)\)/.test(src));

  // One mega menu is one question, not seventeen. `nested` is the collector's
  // own word for it and the labelling list was ignoring it.
  check('parts of a component already listed do not each get their own row',
    /const components = cands\.filter\(\(c\) => !c\.nested && c\.component\);/.test(src));
  check('…and a native link or button is not offered as work',
    /const isNative = \(c\) => \(c\.signals \|\| \[\]\)\.some\(\(s\) => NATIVE_SIGNAL\.test\(s\)\);/.test(src) &&
    /const bare = rest\.filter\(\(c\) => \(c\.signals \|\| \[\]\)\.length && !isNative\(c\) && c\.selector\);/.test(src));
  check('…while one that takes a click without being either can be given a role',
    /id="lblRoleBtn"/.test(src) && /id="lblRoleLink"/.test(src) &&
    /roleBtn\.id === 'lblRoleLink' \? 'link' : 'button'/.test(src));
}

// The marks, for real rather than by regex: this is the one the user sees.
{
  const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
  const d = new JSDOM(`<!doctype html><body>
    <button id="a">one</button><button id="b">two</button><a id="c" href="/x">three</a>
    </body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = d.window;
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 80, height: 20, left: 10, top: 30, bottom: 50, right: 90 });
  // jsdom implements neither; both are called for their effect on the page,
  // not for a value, so a no-op is the honest stand-in.
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.requestAnimationFrame = () => 0;
  w.cancelAnimationFrame = () => {};
  w.eval(INTEL);
  const S = w.__u1SelectorIntel;
  S.collectCandidates(60, null);
  const marked = w.document.querySelectorAll('[data-u1-mark]').length;
  check('the collector marks the elements it found', marked >= 3, String(marked));

  const drawn = S.drawMarks();
  const layer = () => w.document.getElementById('__u1_mark_layer__');
  check('drawing puts a numbered layer on the page', drawn >= 3 && !!layer(), String(drawn));

  // THE regression. showMark used to call clearOverlay(), and the labelling
  // pause calls showMark on every row hover — so one mouse movement took all
  // sixty numbers off the page and nothing put them back.
  S.showMark(1);
  check('hovering one row does not take the numbers off the page', !!layer());
  check('…and the highlight is a layer of its own', !!w.document.getElementById('__u1_mark_hilite__'));
  S.showMark(2);
  check('…still there after hovering a second row', !!layer());

  // Fixed coordinates written once are right until the page moves, and the
  // pause exists to be scrolled through.
  check('the numbers follow the page instead of being written once',
    /markFollowFn = onMove;/.test(INTEL) &&
    /window\.addEventListener\('scroll', markFollowFn, true\)/.test(INTEL));
  // …but only when the page MOVES. Re-requesting a frame at the end of every
  // pass meant 250 marks did 250 rect reads and as many style writes sixty
  // times a second, for as long as they were up — and the sweep leaves them up
  // on purpose while you name things. A section that takes seconds sat at
  // fourteen minutes.
  check('…and not on every frame, forever',
    // place() must END the pass, not queue the next one. The old form put the
    // rAF call as its own last statement, which is what made it perpetual.
    /markFollowRaf = 0;\s*\n\s*\};/.test(INTEL) &&
    /const onMove = \(\) => \{\s*\n\s*if \(markFollowRaf\) return;/.test(INTEL));
  // The hover highlight must not be built on the numbered layer's id, or using
  // it removes the numbers — the same bug, one function along.
  check('…and the hover highlight owns a different layer from the numbers',
    /function highlightSelector[\s\S]*?layer\.id = HILITE_LAYER;/.test(INTEL) &&
    !/function highlightSelector[\s\S]*?layer\.id = MARK_LAYER;/.test(INTEL));

  S.clearMarks();
  check('clearing still takes both layers down',
    !layer() && !w.document.getElementById('__u1_mark_hilite__') &&
    w.document.querySelectorAll('[data-u1-mark]').length === 0);
}

// ── "Do not stop" has to mean the whole job, not half of it ─────────────────
// The mode says "read the rest of the page and make everything accessible on
// its own". It used to find components, log them, and leave every one to be
// built by hand from a drawer — and the approval card prepareOne renders was
// left standing, which holds the cards stage open and sat over the panel in
// the one mode whose entire promise is that nothing will ask.
console.log('\nnot stopping means finishing');
{
  const src = panelSrc;
  const loop = /for \(let i = 0; i < stops\.length; i\+\+\) \{[\s\S]*?\n    \}\n  \} catch/.exec(src)[0];

  check('the silent mode builds what it finds, in the run',
    /if \(!sweepPause\.on && !sweepLabel\.on\) \{/.test(loop) &&
    /await confirmedToMapping\(\s*\n?\s*\{ mark: null, type: todo\[b\]\.type, sel: todo\[b\]\.sel \}, stop, tab\)/.test(loop));
  check('…one at a time, so each lands in the drawer as it finishes',
    /for \(let b = 0; b < todo\.length && !aiSweep\.abort; b\+\+\)/.test(loop));
  check('…and Stop still gets out of it',
    /&& !aiSweep\.abort;/.test(loop));
  check('…and the section says what it actually built',
    /made accessible — saved to Mappings/.test(loop));

  const conf = /async function confirmedToMapping[\s\S]*?\n}/.exec(src)[0];
  check('the approval card is taken down once it has been saved',
    /\.ai-map-card\[data-card="\$\{prepared\.idx\}"\]`\)\?\.remove\(\)/.test(conf));
  check('…and the card stage closes with it, rather than staying open on nothing',
    /if \(!document\.querySelectorAll\('#aiSlideTrack \.ai-map-card:not\(\[data-done\]\)'\)\.length\)/.test(conf));
  // aiCardTemplate reads the card's own form, so the order matters.
  check('…and only after the template has been read out of it',
    conf.indexOf('aiCardTemplate(prepared.idx)') < conf.indexOf('.remove()'));
}

// ── The Scan tab shows one scan at a time ───────────────────────────────────
//
// It holds two, answering unrelated questions: what is wrong with this page,
// and whether the mappings still work. They were shown together, so a page
// scan left the previous mapping run sitting under it — "36 links have no
// accessible text" directly above "45 tested · 5 failing" reads as one finding
// about one thing.
console.log('\none scan on screen at a time');
{
  const src = panelSrc;
  const html = readFileSync(join(ROOT, 'panel.html'), 'utf8');

  check('there is one place that decides which is visible',
    /function showOnlyScan\(which\)/.test(src));
  check('…and running the page scan hides the mapping results',
    /showOnlyScan\('static'\)/.test(src));
  check('…and running the mapping test hides the page scan',
    /showOnlyScan\('mappings'\)/.test(src));
  check('…and neither section sets its own display any more',
    !/getElementById\('elemScanSection'\)\.style\.display = 'block'/.test(src));
  check('the results are hidden, not thrown away',
    /if \(m\) m\.style\.display = which === 'mappings' \? 'block' : 'none';/.test(src) &&
    !/elemScanResults'\)\.innerHTML = ''[\s\S]{0,80}showOnlyScan/.test(src));
  check('…and the card that produced them says so',
    /c\.classList\.toggle\('is-showing'/.test(src) &&
    /\.scan-choice-card\.is-showing/.test(readFileSync(join(ROOT, 'styles.css'), 'utf8')));
  check('both scans still have their own button',
    /id="scanBtn"/.test(html) && /id="elemScanBtn"/.test(html));
}

// ── Holding after each section so its fixes can be built ────────────────────
// Ticking all twenty-three sections used to be thirty-five minutes and $14
// before the components view was reached even once: the loop only reached
// phase='components' after the LAST section. What matters structurally is that
// the hold is inside the loop, that the run genuinely resumes from it, that
// Stop can end a wait nothing else will end, and that the make-accessible
// button is let through the guard that a run normally holds it behind.
console.log('\nholding after each section');
{
  const src = panelSrc;
  const loop = /for \(let i = 0; i < stops\.length; i\+\+\) \{[\s\S]*?\n    \}\n  \} catch/.exec(src)[0];

  check('the hold is inside the loop, not after it',
    /await pauseForFixes\(stop, rest\)/.test(loop));
  check('…and it only holds when there is something to build',
    /const buildable = stop\.found\.filter\(\(f\) => !f\.done\)\.length;/.test(loop) &&
    /sweepPause\.on && buildable/.test(loop));
  check('…and never after the last section, where there is nothing to continue to',
    /rest = stops\.length - \(i \+ 1\)/.test(loop) && /rest > 0/.test(loop));
  check('Stop during the hold breaks the run',
    /if \(out\.stopped\) break;/.test(loop));
  check('…and continuing puts it back to being a run',
    /aiSweep\.phase = 'screens';[\s\S]{0,120}setPlayButtons\(false\)/.test(loop));

  const fn = /function pauseForFixes[\s\S]*?\n}/.exec(src)[0];
  check('the hold shows the real components view, not a copy of it',
    /renderSweepPicks\(\)/.test(fn) && /aiSweep\.phase = 'components'/.test(fn));
  check('…and stops the busy overlay, because nothing is working',
    /clearSweepBusy\(\)/.test(fn));
  check('the wait is reachable from outside, so Stop can end it',
    /sweepPause\.resolve = finish;/.test(fn) &&
    /if \(sweepPause\.resolve\) sweepPause\.resolve\(\{ stopped: true \}\)/.test(src));
  check('opting out of every further hold is offered where it is felt',
    /sweepPause\.on = !e\.target\.checked/.test(fn));

  // The guard exists so a run cannot be started on top of itself. The hold is
  // the one moment the run is there specifically so this button can be pressed.
  check('the make-accessible button is let through while the run holds',
    /if \(aiSweep\.running && !sweepPause\.resolve\) return;/.test(src));
  check('the hold is offered before the run starts, not only during it',
    /id="sweepPauseTick"/.test(src) &&
    /e\.target\.id === 'sweepPauseTick'/.test(src));
  check('…and is on by default', /const sweepPause = \{ on: true/.test(src));

  // A throw inside the loop skips the hold's own finish().
  check('a run that dies while holding takes the banner down with it',
    /sweepPause\.resolve = null;[\s\S]{0,200}getElementById\('sweepResume'\)/.test(src));
}
  check('…and a declined role question does not leave a half-made mapping',
    /saved\.cancelled\) return \{ err/.test(toMap));

  // Hovering a row lights the element. showMark has been exported since the
  // set-of-mark work and never had a caller.
  check('hovering a row lights that element on the page',
    /showMark\(m\), \[n\]\)/.test(src));
  // …and now shows it as a picture in the panel too, cut from the screenshot
  // this section already produced. Hovering a row should not scroll the site.
  check('…and shows the element itself, cropped from the section screenshot',
    /function elementCrop\(shot, viewport, box, img\)/.test(src) &&
    /crops\.set\(n, c \? elementCrop\(collected\.shot, collected\.viewport, c\.box, shotImg\) : ''\)/.test(src));
  // Drawn into the rows up front, not only on hover — the number was never the
  // thing you wanted to see, and a wall of numbers is what the list used to be.
  check('…and the crop is in the row itself, where the number used to be',
    /shotImg\.onload = \(\) => \{/.test(src) &&
    /holder\.querySelector\('\.lbl-img'\)\.src = src;/.test(src) &&
    /class="lbl-thumb" data-mark=/.test(src));
  // Hovering marks the element on the REAL page instead of enlarging a copy of
  // a picture already in the row.
  check('…and hovering it marks that element on the page, not a bigger picture',
    /inPage\(tab\.id, \(m\) => window\.__u1SelectorIntel\.showMark\(m\), \[n\]\)/.test(src) &&
    !/lbl-preview/.test(src));
  check('…and leaving the list takes the highlight down',
    /window\.__u1SelectorIntel\.clearHilite\(\)/.test(src) &&
    /clearHilite,/.test(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8')));
  check('…which costs no capture, because the shot is already in hand',
    !/captureScreen/.test(/function elementCrop[\s\S]*?\n}/.exec(src)[0]));
  // And the group case, which is the reason this exists at all.
  check('several ticked rows can be declared ONE component',
    /Add the ticked ones as this/.test(src) && /const marks = \[\.\.\.sweepLabel\.marks\]/.test(src));
  // The row says what it is and can be corrected there. One dropdown at the
  // bottom governing every ticked row at once is unusable the moment two rows
  // differ, and it was not clear what it applied to even when they did not.
  check('each component row carries its own type, correctable in place',
    /class="lbl-row-type"/.test(src) &&
    /r\.querySelector\('\.lbl-row-type'\)\.value/.test(src));
  check('confirming builds each row as the type its own control says',
    /const res = await confirmedToMapping\(ticked\[k\], stop, tab\);/.test(src) &&
    /type: pick\.type, found: sel, container/.test(src));
  // The engine that reads the container's HTML, not the one that measures it
  // from outside. describeComponent collapsed every sub-selector onto the root:
  //   fix.tabs('.finder__tabs', { selectors: { tabList: '.finder__tabs' } })
  check('…through rowFromParts and prepareOne, so the parts are real selectors',
    /async function confirmedToMapping\(pick, stop, tab\)/.test(src) &&
    /const built = rowFromParts\(\{/.test(/async function confirmedToMapping[\s\S]*?\n}/.exec(src)[0]) &&
    /await prepareOne\(built\.row, tab\)/.test(/async function confirmedToMapping[\s\S]*?\n}/.exec(src)[0]));
  check('…and a trigger-rooted type still gets its panel supplied',
    /triggerRequired\(pick\.type\) \|\| triggerFirstType\(pick\.type\)/.test(src));
  // A redraw of the list would take the pause's own host with it.
  check('an open pause is not destroyed by a redraw of the list it lives in',
    /if \(sweepLabel\.resolve\) return;/.test(src));
  // The collector's selector is a guess, not a decision.
  check('…and the selector it proposes can be corrected in the row',
    /class="lbl-sel-edit"/.test(src) &&
    /async function labelToMapping\(type, marks, stop, tab, rootOverride\)/.test(src) &&
    /root = rootOverride;/.test(src));
  check('…and a corrected selector is checked against the page before it is used',
    /That selector is not valid CSS/.test(src) && /That selector matches nothing on this page/.test(src));
  check('…and there is one press to stop being asked at all',
    /id="sweepSilentTick"/.test(src) && /if \(answer\.auto\)/.test(src) &&
    /sweepLabel\.on = false;/.test(src) && /sweepPause\.on = false;/.test(src));
  // It governs the whole run, so it belongs with the switches that do — not at
  // the bottom of a pause you only reach after committing to the run.
  check('…and it sits with the other two run switches, not inside the pause',
    /id="sweepPauseTick"/.test(src) && /id="sweepSilentTick"/.test(src) &&
    !/id="lblAutoRest"/.test(src));
  check('…including from the folded-away plain elements',
    /lbl-plain/.test(src) && /six buttons that are a tab strip/i.test(src) &&
    /Missed something\?/.test(src));

  // What you name is also ground truth. fixtures/step.labels.json is what
  // verify-detect scores against, and its own header insists it be written by
  // reading the page rather than by blessing the tool's output — which is
  // exactly what a hand-typed label is.
  const exp = /getElementById\('exportLabelsBtn'\)[\s\S]*?\n\}\);/.exec(src)[0];
  check('what you named is kept as ground truth',
    /rememberLabel\(\{/.test(src) && /LABELS_KEY/.test(src));
  check('…privately, so it never travels in a project export',
    /PRIVATE_PREFIX \|\| '__'\) \+ 'labels'/.test(src));
  check('…and exports in the corpus shape, field for field',
    /components: list\.map/.test(exp) && /type: l\.type, root: l\.root, why: l\.why/.test(exp));
  check('…carrying the warning about what makes a corpus worthless',
    /can only ever score 100%/.test(exp));
  check('naming the same thing twice is a correction, not a second example',
    /findIndex\(\(x\) => x\.root === entry\.root && x\.type === entry\.type\)/.test(src));
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

// ── Choosing which sections to pay to read ───────────────────────────────────
console.log('\nchoosing screens');
{
  const d2 = new JSDOM(`<!doctype html><body>
    <div id="sweepPicks"><div id="sweepPicksSummary"></div><div id="sweepPicksList"></div>
    <div id="sweepEstimate"></div><button id="sweepMakeBtn"></button></div>
    <div id="sweepBusy"></div>
    <nav id="stageTrail"></nav>
    <div id="aiResults"></div><div id="aiMappings"></div>
    <div id="aiBulkReview"></div><details id="aiApproved"><div id="aiApprovedList"></div></details>
    </body>`);
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
    saveSweepNow: () => { saved++; return Promise.resolve(); },
    // The sweep panel belongs to the Whole page route, so the render functions
    // ask which route is on screen. These tests are about that route.
    mapMode: 'sweep',
    currentStage: 'none',
    // showSweepBusy owns a module-level interval handle in panel.js.
    sweepBusyTimer: null,
    // Whether the run holds after each section for its fixes to be built. The
    // sections summary draws its tick from this, so the render needs it here.
    sweepPause: { on: true, resolve: null },
    // The third run switch is drawn from this, so the render needs it too.
    sweepLabel: { on: true, resolve: null, marks: new Set(), busy: false },
    setInterval: (...a) => w2.setInterval(...a),
    clearInterval: (...a) => w2.clearInterval(...a),
    // A busy section is asked about in more than one call, and the estimate
    // says so — so the batch size has to be here for it to work it out.
    SWEEP_ASK_BATCH: 60,
    SWEEP_EST: { scanBase: 10, scanPerElement: 0.85, fixSecs: 15, fixPerElements: 6, fallbackCall: 0.13, fixCall: 0.10 },
    aiSweep: { phase: 'screens', stops: [
      { n: 1, thumb: PIXEL, count: 14, inventory: '6 links, 3 buttons', sticky: 27, truncated: false, found: [] },
      { n: 2, thumb: PIXEL, count: 0,  inventory: '',                   sticky: 0,  truncated: false, found: [] },
      { n: 3, thumb: PIXEL, count: 60, inventory: '18 links, 2 tabs',   sticky: 0,  truncated: true,  found: [] },
    ] },
  };
  box.globalThis = box;
  const src2 = [lift('renderSweepScreens'), lift('sweepScreenRowHtml'), lift('sweepEstimateHtml'),
                lift('syncSweepMakeBtn'), lift('showSweepBusy'), lift('clearSweepBusy'),
                lift('markScreenReading'), lift('markScreenRead'),
                lift('sweepRunningHtml'), lift('markScreenFailed'), lift('sweepSettledHtml'),
                lift('setPlayButtons'), lift('sweepSecsFor'), lift('sweepCallsFor'),
                // The real stage owner, so these tests exercise the thing that
                // ships rather than a stand-in that cannot drift with it.
                lift('setStage'), lift('renderStageTrail'), lift('resumeStage'),
                lift('stageHasContent')].join('\n') +
    '\nconst STAGE_PANELS = ' + /const STAGE_PANELS = (\{[\s\S]*?\n\});/.exec(panelSrc)[1] + ';' +
    '\nconst STAGE_IDS = ' + /const STAGE_IDS = (\[[^\]]*\]);/.exec(panelSrc)[1] + ';' +
    '\nconst STAGE_TRAIL = ' + /const STAGE_TRAIL = (\{[\s\S]*?\n\});/.exec(panelSrc)[1] + ';' +
    '\nconst STAGE_STANDS_FOR = ' + /const STAGE_STANDS_FOR = (\{[^}]*\});/.exec(panelSrc)[1] + ';' +
    '\nconst sweepPicked = ' + /const sweepPicked = ([\s\S]*?);\n/.exec(panelSrc)[1] + ';' +
    '\nconst sweepPickedScreens = ' + /const sweepPickedScreens = ([\s\S]*?);\n/.exec(panelSrc)[1] + ';' +
    '\nconst sweepAvgCall = ' + /const sweepAvgCall =([\s\S]*?);\n/.exec(panelSrc)[1] + ';' +
    '\nconst sweepTimesMeasured = ' + /const sweepTimesMeasured =([\s\S]*?);\n/.exec(panelSrc)[1] + ';' +
    '\nconst mins = ' + /const mins = ([\s\S]*?);\n/.exec(panelSrc)[1] + ';';
  new w2.Function('ctx', `with (ctx) { ${src2}
    ctx.renderSweepScreens = renderSweepScreens; ctx.sweepPickedScreens = sweepPickedScreens;
    ctx.syncSweepMakeBtn = syncSweepMakeBtn; ctx.showSweepBusy = showSweepBusy;
    ctx.clearSweepBusy = clearSweepBusy; ctx.markScreenReading = markScreenReading;
    ctx.markScreenRead = markScreenRead; ctx.markScreenFailed = markScreenFailed;
    ctx.sweepRunningHtml = sweepRunningHtml; ctx.setStage = setStage;
    ctx.resumeStage = resumeStage; ctx.setPlayButtons = setPlayButtons;
    ctx.sweepScreenRowHtml = sweepScreenRowHtml; ctx.sweepSecsFor = sweepSecsFor; }`)(box);

  box.renderSweepScreens();
  const l2 = w2.document.getElementById('sweepPicksList');
  const rows = [...l2.querySelectorAll('.sweep-screen')];
  check('every section is listed, including the empty one', rows.length === 3, String(rows.length));
  check('each shows its own element count and breakdown',
    /14 elements/.test(rows[0].textContent) && /6 links, 3 buttons/.test(rows[0].textContent),
    rows[0].textContent.replace(/\s+/g, ' '));
  check('the empty section cannot be ticked',
    rows[1].querySelector('.sweep-screen-tick').disabled &&
    !rows[1].querySelector('.sweep-screen-tick').checked);
  check('…and is marked as such rather than silently greyed',
    rows[1].classList.contains('is-empty'));
  check('the ones with content start ticked', box.sweepPickedScreens().join() === '1,3',
    box.sweepPickedScreens().join());
  // The sticky header is counted once. Ticking only the middle of a page would
  // otherwise silently leave out the site's main navigation.
  check('the section that took the sticky header says so',
    /includes the sticky header \(27\)/.test(rows[0].textContent),
    rows[0].textContent.replace(/\s+/g, ' '));
  check('and no other section claims it',
    !/sticky header/.test(rows[2].textContent));
  check('a section that hit the candidate cap says so in words',
    /only the first/.test(rows[2].textContent) && /60\+ elements/.test(rows[2].textContent),
    rows[2].textContent.replace(/\s+/g, ' '));
  check('one that did not is shown as a plain count',
    !/only the first/.test(rows[0].textContent) && /14 elements/.test(rows[0].textContent));
  check('the summary says nothing has been spent',
    /nothing spent yet/.test(w2.document.getElementById('sweepPicksSummary').textContent));

  // ── ▶ on one row: read this section, now ───────────────────────────────
  //
  // A page is worked through one section at a time — read one, build its
  // fixes, apply them, look at the page, read the next. Expressing that with a
  // list of ticks and one button at the bottom takes three actions per screen,
  // and two of them are chances to pay for a screen you did not mean.
  {
    const play = [...l2.querySelectorAll('.sweep-play')];
    check('every section that can be read has a ▶ of its own',
      play.length === 2, String(play.length));
    check('…carrying the screen number it will read, not a position in the list',
      play.map(b => b.dataset.playScreen).join() === '1,3',
      play.map(b => b.dataset.playScreen).join());
    check('the empty section has none — there is nothing to spend a call on',
      !rows[1].querySelector('.sweep-play'));
    // It spends money. A bare ▶ glyph is not a label.
    check('it says out loud that it is one section and one call',
      /only this section/i.test(play[0].title) && /one call/i.test(play[0].title),
      play[0].title);
    check('…and says the same to a screen reader, with the number in it',
      /section 1/i.test(play[0].getAttribute('aria-label')) &&
      /one call/i.test(play[0].getAttribute('aria-label')),
      play[0].getAttribute('aria-label'));
    // A completed screen keeps its ▶ — deliberately re-reading one is a real
    // thing to want — and the warning about paying twice lives on the dialog.
    check('a completed section keeps its ▶ rather than losing the option',
      /data-play-screen/.test(box.sweepScreenRowHtml({ ...box.aiSweep.stops[0], scanned: true })));
    check('the re-read warning is on the dialog that spends the money',
      /confirmSweepCost\(1, stop\.scanned \? n : 0, stop\.count, sweepCallsFor\(\[n\]\)\)/.test(panelSrc));
    check('…and confirmSweepCost has somewhere to put it',
      /function confirmSweepCost\(sections, rereading, elements, calls\)/.test(panelSrc) &&
      /has already been searched and paid for/.test(panelSrc));
    // A ▶ quotes the time for THAT section, not for an average one — which is
    // the whole point of the estimate now scaling with what is on the screen.
    check('…and the ▶ hands it that section\'s own element count',
      /confirmSweepCost\(1, [^,]*, stop\.count,/.test(panelSrc));
    // One press, one section, through the same function every other run uses —
    // so it gets the same stop button, log, labelling pause and saved progress.
    check('it runs through scanPickedScreens with just that number',
      /scanPickedScreens\(\[n\]\)/.test(panelSrc));
    check('it refuses to start a second scan on top of a running one',
      /data-play-screen[\s\S]{0,900}?if \(aiSweep\.running\)/.test(panelSrc));
    // The rows are not redrawn during a run, so the ▶s that were live a moment
    // ago have to be disarmed where they stand.
    box.setPlayButtons(false);
    check('a run disarms every ▶ in place', play.every(b => b.disabled));
    box.setPlayButtons(true);
    check('…and they come back when it ends', play.every(b => !b.disabled));
    check('a run disarms them at its start', /setPlayButtons\(false\)/.test(panelSrc));
  }

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
  check('the estimate counts SCREENS of one page, not pages',
    /Ticked: 2 sections on 1 page/.test(est.textContent), est.textContent.replace(/\s+/g, ' ').slice(0, 60));
  // One press starts the run; there is no invisible arming step that relabels
  // the button and writes the cost below the fold.
  check('reading is one press behind a visible dialog, not two presses',
    /confirmSweepCost\(sections\.length, 0, ticked, sweepCallsFor\(sections\)\)/.test(panelSrc) && !/aiSweep\.armed/.test(panelSrc));
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
  check('the build row is marked as conditional, not a forecast',
    /costs only for the components you then tick/.test(est.textContent));
  // Three stages, each saying whether it costs anything. With the free one left
  // off, the two paid rows looked like the whole of the work.
  check('the free stage is listed beside the two that cost',
    /Survey/.test(est.textContent) && /free/.test(est.textContent),
    est.textContent.replace(/\s+/g, ' ').slice(0, 80));
  check('with nothing measured yet it says the numbers are estimates',
    /tighten once the first section has been read/.test(est.textContent),
    est.textContent.replace(/\\s+/g, " ").slice(-90));

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
  // pick up the ones that failed quietly re-charged for every section.
  {
    const withDone = { phase: 'screens', stops: box.aiSweep.stops.map((x, i) => ({ ...x, scanned: i === 0 })) };
    const was = box.aiSweep;
    box.aiSweep = withDone;
    box.renderSweepScreens();
    // By screen number, not by position: the list is now split into areas, so
    // document order no longer matches stop order.
    const row = (n) => w2.document.querySelector(`#sweepPicksList .sweep-screen[data-screen="${n}"]`);
    check('a section already read comes back UNTICKED',
      row(1).querySelector('.sweep-screen-tick').checked === false);
    check('…and says so on the row', /completed/i.test(row(1).textContent));
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
      parts[1].tagName === 'DETAILS' && /Completed · 1/.test(parts[1].textContent));
    check('the unread rows are in the first area and the read ones are not',
      parts[0].contains(row(3)) && parts[1].contains(row(1)));
    check('"read all" counts the unread ones, not everything',
      /Read all 1 section that have not been read yet/.test(w2.document.getElementById('sweepPicksSummary').textContent),
      w2.document.getElementById('sweepPicksSummary').textContent.replace(/\s+/g, ' '));
    // The half-ticked state is the commonest one on this screen and used to be
    // an unexplained dash.
    check('…and says how many are already paid for, and that they are free',
      /1 already read/.test(w2.document.getElementById('sweepPicksSummary').textContent) &&
      /cost nothing/.test(w2.document.getElementById('sweepPicksSummary').textContent));
    // Stopping and not stopping are two answers to one question. Both ticked is
    // a state the run cannot honour; both empty is no answer.
    check('the two run modes cannot both be chosen',
      [...w2.document.querySelectorAll('#sweepPicksSummary input[name="sweepMode"]')].length === 2 &&
      [...w2.document.querySelectorAll('#sweepPicksSummary input[name="sweepMode"]')]
        .every((r) => r.type === 'radio'));
    box.aiSweep = was;
    box.renderSweepScreens();
  }

  // As it happens, not only at the end. Nothing updated the list during a run:
  // ten sections in, the ten already paid for still looked like work to do, and
  // pressing Read again read them a second time.
  {
    box.renderSweepScreens();
    const three = box.aiSweep.stops[2];
    const before = w2.document.getElementById('sweepMakeBtn').textContent;
    three.scanned = true;
    await box.markScreenRead(three);
    const row = w2.document.querySelector('#sweepPicksList .sweep-screen[data-screen="3"]');
    check('a section is marked read the moment it is read',
      row.classList.contains('is-done') && /completed/i.test(row.textContent));
    check('…and unticks itself, so pressing Read again does not pay for it twice',
      row.querySelector('.sweep-screen-tick').checked === false);
    check('…and the estimate comes down as the run goes',
      w2.document.getElementById('sweepMakeBtn').textContent !== before,
      `${before} -> ${w2.document.getElementById('sweepMakeBtn').textContent}`);
    check('…and it is persisted, so stopping halfway keeps what was paid for',
      saved > 0, `${saved} saves`);
    // Awaited at the boundary, not left on a debounce that may not have fired
    // when the panel closes. "Finish one, save it, move to the next."
    const psrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
    check('…and the save at a section boundary is awaited, not debounced',
      /return saveSweepNow\(\);/.test(psrc) && /await markScreenRead\(stop\);/.test(psrc));
    check('…and a completed section shows what it gave',
      /class="sweep-outcome"/.test(psrc));
    // Two numbering systems were shown with one word: the counter is the
    // position in THIS run, the sections have numbers of their own. "Searching
    // section 2 of 23" was read as screen 2, which was already completed.
    check('the progress names the screen as well as the position in the run',
      /Searching section \$\{stop\.n\} — \$\{i \+ 1\} of \$\{stops\.length\}/.test(psrc));
  }

  // A section that completes DURING a run moves into the completed area then,
  // not when the run ends. Screen 1 finished and sat under "still to search"
  // while the drawer below said COMPLETED · 3 — answering for the previous run.
  {
    const st = box.aiSweep.stops;
    st[0].scanned = true;                 // one already done, so both areas exist
    box.renderSweepScreens();
    const doneArea = w2.document.querySelector('#sweepPicksList .sweep-part-done');
    check('with one completed there are two areas to move between', !!doneArea);

    st[2].scanned = true;
    st[2].outcome = '3 components';
    await box.markScreenRead(st[2]);
    const moved = w2.document.querySelector('#sweepPicksList .sweep-part-done .sweep-screen[data-screen="3"]');
    check('a section completing mid-run moves into the completed area at once', !!moved);
    // Zero left, and correctly so: the only remaining section is the empty
    // one, which was never pickable and must not be counted as owed work.
    check('…and both counts follow it',
      /Completed · 2/.test(w2.document.querySelector('.sweep-part-done summary').textContent) &&
      /Still to search · 0/.test(w2.document.querySelector('#sweepPicksList .sweep-part > h4').textContent),
      w2.document.querySelector('.sweep-part-done summary').textContent + ' | ' +
      w2.document.querySelector('#sweepPicksList .sweep-part > h4').textContent);
    st[0].scanned = false; st[2].scanned = false; delete st[2].outcome;
    box.renderSweepScreens();
  }

  // What the completed sections are WORTH, and a way to act on it before the
  // rest of the run finishes. The components found in completed sections were
  // unreachable until the whole run ended — eight minutes on a page like this.
  {
    const st = box.aiSweep.stops;
    st[0].scanned = true;
    st[0].found = [{ id: 'a', label: 'Main nav', type: 'menu', sel: '#nav' },
                   { id: 'b', label: 'Search', type: 'combobox', sel: '#q' }];
    box.renderSweepScreens();
    const sum = w2.document.querySelector('.sweep-part-done summary');
    check('the completed drawer says how many components are in it',
      /2 components found/.test(sum.textContent), sum.textContent);
    check('…and offers to build them without finishing the run',
      !!sum.querySelector('[data-build-found]'));
    check('…and the drawer opens itself once it holds something',
      w2.document.querySelector('.sweep-part-done').hasAttribute('open'));

    // Nothing found yet is not an offer.
    st[0].found = [];
    box.renderSweepScreens();
    check('a drawer with nothing in it makes no offer',
      !w2.document.querySelector('.sweep-part-done summary [data-build-found]'));

    // Components already built are not offered a second time.
    st[0].found = [{ id: 'a', label: 'Main nav', type: 'menu', sel: '#nav', done: true }];
    box.renderSweepScreens();
    check('…nor are components already built',
      !w2.document.querySelector('.sweep-part-done summary [data-build-found]'));

    st[0].scanned = false; st[0].found = [];
    box.renderSweepScreens();

    // Stopping is what releases them, so the button presses Stop rather than
    // inventing a second path into the same place.
    const psrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
    const h = /closest\('\[data-build-found\]'\)[\s\S]{0,1400}/.exec(psrc)[0];
    check('the offer stops the run rather than racing it',
      /aiSweep\.abort = true/.test(h) && /while.*aiSweep\.running|aiSweep\.running;/.test(h));
    check('…and does not fold the drawer it lives in', /stopPropagation\(\)/.test(h));
  }

  // The box under the button described the NEXT press while the button
  // described the run in progress — two different moments, stacked.
  {
    const st = box.aiSweep.stops;
    st[0].scanned = true; st[0].cost = 0.13;
    st[0].found = [{ id: 'a', label: 'Nav', type: 'menu', sel: '#n' }];
    box.aiSweep.running = true;
    box.aiSweep.progress = { at: 2, of: 22, screen: 6 };
    box.syncSweepMakeBtn();
    const est2 = w2.document.getElementById('sweepEstimate');
    // The bar at the top and the button at the bottom are read together, so a
    // difference in wording between them reads as a difference in meaning.
    const psrc2 = readFileSync(join(ROOT, 'panel.js'), 'utf8');
    const POSITION = 'Section ${stop.n} — ${i + 1} of ${stops.length}';
    check('the top bar and the button word the position identically',
      psrc2.includes('showSweepBusy(`' + POSITION + '`') &&
      psrc2.includes('btn.textContent = `Searching section ${stop.n} — ${i + 1} of ${stops.length}…`'),
      'they must be the same phrase in both places');
    check('while a run is going the box is about that run',
      /Searching · section 6 · 2 of 22/.test(est2.textContent), est2.textContent.replace(/\s+/g, ' ').slice(0, 70));
    check('…and reports what has actually been spent, not a forecast',
      /Done1section\$0\.13/.test(est2.textContent.replace(/\s+/g, '')), est2.textContent.replace(/\s+/g, ' '));
    check('…and what is left of THIS run', /Left/.test(est2.textContent) && /~\$2\.60/.test(est2.textContent),
      est2.textContent.replace(/\s+/g, ' '));
    check('…and that stopping keeps what is done',
      /you can stop and build them/.test(est2.textContent));

    box.aiSweep.running = false;
    box.aiSweep.progress = null;
    st[0].scanned = false; st[0].cost = 0; st[0].found = [];
    box.renderSweepScreens();
    check('and when nothing is running it is back to what the next press costs',
      /Ticked:/.test(w2.document.getElementById('sweepEstimate').textContent));
  }

  // Attempted and failed is not the same as never tried, and it looked
  // identical: the run moved past two sections and left them in "still to
  // search" with their original survey line, so the only evidence anything had
  // happened was a gap in the numbering of the completed drawer.
  {
    const st = box.aiSweep.stops;
    box.renderSweepScreens();
    await box.markScreenFailed(st[2], 'Could not capture the page.');
    const row = w2.document.querySelector('#sweepPicksList .sweep-screen[data-screen="3"]');
    check('a screen that failed says so', /not read/i.test(row.textContent));
    check('…with the reason and what to do about it',
      /Could not capture the page/.test(row.textContent) && /press again to retry/.test(row.textContent));
    check('…and keeps its tick, because it really was not searched',
      row.querySelector('.sweep-screen-tick').checked === true);
    check('…and stays out of the completed drawer',
      !w2.document.querySelector('.sweep-part-done .sweep-screen[data-screen="3"]'));

    // Redrawn from storage, the failure has to still be there.
    box.renderSweepScreens();
    check('…and the mark survives a redraw',
      /not read/i.test(w2.document.querySelector('#sweepPicksList .sweep-screen[data-screen="3"]').textContent));

    // And a retry that works clears it.
    st[2].scanned = true; st[2].outcome = '2 components';
    await box.markScreenRead(st[2]);
    const after = w2.document.querySelector('.sweep-screen[data-screen="3"]');
    check('a successful retry clears the failure', !/not read/i.test(after.textContent) &&
      /completed/i.test(after.textContent));
    st[2].scanned = false; st[2].failed = null; delete st[2].outcome;
    box.renderSweepScreens();
  }

  // Exactly one section can be the one being read.
  {
    box.aiSweep.running = true;
    box.markScreenReading(1);
    box.markScreenReading(3);
    check('only one section is ever marked as being read',
      w2.document.querySelectorAll('.sweep-screen.is-reading').length === 1,
      [...w2.document.querySelectorAll('.sweep-screen.is-reading')].map(x => x.dataset.screen).join(','));
    box.markScreenReading(null);
    box.aiSweep.running = false;
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

// ── The whole page, not the first fifteen sections ────────────────────────
console.log('\nthe screen limit');
{
  const cap = Number(/const SWEEP_MAX_STOPS = (\d+);/.exec(panelSrc)[1]);
  check('the free survey is not cut off at fifteen screens', cap >= 60, String(cap));
  const comment = panelSrc.slice(panelSrc.indexOf('const SWEEP_MAX_STOPS') - 700,
                                 panelSrc.indexOf('const SWEEP_MAX_STOPS'));
  check('and the reason it moved is written down', /spending guard|costs nothing/.test(comment));
}

// ── Naming the components, for free ─────────────────────────────────────────
// "22 links, 19 buttons" says how busy a section is. "a nav, a carousel and a
// tab strip" says whether it is worth paying to read — and that is the choice
// the sections list exists to support. None of this needs the model, because the
// page declares it: role="tablist" IS a tab strip and <form> IS a form.
console.log('\nnaming what is on a section');
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
  check('a section of plain text says nothing at all', comps([{ component: '' }]) === '');
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

// Some sections came back with no boxes at all. Two causes, both fixed.
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
  //    drew nothing on exactly the section that most needed looking at.
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
    '<label class="sweep-all"><input type="checkbox" id="sweepAllTick" checked>Select all 2 readable sections</label>';
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
  check('an empty section is never ticked by it',
    !doc.querySelector('.is-empty .sweep-screen-tick').checked);
}

console.log('\nan element cut between two sections');
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
  record(3, ['.deals-table', '.faq']);  // …still here on the next section
  record(4, ['.newsletter']);

  check('the section it starts on says it continues', stops[1].continuesOnto === 3, String(stops[1].continuesOnto));
  check('the next one says where it came from', stops[2].continuedFrom === 2, String(stops[2].continuedFrom));
  check('a component wholly inside one section is not marked',
    !stops[0].continuesOnto && !stops[0].continuedFrom);
  check('nor is the one after it ends', !stops[3].continuedFrom, String(stops[3].continuedFrom));
  check('a repeated selector two sections apart is NOT a continuation',
    (() => { const s = []; const push = (n, sels) => {
        const st = { n, compSels: sels, continuedFrom: 0, continuesOnto: 0 };
        s.push(st); const p = s[s.length - 2];
        if (p && st.compSels.some(x => p.compSels.includes(x))) { st.continuedFrom = p.n; p.continuesOnto = n; }
        return st; };
      push(1, ['.promo']); push(2, ['.other']); const third = push(3, ['.promo']);
      return !third.continuedFrom; })());
}

// ── Reading and operating, together ─────────────────────────────────────────
// The probe presses at most a dozen things per section, so its silence is not
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
  check('a section with nothing either way says nothing', merge('', []) === '');
}

// ── The camera that lets you carry on working ──────────────────────────────
//
// captureVisibleTab photographs whatever tab is IN FRONT, whatever id it is
// handed, and throws when the window is minimised. With that as the only camera
// a scan cannot run while you work — it can only wait, and waiting is what it
// did.
//
// beginBackgroundCapture existed, with a paragraph of comment explaining
// exactly this, and NOTHING CALLED IT. Both entry points went through the
// focus-bound camera, and scanPickedScreens additionally yanked the tab in
// front of whatever you were doing. These checks are on the wiring, because the
// wiring is what was missing.
console.log('\nthe background camera — attached, not merely written');
{
  const calls = (panelSrc.match(/await announceCamera\(/g) || []).length;
  check('something actually turns it on', calls >= 2, `${calls} call sites`);
  // Both ends. Chrome's "is debugging this browser" banner stays up for exactly
  // as long as we are attached, so a run that ends without detaching leaves a
  // standing claim about the page that is no longer true.
  const detach = (panelSrc.match(/await endBackgroundCapture\(\)/g) || []).length;
  check('and both runs detach when they end', detach >= 2, `${detach} call sites`);
  // The survey and the paid read are two separate entry points and only one of
  // them had a finally that detached.
  const survey = panelSrc.slice(panelSrc.indexOf('async function runSweep('),
                                panelSrc.indexOf('function renderSweepScreens('));
  check('the survey turns it on', /await announceCamera\(tab\)/.test(survey));
  check('…and turns it off in its finally',
    /finally \{\s*\n[^}]*await endBackgroundCapture\(\)/.test(survey));
  const scan = panelSrc.slice(panelSrc.indexOf('async function scanPickedScreens('));
  check('the paid read turns it on', /const cam = await announceCamera\(tab\)/.test(scan));
  // The yank is the rude fallback, not the default. It used to run every time.
  check('it only steals the window when there is no background camera',
    /if \(!cam && !\(await pinnedTabIsVisible\(tab\)\)\)/.test(scan));
  // Which camera a run has decides whether you can switch tabs at all, so it is
  // not something to discover by trying it and watching the run stall.
  check('the run says in its log which camera it got',
    /background camera on — switch tabs/.test(panelSrc) &&
    /no background camera \(\$\{sweepCam\.why\}\)/.test(panelSrc));
  // Attached, no error, no picture is the worst of the three outcomes: it looks
  // like a working camera and produces nothing.
  check('an empty picture demotes the camera instead of being retried forever',
    /returned an empty picture/.test(panelSrc));
  check('Page is enabled before anything asks it for a screenshot',
    panelSrc.indexOf("'Page.enable'") > 0 &&
    panelSrc.indexOf("'Page.enable'") < panelSrc.indexOf("'Page.captureScreenshot'"));
  // The permission this whole path needs. Without it attach throws at runtime
  // and every run silently falls back to waiting.
  const mf = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  check('the manifest asks for the debugger permission',
    (mf.permissions || []).includes('debugger'), (mf.permissions || []).join());
}

// ── The way this camera hangs ───────────────────────────────────────────────
//
// Reported as "this is already far too much time" on a screen that never
// finished. It was not slow; it was never going to finish.
//
// Page.captureScreenshot defaults to fromSurface:true and photographs the
// BROWSER'S composited surface. A backgrounded tab produces no frames, so on a
// hidden tab the call does not fail, does not return an empty picture, and does
// not throw — it never settles, and `await` on it waits for the rest of the
// session. Which is precisely the tab this camera was attached to photograph:
// turning it on made "switch tabs and carry on" hang the run it was meant to
// keep going.
//
// Every other await in a section is already bounded — the model call has had
// its own AbortController all along. This was the one unbounded wait.
console.log('\nthe camera that can never answer');
{
  const cam = panelSrc.slice(panelSrc.indexOf('const sweepCam ='),
                             panelSrc.indexOf('async function awaitTabVisible'));
  check('no debugger command is awaited without a clock on it',
    !/await chrome\.debugger\.sendCommand/.test(panelSrc),
    'a bare sendCommand can hang forever');
  check('there is a helper that rejects rather than hanging',
    /function cdp\(tabId, method, params, ms = CDP_TIMEOUT_MS\)/.test(cam));
  check('…and the timeout is far outside a normal capture',
    /CDP_TIMEOUT_MS = (\d+)/.test(cam) && Number(RegExp.$1) >= 5000 && Number(RegExp.$1) <= 20000,
    RegExp.$1);
  // A timeout is not a shrug. fromSurface:false is the renderer-side path,
  // which needs no frames — it is the answer to this exact failure, so it is
  // tried before giving up on the camera.
  check('a timeout is retried on the path that needs no frames',
    /for \(const surface of \[true, false\]\)/.test(cam) &&
    /fromSurface: surface/.test(cam));
  // Sixteen seconds of silence per section, twenty-one sections: one slow
  // screen becomes a run nobody can sit through.
  check('and if neither answers the camera is demoted for the rest of the run',
    /sweepCam\.attached = false;\s*\n\s*sweepLog\(0, `background camera stopped working/.test(cam));
  check('…out loud, because it changes whether you can leave the tab',
    /from here this run needs its own tab in front/.test(cam));
  // Attaching is on the same protocol and can hang the same way — before the
  // first section, where it would look like a scan that never started.
  check('attaching is bounded too', /await cdp\(tab\.id, 'Page\.enable', \{\}, \d+\)/.test(cam));
  // The half that was already right, and must stay right.
  check('the model call keeps its own timeout',
    /CALL_TIMEOUT_MS/.test(readFileSync(join(ROOT, 'ai-advisor.js'), 'utf8')));
}

// And the same thing again against the real function, because a source check
// proves the code is written and not that it works. This is the exact shape of
// the failure: a command that never settles.
console.log('\n…and it really does give up, run for real');
{
  const box = { chrome: { debugger: { sendCommand: null } }, setTimeout, clearTimeout, CDP_TIMEOUT_MS: 40 };
  box.globalThis = box;
  new Function('ctx', `with (ctx) { ${lift('cdp')}\n ctx.cdp = cdp; }`)(box);

  // Every await here has a clock of the test's OWN, because the thing under
  // test is a missing clock: take the timeout out of cdp and this file would
  // hang rather than fail, and a hung suite is a worse signal than a FAIL.
  // (Confirmed by taking it out — the run had to be killed.)
  const within = (ms, p) => Promise.race([p,
    new Promise((r) => setTimeout(() => r('NEVER SETTLED — cdp has no timeout'), ms))]);

  // Never resolves, never rejects — a hidden tab asked for a surface capture.
  box.chrome.debugger.sendCommand = () => new Promise(() => {});
  const began = Date.now();
  const hung = await within(2000, box.cdp(1, 'Page.captureScreenshot', {}, 40)
    .then(() => 'resolved', (e) => e.message));
  check('a command that never settles rejects instead of waiting forever',
    /did not answer/.test(hung), hung);
  check('…and it says how long it waited, in the message',
    /within 0s|within \d+s/.test(hung), hung);
  check('…promptly', Date.now() - began < 2000, `${Date.now() - began}ms`);

  // A camera that works must not be killed by its own clock.
  box.chrome.debugger.sendCommand = () => Promise.resolve({ data: 'abc' });
  const ok = await within(2000, box.cdp(1, 'Page.captureScreenshot', {}, 40).then(r => r.data, e => 'threw: ' + e.message));
  check('a command that answers is passed straight through', ok === 'abc', ok);

  // A real protocol error must stay a real protocol error, not become a timeout.
  box.chrome.debugger.sendCommand = () => Promise.reject(new Error('Detached while handling command'));
  const bad = await within(2000, box.cdp(1, 'Page.captureScreenshot', {}, 40).then(() => 'resolved', e => e.message));
  check('a genuine failure keeps its own reason', /Detached/.test(bad), bad);

  // A slow command that lands after the clock has already fired must not
  // resolve a promise that was rejected — settling twice is silent and wrong.
  box.chrome.debugger.sendCommand = () => new Promise(r => setTimeout(() => r({ data: 'late' }), 80));
  let settled = 0;
  const late = box.cdp(1, 'Page.captureScreenshot', {}, 20);
  late.then(() => settled++, () => settled++);
  await new Promise(r => setTimeout(r, 160));
  check('a late answer after a timeout does not settle it a second time', settled === 1, String(settled));
}

// ── Switching tabs must not touch a scan that is running ───────────────────
//
// Reported as: started a single-screen scan, switched tabs, and it reset — it
// had not really scanned. The background camera made the run survive; this is
// what threw the run away anyway.
//
// onTabChanged re-points the whole panel at whatever tab is IN FRONT. The most
// damaging line in it is the quietest: `currentHostname = newHostname`. Nothing
// visible happens — but sweepStoreKey() defaults to currentHostname, so from
// that moment every save of the RUNNING scan is written under the other site's
// key and pushed to the other site on the server; then the same function pulls
// that site's own survey down over the top. Come back and the scan is gone and
// its sections are unread, because that is genuinely what is stored under this
// site's name now.
console.log('\na running scan owns the panel');
{
  const otc = panelSrc.slice(panelSrc.indexOf('async function onTabChanged('),
                             panelSrc.indexOf('chrome.tabs.onUpdated.addListener'));
  // The hold has to be the FIRST thing, ahead of every line that acts on the
  // new tab — a guard placed after the assignment guards nothing.
  const hold = otc.indexOf('if (aiSweep.running && await sweepIsPinnedAndAlive())');
  check('a running, pinned scan stops the tab change dead', hold > 0);
  check('…before the panel is re-pointed at the other site',
    hold > 0 && hold < otc.indexOf('currentHostname = newHostname'),
    `hold at ${hold}, reassignment at ${otc.indexOf('currentHostname = newHostname')}`);
  check('…before the licence is re-checked for the other site',
    hold > 0 && hold < otc.indexOf('enforceLicence(currentHostname)'));
  check('…before anything can reset the workspace',
    hold > 0 && hold < otc.indexOf('resetAiWorkspace()'));
  check('…and before the other site\'s survey is pulled over the top',
    hold > 0 && hold < otc.indexOf('restoreSweep()'));
  // A scan not running, or pinned to a tab that has been closed, must still let
  // the panel follow you — otherwise the panel is stuck on a dead site.
  check('the hold needs BOTH a running scan and a tab still alive',
    /aiSweep\.running && await sweepIsPinnedAndAlive\(\)/.test(otc));
  // Held is not the same as broken. The mappings list will be naming a site
  // that is not the one on screen, and that has to be stated.
  check('the hold says why the panel is showing another site',
    /Still scanning <strong>\$\{escapeHtml\(currentHostname\)\}<\/strong>/.test(panelSrc) &&
    /this panel stays with/.test(panelSrc));
  // It renders a host name into HTML now, because it carries a button. A site
  // name is attacker-controlled text on a page the tool is pointed at.
  check('…with both host names escaped, since this is HTML now',
    /escapeHtml\(currentHostname\)/.test(panelSrc) && /escapeHtml\(here\)/.test(panelSrc));
  check('…and says nothing when you are looking at the scan\'s own tab',
    /if \(!here \|\| here === currentHostname\) \{ host\.style\.display = 'none'; return; \}/.test(panelSrc));
  check('…and it is cleared once the panel is free to follow again',
    /clearSweepHoldsPanel\(\);/.test(otc));
  check('the notice has somewhere to render',
    /id="sweepHoldsPanel"/.test(readFileSync(join(ROOT, 'panel.html'), 'utf8')));

  // The guard above is the fix. This is the reason the bug could exist at all,
  // closed separately: a survey is filed under the site it is ABOUT, carried on
  // the survey itself, rather than under a global that describes whichever tab
  // is in front.
  check('a survey carries the site it is about',
    /host: getHostname\(tab\)/.test(panelSrc));
  check('…and saves under THAT site, not the panel\'s',
    /const host = aiSweep\.host \|\| currentHostname;/.test(panelSrc) &&
    /\[sweepStoreKey\(host\)\]:/.test(panelSrc));
  check('…and pushes to that site on the server too',
    /U1Sync\.pushSweep\(host, \{/.test(panelSrc));
  check('a restored survey keeps the site it was saved for',
    /host: saved\.host \|\| currentHostname/.test(panelSrc));
  check('…and one continued from a restore gets a host before it writes',
    /if \(!aiSweep\.host\) aiSweep\.host = getHostname\(tab\) \|\| currentHostname;/.test(panelSrc));
  // sweepStoreKey takes an optional host; every writer must pass it, or the
  // default quietly reintroduces exactly this bug.
  check('no save path is left keying off the panel\'s idea of the site',
    !/\[sweepStoreKey\(\)\]: \{/.test(panelSrc));

  // And the hole the guard would otherwise have had. sweepIsPinnedAndAlive
  // requires a tabId; restoreSweep deliberately sets it to null, because the
  // tab a saved survey ran on is gone. So a RESTORED survey is not pinned, the
  // hold does not apply to it, and pressing ▶ on one and switching tabs resets
  // it anyway — which is the shape of the run that was actually reported.
  check('restoring a survey leaves it unpinned, as it must',
    /stops: saved\.stops, tabId: null/.test(panelSrc));
  check('…so reading a section pins it to the tab being read',
    /aiSweep\.tabId = tab\.id;/.test(panelSrc.slice(panelSrc.indexOf('async function scanPickedScreens('))));
  check('…and that happens before the first section is read',
    panelSrc.indexOf('aiSweep.tabId = tab.id;') < panelSrc.indexOf('for (let i = 0; i < stops.length; i++)'));
  // Belt and braces: sweepIsPinnedAndAlive is the whole condition the hold
  // rests on, so its requirement must not drift without this test noticing.
  check('the hold rests on there being a tabId at all',
    /if \(aiSweep\.tabId == null\) return false;/.test(panelSrc));
}

// ── "How is it supposed to know I have switched site?" ──────────────────────
//
// It is not. From inside the panel, "I glanced at another tab" and "I have
// moved on to a different site" are the same event, and holding is right for
// one and wrong for the other. The hold has no time limit either: a twenty
// screen run is twenty minutes with the mappings list, the config form and the
// export tab all describing a site you are no longer on.
//
// So it asks, in the notice, named after where it goes.
console.log('\nleaving a scan that is holding the panel');
{
  check('the hold offers a way out rather than only explaining itself',
    /data-leave-scan="\$\{escapeHtml\(here\)\}"/.test(panelSrc));
  check('…named after the site it goes to, and what it costs you',
    /Work on \$\{escapeHtml\(here\)\} instead — ends the scan/.test(panelSrc));
  // Nothing else may set it. A panel that decides on its own that you have
  // moved on is the bug this whole guard exists to prevent, wearing a hat.
  check('only that button can trigger the switch',
    (panelSrc.match(/sweepLeaveFor = /g) || []).length === 3,   // declare, set, clear
    String((panelSrc.match(/sweepLeaveFor = /g) || []).length));
  // The section in flight is already paid for. Abandoning it mid-call would
  // spend the money and throw the answer away.
  check('it stops after the current section rather than mid-call',
    /sweepLeaveFor = btn\.dataset\.leaveScan;\s*\n\s*aiSweep\.abort = true;/.test(panelSrc));
  check('…and says that is what it is doing',
    /Finishing this section, then moving to \$\{sweepLeaveFor\}/.test(panelSrc));
  check('…and that nothing already read is lost',
    /Everything read so far is saved/.test(panelSrc));
  // Both endings: a survey and a paid read are separate functions with separate
  // finallys, and only one of them having this would strand the panel.
  check('both kinds of run release the panel when they end',
    (panelSrc.match(/await followPendingSiteSwitch\(\)/g) || []).length === 2,
    String((panelSrc.match(/await followPendingSiteSwitch\(\)/g) || []).length));
  check('…after running is false, or the hold would block its own release',
    panelSrc.indexOf('aiSweep.running = false') < panelSrc.indexOf('await followPendingSiteSwitch()'));
  // The survey on screen belongs to the site being left. sweepIsPinnedAndAlive
  // would keep it — right for a glance, wrong when the answer to "are you still
  // working on that site" was an explicit no.
  check('the survey comes off screen, since it is about the site being left',
    /resetAiWorkspace\(\);\s*\n\s*const t = await getTab\(\);/.test(panelSrc));
}

// ── Saying which step is running ────────────────────────────────────────────
//
// Reported as "it has been a minute and a half and found nothing". It had not
// hung — a call is allowed 150 seconds and this one was still inside that. But
// a section is four steps under one label, so "the model is thinking" and
// "this has died" looked identical, and the label promised 10–30 seconds while
// the clock beside it read 1:34.
console.log('\nwhich step a section is on');
{
  const scan = panelSrc.slice(panelSrc.indexOf('async function scanPickedScreens('));
  check('the local half says it is local and free',
    /Reading what is on this section — a few seconds, no charge\./.test(scan));
  check('the paid half says it is the model, and what it was given',
    /asking\$\{''\}? Claude about \$\{batches\[b\]\.length\} element|Claude about \$\{batches\[b\]\.length\} element/.test(scan));
  check('…and describes the limit it actually has, not a stopwatch',
    /it only gives up if Claude \$\{''\}?goes quiet for a minute|goes quiet for a minute/.test(scan));
  // The panel must not print a rule the code does not follow — that is how
  // "usually 10–30 seconds" got there, and then "gives up at 2:30" after it.
  check('and that is the rule the call really follows',
    /const CALL_IDLE_MS = 60000/.test(readFileSync(join(ROOT, 'ai-advisor.js'), 'utf8')));
  check('the old total-elapsed deadline is not still quoted anywhere',
    !/gives up at 2:30/.test(panelSrc));
  check('the old blanket promise is gone',
    !/Looking for components — usually 10–30 seconds/.test(panelSrc));
  // The count is what was actually sent, not what was collected: everything
  // already mapped or seen on an earlier section is filtered out first.
  check('the count is what was sent, not what was on the section',
    /const asking = collected\.candidates\.filter\(\(c\) => !handled\.has\(c\.selector\)\);/.test(scan) &&
    /const busyN = asking\.length;/.test(scan));
}

// ── The estimate that quoted 15 seconds for a 94-second screen ─────────────
//
// scanSecs was a flat 15, used by all three places that quote a time: the box,
// the dialog and the "Left" line of a running scan. Nothing measured it. The
// COST tightens after the first call — sweepAvgCall does exactly that — while
// the note underneath read "Times are estimates", as though that were a
// property of time rather than of nobody having looked.
//
// Saying which step is running (above) told you where the minute went. This is
// the other half: not quoting fifteen seconds for it in the first place.
console.log('\nhow long a section takes, measured');
{
  check('the flat per-screen constant is gone',
    !/SWEEP_EST\.scanSecs/.test(panelSrc));
  // Two numbers for one press, differing because one was written later than
  // the other, is how an estimate stops being read at all.
  check('the box and the dialog quote the same number from the same function',
    (panelSrc.match(/sweepSecsFor\(/g) || []).length >= 4,
    String((panelSrc.match(/sweepSecsFor\(/g) || []).length));
  check('a run records how long each section actually took',
    (panelSrc.match(/stop\.secs = Math\.round\(\(Date\.now\(\) - beganAt\) \/ 1000\)/g) || []).length === 2,
    'both the free path and the paid one');

  // The function itself, on real numbers. It reads only aiSweep.stops and
  // SWEEP_EST, so it needs no DOM — and it is lifted out of panel.js rather
  // than restated here, or this would be testing a copy.
  const est = { aiSweep: { stops: [] } };
  est.globalThis = est;
  new Function('ctx', `with (ctx) {
    const SWEEP_EST = ${/const SWEEP_EST = (\{[\s\S]*?\n\});/.exec(panelSrc)[1]};
    ${lift('sweepSecsFor')}
    ctx.sweepSecsFor = sweepSecsFor; ctx.SWEEP_EST = SWEEP_EST; }`)(est);
  const stops = est.aiSweep.stops;
  const box = est;   // same shape, read the same way below

  const sparse = box.sweepSecsFor(10);
  const busy = box.sweepSecsFor(94);
  check('with nothing measured, a busy section is quoted longer than a sparse one',
    busy > sparse * 2, `${sparse}s vs ${busy}s`);
  // The section that prompted all this. Quoted at 15s, took 94s.
  check('…and the 94-element section is quoted in the right minute, not at 15s',
    busy >= 60 && busy <= 120, `${busy}s`);
  check('a section with nothing on it still quotes the fixed overhead',
    box.sweepSecsFor(0) === 10, String(box.sweepSecsFor(0)));

  // One real reading replaces the guess — for every section, scaled by how
  // busy each one is rather than averaged into a single per-screen number.
  stops.push({ n: 1, scanned: true, secs: 60, count: 30 });   // 2s per element
  check('one section read is enough to replace the guess',
    box.sweepSecsFor(30) === 60, String(box.sweepSecsFor(30)));
  check('…and it scales to a section twice as busy',
    box.sweepSecsFor(60) === 120, String(box.sweepSecsFor(60)));
  check('…without ever quoting less than the fixed overhead',
    box.sweepSecsFor(1) === 10, String(box.sweepSecsFor(1)));
  // A section read for free by naming it takes seconds and would drag the
  // measured rate down for the paid ones — but it is a real reading of a real
  // section, and excluding it would be picking the data that flatters.
  check('a section with no elements cannot poison the rate',
    (() => { stops.push({ n: 2, scanned: true, secs: 5, count: 0 });
             return box.sweepSecsFor(30) === 60; })(), String(box.sweepSecsFor(30)));

  check('the note stops hedging once a time has been measured',
    /From this session's own sections/.test(panelSrc) &&
    /measured, not guessed/.test(panelSrc));
  check('…and before that says the time depends on how busy the section is',
    /the time scales with how busy a section is/.test(panelSrc));
}

// ── "Where is this and where is that" ──────────────────────────────────────
//
// The survey guessed "6 menus · form · dialog? · carousel?". The search
// returned two components. The row went on displaying the guess, so the panel
// showed one set of things in the survey and a different set in the results
// with nothing in between — and the obvious reading is that the search failed.
//
// It did not. The guess counts what is ON the section; the search reports what
// is LEFT to map, and the difference is everything already mapped, dismissed,
// or found in an earlier section. That count existed and went nowhere:
// seenAgain counts only what the model handed back that we already had — the
// small half — while the big half is filtered out BEFORE the call and lived
// only in collected.skipped, which nothing read.
console.log('\nwhat the survey guessed against what the search found');
{
  const scan = panelSrc.slice(panelSrc.indexOf('async function scanPickedScreens('));
  check('everything left out of the call is counted, not just what came back',
    /const held = \(collected\.skipped \|\| 0\) \+ seenAgain;/.test(scan));
  check('…and the outcome says why those are missing',
    /left out — already mapped, dismissed, or found in an earlier section/.test(scan));
  check('a section where everything was already handled says so plainly',
    /nothing new to map — all \$\{held\} thing/.test(scan));

  // Two numbers with nothing between them is the whole complaint, so both stay
  // on the row: the conclusion leads, the guess is kept and named as a guess.
  const row = lift('sweepScreenRowHtml');
  check('a searched section leads with what the search concluded',
    /done && stop\.outcome/.test(row) && /escapeHtml\(stop\.outcome\)/.test(row));
  check('…and keeps the first pass\'s guess underneath, labelled as one',
    /first pass had guessed: \$\{escapeHtml\(stop\.components\)\}/.test(row));

  // On the real renderer, in both states. It needs only escapeHtml, safeImg and
  // aiSweep, so it runs without a DOM — and it is lifted rather than restated,
  // or this would be testing a copy.
  const rowBox = { escapeHtml: sandbox.escapeHtml, safeImg: sandbox.safeImg,
                   aiSweep: { running: false, stops: [] } };
  rowBox.globalThis = rowBox;
  new Function('ctx', `with (ctx) { ${row}\n ctx.sweepScreenRowHtml = sweepScreenRowHtml; }`)(rowBox);

  const guessed = { n: 1, count: 94, components: '6 menus · form · dialog? · carousel?',
                    inventory: '28 buttons, 21 links', thumb: null, found: [] };
  const before = rowBox.sweepScreenRowHtml(guessed);
  check('before a search, only the guess is shown',
    /6 menus · form/.test(before) && !/first pass had guessed/.test(before));

  const after = rowBox.sweepScreenRowHtml({ ...guessed, scanned: true,
    outcome: '2 components to map · 12 left out — already mapped, dismissed, or found in an earlier section' });
  check('after one, the conclusion leads', /2 components to map/.test(after));
  check('…the ones that did not come back are accounted for', /12 left out/.test(after));
  check('…and the guess is still readable, so the two can be compared',
    /first pass had guessed/.test(after) && /6 menus · form/.test(after));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// How accurate is detection, actually?
//
//   node scripts/verify-detect.mjs            local detection only (free)
//   node scripts/verify-detect.mjs --verbose  list every hit and miss
//
// Everything else in this repo asserts that a specific thing behaves a specific
// way. This one measures: against a page whose components were labelled BY HAND
// from its markup, how many does the tool find, does it name them correctly, and
// does it point at the right element?
//
// It exists because "the detection got better" was, until now, an opinion. A
// number that moves is the only way to tell a real improvement from a plausible
// one — and the only way to notice a change that quietly makes things worse.
//
// It scores the LOCAL half only: candidate collection and the component hints.
// The model's contribution is not scored here because scoring it costs money on
// every run; the local score is the floor the model builds on, and it is the
// half we can improve without paying.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');
const HOSTILE = process.argv.includes('--hostile');
// The middle of the three, and the one that matters commercially: semantic tags
// everywhere, ARIA relationships nowhere. Counted on what bbc.com and
// wikipedia.org actually serve — role="tablist" appears zero times on either.
const REAL = process.argv.includes('--real');

const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');
const labels = JSON.parse(readFileSync(join(ROOT, 'fixtures/step.labels.json'), 'utf8'));
const VARIANT = HOSTILE ? '-hostile' : REAL ? '-real' : '';
let html = readFileSync(join(ROOT, `fixtures/step${VARIANT}.html`), 'utf8');
let mega = readFileSync(join(ROOT, `fixtures/step${VARIANT}-mega.js`), 'utf8');

// ── The hostile build, scored against the SAME labels ───────────────────────
// The hostile page is the friendly page with every class, id and data-* hook
// renamed opaquely and every role, aria-* and semantic tag removed. Labelling
// it by hand would mean labelling the same page twice, and two hand-labellings
// drift — the corpus would end up measuring the labeller. Instead the rename map
// the build emits is applied to the labels, so both pages are scored against one
// set of judgements about what is on them.
if (REAL) {
  // Only two things moved: the state attributes were renamed and `hidden`
  // became a class. Every tag, class and id is where it was, so the labels need
  // only follow those two.
  const translate = (sel) => sel
    .replace(/\[aria-(expanded|selected|current|controls|labelledby)([^\]]*)\]/g, '[data-$1$2]')
    .replace(/\[role="[^"]*"\]/g, '');
  for (const c of labels.components) {
    c.root = translate(c.root);
    for (const k of Object.keys(c.fields || {})) c.fields[k] = translate(c.fields[k]);
  }
  labels.url += '  (REALISTIC build — semantic tags, no ARIA relationships)';
}

if (HOSTILE) {
  const map = JSON.parse(readFileSync(join(ROOT, 'fixtures/step-hostile-map.json'), 'utf8'));
  const translate = (sel) => sel
    .replace(/\.([\w-]+)/g, (m, c) => map.classes[c] ? '.' + map.classes[c] : m)
    .replace(/#([\w-]+)/g, (m, i) => map.ids[i] ? '#' + map.ids[i] : m)
    .replace(/data-([\w-]+)/g, (m, d) => map.data[d] ? 'data-' + map.data[d] : m)
    // Every one of these tags is now a <div>, so a tag-anchored label must
    // follow. `nav[aria-label="Breadcrumb"]` has nothing left to match at all,
    // and that IS the finding — it is scored as a miss, not quietly repaired.
    .replace(/\b(nav|form|table|button|ul|ol|li|h[1-6]|section|article|header|footer|main|aside)\b(?![\w-])/g, 'div')
    .replace(/\[aria-[^\]]*\]/g, '');
  for (const c of labels.components) {
    c.root = translate(c.root);
    for (const k of Object.keys(c.fields || {})) c.fields[k] = translate(c.fields[k]);
  }
  labels.url += '  (HOSTILE build — no roles, no semantic tags, opaque names)';
}

// ── The page, as a user meets it ────────────────────────────────────────────
// Four of the labelled components do not exist in the served HTML: the nav's
// items, the hero slides, the deal tabs and the FAQ accordion are written by
// mega.js on DOMContentLoaded. Scoring against the served file alone would be
// scoring a page nobody sees, so the site's own render functions are run first.
function buildPage() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;

  // jsdom has no layout and no CSS. Elements get a box unless the page hid
  // them, and computed style is answered from the inline attributes that
  // matter to the collector.
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const hidden = this.hasAttribute('hidden') || this.closest('[hidden]');
    return hidden
      ? { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
      : { top: 10, left: 10, right: 210, bottom: 50, width: 200, height: 40 };
  };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', {
    get() { return this.hasAttribute('hidden') ? 0 : 40; }, configurable: true,
  });
  const STICKY = /site-header|portal-header/;
  w.getComputedStyle = (el) => ({
    position: STICKY.test(el.className || '') ? 'sticky' : 'static',
    visibility: 'visible', display: 'block', opacity: '1',
  });

  // Enough of the site's own environment for its render functions to run.
  w.eval(`window.Store = {
    utils: {
      qsa: (s, r) => Array.from((r || document).querySelectorAll(s)),
      escapeHtml: (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
      formatPrice: (n) => '$' + n, stars: () => '★★★★★',
      slug: (s) => String(s).toLowerCase().replace(/\\s+/g, '-'),
    },
    shoeIconSVG: () => '<svg></svg>',
    toast: { show: () => {} },
    state: { cart: [], wishlist: [] },
    PRODUCTS: [], BRANCHES: [], ORDERS: [],
  };`);
  try {
    // `mega.js` opens with `const Mega = {}`, and a const declared inside
    // window.eval does not join the global lexical environment — so a second
    // eval cannot see it, and every render call failed with "Mega is not
    // defined" while the harness quietly reported zero components built. The
    // export line is appended INSIDE the same evaluation, where the binding
    // does exist.
    w.eval(mega + '\n;window.Mega = Mega;');
    // Only the renderers that create labelled components. The rest of mega.js
    // wants timers, fetch and a router, and none of that is being measured.
    w.eval(`
      ['menu','hero','dealTabs','faq'].forEach(function (fn) {
        try { Mega.render && Mega.render[fn] && Mega.render[fn](); } catch (e) {}
      });
    `);
  } catch { /* a renderer that will not run leaves its component unbuilt */ }

  // Which of the labelled components actually got built. A renderer that threw
  // leaves its component missing, and the score would then be measuring this
  // harness rather than the detector — so it is reported rather than hidden.
  // Asked through the labels, which have already been translated for the
  // hostile build. Hard-coded friendly selectors here reported "nothing built"
  // on every hostile run — a false alarm in the one place that exists to catch
  // a real one.
  const probes = labels.components
    .filter(c => c.builtByJs)
    .map(c => Object.values(c.fields || {})[0] || c.root);
  const built = probes.map(sel => {
    let n = 0;
    try { n = w.document.querySelectorAll(sel).length; } catch { n = 0; }
    return `${sel.slice(0, 34).padEnd(36)} ${n}`;
  });
  const none = built.every(b => b.endsWith(' 0'));
  if (VERBOSE || none) {
    console.log(`\n  Built by the page's own JavaScript:\n    ${built.join('\n    ')}`);
    if (none) {
      console.log('\n  NONE of them built. The score below is of the served HTML only,');
      console.log('  which is not the page anyone sees — fix the harness before reading it.\n');
    }
  }

  w.eval(INTEL);
  return w;
}

const w = buildPage();
const d = w.document;
const intel = w.__u1SelectorIntel;

// The page is taller than any viewport, and the collector only reports what is
// on screen. Scoring "did it find the footer menu" against one screenful would
// measure the viewport, not the detector — so the whole document is treated as
// visible here, exactly as a full sweep across every screenful would see it.
const got = intel.collectCandidates(2000, null);

// ── Scoring ─────────────────────────────────────────────────────────────────
const scored = labels.components.filter(c => !c.hidden);
const openable = labels.components.filter(c => c.hidden);

const rows = [];
let found = 0, typed = 0, rooted = 0;

for (const want of scored) {
  let target = null;
  try { target = d.querySelector(want.root); } catch { target = null; }
  if (!target) { rows.push({ want, verdict: 'label-broken' }); continue; }

  // Found: is this element among the candidates at all?
  const cand = got.candidates.find(c => {
    try { return d.querySelector(`[data-u1-mark="${c.mark}"]`) === target; } catch { return false; }
  });
  if (!cand) { rows.push({ want, verdict: 'not-found' }); continue; }
  found++;

  // Typed: does the local hint name it correctly?
  const same = cand.component === want.type ||
    (want.type === 'tabs' && cand.component === 'tabs');
  if (same) typed++;

  // Rooted: does the selector it produced resolve back to this same element?
  let hits = [];
  try { hits = cand.selector ? [...d.querySelectorAll(cand.selector)] : []; } catch { hits = []; }
  const exact = hits.length > 0 && hits.includes(target) &&
    (want.matches ? hits.length === want.matches : true);
  if (exact) rooted++;

  rows.push({
    want, verdict: same && exact ? 'ok' : 'partial',
    gotType: cand.component || '(none)', gotSel: cand.selector || '(none)',
    hits: hits.length,
  });
}

// ── Field mapping ───────────────────────────────────────────────────────────
// Scored against what the LABEL's selectors actually match, not against the
// strings: two different selectors that catch the same elements are the same
// answer, and only the elements matter to U1.
let fieldTotal = 0, fieldOk = 0;
for (const want of scored) {
  for (const [key, sel] of Object.entries(want.fields || {})) {
    fieldTotal++;
    let n = 0;
    try { n = d.querySelectorAll(sel).length; } catch { n = 0; }
    if (n > 0) fieldOk++;          // the label itself resolves on the built page
  }
}

const pct = (a, b) => b ? Math.round((a / b) * 1000) / 10 : 0;
const bar = (p) => '█'.repeat(Math.round(p / 5)).padEnd(20, '·');

console.log(`\n  Detection accuracy — ${labels.url}`);
console.log(`  ${scored.length} components labelled by hand, ${openable.length} more that only exist while open\n`);

const measures = [
  ['found at all', found, scored.length],
  ['named correctly', typed, scored.length],
  ['selector resolves to it', rooted, scored.length],
  ['label fields still resolve', fieldOk, fieldTotal],
];
for (const [name, a, b] of measures) {
  const p = pct(a, b);
  console.log(`  ${name.padEnd(28)} ${bar(p)} ${String(a).padStart(3)}/${b}  ${p}%`);
}

console.log('\n  Where it stands, component by component:');
for (const r of rows) {
  const mark = r.verdict === 'ok' ? '  ok  ' : r.verdict === 'partial' ? ' ~~~  ' : ' MISS ';
  console.log(`  ${mark} ${r.want.type.padEnd(9)} ${r.want.root.padEnd(28)}` +
    (r.verdict === 'ok' ? ''
      : r.verdict === 'not-found' ? '— never collected'
      : r.verdict === 'label-broken' ? '— the LABEL does not resolve; fix the corpus'
      : `— named "${r.gotType}", selector "${r.gotSel}" hits ${r.hits}`));
}

if (VERBOSE) {
  console.log('\n  Everything the local pass called a component:');
  for (const c of got.candidates.filter(x => x.component)) {
    console.log(`    ${(c.component + (c.maybe ? '?' : '')).padEnd(14)} ${c.selector || '(no selector)'}`);
  }
}

console.log(`\n  These are the LOCAL numbers — collection and hints, no model.`);
console.log(`  They are the floor the model builds on, and the half we can raise for free.`);
console.log(REAL ? `
  This is the shape of a real client's site, and it is the number that matters
  commercially. Semantic tags are all present; the ARIA that says WHICH panel a
  control operates and WHICH tab is selected is not — counted on bbc.com and
  wikipedia.org, where role="tablist" appears zero times on pages that both
  have tabbed interfaces.

  Whatever is missing here is missing on nearly every site we are called to.\n`
  : HOSTILE ? `
  This is the SAME page with every hint removed: no role, no aria-*, no <nav>,
  <form>, <table>, <button> or heading, and every class, id and data-* hook
  renamed opaquely. The components are all still there — 'label fields still
  resolve' proves the elements exist and the labels find them.

  Local detection cannot see them at all, because there is nothing left to
  read. This is not a bug to fix by adding another class-name pattern: no list
  of names can cover a page that has no names. It is the case that behavioural
  probing exists for — you cannot read what this page is, but you can still
  click it and watch.\n` : `
  READ THEM NARROWLY. One page, ${scored.length} components, and a FRIENDLY page: it
  carries role="tablist", <nav>, <form>, <table> and aria-roledescription. It
  is close to the best case, not the average one.

  Run it again with --hostile for the same page with every hint stripped.
  The gap between the two is what detection actually has left to close.\n`);

// A floor, not a target. It fails the build only if detection collapses, so the
// number can be watched as it climbs rather than blocking every commit.
const FLOOR = HOSTILE ? 0 : 60;
const worst = Math.min(pct(found, scored.length), pct(rooted, scored.length));
if (worst < FLOOR) {
  console.error(`  Detection fell below ${FLOOR}% — something regressed.\n`);
  process.exit(1);
}

// The page's own carousel starts a 6.5s interval, which holds the event loop
// open forever. Nothing is left to do by this line.
process.exit(0);

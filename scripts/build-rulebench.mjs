// Build the rule bench — a single self-contained page.
//
//   node scripts/build-rulebench.mjs [outfile]
//
// Two things live in that page and they are different in kind:
//
//   THE RULES. Every component type, what identifies it and what accessibility
//   it is supposed to produce. These are READ OUT OF panel.js, not retyped —
//   FIELD_HOW, TYPE_GUIDE, STRUCTURE_RULES and COMPONENT_SCHEMAS. A copy would
//   start drifting the day after it was written, and a rule page that disagrees
//   with the tool is worse than no rule page.
//
//   THE BENCH. Paste markup, press Identify, and selector-intel.js — the actual
//   file the extension injects into a client's page — runs on it. Not a
//   description of the detection: the detection. What the bench says is what
//   the tool will say.
//
// The point of putting them side by side is the third column in the table:
// which types are MEASURED and which are only asked of the model. That column
// is the map of where identification can still go wrong.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'dist', 'u1-rulebench.html');
const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');

// ── Lift an object literal out of panel.js ──────────────────────────────────
// These literals are full of nested template strings with ${} holes, so a plain
// brace counter ends them in the middle of one. This tracks what it is inside.
function lit(name) {
  const a = panelSrc.indexOf(`const ${name} = {`);
  if (a < 0) throw new Error(`could not find ${name} in panel.js`);
  let i = panelSrc.indexOf('{', a);
  const start = i;
  let depth = 0;
  const stack = [];
  const top = () => stack[stack.length - 1];
  for (; i < panelSrc.length; i++) {
    const c = panelSrc[i];
    if (c === '\\') { i++; continue; }
    if (top()?.kind === 'tpl') {
      if (c === '`') { stack.pop(); continue; }
      if (c === '$' && panelSrc[i + 1] === '{') { stack.push({ kind: 'hole' }); depth++; i++; }
      continue;
    }
    if (c === '`') { stack.push({ kind: 'tpl' }); continue; }
    if (c === '"' || c === "'") {
      const q = c;
      for (i++; i < panelSrc.length; i++) {
        if (panelSrc[i] === '\\') { i++; continue; }
        if (panelSrc[i] === q) break;
      }
      continue;
    }
    if (c === '/' && panelSrc[i + 1] === '/') { i = panelSrc.indexOf('\n', i); continue; }
    if (c === '/' && panelSrc[i + 1] === '*') { i = panelSrc.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { if (--depth === 0) { i++; break; } if (top()?.kind === 'hole') stack.pop(); }
  }
  return new Function('return (' + panelSrc.slice(start, i) + ');')();
}

const FIELD_HOW = lit('FIELD_HOW');
const TYPE_GUIDE = lit('TYPE_GUIDE');
const STRUCTURE_RULES = lit('STRUCTURE_RULES');
const SCHEMAS = lit('COMPONENT_SCHEMAS');

// Which types the tool MEASURES rather than asks about, and with what. This is
// the honest part of the page: everything not in here is the model's opinion,
// checked only by field counts.
const MEASURED = {
  listbox: ['listboxShape', 'The whole shape — which element is the list, which is the trigger, and which element in each row a person actually activates. It overrides the model outright, because the model was asked three times and answered wrong three times.'],
  combobox: ['listboxShape', 'Shares the listbox measurement for the popup half.'],
  menu: ['menuItemsRoot', 'The shallowest level whose children are homogeneous — same tag, two or more, each holding an item. That test is what separates the <ul> from the <nav> around it.'],
  tabs: ['tabPanelsFor', 'Follows aria-controls, then any data-* holding an element id, then [role=tabpanel], then shape. A strip whose panels cannot be found is not a tab strip.'],
  dialog: ['openedBy', 'Which control opens it: aria-controls / aria-owns, then a data-* id, then a popup role near the trigger, then the next sibling holding two or more links.'],
};

const TYPES = Object.keys(SCHEMAS);

const data = { FIELD_HOW, TYPE_GUIDE, STRUCTURE_RULES, SCHEMAS, MEASURED, TYPES };

// ── The decision order ──────────────────────────────────────────────────────
// Two measurements can both answer for the same markup: a trigger-plus-list is
// a list of items, so menuItemsRoot answers for it AND so does listboxShape.
// Both are right; the component is a listbox. That needs an ORDER, and the tool
// does not have one today — which is exactly how the Molina dropdown was mapped
// as a menu three times.
//
// The order is designed and proved HERE, against cases, before it is worth
// putting into the extension.
const DECIDE_ORDER = [
  ['listbox', 'a trigger beside a list of items'],
  ['tabs', 'a strip whose panels can be reached'],
  ['menu', 'a homogeneous level of two or more items'],
];

const html = `<title>U1 Studio — Component rules & learning bench</title>
<style>
/* Single-theme on purpose: this is the extension's own surface, and the
   extension is dark. Every colour painted explicitly so the page holds on
   either host ground. Values lifted from the extension's styles.css. */
:root{
  --ground:#0A0A0F; --surface:#15151E; --raised:#1C1C28; --hairline:#2A2A35;
  --edge:#3A3A48; --text:#FFFFFF; --muted:#B8B5C4; --dim:#6E6B7E;
  --accent:#8B5CF6; --accent-dim:rgba(139,92,246,.16);
  --warn:#F5A524; --ok:#4ADE80; --signal:#D2635C;
  --display:"Avenir Next Condensed","HelveticaNeue-CondensedBold","Arial Narrow",ui-sans-serif,system-ui,sans-serif;
  --body:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --ui:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);font-family:var(--body);
     font-size:15px;line-height:1.6;direction:ltr}
.shell{max-width:1280px;margin:0 auto;padding:34px 20px 80px;display:flex;flex-direction:column;gap:24px}
.mast{display:flex;flex-direction:column;gap:9px}
.eyebrow{font-family:var(--ui);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
h1{font-family:var(--display);font-size:clamp(30px,5vw,46px);font-weight:600;margin:0;line-height:1.05;text-wrap:balance}
.sub{max-width:74ch;color:var(--muted);margin:0}
.sub strong{color:var(--text);font-weight:600}

/* ── score bar ─────────────────────────────────────────────────────────── */
.scorebar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  border:1px solid var(--edge);border-radius:10px;background:var(--surface);padding:13px 16px}
.score{font-family:var(--display);font-size:30px;font-weight:600;line-height:1}
.score.good{color:var(--ok)} .score.bad{color:var(--signal)} .score.none{color:var(--dim)}
.scoretext{color:var(--muted);font-size:13.5px;flex:1;min-width:240px}
.scoretext b{color:var(--text)}

/* ── bench ─────────────────────────────────────────────────────────────── */
.bench{border:1px solid var(--edge);border-radius:12px;background:var(--surface);
  padding:17px;display:flex;flex-direction:column;gap:12px}
.bench h2{font-family:var(--display);font-size:23px;font-weight:600;margin:0}
.bench p{margin:0;color:var(--muted);font-size:13.5px;max-width:76ch}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:900px){.grid2{grid-template-columns:1fr}}
textarea{width:100%;min-height:170px;resize:vertical;font-family:var(--ui);font-size:12px;
  line-height:1.5;padding:11px;border-radius:8px;background:var(--ground);color:var(--text);
  border:1px solid var(--edge)}
input[type=text]{width:100%;font-family:var(--ui);font-size:12px;padding:8px 10px;border-radius:8px;
  background:var(--ground);color:var(--text);border:1px solid var(--edge)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.row{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
button{font:inherit;font-size:13px;padding:8px 15px;border-radius:8px;cursor:pointer;
  background:var(--accent);color:#fff;border:1px solid var(--accent)}
button.ghost{background:transparent;color:var(--muted);border-color:var(--edge)}
button.ghost:hover{color:var(--text)}
button.danger{background:transparent;color:var(--signal);border-color:var(--signal)}
select{font:inherit;font-size:13px;padding:7px 10px;border-radius:8px;background:var(--raised);
  color:var(--text);border:1px solid var(--edge)}
.out{font-family:var(--ui);font-size:12px;line-height:1.55;background:var(--ground);
  border:1px solid var(--edge);border-radius:8px;padding:11px;min-height:170px;
  overflow:auto;white-space:pre-wrap}
.stage{border:1px dashed var(--edge);border-radius:8px;padding:12px;background:#fff;color:#111;
  min-height:70px;overflow:auto;max-height:300px}
.stagelabel{font-family:var(--ui);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--dim);margin:0 0 5px}

/* ── rail + pane ───────────────────────────────────────────────────────── */
.cols{display:grid;grid-template-columns:196px 1fr;gap:22px;align-items:start}
@media(max-width:820px){.cols{grid-template-columns:1fr}}
.rail{display:flex;flex-direction:column;gap:2px;position:sticky;top:14px;max-height:88vh;overflow:auto}
.rail button{background:none;border:0;border-radius:7px;text-align:left;padding:7px 10px;
  color:var(--muted);font-family:var(--ui);font-size:12px;display:flex;justify-content:space-between;
  gap:8px;align-items:center}
.rail button:hover{color:var(--text);background:var(--raised)}
.rail button[aria-current=true]{background:var(--accent-dim);color:var(--text);box-shadow:inset 2px 0 0 var(--accent)}
.tag{font-size:9px;letter-spacing:.06em;text-transform:uppercase;border:1px solid currentColor;
  border-radius:4px;padding:0 4px;flex:none}
.tag.m{color:var(--ok)} .tag.a{color:var(--dim)}
.tag.fail{color:var(--signal)}

.pane{display:flex;flex-direction:column;gap:16px;min-width:0}
.panehead{display:flex;flex-direction:column;gap:6px}
.panehead h2{font-family:var(--display);font-size:29px;font-weight:600;margin:0}
.panehead .what{color:var(--muted);margin:0}

/* the two sub-tabs */
.subtabs{display:flex;gap:4px;border-bottom:1px solid var(--hairline)}
.subtabs button{background:none;border:0;border-radius:0;color:var(--dim);padding:8px 13px;
  font-family:var(--ui);font-size:11px;letter-spacing:.09em;text-transform:uppercase;
  border-bottom:2px solid transparent}
.subtabs button[aria-selected=true]{color:var(--text);border-bottom-color:var(--accent)}
.subtabs button:hover{color:var(--muted)}

.card{border:1px solid var(--hairline);border-radius:10px;background:var(--surface);
  padding:15px 17px;display:flex;flex-direction:column;gap:11px}
.card > h3{margin:0;font-family:var(--ui);font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--accent)}
.card.measured{border-color:var(--ok)} .card.measured > h3{color:var(--ok)}
.card.asked{border-style:dashed} .card.asked > h3{color:var(--warn)}
dl{margin:0;display:flex;flex-direction:column;gap:11px}
dt{font-family:var(--ui);font-size:12px;color:var(--text);display:flex;gap:7px;align-items:center}
dt .req{font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--warn);
  border:1px solid var(--warn);border-radius:4px;padding:0 4px}
dd{margin:3px 0 0;color:var(--muted);font-size:13.5px}
dd .desc{color:var(--dim);display:block;font-size:12.5px;margin-bottom:2px}
code{font-family:var(--ui);font-size:.86em;background:var(--raised);border:1px solid var(--hairline);
  border-radius:4px;padding:1px 5px}
ul.list{margin:0;padding-left:18px;color:var(--muted);font-size:13.5px}
ul.list li{margin:4px 0} ul.list b{color:var(--text);font-weight:600}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-family:var(--ui);font-size:10.5px;color:var(--muted);border:1px solid var(--hairline);
  border-radius:5px;padding:2px 7px}
.note{color:var(--dim);font-size:12.5px;margin:0}

/* cases */
.case{border:1px solid var(--hairline);border-radius:9px;background:var(--raised);padding:11px 13px;
  display:flex;flex-direction:column;gap:7px}
.case.pass{border-left:3px solid var(--ok)}
.case.fail{border-left:3px solid var(--signal)}
.casehead{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.verdict{font-family:var(--ui);font-size:10px;letter-spacing:.07em;text-transform:uppercase;
  border-radius:4px;padding:1px 6px;border:1px solid currentColor;flex:none}
.verdict.pass{color:var(--ok)} .verdict.fail{color:var(--signal)}
.caseexp{font-family:var(--ui);font-size:11.5px;color:var(--muted);flex:1;min-width:0}
.casehtml{font-family:var(--ui);font-size:11px;color:var(--dim);background:var(--ground);
  border:1px solid var(--hairline);border-radius:6px;padding:8px;overflow:auto;max-height:120px;
  white-space:pre-wrap;margin:0}
.foot{color:var(--dim);font-size:13px;border-top:1px solid var(--hairline);padding-top:16px;max-width:80ch}
</style>

<div class="shell">
  <header class="mast">
    <div class="eyebrow">U1 Studio · rules &amp; learning bench</div>
    <h1>What identifies each component, and proof that teaching it worked</h1>
    <p class="sub">
      The rules here are <strong>read out of the extension's own code</strong>, not copied into
      this page — so they cannot drift from it. The bench runs
      <code>selector-intel.js</code> itself: what it says here is what the tool decides there.
    </p>
    <p class="sub">
      Every type carries a tag. <strong>MEASURED</strong> — the answer is computed from the DOM and
      overrules the model. <strong>ASKED</strong> — the answer is the model's opinion, checked only
      by counting matches. That tag is the map of where identification can still go wrong.
    </p>
  </header>

  <div class="scorebar">
    <div class="score none" id="score">—</div>
    <div class="scoretext" id="scoretext">
      No cases yet. A case is markup plus the answer you know is right. The score is the only way to
      tell teaching that worked from teaching that felt right.
    </div>
    <div class="row">
      <button id="runall">Run all cases</button>
      <button class="ghost" id="export">Export JSON</button>
      <button class="ghost" id="import">Import</button>
    </div>
  </div>

  <section class="bench">
    <h2>Bench — paste markup, see what the tool decides</h2>
    <p>
      The same code that runs on a client's page: <code>menuItemsRoot</code>,
      <code>listboxShape</code>, <code>tabPanelsFor</code>, <code>collectCandidates</code>.
      No simulation.
    </p>
    <div class="grid2">
      <div>
        <textarea id="in" spellcheck="false" aria-label="markup"></textarea>
        <div class="row" style="margin-top:9px">
          <button id="run">Identify</button>
          <select id="sample" aria-label="samples">
            <option value="">— sample —</option>
            <option value="menu">A real menu (nav &gt; ul &gt; li &gt; a)</option>
            <option value="fakemenu">Buttons that are not a menu</option>
            <option value="tabs">A tab strip with panels</option>
            <option value="notabs">Tabs with no panel</option>
            <option value="listbox">A button that opens a list</option>
          </select>
          <button class="ghost" id="clear">Clear</button>
        </div>
      </div>
      <div><div class="out" id="out">Paste markup and press Identify.</div></div>
    </div>
    <div>
      <p class="stagelabel">as the page sees it</p>
      <div class="stage" id="stage"></div>
    </div>
  </section>

  <div class="cols">
    <nav class="rail" id="rail" aria-label="Component types"></nav>
    <main class="pane" id="pane"></main>
  </div>

  <p class="foot">
    Generated from <code>panel.js</code> and <code>selector-intel.js</code> by
    <code>scripts/build-rulebench.mjs</code>. Re-run it after a rule changes and the page follows —
    there is no second copy to remember to maintain. Cases live in this browser; export them to put
    them in the repo.
  </p>
</div>

<script>
${INTEL}
</script>
<script>
const D = ${JSON.stringify(data)};
const ORDER = ${JSON.stringify(DECIDE_ORDER)};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = window.__u1SelectorIntel;
const stage = document.getElementById('stage');

// ── the decision ──────────────────────────────────────────────────────────
// Two measurements can both answer for one piece of markup — a trigger beside a
// list of items IS a list of items, so menu answers and listbox answers, and
// both are right. What was missing is an ORDER. It lives here so it can be
// proved against cases before it is worth putting into the extension.
function decide(rootSel) {
  const tried = {};
  try { tried.listbox = I.listboxShape(rootSel) || null; } catch (e) { tried.listbox = null; }
  try {
    let tp = null;
    for (const g of ['button', '[role=tab]', 'a']) {
      try { const got = I.tabPanelsFor(rootSel, g); if (got) { tp = got; break; } } catch (e) {}
    }
    tried.tabs = tp;
  } catch (e) { tried.tabs = null; }
  try { tried.menu = I.menuItemsRoot(rootSel) || null; } catch (e) { tried.menu = null; }

  for (const [type, why] of ORDER) {
    if (tried[type]) return { type, why, detail: tried[type], tried };
  }
  return { type: 'none', why: 'no measurement matched this shape', detail: null, tried };
}
const asText = (v) => v == null ? '—' : (typeof v === 'string' ? v : (v.selector || JSON.stringify(v)));

// ── cases ─────────────────────────────────────────────────────────────────
const KEY = 'u1x-cases-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
const save = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
let CASES = load();

// Seeded so the page is not empty on first open, and so the two failures we
// already know about are on the board from the start.
if (!CASES.length) {
  CASES = [
    { id: 'seed-menu', type: 'menu', expect: 'menu', note: 'A real navigation menu.',
      html: '<nav class="site-nav">\\n  <ul class="nav-list">\\n    <li><a href="/a">Shoes</a></li>\\n    <li><a href="/b">Sport</a></li>\\n    <li><a href="/c">Sale</a></li>\\n  </ul>\\n</nav>' },
    { id: 'seed-fakemenu', type: 'menu', expect: 'none', note: 'Four buttons in a row are NOT a menu. The negative case.',
      html: '<div class="toolbar">\\n  <button class="tb">Save</button>\\n  <button class="tb">Print</button>\\n  <a class="help" href="/help">Help</a>\\n</div>' },
    { id: 'seed-tabs', type: 'tabs', expect: 'tabs', note: 'Panels reachable through aria-controls.',
      html: '<div class="card">\\n  <div class="tab-bar">\\n    <button class="tb" aria-controls="p1">One</button>\\n    <button class="tb" aria-controls="p2">Two</button>\\n  </div>\\n  <div id="p1" class="panel">first</div>\\n  <div id="p2" class="panel" hidden>second</div>\\n</div>' },
    { id: 'seed-notabs', type: 'tabs', expect: 'none', note: 'A strip with nothing to control is not a tab strip.',
      html: '<div class="tab-bar">\\n  <button class="tb">One</button>\\n  <button class="tb">Two</button>\\n</div>' },
    { id: 'seed-listbox', type: 'listbox', expect: 'listbox', note: 'The Molina shape: a trigger beside a closed list. Menu also answers here — the order is what decides it.',
      html: '<div class="click-nav">\\n  <button class="clicker">Sign In</button>\\n  <ul class="signin-dropdown">\\n    <li><a href="/m">Member</a></li>\\n    <li><a href="/p">Professional</a></li>\\n  </ul>\\n</div>' },
  ];
  save(CASES);
}

function runCase(c) {
  const holder = document.createElement('div');
  holder.className = 'stage';
  holder.style.position = 'absolute';
  holder.style.left = '0';
  holder.style.top = '0';
  holder.style.width = '900px';
  holder.style.opacity = '0';
  holder.style.pointerEvents = 'none';
  document.body.appendChild(holder);
  let got = 'none', detail = null;
  try {
    holder.innerHTML = c.html;
    const root = holder.firstElementChild;
    if (root) {
      const sel = I.robustSelector(root);
      const d = decide(sel);
      got = d.type;
      detail = d.detail;
    }
  } catch (e) { got = 'error: ' + e.message; }
  holder.remove();
  return { pass: got === c.expect, got, detail };
}

function scoreAll() {
  const results = CASES.map((c) => ({ c, r: runCase(c) }));
  const pass = results.filter((x) => x.r.pass).length;
  const el = document.getElementById('score');
  const tx = document.getElementById('scoretext');
  if (!results.length) {
    el.textContent = '—'; el.className = 'score none';
    tx.innerHTML = 'No cases yet.';
    return results;
  }
  el.textContent = pass + '/' + results.length;
  el.className = 'score ' + (pass === results.length ? 'good' : 'bad');
  const failing = results.filter((x) => !x.r.pass);
  tx.innerHTML = pass === results.length
    ? '<b>Every case passes.</b> Add a case the tool gets wrong — that is the one worth teaching.'
    : '<b>' + failing.length + ' failing:</b> ' +
      failing.map((x) => esc(x.c.id) + ' (wanted ' + esc(x.c.expect) + ', got ' + esc(x.r.got) + ')').join(' · ');
  // rail tags follow the score, so a type with a failing case says so
  const byType = {};
  results.forEach((x) => {
    byType[x.c.type] = byType[x.c.type] || { p: 0, n: 0 };
    byType[x.c.type].n++; if (x.r.pass) byType[x.c.type].p++;
  });
  [...document.querySelectorAll('#rail button')].forEach((b) => {
    const s = byType[b.dataset.t];
    const tag = b.querySelector('.tag');
    if (!s) { tag.textContent = D.MEASURED[b.dataset.t] ? 'measured' : 'asked';
              tag.className = 'tag ' + (D.MEASURED[b.dataset.t] ? 'm' : 'a'); return; }
    tag.textContent = s.p + '/' + s.n;
    tag.className = 'tag ' + (s.p === s.n ? 'm' : 'fail');
  });
  return results;
}

// ── rail ──────────────────────────────────────────────────────────────────
const rail = document.getElementById('rail');
const pane = document.getElementById('pane');
let currentType = D.TYPES[0];
let currentTab = 'rules';

rail.innerHTML = D.TYPES.map((t) =>
  '<button type="button" data-t="' + t + '">' + esc(t) +
  '<span class="tag ' + (D.MEASURED[t] ? 'm">measured' : 'a">asked') + '</span></button>').join('');

rail.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-t]');
  if (b) { currentType = b.dataset.t; show(); }
});

function rulesHtml(t) {
  const g = D.TYPE_GUIDE[t] || {}, s = D.SCHEMAS[t] || {}, how = D.FIELD_HOW[t] || {};
  const req = s.req || [], meas = D.MEASURED[t], rules = D.STRUCTURE_RULES[t] || [];
  const fields = Object.keys(s.selectors || {}).map((k) =>
    '<dt>' + esc(k) + (s.selectors[k] === 'PRIMARY' ? '<span class="req">primary</span>' : '') +
    (req.includes(k) ? '<span class="req">required</span>' : '') + '</dt><dd>' +
    (s.desc && s.desc[k] ? '<span class="desc">' + esc(s.desc[k]) + '</span>' : '') +
    esc(how[k] || '') + '</dd>').join('');
  const rootOpts = Object.keys(s.rootFields || {}).map((k) =>
    '<dt>' + esc(k) + '</dt><dd>' + esc((s.desc && s.desc[k]) || how[k] || '') + '</dd>').join('');
  return (meas
      ? '<div class="card measured"><h3>Measured — computed, not asked</h3>' +
        '<p class="note"><code>' + esc(meas[0]) + '()</code></p><p>' + esc(meas[1]) + '</p></div>'
      : '<div class="card asked"><h3>Asked — this is the model\\'s opinion</h3>' +
        '<p>No measurement for this type. The answer is checked only by each field matching a ' +
        'sensible number of elements and by the structure below. If it keeps getting this wrong, ' +
        'this is where a measurement belongs.</p></div>') +
    (rules.length ? '<div class="card"><h3>Structure — enforced against the page</h3><ul class="list">' +
      rules.map((r) => '<li><b>' + esc(r.child) + '</b> must be ' +
        (r.inside ? '<b>inside</b> ' : '<b>outside</b> ') + '<b>' + esc(r.parent) + '</b>' +
        (r.inside ? ' — a selector that also matches outside is narrowed automatically on save.' : '') +
        '</li>').join('') + '</ul></div>' : '') +
    (g.variants && g.variants.length ? '<div class="card"><h3>Confused with</h3><ul class="list">' +
      g.variants.map((v) => '<li><b>' + esc(v[0]) + '</b> — ' + esc(v[1]) + '</li>').join('') +
      '</ul></div>' : '') +
    '<div class="card"><h3>Fields — and what identifies each</h3><dl>' + fields + '</dl></div>' +
    (rootOpts ? '<div class="card"><h3>Options</h3><dl>' + rootOpts + '</dl></div>' : '');
}

function learningHtml(t) {
  const mine = CASES.filter((c) => c.type === t);
  const rows = mine.map((c) => {
    const r = runCase(c);
    return '<div class="case ' + (r.pass ? 'pass' : 'fail') + '">' +
      '<div class="casehead">' +
        '<span class="verdict ' + (r.pass ? 'pass">pass' : 'fail">fail') + '</span>' +
        '<span class="caseexp">expects <b>' + esc(c.expect) + '</b> · got <b>' + esc(r.got) + '</b>' +
        (r.detail ? ' · ' + esc(asText(r.detail)) : '') + '</span>' +
        '<button class="ghost" data-del="' + esc(c.id) + '">Remove</button>' +
      '</div>' +
      (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '') +
      '<pre class="casehtml">' + esc(c.html) + '</pre></div>';
  }).join('');

  return '<div class="card"><h3>How we know the teaching was not in vain</h3>' +
    '<ul class="list">' +
    '<li>A case is <b>markup plus the answer you know is right</b>. Nothing is taught by describing it.</li>' +
    '<li>A change that helps makes a failing case <b>pass</b>. If the number does not move, the ' +
    'teaching did nothing — that is what "in vain" looks like, measured rather than felt.</li>' +
    '<li><b>Negative cases are what make the score honest.</b> With only positive cases, a rule ' +
    'that answers "menu" for everything scores full marks. "These buttons are NOT a menu" is the ' +
    'case that stops a rule being taught too widely.</li>' +
    '<li>Every case runs on every change, so a rule that fixes today and breaks something in a ' +
    'month is caught by the case it breaks, not by someone noticing.</li>' +
    '</ul></div>' +
    '<div class="card"><h3>Cases for ' + esc(t) + ' — ' + mine.filter((c) => runCase(c).pass).length +
      '/' + mine.length + ' passing</h3>' +
    (rows || '<p class="note">No cases yet for this type.</p>') + '</div>' +
    '<div class="card"><h3>Teach a new case</h3>' +
      '<textarea id="newhtml" spellcheck="false" placeholder="Paste the markup the tool got wrong"></textarea>' +
      '<div class="row">' +
        '<label class="note">The right answer:</label>' +
        '<select id="newexp">' +
          '<option value="' + esc(t) + '">it IS a ' + esc(t) + '</option>' +
          '<option value="none">it is NOT a ' + esc(t) + ' (negative case)</option>' +
          ORDER.map((o) => o[0]).filter((x) => x !== t)
            .map((x) => '<option value="' + x + '">it is really a ' + x + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<input type="text" id="newnote" placeholder="One line: what went wrong (optional)">' +
      '<div class="row"><button id="addcase">Add case and run</button></div>' +
      '<p class="note">Saved in this browser. Export puts them in the repo, where every ' +
      'change runs them.</p>' +
    '</div>';
}

function show() {
  [...rail.querySelectorAll('button')].forEach((b) =>
    b.setAttribute('aria-current', String(b.dataset.t === currentType)));
  const g = D.TYPE_GUIDE[currentType] || {};
  pane.innerHTML =
    '<div class="panehead"><h2>' + esc(currentType) + '</h2>' +
      '<p class="what">' + esc(g.what || '') + '</p>' +
      '<div class="chips">' +
        (g.keys ? '<span class="chip">' + esc(g.keys) + '</span>' : '') +
        (g.wcag || []).map((w) => '<span class="chip">WCAG ' + esc(w[0]) + ' · ' + esc(w[1]) + '</span>').join('') +
        (g.apg ? '<span class="chip">APG ' + esc(g.apg) + '</span>' : '') +
      '</div></div>' +
    '<div class="subtabs" role="tablist">' +
      '<button role="tab" data-sub="rules" aria-selected="' + (currentTab === 'rules') + '">Accessibility rules</button>' +
      '<button role="tab" data-sub="learning" aria-selected="' + (currentTab === 'learning') + '">Learning</button>' +
    '</div>' +
    (currentTab === 'rules' ? rulesHtml(currentType) : learningHtml(currentType));
}

pane.addEventListener('click', (e) => {
  const sub = e.target.closest('[data-sub]');
  if (sub) { currentTab = sub.dataset.sub; show(); return; }
  const del = e.target.closest('[data-del]');
  if (del) {
    CASES = CASES.filter((c) => c.id !== del.dataset.del);
    save(CASES); show(); scoreAll(); return;
  }
  if (e.target.id === 'addcase') {
    const html = document.getElementById('newhtml').value.trim();
    if (!html) return;
    CASES.push({
      id: currentType + '-' + Date.now().toString(36),
      type: currentType,
      expect: document.getElementById('newexp').value,
      note: document.getElementById('newnote').value.trim(),
      html,
    });
    save(CASES); show(); scoreAll();
  }
});

// ── bench ─────────────────────────────────────────────────────────────────
const out = document.getElementById('out');
const input = document.getElementById('in');
const SAMPLES = {};
CASES.forEach((c) => { if (c.id.startsWith('seed-')) SAMPLES[c.id.slice(5)] = c.html; });

document.getElementById('sample').addEventListener('change', (e) => {
  if (SAMPLES[e.target.value]) { input.value = SAMPLES[e.target.value]; runBench(); }
});
document.getElementById('clear').addEventListener('click', () => {
  input.value = ''; stage.innerHTML = ''; out.textContent = 'Paste markup and press Identify.';
});
document.getElementById('run').addEventListener('click', runBench);
document.getElementById('runall').addEventListener('click', () => { scoreAll(); show(); });

document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(CASES, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'u1-detection-cases.json';
  a.click();
});
document.getElementById('import').addEventListener('click', () => {
  const f = document.createElement('input');
  f.type = 'file'; f.accept = 'application/json';
  f.addEventListener('change', () => {
    const file = f.files && f.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const got = JSON.parse(rd.result);
        if (Array.isArray(got)) { CASES = got; save(CASES); show(); scoreAll(); }
      } catch (e) {}
    };
    rd.readAsText(file);
  });
  f.click();
});

const line = (s) => s + '\\n';
function runBench() {
  const src = input.value.trim();
  if (!src) { out.textContent = 'Nothing to identify.'; return; }
  stage.innerHTML = src;
  let t = '';
  let cands = [];
  try {
    const ctx = I.collectCandidates(60, '#stage');
    cands = (ctx && ctx.candidates) || [];
  } catch (e) { t += line('collectCandidates threw: ' + e.message); }
  t += line('— what the collector sees —');
  t += line(cands.length ? cands.map((c) =>
    '  ' + String(c.mark).padStart(2) + '  ' + c.tag.padEnd(8) + c.selector +
    (c.component ? '   → first guess: ' + c.component : '')).join('\\n') : '  (nothing)');

  for (const r of [...stage.children]) {
    const sel = I.robustSelector(r);
    const d = decide(sel);
    t += line('');
    t += line('— ' + sel + ' —');
    t += line('  DECISION   ' + d.type.toUpperCase() + (d.type !== 'none' ? '  (' + d.why + ')' : ''));
    if (d.detail) t += line('             ' + asText(d.detail));
    t += line('  measurements, in the order they are consulted:');
    for (const [type, why] of ORDER) {
      const v = d.tried[type];
      t += line('    ' + type.padEnd(9) + (v ? 'yes  ' + asText(v) : 'no   — ' + why + ' not found'));
    }
  }
  out.textContent = t;
}

show();
scoreAll();
</script>
`;

writeFileSync(OUT, html);
console.log(`Rule bench → ${OUT}`);
console.log(`  ${TYPES.length} types · ${Object.keys(MEASURED).length} measured · ${TYPES.length - Object.keys(MEASURED).length} asked`);

// Give it a URL, get back a U1 implementation file ready to paste.
//
//   node scripts/map-site.mjs https://example.com            > out.js
//   node scripts/map-site.mjs https://example.com --report    (what it found, and why not)
//
// This is the panel's detection, run headless. It uses the SAME selector-intel
// the extension injects, the SAME COMPONENT_SCHEMAS the builder writes against,
// and the SAME u1-patch regions the export inlines — so what comes out here is
// what the extension would produce, minus the two things that need a browser.
//
// What it CANNOT do, and does not pretend to:
//
//   - press anything. The probe operates components and watches what opens;
//     that needs a real browser. So a dialog or a listbox is found only when
//     its markup is in the page, not by behaviour.
//   - ask the model. Every mapping here is MEASURED off the markup. That is a
//     narrower answer than the panel's and a more predictable one: it is wrong
//     in ways you can see rather than wrong in ways that read well.
//
// Every mapping is checked before it is emitted: required fields present,
// sub-selectors resolving to DIFFERENT elements, and no selector that matches
// nothing. Anything that fails is left out and listed in the report, because a
// mapping that decorates nothing is worse than an absent one — it looks done.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a));
const REPORT = args.includes('--report');
const OUT = (args.find((a) => a.startsWith('--out=')) || '').slice(6);

if (!url) {
  console.error('Usage: node scripts/map-site.mjs <url> [--report] [--out=file.js]');
  process.exit(1);
}

// ── The page, with its own scripts run ──────────────────────────────────────
//
// Most of these sites build themselves after load: the menu, the tabs, the
// accordion and the carousels do not exist in the served HTML at all. Skipping
// this step is how you conclude a page has no components.
const page = await fetch(url).then((r) => r.text());
const base = new URL(url);
const dom = new JSDOM(page, { runScripts: 'outside-only', pretendToBeVisual: true, url });
const w = dom.window;

// jsdom has none of these, and the page's widgets bail out of rendering without
// them. Stubs, not implementations — nothing here needs them to do anything.
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLElement.prototype.scrollBy = function () {};
// No layout, so give everything a box unless the page hid it — `hidden` is what
// a closed panel looks like, and the collector reads it.
w.HTMLElement.prototype.getBoundingClientRect = function () {
  const hid = this.hasAttribute('hidden') || (this.closest && this.closest('[hidden]'));
  return hid ? { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }
             : { width: 300, height: 40, top: 10, left: 10, bottom: 50, right: 310 };
};
for (const prop of ['offsetHeight', 'offsetWidth']) {
  Object.defineProperty(w.HTMLElement.prototype, prop, {
    get() { return this.hasAttribute('hidden') ? 0 : 40; }, configurable: true,
  });
}

// Same-origin scripts, in order, in ONE eval so they share a scope the way two
// <script> tags do — a second file reading the first's top-level const is
// ordinary, and a per-file eval puts it behind a scope boundary.
const srcs = [...dom.window.document.querySelectorAll('script[src]')]
  .map((s) => new URL(s.getAttribute('src'), base))
  .filter((u) => u.origin === base.origin);
const code = [];
for (const s of srcs) {
  try { code.push(await fetch(s.href).then((r) => r.text())); } catch {}
}
try { w.eval(code.join('\n;\n')); } catch (e) { if (REPORT) console.error('[site js]', e.message); }
try { w.document.dispatchEvent(new w.Event('DOMContentLoaded')); } catch {}
try { w.dispatchEvent(new w.Event('load')); } catch {}

w.eval(readFileSync(join(ROOT, 'selector-intel.js'), 'utf8'));
const S = w.__u1SelectorIntel;

// ── The schemas the builder writes against ──────────────────────────────────
const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(/const COMPONENT_SCHEMAS = \{[\s\S]*?\n\};/.exec(panelSrc)[0], ctx);
const SCHEMAS = vm.runInContext('COMPONENT_SCHEMAS', ctx);
const primaryKeyOf = (sc) => Object.keys(sc.selectors || {}).find((k) => sc.selectors[k] === 'PRIMARY');

// ── Measuring one component ─────────────────────────────────────────────────
//
// One function per type, each reading the page rather than guessing. A type
// with no measurer is not emitted: a half-filled mapping is worse than none.
const count = (sel) => { try { return w.document.querySelectorAll(sel).length; } catch { return -1; } };
/**
 * A selector for these items, scoped to the component they belong to.
 *
 * commonSelectorFor happily answers `tr` for a table's rows — correct about the
 * elements it was given and wrong as a mapping: `tr` is 46 rows across four
 * tables on this page, and `td` is 165 cells. u1 would decorate another table's
 * rows as this one's.
 *
 * So the answer is checked against the page: if it reaches more elements
 * outside the component than inside it, anchor it to the root.
 */
const sub = (root, items) => {
  const rootSel = S.robustSelector(root);
  const r = S.commonSelectorFor(root, items, rootSel);
  let sel = (r && r.selector) || '';
  if (!sel) return '';
  // Counted from the DOCUMENT and then filtered by containment, never by
  // scoping the query to the root. commonSelectorFor often returns a selector
  // that is ALREADY anchored — `#dealTabs>.tab-bar__btn` — and
  // root.querySelectorAll() of that is zero, because `#dealTabs` is the root
  // itself rather than a descendant of it. Read as "nothing inside", it threw
  // away a perfectly good selector and left the strip unmapped.
  const hit = (x) => { try { return [...w.document.querySelectorAll(x)]; } catch { return []; } };
  const matched = hit(sel);
  const inside = matched.filter((x) => root.contains(x)).length;
  const all = matched.length;
  if (all > inside) {
    // U1 rejects descendant spaces, so the anchor has to be a chain of direct
    // children — and it has to be the REAL one. A table's rows live inside
    // <tbody>, so `table>tr` matches nothing at all while `table>tbody>tr`
    // matches all fourteen. Walking one level was the difference between four
    // mappings and ten.
    const chain = (item) => {
      const steps = [];
      for (let n = item; n && n !== root; n = n.parentElement) steps.unshift(n.tagName.toLowerCase());
      return steps.length ? rootSel + '>' + steps.join('>') : '';
    };
    const tries = [...new Set(items.map(chain).filter(Boolean))];
    for (const t of tries) {
      const h = hit(t);
      if (h.length === inside && h.every((x) => root.contains(x))) return t;
    }
    // A group of chains covering the same set is still one selector.
    if (tries.length > 1) {
      const joined = tries.join(',');
      const h = hit(joined);
      if (h.length === inside && h.every((x) => root.contains(x))) return joined;
    }
    // Cannot be expressed without a descendant space — better to say so than to
    // emit a selector that reaches into other components.
    return '';
  }
  return sel;
};
const kids = (el, sel) => [...el.querySelectorAll(sel)];

const MEASURE = {
  tabs(el) {
    const tabs = kids(el, 'button,[role="tab"],a[href]').filter((t) => t.parentElement === el);
    if (tabs.length < 2) return null;
    // The panel each tab operates: aria-controls, then any data-* naming a real
    // element — a site wiring its own tabs is ordinary and says the same thing.
    const panels = [];
    for (const t of tabs) {
      let id = t.getAttribute('aria-controls') || t.getAttribute('data-controls');
      if (!id) {
        for (const a of t.attributes) {
          if (!a.name.startsWith('data-')) continue;
          if (a.value && /^[A-Za-z][\w-]*$/.test(a.value) && w.document.getElementById(a.value)) { id = a.value; break; }
        }
      }
      const p = id && w.document.getElementById(id);
      if (p && !panels.includes(p)) panels.push(p);
    }
    // The page can name a panel that is not there. #dealTabs' six buttons all
    // say data-controls="dealPanel" and no element has that id — the real one
    // is .deal-grid. Following a broken reference and giving up leaves a strip
    // unmapped because of the site's typo.
    //
    // So fall back to structure: the region right after the strip. That is what
    // a tab strip with one shared panel looks like, and it is the arrangement
    // the reference was trying to describe.
    if (!panels.length) {
      let after = el.nextElementSibling;
      // Past headings and blurbs, to the first thing with content of its own.
      while (after && after.children.length === 0) after = after.nextElementSibling;
      if (!after && el.parentElement) {
        after = el.parentElement.nextElementSibling;
        while (after && after.children.length === 0) after = after.nextElementSibling;
      }
      if (after && !after.contains(el)) panels.push(after);
    }
    if (!panels.length) return null;
    return {
      primary: S.robustSelector(el),
      fields: { tabList: S.robustSelector(el), tab: sub(el, tabs), tabPanel: sub(w.document.body, panels) },
      roots: { isVertical: false },
    };
  },

  accordion(el) {
    const sh = S.accordionShape(S.robustSelector(el));
    if (!sh) return null;
    return {
      primary: sh.headerSelector,
      fields: { headerSelector: sh.headerSelector, contentSelector: sh.contentSelector },
      roots: { headingLevel: sh.headingLevel, collapsesOthers: sh.collapsesOthers },
    };
  },

  combobox(el) {
    const sh = S.comboboxShape(S.robustSelector(el));
    if (!sh) return null;
    return { primary: sh.combobox, fields: { textbox: sh.textbox, listbox: sh.listbox, options: sh.options }, roots: {} };
  },

  menu(el) {
    // u1.fix.menu reads the root's own children, so root on the list.
    const better = S.menuItemsRoot(S.robustSelector(el));
    const root = better ? w.document.querySelector(better) : el;
    if (!root) return null;
    const items = kids(root, 'a[href],button');
    if (items.length < 2) return null;
    const triggers = items.filter((i) => i.getAttribute('aria-expanded') !== null ||
      i.hasAttribute('data-expanded') || (i.nextElementSibling && i.nextElementSibling.querySelector('a[href]')));
    const subs = triggers.map((t) => t.nextElementSibling).filter(Boolean);
    const f = { menu: S.robustSelector(root), horizontalMenu: S.robustSelector(root), items: sub(root, items) };
    if (triggers.length) f.triggers = sub(root, triggers);
    if (subs.length) f.submenus = sub(root, subs);
    return { primary: S.robustSelector(root), fields: f, roots: { menubar: false } };
  },

  carousel(el) {
    // The slides are a TRACK's children, not everything whose class contains
    // "slide": inside .hero-carousel that phrase matches 45 elements, titles
    // and inner wrappers included. Find the container whose own children are
    // several alike things — that is what a row of slides is.
    let slides = [];
    for (const box of [el, ...kids(el, 'div,ul,ol')]) {
      const ch = [...box.children].filter((x) => x.nodeType === 1);
      if (ch.length < 2) continue;
      const sig = (x) => x.tagName + '|' + [...x.classList].filter((c) => !/--/.test(c)).sort().join('.');
      const first = sig(ch[0]);
      const alike = ch.filter((x) => sig(x) === first);
      // A slide is a slide whether or not it is the one showing, so a state
      // class (--active) is ignored when deciding what is alike.
      if (alike.length >= 2 && alike.length > slides.length) slides = alike;
    }
    const prev = el.querySelector('[class*="prev" i],[aria-label*="previous" i]');
    const next = el.querySelector('[class*="next" i],[aria-label*="next" i]');
    if (slides.length < 2 || !prev || !next) return null;
    const f = {
      carouselContainer: S.robustSelector(el),
      slide: sub(el, slides),
      prevButton: S.robustSelector(prev),
      nextButton: S.robustSelector(next),
    };
    // The dots themselves, not the strip that holds them.
    const dots = kids(el, '[class*="dot" i],[class*="picker" i]')
      .filter((x) => !x.querySelector('[class*="dot" i]'));
    if (dots.length >= 2) f.slidePickerButtons = sub(el, dots);
    return { primary: S.robustSelector(el), fields: f, roots: {} };
  },

  form(el) {
    const inputs = kids(el, 'input,select,textarea').filter((i) => i.type !== 'hidden');
    const submit = el.querySelector('[type="submit"],button:not([type="button"])');
    if (!inputs.length || !submit) return null;
    return {
      primary: S.robustSelector(el),
      fields: { form: S.robustSelector(el), inputField: sub(el, inputs), submitButton: S.robustSelector(submit) },
      roots: {},
    };
  },

  table(el) {
    const rows = kids(el, 'tr');
    const cells = kids(el, 'td');
    if (rows.length < 2 || !cells.length) return null;
    const f = { table: S.robustSelector(el), row: sub(el, rows), cell: sub(el, cells) };
    const ch = kids(el, 'th[scope="col"], thead th');
    const rh = kids(el, 'th[scope="row"]');
    if (ch.length) f.columnheader = sub(el, ch);
    if (rh.length) f.rowheader = sub(el, rh);
    return { primary: S.robustSelector(el), fields: f, roots: {} };
  },
};

// ── Everything on the page ──────────────────────────────────────────────────
const found = S.collectCandidates(4000, null);
const comps = found.candidates.filter((c) => c.component && !c.nested);

const made = [];
const skipped = [];

for (const c of comps) {
  const type = c.component;
  const schema = SCHEMAS[type];
  const measure = MEASURE[type];
  if (!schema) { skipped.push({ type, sel: c.selector, why: 'no u1.fix type for it' }); continue; }
  if (!measure) { skipped.push({ type, sel: c.selector, why: 'needs the browser — pressing it, or the model' }); continue; }

  let el;
  try { el = w.document.querySelector(c.selector); } catch { el = null; }
  if (!el) { skipped.push({ type, sel: c.selector, why: 'its selector no longer resolves' }); continue; }

  let m = null;
  try { m = measure(el); } catch (e) { skipped.push({ type, sel: c.selector, why: 'could not measure: ' + e.message }); continue; }
  if (!m) { skipped.push({ type, sel: c.selector, why: 'the parts it needs are not there' }); continue; }

  // Required fields, from the schema — the check that was missing when
  // fix.tabs("#dealTab-week") shipped without a tabPanel.
  const pKey = primaryKeyOf(schema);
  const missing = (schema.req || []).filter((r) => {
    const v = r === pKey ? m.primary : m.fields[r];
    return !v || !String(v).trim();
  });
  if (missing.length) { skipped.push({ type, sel: c.selector, why: 'missing ' + missing.join(' and ') }); continue; }

  // Sub-selectors must be DIFFERENT elements. Three fields all pointing at the
  // root is not a mapping — u1 decorates one element and does nothing else.
  const same = Object.entries(m.fields).filter(([k, v]) => k !== pKey && v === m.primary).map(([k]) => k);
  if (same.length) { skipped.push({ type, sel: c.selector, why: same.join(', ') + ' is the root again' }); continue; }

  // A field we could not express is an ABSENT field. Emitting "" tells u1 the
  // component has a columnheader selector that matches nothing, which is worse
  // than not mentioning it.
  for (const k of Object.keys(m.fields)) if (!m.fields[k]) delete m.fields[k];

  // And every one has to resolve.
  const dead = Object.entries(m.fields).filter(([, v]) => v && count(v) <= 0).map(([k]) => k);
  if (dead.length) { skipped.push({ type, sel: c.selector, why: dead.join(', ') + ' matches nothing' }); continue; }

  if (made.some((x) => x.type === type && x.primary === m.primary)) {
    skipped.push({ type, sel: c.selector, why: 'already mapped — two candidates, one element' });
    continue;
  }
  made.push({ type, ...m });
}

// ── Emit ────────────────────────────────────────────────────────────────────
const REGIONS = ['core', ...new Set(made.map((m) => m.type))];
const patchSrc = readFileSync(join(ROOT, 'u1-patch.js'), 'utf8');
let patch = "'use strict';\n";
const re = /\/\/#region u1-patch:([a-z]+)\r?\n([\s\S]*?)\r?\n\/\/#endregion/g;
for (let g; (g = re.exec(patchSrc)); ) if (REGIONS.includes(g[1])) patch += g[2] + '\n';

const js = (v) => JSON.stringify(v);
const call = (m) => {
  const cfg = { ...m.roots, selectors: m.fields };
  return `/* ---- ${m.type}  ${m.primary} ---- */\n` +
         `window.u1?.fix.${m.type}(${js(m.primary)}, ${JSON.stringify(cfg, null, 2)});`;
};

const out = `/* ============================================================
 * U1 accessibility mappings — ${base.hostname}
 * Measured from the live page by scripts/map-site.mjs on ${new Date().toISOString()}
 * ${made.length} component${made.length === 1 ? '' : 's'} mapped, ${skipped.length} left out (see the report).
 *
 * Every mapping here was read off the markup, not guessed: required fields
 * present, sub-selectors resolving to different elements, nothing matching
 * nothing. Paste AFTER the U1 library <script> tag.
 * ============================================================ */

/* ---- 1. Library corrections ---- */
(function () {
${patch}
})();

/* ---- 2. Component mappings ---- */
function __u1ApplyMappings() {
${made.map(call).join('\n\n')}
}
__u1ApplyMappings();

/* ---- 3. Responsive re-apply ---- */
(function () {
  var lastWidth = window.innerWidth, t = null;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(t);
    t = setTimeout(function () { try { __u1ApplyMappings(); } catch (e) {} }, 250);
  });
})();
`;

if (OUT) { writeFileSync(OUT, out); console.error(`Written to ${OUT}`); }
else if (!REPORT) process.stdout.write(out);

if (REPORT || OUT) {
  console.error(`\n${base.hostname} — ${found.candidates.length} candidates, ${comps.length} components\n`);
  console.error(`MAPPED (${made.length}):`);
  for (const m of made) {
    console.error(`  ${m.type.padEnd(10)} ${m.primary}`);
    for (const [k, v] of Object.entries(m.fields)) if (v !== m.primary) console.error(`     ${k.padEnd(18)} ${v}`);
  }
  console.error(`\nLEFT OUT (${skipped.length}) — a mapping that decorates nothing is worse than an absent one:`);
  for (const s of skipped) console.error(`  ${s.type.padEnd(10)} ${String(s.sel).slice(0, 44).padEnd(46)} ${s.why}`);
}

// The page's own timers — a ticker on a 6.5s interval, a carousel — keep the
// loop alive forever. Everything is written by this line.
process.exit(0);

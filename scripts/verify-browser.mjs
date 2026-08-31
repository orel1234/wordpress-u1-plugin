// Detection accuracy in a REAL browser.
//
//   node scripts/verify-browser.mjs             all three builds
//   node scripts/verify-browser.mjs --real      one build only
//   node scripts/verify-browser.mjs --hostile
//
// verify-detect.mjs runs the STATIC half (collectCandidates' hints) in jsdom,
// where the page's own JavaScript never runs and every rect and computed style
// is a hand-written stub. This harness is the other half of the audit's
// finding: it loads the same fixtures in headless Chromium — page JS runs, the
// builtByJs components exist, layout is real — injects selector-intel.js and
// probe.js, and drives the page the way the sweep does: section by section
// (scroll steps of 0.85 × viewport), probeAll per section with the sweep's own
// budget ({ inViewport: true, settle: 80, max: 12, limit: 2500, idle: 2000 }).
//
// It scores three matrices against fixtures/step.labels.json:
//   (a) hint      — what collectCandidates' componentHint said (markup read)
//   (b) classify  — what pressing and watching said (behaviour)
//   (c) union     — either one right = right; this is the pipeline's ceiling
// each with found / typed / rooted, a per-type confusion table, and precision
// over grouped flags (the same grouping rule as verify-detect: a detection
// inside another detection is the same detection; `nested` hints never count).
//
// The hostile build is the reason this file exists: with no names and no roles
// the static half reads ~0%, and the repo's own banner says behavioural
// probing is the answer — while nothing measured the behavioural half at all.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'fixtures');
const ONLY = process.argv.includes('--hostile') ? ['-hostile']
  : process.argv.includes('--real') ? ['-real']
  : process.argv.includes('--plain') ? ['']
  : ['', '-real', '-hostile'];
const VERBOSE = process.argv.includes('--verbose');

// The sweep's own numbers — mirrored, not invented. panel.js: SWEEP_OVERLAP
// 0.85, probeAll({ inViewport: true, settle: 80, max: 12, limit: 2500, idle: 2000 }).
const OVERLAP = 0.85;
const PROBE_OPTS = { inViewport: true, settle: 80, max: 12, limit: 2500, idle: 2000 };

// ── Serve fixtures/ ─────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  const file = join(FIX, name);
  if (!name || name.includes('..') || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ── Label translation per variant — same rules as verify-detect.mjs ────────
function labelsFor(variant) {
  const labels = JSON.parse(readFileSync(join(FIX, 'step.labels.json'), 'utf8'));
  if (variant === '-real') {
    const t = (sel) => String(sel)
      .replace(/\[aria-(expanded|selected|current|controls|labelledby)([^\]]*)\]/g, '[data-$1$2]')
      .replace(/\[role="[^"]*"\]/g, '');
    for (const c of labels.components) {
      c.root = t(c.root);
      for (const k of Object.keys(c.fields || {})) c.fields[k] = t(c.fields[k]);
    }
    if (labels.carousels_secondary) {
      labels.carousels_secondary.roots = labels.carousels_secondary.roots.map(t);
    }
  }
  if (variant === '-hostile') {
    const map = JSON.parse(readFileSync(join(FIX, 'step-hostile-map.json'), 'utf8'));
    const t = (sel) => String(sel)
      .replace(/\.([\w-]+)/g, (m, c) => map.classes[c] ? '.' + map.classes[c] : m)
      .replace(/#([\w-]+)/g, (m, i) => map.ids[i] ? '#' + map.ids[i] : m)
      .replace(/data-([\w-]+)/g, (m, d) => map.data[d] ? 'data-' + map.data[d] : m)
      .replace(/\b(nav|form|table|button|ul|ol|li|h[1-6]|section|article|header|footer|main|aside)\b(?![\w-])/g, 'div')
      .replace(/\[aria-[^\]]*\]/g, '');
    for (const c of labels.components) {
      c.root = t(c.root);
      for (const k of Object.keys(c.fields || {})) c.fields[k] = t(c.fields[k]);
    }
    if (labels.carousels_secondary) {
      labels.carousels_secondary.roots = labels.carousels_secondary.roots.map(t);
    }
  }
  return labels;
}

// ── Drive one build ─────────────────────────────────────────────────────────
async function runVariant(browser, variant) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://127.0.0.1:${PORT}/step${variant}.html`, { waitUntil: 'load' });
  await page.waitForTimeout(800);   // the page's own renderers finish
  await page.addScriptTag({ path: join(ROOT, 'selector-intel.js') });
  await page.addScriptTag({ path: join(ROOT, 'probe.js') });

  const labels = labelsFor(variant);
  const out = await page.evaluate(async ({ labels, OVERLAP, PROBE_OPTS }) => {
    const S = window.__u1SelectorIntel, P = window.__u1Probe;
    if (!S || !P) return { err: 'helpers did not load' };

    // Resolve labels once, to ELEMENTS — matching is by identity throughout.
    const positives = [], negatives = [];
    for (const c of labels.components) {
      let el = null;
      try { el = document.querySelector(c.root); } catch (e) {}
      (c.type === 'none' ? negatives : positives).push({ label: c, el });
    }
    // The "judgement call" set: a detection on these is neither hit nor FP.
    const secEls = [];
    for (const sel of (labels.carousels_secondary && labels.carousels_secondary.roots) || []) {
      try { for (const el of document.querySelectorAll(sel)) secEls.push(el); } catch (e) {}
    }

    // ── Pass 1: the sweep's walk — hint collection + probe per section ─────
    const vh = window.innerHeight;
    const total = Math.max(document.documentElement.scrollHeight, vh);
    const hintByEl = new Map();     // el → {component, maybe, nested, selector}
    const observed = [];            // classify comps, elements kept live
    let pressedTotal = 0;
    for (let y = 0; y < total; y += Math.round(vh * OVERLAP)) {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 120));
      try { S.clearMarks && S.clearMarks(); } catch (e) {}
      let got = null;
      try { got = S.collectCandidates(250, null); } catch (e) { got = null; }
      for (const c of (got && got.candidates) || []) {
        if (!c.component) continue;
        let el = null;
        try { el = document.querySelector(`[data-u1-mark="${c.mark}"]`); } catch (e) {}
        if (el && !hintByEl.has(el)) {
          hintByEl.set(el, { component: c.component, maybe: !!c.maybe, nested: !!c.nested, selector: c.selector || '' });
        }
      }
      let probed = null;
      try { probed = await P.probeAll(document.body, PROBE_OPTS); } catch (e) { probed = null; }
      if (probed) {
        pressedTotal += probed.pressed || 0;
        for (const comp of probed.components || []) observed.push(comp);
      }
    }
    window.scrollTo(0, 0);

    // ── Scoring helpers ────────────────────────────────────────────────────
    const touches = (a, b) => !!a && !!b && (a === b || a.contains(b) || b.contains(a));
    const typeOk = (want, got) => got === want || (want === 'tabs' && got === 'menu');
    // The TIGHTEST match, not the first: the idle-watch can hand back a
    // carousel rooted on a huge common ancestor, and first-match let that one
    // detection "explain" every label on the page. Exact element beats a
    // detection inside the label beats a container around it, and among
    // containers the smallest wins.
    const bestMatch = (detections, el) => {
      let best = null, bestRank = -1, bestSize = Infinity;
      for (const d of detections) {
        if (!touches(d.el, el)) continue;
        const rank = d.el === el ? 2 : el.contains(d.el) ? 1 : 0;
        const size = d.el.querySelectorAll('*').length;
        if (rank > bestRank || (rank === bestRank && size < bestSize)) {
          best = d; bestRank = rank; bestSize = size;
        }
      }
      return best;
    };

    const score = (detections) => {
      // detections: [{el, type, selector}]
      const rows = [];
      let found = 0, typed = 0, rooted = 0, tabsAsMenu = 0;
      for (const { label, el } of positives) {
        if (label.hidden) continue;           // the closed half is its own story
        if (!el) { rows.push({ type: label.type, root: label.root, got: '(label broken)' }); continue; }
        const hit = bestMatch(detections, el);
        if (!hit) { rows.push({ type: label.type, root: label.root, got: '(none)' }); continue; }
        found++;
        if (typeOk(label.type, hit.type)) {
          typed++;
          if (label.type === 'tabs' && hit.type === 'menu') tabsAsMenu++;
        }
        let hits = [];
        try { hits = hit.selector ? Array.from(document.querySelectorAll(hit.selector)) : []; } catch (e) {}
        if (hits.length && hits.some((h) => touches(h, el))) rooted++;
        rows.push({ type: label.type, root: label.root, got: hit.type });
      }
      // Precision: group flags — a detection inside another detection OF THE
      // SAME TYPE is an echo of it, not a second opinion. Same-type only: the
      // idle-watch's page-spanning carousel must not swallow a table.
      const perEl = new Map();
      const deduped = [];
      for (const d of detections) {
        if (!d.el) continue;
        let set = perEl.get(d.el);
        if (!set) { set = new Set(); perEl.set(d.el, set); }
        if (set.has(d.type)) continue;
        set.add(d.type);
        deduped.push(d);
      }
      const groups = deduped.filter((d) =>
        !deduped.some((o) => o.el !== d.el && o.type === d.type && o.el.contains(d.el)))
        .filter((d) => !secEls.some((S) => S === d.el || S.contains(d.el) || d.el.contains(S)));
      const tp = groups.filter((g) => positives.some((p) => p.el && touches(g.el, p.el)));
      const fp = groups.filter((g) => !positives.some((p) => p.el && touches(g.el, p.el)));
      const fpList = fp.map((g) => ({
        type: g.type,
        selector: g.selector || (S.robustSelector ? S.robustSelector(g.el) : ''),
        pinned: negatives.some((n) => n.el && touches(g.el, n.el)),
      }));
      const denom = positives.filter((p) => !p.label.hidden).length;
      return { found, typed, rooted, denom, tabsAsMenu, tp: tp.length, groups: groups.length, fpList, rows };
    };

    // Only elements still IN the document may testify. A pane that re-renders
    // between sections (the locator detail, the FAQ answers under a pressed
    // tab) leaves the earlier collection holding detached elements — which
    // matched nothing, doubled as "two tables", and turned four accordion
    // rows into four false positives. Detached is not detected.
    const live = (list) => list.filter((d) => d.el && d.el.isConnected);

    const hintDetections = live([...hintByEl.entries()]
      .filter(([, h]) => !h.nested)
      .map(([el, h]) => ({ el, type: h.component, selector: h.selector })));
    const classifyDetections = observed
      .filter((c) => c && c.root && c.type)
      // A detection rooted on <body> or <html> is not a detection of anything
      // — it is the idle-watch or a commonAncestor climb losing its grip, and
      // counting it let one observation "explain" half the labels on the page.
      // It still appears in the verbose observation list, because it is a
      // finding about classify worth seeing; it just cannot score.
      .filter((c) => c.root !== document.body && c.root !== document.documentElement)
      .map((c) => ({ el: c.root, type: c.type, selector: S.robustSelector ? S.robustSelector(c.root) : '' }));
    const classifyLive = live(classifyDetections);
    // Union: hint's element set plus classify's; for a label matched by both,
    // typed counts if EITHER got the type right.
    const unionDetections = hintDetections.concat(classifyLive);
    const union = (() => {
      const base = score(unionDetections);
      let typed = 0;
      for (const { label, el } of positives) {
        if (label.hidden || !el) continue;
        const anyRight = unionDetections.some((d) => touches(d.el, el) && typeOk(label.type, d.type));
        if (anyRight) typed++;
      }
      return { ...base, typed };
    })();

    // The closed half: found (collected or observed at all), and NAMED — did
    // any source put the right type on it. Naming the hidden components is
    // the whole promise of the behavioural layer on a hint-free page.
    let openFound = 0, openNamed = 0;
    const openable = positives.filter((p) => p.label.hidden);
    for (const { label, el } of openable) {
      if (!el) continue;
      const found = hintByEl.has(el) || unionDetections.some((d) => touches(d.el, el));
      if (found) openFound++;
      const hit = bestMatch(unionDetections, el);
      if (hit && typeOk(label.type, hit.type)) openNamed++;
    }

    // builtByJs sanity — the reason jsdom's hostile run was not a measurement.
    const builtProbes = labels.components.filter((c) => c.builtByJs)
      .map((c) => Object.values(c.fields || {})[0] || c.root)
      .map((sel) => { let n = 0; try { n = document.querySelectorAll(sel).length; } catch (e) {} return { sel, n }; });

    // classify's observations as text (for --verbose and the confusion table)
    const observedList = observed.map((c) => ({
      type: c.type, why: c.why || '',
      root: S.robustSelector ? S.robustSelector(c.root) : '(unnamed)',
    }));

    return {
      hint: score(hintDetections),
      classify: score(classifyLive),
      union,
      openFound, openNamed, openTotal: openable.length,
      builtProbes, pressedTotal, observedList,
    };
  }, { labels, OVERLAP, PROBE_OPTS });

  await page.close();
  return out;
}

// ── Print ───────────────────────────────────────────────────────────────────
const pct = (a, b) => b ? Math.round((a / b) * 1000) / 10 : 0;
const bar = (p) => '█'.repeat(Math.round(p / 5)).padEnd(20, '·');
const line = (name, a, b) => console.log(`    ${name.padEnd(26)} ${bar(pct(a, b))} ${String(a).padStart(3)}/${b}  ${pct(a, b)}%`);

const NAMES = { '': 'FRIENDLY', '-real': 'REALISTIC', '-hostile': 'HOSTILE' };
let failed = false;

const browser = await chromium.launch();
for (const variant of ONLY) {
  const r = await runVariant(browser, variant);
  console.log(`\n══ ${NAMES[variant]} — real Chromium, the sweep's own walk ══`);
  if (r.err) { console.error('  ' + r.err); failed = true; continue; }

  const none = r.builtProbes.every((b) => b.n === 0);
  if (none) {
    console.log('  NONE of the JS-built components built — harness problem, scores below are void.');
    failed = true;
  } else if (VERBOSE) {
    console.log('  Built by the page\'s own JavaScript: ' + r.builtProbes.map((b) => `${b.sel}=${b.n}`).join(' · '));
  }
  console.log(`  ${r.pressedTotal} presses across the walk · ` +
    (r.openTotal ? `closed collected ${r.openFound}/${r.openTotal} · closed NAMED right ${r.openNamed}/${r.openTotal}` : ''));

  for (const [title, m] of [['(a) hint — markup read', r.hint], ['(b) classify — behaviour', r.classify], ['(c) union — the pipeline', r.union]]) {
    console.log(`\n  ${title}`);
    line('found at all', m.found, m.denom);
    line('named correctly', m.typed, m.denom);
    line('selector resolves', m.rooted, m.denom);
    line('precision (flag groups)', m.tp, m.groups);
    if (m.tabsAsMenu) console.log(`    ⚠ ${m.tabsAsMenu} tab strip(s) accepted as "menu" (documented collapse; stage 4 will demand "tabs")`);
    if (m.fpList.length) {
      const byType = {};
      for (const f of m.fpList) (byType[f.type + (f.pinned ? ' ← pinned negative' : '')] ||= []).push(f.selector);
      console.log('    false positives:');
      for (const [t, sels] of Object.entries(byType)) {
        console.log(`      ${t.padEnd(24)} ×${String(sels.length).padEnd(3)} ${sels.slice(0, 4).join(' · ')}${sels.length > 4 ? ' …' : ''}`);
      }
    }
  }

  console.log('\n  confusion (label type → what each source said):');
  console.log(`    ${'label'.padEnd(11)}${'hint'.padEnd(12)}${'classify'.padEnd(12)}root`);
  for (let i = 0; i < r.hint.rows.length; i++) {
    const h = r.hint.rows[i], c = r.classify.rows[i];
    console.log(`    ${h.type.padEnd(11)}${(h.got || '—').padEnd(12)}${((c && c.got) || '—').padEnd(12)}${h.root}`);
  }

  if (VERBOSE && r.observedList.length) {
    console.log('\n  everything classify observed:');
    for (const o of r.observedList) console.log(`    ${o.type.padEnd(11)} ${o.root}  — ${o.why}`);
  }

  // Floor: on the non-hostile builds the UNION must hold recall and precision.
  if (variant !== '-hostile') {
    const worst = Math.min(pct(r.union.found, r.union.denom),
      r.union.groups ? pct(r.union.tp, r.union.groups) : 100);
    if (worst < 60) { console.error('\n  Below the 60% floor (union recall or precision).'); failed = true; }
  }
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);

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
    try { P.resetRun && P.resetRun(); } catch (e) {}

    // F-lite + D. One snapshot decides press membership; the hint layer's
    // strips are seeded so a strip the markup announces never depends on
    // where the viewport happened to be when rects were read. The seed scan
    // mirrors the hint vocabulary for strips: role=tablist, or a tab/menu/nav
    // -flavoured class, with ≥2 direct children that hold a pressable.
    const seeds = [];
    try {
      const STRIP_ROOTS = document.querySelectorAll(
        '[role="tablist"],[class*="tab" i],[class*="menu" i],[class*="nav" i]');
      for (const rootEl of STRIP_ROOTS) {
        if (seeds.length >= 60) break;
        const kids = [...rootEl.children].map((k) => {
          try {
            return k.matches('button,[role="button"],[role="tab"],summary') ? k
              : k.querySelector('button,[role="button"],[role="tab"],summary');
          } catch (e) { return null; }
        }).filter(Boolean);
        if (kids.length >= 2) for (const k of kids) { if (seeds.length < 60) seeds.push(k); }
      }
    } catch (e) {}
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 150));
    const planned = P.planRun ? P.planRun(document.body, { seeds }) : 0;

    const vh = window.innerHeight;
    const total = Math.max(document.documentElement.scrollHeight, vh);
    const step = Math.round(vh * OVERLAP);
    // The per-section press signature, for the stability gate: which planned
    // candidates belong to each band, named tersely. Identical across runs
    // is the whole promise of the snapshot.
    const face = (el) => (el.id || String(el.className).split(' ')[0] || el.tagName).slice(0, 24);
    const planSections = [];
    const hintByEl = new Map();     // el → {component, maybe, nested, selector}
    const observed = [];            // classify comps, elements kept live
    let pressedTotal = 0;
    for (let y = 0; y < total; y += step) {
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
      const band = { from: y, to: y + step >= total ? Infinity : y + step };
      let probed = null;
      try {
        probed = await P.probeAll(document.body, { ...PROBE_OPTS, sectionY: band });
      } catch (e) { probed = null; }
      if (probed) {
        pressedTotal += probed.pressed || 0;
        for (const comp of probed.components || []) observed.push(comp);
      }
      planSections.push({ y });
    }
    // The signature comes from the PLAN itself (stable by construction), not
    // from what got pressed — everPressed thins later sections by design.
    try {
      const snap = P.planSnapshot ? P.planSnapshot() : [];
      for (const sec of planSections) {
        const to = sec.y + step >= total ? Infinity : sec.y + step;
        sec.faces = snap.filter((p) => p.docY >= sec.y && p.docY < to)
          .map((p) => (p.seeded ? '*' : '') + (p.id || p.cls));
      }
    } catch (e) {}
    window.scrollTo(0, 0);
    // ── The run-level pass (stage 3.5): one classify over the whole ledger,
    // with the sibling climb. Its answer REPLACES the per-section fragments —
    // the sections' own comps are kept only for the verbose observation list.
    let finalComps = [];
    try { finalComps = P.classifyRun ? P.classifyRun() : []; } catch (e) { finalComps = []; }

    // ── Scoring helpers ────────────────────────────────────────────────────
    const touches = (a, b) => !!a && !!b && (a === b || a.contains(b) || b.contains(a));
    // 4.3: exact — the tabs-as-menu collapse is over, the count is paid.
    const typeOk = (want, got) => got === want;
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
      let found = 0, typed = 0, rooted = 0;
      for (const { label, el } of positives) {
        if (label.hidden) continue;           // the closed half is its own story
        if (!el) { rows.push({ type: label.type, root: label.root, got: '(label broken)' }); continue; }
        const hit = bestMatch(detections, el);
        if (!hit) { rows.push({ type: label.type, root: label.root, got: '(none)' }); continue; }
        found++;
        if (typeOk(label.type, hit.type)) typed++;
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
      return { found, typed, rooted, denom, tp: tp.length, groups: groups.length, fpList, rows };
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
    // 4.2: observed-but-unclassified is its own column, never a score.
    const unclassified = finalComps
      .filter((c) => c && c.root && !c.type)
      .map((c) => S.robustSelector ? S.robustSelector(c.root) : '(unnamed)');
    const classifyDetections = finalComps
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
    const openDetail = [];
    const openable = positives.filter((p) => p.label.hidden);
    for (const { label, el } of openable) {
      if (!el) { openDetail.push({ root: label.root, type: label.type, found: false, named: false }); continue; }
      const found = hintByEl.has(el) || unionDetections.some((d) => touches(d.el, el));
      if (found) openFound++;
      const hit = bestMatch(unionDetections, el);
      const named = !!(hit && typeOk(label.type, hit.type));
      if (named) openNamed++;
      openDetail.push({ root: label.root, type: label.type, found, named,
                        got: hit ? hit.type : null });
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
      openFound, openNamed, openTotal: openable.length, openDetail, unclassified,
      builtProbes, pressedTotal, observedList,
      plannedCount: planned, planSections,
      starved: P.starvedSnapshot ? P.starvedSnapshot() : [],
      residue: P.residueSnapshot ? P.residueSnapshot() : [],
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

const STABILITY = (() => {
  const a = process.argv.find((x) => x.startsWith('--stability'));
  return a ? Number(a.split('=')[1] || 5) : 0;
})();

const browser = await chromium.launch();

// ── The stability gate: N full walks per build ──────────────────────────────
// F-lite's promise is determinism: the per-section candidate plan must be
// IDENTICAL run to run, the finder strip must classify every time, and the
// classify numbers are reported as mean and range, not as one lucky draw.
if (STABILITY) {
  for (const variant of ONLY) {
    const runs = [];
    for (let n = 0; n < STABILITY; n++) runs.push(await runVariant(browser, variant));
    console.log(`\n══ ${NAMES[variant]} — ${STABILITY} runs ══`);

    if (variant === '') {
      const sig = (r) => JSON.stringify(r.planSections.map((s) => s.faces));
      const sigs = runs.map(sig);
      const identical = sigs.every((s) => s === sigs[0]);
      console.log(`  plan identical across runs: ${identical ? `YES (${runs[0].planSections.length} sections, ${runs[0].plannedCount} candidates)` : 'NO'}`);
      if (!identical) {
        failed = true;
        for (let n = 1; n < runs.length; n++) {
          if (sigs[n] === sigs[0]) continue;
          runs[0].planSections.forEach((s, i) => {
            const other = runs[n].planSections[i];
            if (JSON.stringify(s.faces) !== JSON.stringify(other && other.faces)) {
              console.log(`    run 1 vs run ${n + 1}, section y=${s.y}:`);
              console.log(`      1: ${s.faces.join(' ')}`);
              console.log(`      ${n + 1}: ${(other ? other.faces : []).join(' ')}`);
            }
          });
          break;
        }
      }
      const finder = runs.map((r) => {
        const row = (r.classify.rows || []).find((x) => x.root === '.finder__tabs');
        return row ? row.got : '(no row)';
      });
      const finderOk = finder.every((g) => g === 'menu' || g === 'tabs');
      console.log(`  .finder__tabs classify verdicts: ${finder.join(' · ')}  ⇒ ${finderOk ? 'PASS' : 'FAIL'}`);
      if (!finderOk) failed = true;
    }

    const stat = (pick) => {
      const vals = runs.map(pick);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return `${mean.toFixed(1)} [${Math.min(...vals)}–${Math.max(...vals)}]`;
    };
    console.log(`  classify found:     ${stat((r) => r.classify.found)} /${runs[0].classify.denom}`);
    console.log(`  classify typed:     ${stat((r) => r.classify.typed)} /${runs[0].classify.denom}`);
    console.log(`  classify precision: ${stat((r) => r.classify.groups ? Math.round((r.classify.tp / r.classify.groups) * 1000) / 10 : 100)}%`);
    console.log(`  closed named right: ${stat((r) => r.openNamed)} /${runs[0].openTotal}`);
    console.log(`  presses:            ${stat((r) => r.pressedTotal)}`);
  }
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
}
for (const variant of ONLY) {
  const t0 = Date.now();
  const r = await runVariant(browser, variant);
  const walkSecs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n══ ${NAMES[variant]} — real Chromium, the sweep's own walk ══`);
  console.log(`  walk time: ${walkSecs}s`);
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
  for (const d of r.openDetail || []) {
    console.log(`    ${d.found ? (d.named ? ' ok ' : ' ~~ ') : 'MISS'}  ${d.type.padEnd(10)} ${d.root}` +
      (d.found && !d.named ? `  — collected, named ${d.got || '(nothing)'}` : ''));
  }
  if ((r.unclassified || []).length) {
    console.log(`  observed, unclassified (type:null — reported, never scored): ` +
      r.unclassified.slice(0, 8).join(' · ') +
      (r.unclassified.length > 8 ? ` · +${r.unclassified.length - 8} more` : ''));
  }
  if ((r.residue || []).length) {
    console.log(`  restored:false — presses whose undo did not complete: ` +
      r.residue.slice(0, 8).map((p) => (p.id ? '#' + p.id : p.cls) +
        (p.residue ? ` (${p.residue.appeared} left showing${p.residue.classes ? ', classes' : ''})` : '')).join(' · ') +
      (r.residue.length > 8 ? ` · +${r.residue.length - 8} more` : ''));
  } else {
    console.log('  restored:false — none: every press was put back');
  }
  if ((r.starved || []).length) {
    console.log(`  starved (budget cost them their press, even with one spillover): ` +
      r.starved.map((s) => (s.id ? '#' + s.id : s.cls) + '@' + s.docY).join(' · '));
  }

  // (c) is THE reported number from stage 3.4 on: it is the by-root merge of
  // both voices, which is exactly what the panel's typing pipeline now feeds
  // to the model and the audit.
  for (const [title, m] of [['(a) hint — markup read', r.hint], ['(b) classify — behaviour', r.classify], ['(c) union — the pipeline (REPORTED)', r.union]]) {
    console.log(`\n  ${title}`);
    line('found at all', m.found, m.denom);
    line('named correctly', m.typed, m.denom);
    line('selector resolves', m.rooted, m.denom);
    line('precision (flag groups)', m.tp, m.groups);
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

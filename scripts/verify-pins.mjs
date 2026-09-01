// Real-site pins (mission brief 0.5): frozen post-JS captures of live pages,
// each with hand-written labels, walked the way the sweep walks. A pin is a
// REGRESSION anchor, not a target — the floor below each pin is the score it
// had the day it was frozen, and the build fails only if detection falls
// UNDER it. The pages are inert (scripts stripped at capture), so only the
// hint layer and the non-press half of behaviour can testify; the floors are
// set accordingly, from the first measured run.
//
//   node scripts/verify-pins.mjs

import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PINS = join(ROOT, 'fixtures', 'pins');

// { pinName: { found, typed } } — frozen the day the pin was captured.
const FLOORS = {
  // 5/5 measured at capture (2026-09-01). The three MISSes are the
  // behaviour-only components (the lang menu's press, the galleries'
  // slide) — an inert pin can never fire them, and their labels stay to
  // document the full page; the floor covers the hint layer's share.
  'govil-home': { found: 5, typed: 5 },
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  const file = join(PINS, name);
  if (!name || name.includes('..') || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await chromium.launch();
let failed = false;

for (const html of readdirSync(PINS).filter((f) => f.endsWith('.html'))) {
  const name = html.replace(/\.html$/, '');
  const labelsFile = join(PINS, name + '.labels.json');
  if (!existsSync(labelsFile)) { console.log(`  ${name}: no labels — skipped`); continue; }
  const labels = JSON.parse(readFileSync(labelsFile, 'utf8'));

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://127.0.0.1:${PORT}/${html}`, { waitUntil: 'load' });
  await page.addScriptTag({ path: join(ROOT, 'selector-intel.js') });
  await page.addScriptTag({ path: join(ROOT, 'probe.js') });

  const r = await page.evaluate(async (labels) => {
    const S = window.__u1SelectorIntel, P = window.__u1Probe;
    if (!S || !P) return { err: 'helpers did not load' };
    const touches = (a, b) => a === b || a.contains(b) || b.contains(a);

    const resolved = labels.components
      .filter((c) => c.type !== 'none')
      .map((c) => {
        let el = null;
        try { el = document.querySelector(c.root); } catch (e) {}
        return { label: c, el };
      });

    // Hint pass + the walk (the page is inert: presses reveal nothing, but
    // the walk itself must complete without harm).
    let hints = [];
    try {
      hints = S.collectCandidates(2500, null).candidates
        .filter((c) => c.component && !c.nested)
        .map((c) => { let el = null; try { el = document.querySelector(c.selector); } catch (e) {} return { el, type: c.component }; })
        .filter((h) => h.el);
    } catch (e) {}
    P.resetRun();
    P.planRun(document.body, { seeds: [] });
    const vh = window.innerHeight;
    const total = Math.max(document.documentElement.scrollHeight, vh);
    const step = Math.round(vh * 0.85);
    let pressed = 0;
    for (let y = 0; y < total; y += step) {
      window.scrollTo(0, y);
      await new Promise((r2) => setTimeout(r2, 60));
      const res = await P.probeAll(document, {
        inViewport: true, settle: 40, max: 12, limit: 2500, idle: 0,
        sectionY: { from: y, to: (y + step >= total) ? null : y + step },
      });
      pressed += res.pressed || 0;
    }
    const observed = P.classifyRun().filter((c) => c.type && c.root);
    const voices = hints.map((h) => ({ el: h.el, type: h.type }))
      .concat(observed.map((c) => ({ el: c.root, type: c.type })));

    let found = 0, typed = 0;
    const rows = [];
    for (const { label, el } of resolved) {
      if (!el) { rows.push(`MISS(label!) ${label.type} ${label.root}`); continue; }
      const touching = voices.filter((v) => touches(v.el, el));
      const ok = touching.some((v) => v.type === label.type);
      if (touching.length) found++;
      if (ok) typed++;
      rows.push(`${ok ? ' ok ' : touching.length ? ' ~~ ' : 'MISS'} ${label.type.padEnd(10)} ${label.root}`);
    }
    return { found, typed, total: resolved.length, pressed, rows };
  }, labels);
  await page.close();

  if (r.err) { console.log(`  ${name}: ${r.err}`); failed = true; continue; }
  console.log(`  ${name} — found ${r.found}/${r.total}, typed ${r.typed}/${r.total}, pressed ${r.pressed}`);
  for (const row of r.rows) console.log(`    ${row}`);
  const floor = FLOORS[name];
  if (floor && (r.found < floor.found || r.typed < floor.typed)) {
    console.log(`  ${name}: UNDER THE FLOOR (${floor.found}/${floor.typed}) — detection regressed on a frozen page`);
    failed = true;
  }
}

await browser.close();
server.close();
console.log(failed ? '\n  pins: FAIL' : '\n  pins: ok');
process.exit(failed ? 1 : 0);

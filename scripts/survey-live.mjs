// R5: the field survey with a NAVIGATION GUARD — the sweep's own recovery
// (sweepBackIfNavigated), harness-grade: a press that escapes the net and
// navigates loses one band, not the run. Per-band evaluate, rows merged in
// Node by (sel, type); in-page state (plan, ledger) is rebuilt after each
// escape and dedup happens here.
import { chromium } from '/Users/oreluser1st/git/wordpress-u1-plugin-1/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const PROBE = readFileSync('/Users/oreluser1st/git/wordpress-u1-plugin-1/probe.js', 'utf8');
const INTEL = readFileSync('/Users/oreluser1st/git/wordpress-u1-plugin-1/selector-intel.js', 'utf8');
const URL_ = process.argv[2];
const OUT = process.argv[3];
const MAX_BANDS = Number(process.argv[4] || 20);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
});

const inject = async () => {
  await page.addScriptTag({ content: INTEL });
  await page.addScriptTag({ content: PROBE });
  await page.evaluate(() => {
    const P = window.__u1Probe;
    P.resetRun();
    window.scrollTo(0, 0);
    P.planRun(document.body, { seeds: [] });
  });
};

let navEscapes = 0;
const rows = new Map();          // (type|sel) -> row
const misc = { unclassified: new Set(), starved: [], residue: [], blocked: [], closedShadow: [] };

const harvest = async () => {
  const h = await page.evaluate(() => {
    const S = window.__u1SelectorIntel, P = window.__u1Probe;
    const show = (el) => { try { return S.robustSelector(el) || el.tagName; } catch (e) { return el.tagName; } };
    const comps = P.classifyRun();
    return {
      rows: comps.filter((c) => c.type).map((c) => ({
        sel: show(c.root), type: c.type, over: c.overwriteRole || null,
        why: (c.why || '').slice(0, 120),
      })),
      unclassified: comps.filter((c) => !c.type).map((c) => show(c.root)).slice(0, 10),
      starved: P.starvedSnapshot().slice(0, 10),
      residue: P.residueSnapshot().slice(0, 8),
    };
  });
  for (const r of h.rows) {
    const k = r.type + '|' + r.sel;
    if (!rows.has(k)) rows.set(k, r);
  }
  h.unclassified.forEach((u) => misc.unclassified.add(u));
  misc.starved = h.starved; misc.residue = h.residue;
};

try {
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  await inject();

  // Hint pass + shadow census, once.
  const head = await page.evaluate(() => {
    const S = window.__u1SelectorIntel;
    let hint = [];
    try {
      hint = S.collectCandidates(2500, null).candidates
        .filter((c) => c.component && !c.nested)
        .map((c) => ({ sel: c.selector, type: c.component, maybe: !!c.maybe }));
    } catch (e) {}
    const seen = {};
    for (const el of document.querySelectorAll('*')) {
      const t = el.tagName.toLowerCase();
      if (t.includes('-') && !el.shadowRoot) seen[t] = (seen[t] || 0) + 1;
    }
    return { hint, closedShadow: Object.entries(seen).map(([t, n]) => t + '×' + n).slice(0, 12),
             total: Math.max(document.documentElement.scrollHeight, 800),
             title: document.title.slice(0, 80) };
  });
  misc.closedShadow = head.closedShadow;

  const step = Math.round(800 * 0.85);
  let pressed = 0, bands = 0;
  for (let y = 0; y < head.total && bands < MAX_BANDS; y += step, bands++) {
    try {
      const res = await page.evaluate(async ({ y, step, last }) => {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 150));
        const out = await window.__u1Probe.probeAll(document, {
          inViewport: true, settle: 80, max: 12, limit: 2500, idle: 600,
          sectionY: { from: y, to: last ? null : y + step },
        });
        return { pressed: out.pressed || 0, blocked: (out.blocked || []).slice(0, 5).map(String) };
      }, { y, step, last: y + step >= head.total || bands === MAX_BANDS - 1 });
      pressed += res.pressed;
      for (const b of res.blocked) if (misc.blocked.length < 15) misc.blocked.push(b.slice(0, 90));
      await harvest();
    } catch (e) {
      // R5: the guard. A press navigated out from under the net — go back,
      // re-arm everything, and continue from the NEXT band.
      navEscapes++;
      try {
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
        await page.waitForTimeout(1500);
        await inject();
      } catch (e2) { break; }
    }
  }

  for (const h of head.hint) {
    const k = h.type + '|' + h.sel;
    if (!rows.has(k)) rows.set(k, { sel: h.sel, type: h.type, src: 'hint', maybe: h.maybe, why: '(markup only)' });
  }

  writeFileSync(OUT, JSON.stringify({
    url: URL_, title: head.title, pressed, bands, navEscapes,
    rows: [...rows.values()],
    unclassified: [...misc.unclassified],
    starved: misc.starved, residue: misc.residue,
    blocked: misc.blocked, closedShadow: misc.closedShadow,
  }, null, 2));
  console.log(OUT, `ok — ${rows.size} rows, pressed ${pressed}, bands ${bands}, navEscapes ${navEscapes}`);
} catch (e) {
  writeFileSync(OUT, JSON.stringify({ url: URL_, err: String(e).slice(0, 300), navEscapes }));
  console.log(OUT, 'ERR:', String(e).slice(0, 160));
}
await browser.close();

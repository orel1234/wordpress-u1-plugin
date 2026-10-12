// The field survey, FAITHFUL to the extension's world split: probe-net.js in
// the page's MAIN world, selector-intel.js + probe.js in an ISOLATED world
// (CDP Page.createIsolatedWorld) — so the page's own fetch/pushState are
// only ever touched by probe-net's wrappers, exactly as in Chrome. The
// older survey-live.mjs injects everything into the main world, where
// probe.js's own stubs REJECT fetch and a Next.js router tears the page
// down (molinahealthcare.com, 2026-10-04) — a failure the extension never has.
//
// Mirrors runSweep: the seeds, F-lite plan, bands of 0.85 × viewport,
// probeAll({ inViewport, settle: 80, max: 12, limit: 2500, idle: 2000 }),
// the reload-and-skip recovery on page loss, and the run-level classify.
//
//   node scripts/survey-iso.mjs <url> [out.json]        (VW=390 for mobile)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const R = join(dirname(fileURLToPath(import.meta.url)), '..') + '/';
const [,, URL_, OUT] = process.argv;
const NET = readFileSync(R + 'probe-net.js', 'utf8');
const PROBE = readFileSync(R + 'probe.js', 'utf8'), INTEL = readFileSync(R + 'selector-intel.js', 'utf8');
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: Number(process.env.VW || 1280), height: Number(process.env.VH || 800) } });
await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4500);
const cdp = await page.context().newCDPSession(page);
const { frameTree } = await cdp.send('Page.getFrameTree');
let ctx = null;
const arm = async () => {
  await page.addScriptTag({ content: NET });
  const w = await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'u1iso' + Date.now() });
  ctx = w.executionContextId;
  await iso(INTEL); await iso(PROBE);
};
const iso = async (expr) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, contextId: ctx, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
};
const call = (fn, arg) => iso(`(${fn})(${JSON.stringify(arg ?? null)})`);
await arm();
// Router + net trace from the MAIN world
await page.evaluate(() => {
  window.__trace = [];
  const Rt = window.next && window.next.router;
  if (Rt && Rt.events) ['routeChangeStart', 'routeChangeError', 'beforeHistoryChange'].forEach((ev) => Rt.events.on(ev, (u) => window.__trace.push(`ROUTER ${ev} ${String(u).slice(0, 60)}`)));
});
const hint = await call(() => window.__u1SelectorIntel.collectCandidates(2500, null).candidates.filter((c) => c.component && !c.nested).map((c) => ({ sel: c.selector, type: c.component })));
const plan = () => call(() => {
  const P = window.__u1Probe; P.resetRun(); window.scrollTo(0, 0);
  const seeds = [];
  for (const rootEl of document.querySelectorAll('[role="tablist"],[class*="tab" i],[class*="menu" i],[class*="nav" i]')) {
    if (seeds.length >= 60) break;
    const kids = [...rootEl.children].map((k) => { try { return k.matches('button,[role="button"],[role="tab"],summary') ? k : k.querySelector('button,[role="button"],[role="tab"],summary'); } catch (e) { return null; } }).filter(Boolean);
    if (kids.length >= 2) for (const k of kids) { if (seeds.length < 60) seeds.push(k); }
  }
  return P.planRun(document.body, { seeds });
});
let planned = await plan();
const log = [`planned ${planned}`];
let skipKeys = [], reloads = 0, lostObserved = [];
const total = await page.evaluate(() => document.documentElement.scrollHeight);
const step = Math.round(Number(process.env.VH || 800) * 0.85);
for (let y = 0; y < total; y += step) {
  const res = await call(async (a) => {
    window.__skipKeys = a.skipKeys;
    window.scrollTo(0, a.y); await new Promise((r) => setTimeout(r, 150));
    const S = window.__u1SelectorIntel;
    const out = await window.__u1Probe.probeAll(document.body, { inViewport: true, settle: 80, max: 12, limit: 2500, idle: 2000, trace: true, skipKeys: a.skipKeys, sectionY: { from: a.y, to: a.last ? Infinity : a.y + a.step } });
    const ledger = out.pageLost ? window.__u1Probe.classifyRun().filter((c) => c.type && c.root).map((c) => ({ type: c.type, root: (() => { try { return S.robustSelector(c.root); } catch (e) { return '?'; } })(), why: (c.why || '').slice(0, 150) })) : null;
    return { ledger, pressedKeys: out.pressedKeys, lostKey: out.lostKey, trace: out.trace, planMissing: out.planMissing, pressed: out.pressed, lost: out.pageLost, spared: out.spared, blocked: out.blocked, restored: out.restored, comps: out.components.map((c) => c.type + '@' + (S.robustSelector(c.root) || '').slice(0, 50)), body: document.body.querySelectorAll('*').length, path: location.pathname };
  }, { y, step, last: y + step >= total, skipKeys });
  if (res.lost && reloads < 3) {
    reloads++;
    skipKeys = [...new Set([...skipKeys, ...(res.pressedKeys || [])])];
    if (res.ledger) lostObserved.push(...res.ledger);
    log.push(`   LOST by ${res.lostKey} — reloading (${reloads}), skipping ${skipKeys.length} keys`);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4500);
    await arm(); planned = await plan(); log.push(`   re-planned ${planned}`);
    y -= step; continue;
  }
  (res.trace || []).forEach((t) => log.push('    ' + JSON.stringify(t)));
  log.push(`   planMissing ${res.planMissing}`);
  log.push(`band y${y}: pressed ${res.pressed} spared ${res.spared} lost ${res.lost} restored ${res.restored} body ${res.body} path ${res.path} blocked ${JSON.stringify(res.blocked).slice(0, 200)} comps ${res.comps.join(' ; ')}`);
}
const comps0 = await call(() => { const S = window.__u1SelectorIntel; const d = (e) => { try { return (e.isConnected ? '' : 'GONE:') + (S.robustSelector(e) || e.tagName).slice(0, 60); } catch (x) { return e.tagName; } }; return window.__u1Probe.classifyRun().map((c) => ({ type: c.type || 'UNCLASSIFIED', root: (() => { try { return S.robustSelector(c.root); } catch (e) { return '?'; } })(), why: (c.why || '').slice(0, 150), over: c.overwriteRole || null, parts: Object.fromEntries(Object.entries(c.parts || {}).map(([k, v]) => [k, (v || []).slice(0, 6).map(d)])) })); });
const seenC = new Set(comps0.map((c) => c.type + '|' + c.root)); const comps = comps0.concat(lostObserved.filter((c) => !seenC.has(c.type + '|' + c.root)).map((c) => ({ ...c, parts: { fromLostPage: [] } })));
const trace = await page.evaluate(() => window.__trace || []);
const final = await page.evaluate(() => ({ body: document.body.querySelectorAll('*').length, h1: (document.querySelector('h1') || {}).textContent }));
const res = { log, comps, hint, trace, final };
if (OUT) writeFileSync(OUT, JSON.stringify(res, null, 2));
log.forEach((l) => console.log(l));
console.log('RUN COMPS:'); comps.forEach((c) => { console.log('  ', c.type.padEnd(12), (c.over ? '[' + c.over + '] ' : '') + c.root.slice(0, 70), '|', c.why); console.log('      parts', JSON.stringify(c.parts)); });
console.log('HINT:'); hint.forEach((h) => console.log('  ', h.type.padEnd(12), h.sel.slice(0, 90)));
console.log('ROUTER/NET trace:', trace.slice(0, 20).join(' || '));
console.log('final', JSON.stringify(final));
await browser.close();

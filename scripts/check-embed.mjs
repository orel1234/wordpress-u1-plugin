// Give it a client's live URL, get back a pass/fail on whether U1 is really
// embedded — permanently, in their own template — not just present in this
// one DevTools session because someone pasted the snippet into the console.
//
//   node scripts/check-embed.mjs https://client-site.com
//
// Three independent checks, because any one alone can lie:
//
//   1. RAW HTML (fetched cold, no browser, no JS run) has <link id="u1-css">
//      and <script id="u1-js"> pointing at the real host. This is the one
//      that catches a console-only injection: if it's not in the markup the
//      server actually serves, it isn't "implemented", it's a demo that dies
//      on next reload.
//   2. The real browser's NETWORK LOG shows u1.css and u1_vanilla-js-a11y.js
//      loaded with 200 — confirms the reference in (1) actually resolves
//      (not a stale/typo'd URL) and isn't blocked (CSP, ad blocker, CORS).
//   3. RUNTIME: window.u1 (or U1 / user1st) exists with .fix, and
//      window.__u1Patch is set — confirms the engine booted and u1-patch.js
//      (or the client's own implementation file) ran, not just that the
//      <script> tag loaded.
//
// Bonus: flags skip-links that are visible at rest (not hidden until
// keyboard focus) — the symptom is "several Skip... strings stacked at the
// top of the page, always on screen" and it means either u1.css isn't
// actually applying to them or the site's own CSS is overriding it.

import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/check-embed.mjs <url>');
  process.exit(1);
}

const U1_HOST_RE = /https?:\/\/[^"'\s]+\/u1(?:_vanilla-js-a11y)?\.(?:js|css)/i;
const result = { url, checks: [] };
const record = (name, pass, detail) => result.checks.push({ name, pass, detail });

// ── 1. Raw HTML, no browser ─────────────────────────────────────────────
const rawHtml = await fetch(url).then((r) => r.text()).catch((e) => {
  console.error(`Could not fetch ${url}: ${e.message}`);
  process.exit(1);
});
const cssTag = rawHtml.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)?.find((t) => U1_HOST_RE.test(t));
const jsTag = rawHtml.match(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)?.find((t) => U1_HOST_RE.test(t));
record('u1.css <link> in served HTML', !!cssTag, cssTag || 'not found in markup — check if it was only pasted into DevTools');
record('u1 engine <script> in served HTML', !!jsTag, jsTag || 'not found in markup — check if it was only pasted into DevTools');

// ── 2 & 3. Real browser: network + runtime ──────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage();
const loaded = { css: false, js: false };
page.on('response', (res) => {
  if (/\/u1\.css(\?|$)/i.test(res.url()) && res.ok()) loaded.css = true;
  if (/\/u1_vanilla-js-a11y\.js(\?|$)/i.test(res.url()) && res.ok()) loaded.js = true;
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1500);

record('u1.css loaded 200 in browser', loaded.css, loaded.css ? '' : 'never requested, or not 200');
record('u1 engine .js loaded 200 in browser', loaded.js, loaded.js ? '' : 'never requested, or not 200');

const runtime = await page.evaluate(() => {
  const eng = window.u1 ?? window.U1 ?? window.user1st;
  return {
    engineGlobal: !!eng,
    engineHasFix: !!(eng && eng.fix),
    patchRan: !!window.__u1Patch,
    patchBuild: window.__u1Patch?.build ?? null,
  };
});
record('u1 engine global present (window.u1/.U1/.user1st)', runtime.engineGlobal);
record('engine exposes .fix', runtime.engineHasFix);
record('implementation patch ran (window.__u1Patch)', runtime.patchRan, runtime.patchBuild ? `build ${runtime.patchBuild}` : 'no __u1Patch — patch script never ran');

// ── Bonus: skip-links visible at rest ───────────────────────────────────
const skipLinks = await page.evaluate(() => {
  const els = [...document.querySelectorAll('a[href^="#"]')].filter((a) =>
    /skip/i.test(a.textContent || '') || /skip/i.test(a.className || ''));
  return els.map((a) => {
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    const hiddenAtRest = cs.display === 'none' || cs.visibility === 'hidden' ||
      (r.width <= 1 && r.height <= 1) || cs.clip === 'rect(0px, 0px, 0px, 0px)' ||
      (r.top < -50 || r.left < -9999);
    return { text: (a.textContent || '').trim().slice(0, 60), hiddenAtRest };
  });
});
const visibleSkipLinks = skipLinks.filter((s) => !s.hiddenAtRest);
record('skip-links hidden until focus', visibleSkipLinks.length === 0,
  visibleSkipLinks.length
    ? `${visibleSkipLinks.length} visible at rest: ${visibleSkipLinks.map((s) => JSON.stringify(s.text)).join(', ')}`
    : `${skipLinks.length} skip-link(s) found, all hidden at rest`);

await browser.close();

// ── Report ───────────────────────────────────────────────────────────────
console.log(`\n${url}\n`);
let allPass = true;
for (const c of result.checks) {
  allPass &&= c.pass;
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? `  —  ${c.detail}` : ''}`);
}
console.log(`\n${allPass ? 'PASS — U1 is genuinely implemented.' : 'FAIL — see ✗ above.'}\n`);
process.exit(allPass ? 0 : 1);

// Does a breadcrumb mapping actually produce an accessible breadcrumb?
//
//   node scripts/verify-breadcrumb.mjs
//
// The breadcrumb engine is the extension's own — there is no u1.fix.breadcrumb
// to lean on — so nothing outside this file checks that picking the type in the
// panel changes anything on the page. The engine is run against real markup in
// a real DOM and the resulting attributes are read back.
//
// What it is checking for, from the WAI-ARIA breadcrumb pattern and WCAG G65:
// a named navigation landmark, an ordered-list structure, aria-current="page"
// on the current crumb, and separators that a screen reader will not announce.
//
// Same lifting trick as the other verify scripts: grid-nav.js touches `window`
// at the top level and cannot be imported, so it is evaluated inside jsdom.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = readFileSync(join(ROOT, 'grid-nav.js'), 'utf8');

const checks = [];
const ok = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

/** A page with the engine loaded, ready to be asked questions. */
function page(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  // The engine watches for re-renders through rAF; jsdom's is absent under
  // outside-only, and without it the observer callback throws on every mutation.
  w.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  w.eval(ENGINE);
  return w;
}

const install = (w, sel, config) =>
  w.__u1InstallBreadcrumbFromMapping(sel, config || { selectors: { container: sel } });

// ── The ordinary trail: divs, spans for separators, no ARIA anywhere ────────
{
  const w = page(`
    <div class="crumbs">
      <a href="/">Home</a><span class="sep">/</span>
      <a href="/shoes">Shoes</a><span class="sep">/</span>
      <a href="/shoes/running">Running</a>
    </div>`);
  const res = install(w, '.crumbs');
  const d = w.document;
  const root = d.querySelector('.crumbs');
  const links = [...d.querySelectorAll('.crumbs a')];
  const seps = [...d.querySelectorAll('.sep')];

  ok('it reports what it did', res.ok && res.trails === 1 && res.items === 3, JSON.stringify(res));
  ok('the trail becomes a navigation landmark', root.getAttribute('role') === 'navigation');
  ok('the landmark carries a name', root.getAttribute('aria-label') === 'Breadcrumb');
  ok('the LAST crumb is the current page', links[2].getAttribute('aria-current') === 'page');
  ok('the earlier crumbs are not',
     !links[0].hasAttribute('aria-current') && !links[1].hasAttribute('aria-current'));
  ok('the separators are hidden from screen readers',
     seps.length === 2 && seps.every((s) => s.getAttribute('aria-hidden') === 'true'));
  ok('the links themselves are left alone',
     links.every((a) => a.tagName === 'A' && a.getAttribute('href')));

  // Applying a mapping twice is ordinary — Apply, then Run on Page — and a fix
  // that is not idempotent shows up as attributes fighting each other.
  const before = root.outerHTML;
  install(w, '.crumbs');
  ok('running it twice changes nothing', root.outerHTML === before);
}

// ── The recommended markup: <nav> + <ol>, which many sites already have ─────
{
  const w = page(`
    <nav class="bc">
      <ol><li><a href="/">Home</a></li><li><a href="/a">Shoes</a></li><li>Running</li></ol>
    </nav>`);
  install(w, '.bc');
  const d = w.document;
  ok('no redundant role on a real <nav>', !d.querySelector('.bc').hasAttribute('role'));
  ok('no redundant role on a real <ol>', !d.querySelector('.bc ol').hasAttribute('role'));
  ok('no redundant role on a real <li>', !d.querySelector('.bc li').hasAttribute('role'));
  ok('the last LINK is marked current',
     d.querySelector('.bc li:nth-child(2) a').getAttribute('aria-current') === 'page');
}

// ── A trail the site already named, in its own language ────────────────────
{
  const w = page(`<nav class="t" aria-label="מיקומך באתר"><a href="/">בית</a><span>/</span><a href="/x">נעליים</a></nav>`);
  install(w, '.t');
  ok('a label the site wrote is never replaced',
     w.document.querySelector('.t').getAttribute('aria-label') === 'מיקומך באתר');
}

// ── An explicit current selector overrides "the last one" ──────────────────
{
  const w = page(`
    <div class="c">
      <a href="/" class="crumb">Home</a>
      <a href="/x" class="crumb here">Shoes</a>
      <a href="/back" class="up">Back to top</a>
    </div>`);
  install(w, '.c', { selectors: { container: '.c', item: '.crumb', current: '.here' } });
  const d = w.document;
  ok('an explicit current wins over the last item',
     d.querySelector('.here').getAttribute('aria-current') === 'page' &&
     !d.querySelector('.up').hasAttribute('aria-current'));
}

// ── A router moved the trail: the old current must not linger ──────────────
{
  const w = page(`<div class="r"><a href="/" aria-current="page">Home</a><span>/</span><a href="/x">Shoes</a></div>`);
  install(w, '.r');
  const d = w.document;
  ok('a stale aria-current is cleared',
     !d.querySelector('.r a:first-child').hasAttribute('aria-current') &&
     d.querySelector('.r a:last-child').getAttribute('aria-current') === 'page');
}

// ── A named separator selector ─────────────────────────────────────────────
{
  const w = page(`<div class="s"><a href="/">Home</a><i class="chev">chevron_right</i><a href="/x">Shoes</a></div>`);
  install(w, '.s', { selectors: { container: '.s', separator: '.chev' } });
  ok('a named separator is hidden even when its text is a word',
     w.document.querySelector('.chev').getAttribute('aria-hidden') === 'true');
}

// ── Nothing matches: an error, not a silent success ────────────────────────
{
  const w = page(`<div class="x"><a href="/">Home</a></div>`);
  const res = install(w, '.nope');
  ok('a selector that matches nothing is an error', res.ok === false && !!res.err, JSON.stringify(res));
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log('\nA breadcrumb mapping produces an accessible breadcrumb:');
let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`  ${c.pass ? 'ok  ' : 'FAIL'}   ${c.name}${c.pass || !c.detail ? '' : ' — ' + c.detail}`);
}
console.log(`\n${checks.length - failed} passed, ${failed} failed\n`);
if (failed) process.exit(1);

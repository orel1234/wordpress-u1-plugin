// Does probe-net.js actually block a page's own script-driven navigation?
//
//   node scripts/verify-probe-net.mjs
//
// verify-probe.mjs proves armNet's DOM-level net (link clicks, form submits)
// works — but it evals probe.js directly into the "page" window, which is not
// what happens in the real extension: probe.js runs in the ISOLATED world,
// with its own copy of every JS global, so patching `root.fetch` there never
// touches what the page's own click handlers call. probe-net.js is the fix —
// injected into the MAIN world instead, gated on a DOM attribute (the one
// thing genuinely shared between worlds) rather than a JS flag isolated-world
// code could never set from over there.
//
// This can't simulate two real V8 isolates sharing one DOM — jsdom has no such
// concept — but the mechanism under test IS "does the attribute gate the
// patch correctly", which one window is enough to prove: set the attribute
// the way probe.js's armNet does, confirm every patched global blocks and
// reports; clear it, confirm every one passes through untouched.
//
// location.assign/replace are NOT covered here or in probe-net.js — checked
// directly against real Chromium (not jsdom, which happened to agree):
// reassigning them neither throws nor errors, `typeof` reports "function"
// afterwards, but the reference silently does not change and the real
// navigation still runs. Location is a spec'd exotic object exempt from
// ordinary property assignment; no world, isolated or MAIN, can intercept a
// call to it this way. See probe-net.js's own comment on this.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROBE_NET = readFileSync(join(ROOT, 'probe-net.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

function page() {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/start',
  });
  const w = dom.window;
  // Real stand-ins for what probe-net.js is meant to wrap, installed BEFORE
  // it runs — exactly the order real injection happens in (the page's own
  // globals exist first; probe-net.js patches over them).
  w.fetch = () => Promise.resolve('real-response');
  w.XMLHttpRequest.prototype.send = function () { this.__realSent = true; };
  w.navigator.sendBeacon = () => true;
  w.open = () => 'a-real-window';
  w.eval(PROBE_NET);
  return w;
}

console.log('\nInstalled once, guarded against a second injection:');
{
  const w = page();
  const fetchAfterFirst = w.fetch;
  w.eval(PROBE_NET);
  check('re-evaluating the file does not wrap an already-wrapped fetch a second time', w.fetch === fetchAfterFirst);
}

console.log('\nInactive by default — every global still does its real job:');
{
  const w = page();
  const events = [];
  w.document.addEventListener('u1-net-blocked', (e) => events.push(e.detail));

  await w.fetch('/api/whatever');
  check('fetch passes through when the attribute is absent', events.length === 0);
  w.open('/x');
  check('window.open passes through when the attribute is absent', events.length === 0);
  w.history.pushState({}, '', '/z');
  check('history.pushState passes through when the attribute is absent', events.length === 0);
}

console.log('\nActive once probe.js sets the shared DOM attribute:');
{
  const w = page();
  const events = [];
  w.document.addEventListener('u1-net-blocked', (e) => events.push(e.detail));
  w.document.documentElement.setAttribute('data-u1-net-block', '1');

  let fetchRejected = false;
  await w.fetch('/api/delete-account').catch(() => { fetchRejected = true; });
  check('fetch is rejected while armed', fetchRejected);
  check('…and reported as blocked', events.some((d) => d.where === 'fetch' && d.url === '/api/delete-account'));

  const xhr = new w.XMLHttpRequest();
  let errored = false;
  xhr.addEventListener('error', () => { errored = true; });
  xhr.open('POST', '/api/subscribe');
  xhr.send();
  await new Promise((r) => setTimeout(r, 10));
  check('XHR.send is intercepted (never reaches the real send)', !xhr.__realSent);
  check('…and fires a synthetic error event, so the page\'s own handling runs', errored);

  check('sendBeacon reports false while armed', w.navigator.sendBeacon('/beacon', 'x') === false);
  check('window.open returns null while armed', w.open('/popup') === null);

  w.history.pushState({}, '', '/spa-route');
  check('history.pushState is a no-op while armed', w.location.pathname === '/start');

  check(
    'every blocked attempt is reported by name',
    ['fetch', 'xhr.send', 'sendBeacon', 'window.open', 'history.pushState']
      .every((where) => events.some((d) => d.where === where)),
    events.map((d) => d.where).join(','),
  );
}

console.log('\nDisarming (removing the attribute) restores real behaviour:');
{
  const w = page();
  const events = [];
  w.document.addEventListener('u1-net-blocked', (e) => events.push(e.detail));
  w.document.documentElement.setAttribute('data-u1-net-block', '1');
  w.document.documentElement.removeAttribute('data-u1-net-block');

  // The wrapper installed by probe-net.js delegates to whatever fetch WAS
  // present at injection time — confirm that path runs (not the "blocked"
  // rejection) once the attribute is gone, using the real stub from page().
  const res = await w.fetch('/anything').catch(() => 'threw');
  check('fetch resolves normally once disarmed (not the "blocked" rejection)', res !== 'threw');
  check('…and nothing was reported as blocked', events.length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

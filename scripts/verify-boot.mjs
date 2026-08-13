// Does the panel actually start?
//
//   node scripts/verify-boot.mjs
//
// Every other check in this repo reads the SOURCE. They are worth having and
// they are not this: they all passed, green, while the panel was dead in the
// browser — because they proved the code was written, not that it runs.
//
// What happened: a change removed a section from Setup, and something on the
// path out of init() threw. init() is one long sequence of awaits, so a throw
// anywhere in it silently abandons everything after that point. The visible
// symptom was three tabs away from the cause: pressing an AI mode bounced to
// Setup, because the flag that says a key is saved is written by a function
// init() never reached.
//
// So: load panel.html, load the scripts it loads, in its order, with the
// browser APIs stubbed, run init(), and insist it finishes. That is a low bar
// and it is the bar that was not being cleared.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'panel.html'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// The scripts panel.html loads, in the order it loads them. Read from the
// markup rather than listed here, so a new one is covered without being added.
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://localhost/' });
const w = dom.window;

// ── The browser, stubbed to the shape the panel expects ────────────────────
// Everything answers, nothing throws, nothing is granted. A panel that cannot
// boot against "no data and no permissions" cannot boot on a fresh install.
// Signed in, with a live session. Without this the licence gate takes over,
// init() returns early BY DESIGN, and nothing past the gate is exercised —
// which is a real path worth testing and not the one this file is about.
const store = {
  __studioAuth: { refreshToken: 'test-refresh', user: { email: 'tester@user1st.com' } },
};
const noop = () => {};
const tab = { id: 1, windowId: 1, url: 'https://example.com/', active: true, status: 'complete' };

w.chrome = {
  runtime: {
    id: 'test', lastError: null,
    getManifest: () => ({ version: '3.1.0', version_name: '3.1.0 (test)' }),
    sendMessage: async () => ({}),
    onMessage: { addListener: noop, removeListener: noop },
    getURL: (p) => 'chrome-extension://test/' + p,
  },
  storage: {
    local: {
      get: async (k) => {
        if (k == null) return { ...store };
        const keys = Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k);
        const out = {};
        for (const key of keys) if (key in store) out[key] = store[key];
        return out;
      },
      set: async (o) => { Object.assign(store, o); },
      remove: async (k) => { for (const key of [].concat(k)) delete store[key]; },
      clear: async () => { for (const key of Object.keys(store)) delete store[key]; },
    },
    onChanged: { addListener: noop },
  },
  tabs: {
    query: async () => [tab],
    get: async () => tab,
    update: async () => tab,
    reload: noop,
    captureVisibleTab: async () => 'data:image/jpeg;base64,AA',
    onUpdated: { addListener: noop },
    onActivated: { addListener: noop },
    sendMessage: async () => ({}),
  },
  windows: { get: async () => ({ id: 1, focused: true, state: 'normal' }), update: async () => ({}) },
  scripting: {
    executeScript: async () => [{ result: null }],
    getRegisteredContentScripts: async () => [],
    registerContentScripts: async () => {},
    unregisterContentScripts: async () => {},
  },
  debugger: { attach: async () => {}, detach: async () => {}, sendCommand: async () => ({}) },
  declarativeNetRequest: { updateSessionRules: async () => {}, getSessionRules: async () => [] },
  sidePanel: { setOptions: async () => {} },
  permissions: { contains: async () => true, request: async () => true },
};
// A signed-in worker, assigned to this site — which is the state the panel is
// normally in and the only one where the Picker is reachable at all. Booting as
// "not signed in" is a different and much shorter path: the gate takes over and
// init() returns early by design, so nothing past it is exercised.
w.fetch = async (url) => {
  const path = String(url);
  const json = /\/auth\/refresh/.test(path)
    ? { accessToken: 'test-token', user: { email: 'tester@user1st.com' } }
    : /\/sites\//.test(path)
    ? { accessLevel: 'full', label: 'Test site' }
    : {};
  return {
    ok: true, status: 200,
    json: async () => json,
    text: async () => JSON.stringify(json),
    headers: { get: () => 'application/json' },
  };
};

// jsdom has no layout, so it has no scrollIntoView. Stubbed rather than left
// to throw, because a missing scroll must not be able to fail a test about
// whether a mode can be entered.
w.Element.prototype.scrollIntoView = () => {};

// A harness that hangs is worse than one that fails: it stops a suite instead
// of reporting on it. Nothing here should take five seconds.
const watchdog = setTimeout(() => {
  console.log('\n  FAIL the harness did not finish within 30s — something never settled');
  process.exit(1);
}, 30000);
watchdog.unref?.();

const errors = [];
w.addEventListener('error', (e) => errors.push('window error: ' + (e.error?.stack || e.message)));
w.addEventListener('unhandledrejection', (e) => errors.push('unhandled rejection: ' + (e.reason?.stack || e.reason)));
const realError = console.error;
console.error = (...a) => { errors.push('console.error: ' + a.join(' ')); };

// ── Load them, in the panel's own order ────────────────────────────────────
//
// Concatenated into ONE eval, which is the faithful model. Separate <script>
// tags share the global lexical environment, so `const U1Auth` in auth.js is
// visible to panel.js. Separate eval() calls do NOT: let/const declared in eval
// code stay in that eval's own scope, so loading them one at a time makes every
// library invisible to the next file — a property of the harness, not of the
// product.
let loadFailure = null;
try {
  let src = scripts.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n;\n');
  if (process.env.TRACE) {
    // Number every await inside init() so an early return is locatable.
    const at = src.indexOf('async function init() {');
    const end = src.indexOf('\n}', at);
    let n = 0;
    const body = src.slice(at, end).replace(/\n(\s+)(await |return |if \()/g,
      (m, sp, kw) => `\n${sp}globalThis.__trace(${++n});\n${sp}${kw}`);
    src = src.slice(0, at) + body + src.slice(end);
    w.__trace = (i) => { w.__last = i; };
  }
  w.eval(src);
} catch (e) {
  loadFailure = `loading threw: ${e.message}`;
}
console.log('\nthe panel loads');
check(`all ${scripts.length} scripts evaluate`, !loadFailure, loadFailure || '');

// ── Then start it ──────────────────────────────────────────────────────────
//
// panel.js calls init() on its last line, and a rejection from THAT call is
// invisible here — jsdom does not reliably fire unhandledrejection, which is
// how the first version of this file reported a green "init() completes
// without throwing" over an init() that had thrown. So it is called again,
// directly, inside a try. Twice is harmless: init is written to be re-run on
// every tab change.
await new Promise((r) => setTimeout(r, 250));
let initError = null;
try {
  await w.init();
} catch (e) {
  initError = e && (e.stack || e.message) || String(e);
}
await new Promise((r) => setTimeout(r, 250));
console.error = realError;

console.log('\nand it starts');
check('init() runs to the end without throwing', !initError, initError || '');
check('…and nothing else on the page threw either', errors.length === 0,
  errors.slice(0, 2).join('\n         '));

// ── And the state boot is responsible for is actually set ──────────────────
//
// "It did not throw" is not the whole bar. init() dying halfway is silent: the
// awaits after it simply never happen, and the panel sits there looking
// finished. So the things it is supposed to have done are checked directly.
console.log('\nand it finishes what it started');
{
  const d = w.document;
  // Written by the last steps of init(). If the sequence stopped early these
  // are still at their markup defaults.
  const stamp = d.getElementById('buildStamp');
  check('the build stamp is filled in, which happens late in init()',
    !!stamp && /3\.1\.0/.test(stamp.textContent), stamp && stamp.textContent);
  check('the site name reached every place that shows it',
    [...d.querySelectorAll('#mappingsHostname, #exportHostname, #closeOutHostname')]
      .every((el) => el.textContent && el.textContent !== ''),
    [...d.querySelectorAll('#mappingsHostname')].map((e) => e.textContent).join());

  // The bug this file exists for. With no key saved, both AI modes must be
  // marked locked — and the marking is done by a function init() calls, so an
  // unmarked button is proof init() did not get there.
  const auto = d.getElementById('modeAutoBtn');
  const sweep = d.getElementById('modeSweepBtn');
  check('with no key saved, both AI modes are marked locked',
    auto?.classList.contains('is-locked') && sweep?.classList.contains('is-locked'),
    `auto:${auto?.className} sweep:${sweep?.className}`);
  check('…and say so to a screen reader too',
    auto?.getAttribute('aria-disabled') === 'true' &&
    sweep?.getAttribute('aria-disabled') === 'true');
  check('…while Manual, which costs nothing, is never locked',
    !d.getElementById('modeManualBtn')?.classList.contains('is-locked'));
  // The symptom, exactly: pressing one bounced to Setup from a panel that had
  // not drawn them as locked. Unlocked-looking and refusing is the broken
  // state; both marks agreeing is the working one, either way round.
  check('locked-looking and locked-behaving are the same state',
    auto?.classList.contains('is-locked') === (auto?.getAttribute('aria-disabled') === 'true'));
}

if (process.env.TRACE) console.log('\n  last traced step inside init():', w.__last);
// ── And the same boot WITH a key saved ─────────────────────────────────────
//
// The other half of the gate, and the half that was reported broken: pressing
// an AI mode sent me to Setup. Locking correctly when there is no key proves
// nothing about unlocking when there is one.
console.log('\nand with a key saved, they unlock');
{
  store['__anthropicKey'] = 'sk-ant-test';
  await w.refreshAiLocks();
  const d = w.document;
  const auto = d.getElementById('modeAutoBtn');
  const sweep = d.getElementById('modeSweepBtn');
  check('both AI modes come unlocked',
    !auto.classList.contains('is-locked') && !sweep.classList.contains('is-locked'),
    `auto:${auto.className} sweep:${sweep.className}`);
  check('…and stop telling a screen reader they are unavailable',
    auto.getAttribute('aria-disabled') === 'false');
  // The symptom itself: unlocked-looking and still refusing. This is the
  // assertion that would have caught it.
  check('…and pressing one actually enters the mode instead of bouncing to Setup',
    (await w.aiModeAllowed()) === true);

  // The gate re-reads the key rather than trusting a flag written during boot.
  // A flag saying "locked" because the step that would have said otherwise
  // never ran is, at the moment of the click, indistinguishable from a real no.
  w.aiUnlocked = false;                       // as if boot had never got there
  check('…even when the boot-time flag is stale, because it re-reads the key',
    (await w.aiModeAllowed()) === true);

  // Folded away once it is filled in; open while it is not.
  const det = d.getElementById('aiKeyDetails');
  check('the key section folds itself once there is a key in it', det && !det.open);
  store['__anthropicKey'] = '';
  await w.refreshAiLocks();
  check('…and opens again if the key is cleared', det && det.open);

  // And with no key, refusing is not silent: the panel changing tab on its own
  // needs a reason attached to it.
  const before = d.querySelector('.tab-content.active')?.id;
  check('a refusal says why, rather than just changing tab',
    (await w.aiModeAllowed()) === false &&
    /Anthropic API key/.test(d.getElementById('aiKeyStatus')?.textContent || ''),
    `${before} → ${d.getElementById('aiKeyStatus')?.textContent}`);
}

clearTimeout(watchdog);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Static checks for the things that break silently in an extension: a
// getElementById that points at markup nobody added, a script file missing from
// panel.html, or a CSP that forbids the server the code is configured to call.
// None of these throw at build time — they fail in front of a client.
//
//   node scripts/verify.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ❌ ${msg}`); };
const pass = (msg) => console.log(`  ✅ ${msg}`);

const html = read('panel.html');
const panel = read('panel.js');
const auth = read('auth.js');
const config = read('config.js');
const store = read('store.js');
const background = read('background.js');
const reportGen = read('report-gen.js');
const manifest = JSON.parse(read('manifest.json'));

// --- Every getElementById target exists in the markup ---------------------

console.log('\nDOM references in panel.js resolve to markup:');
// Ids come from two places: panel.html, and markup panel.js builds at runtime
// (test results, dialogs, and the <link>/<script> tags it injects into the page).
const knownIds = new Set([
  ...[...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]),
  ...[...panel.matchAll(/\bid="([^"$]+)"/g)].map((m) => m[1]),
  ...[...panel.matchAll(/\.id\s*=\s*'([^']+)'/g)].map((m) => m[1]),
]);
// Some lookups run inside chrome.scripting.executeScript and resolve against
// the client's page, not the panel. '#root' is React's conventional mount point,
// checked during platform detection.
const PAGE_CONTEXT_IDS = new Set(['root']);

const referenced = new Set([...panel.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]));

const missing = [...referenced].filter((id) => !knownIds.has(id) && !PAGE_CONTEXT_IDS.has(id));
if (missing.length) fail(`panel.js references ids not in panel.html: ${missing.join(', ')}`);
else pass(`all ${referenced.size} referenced ids exist`);

// --- Scripts the panel depends on are actually loaded ---------------------

console.log('\npanel.html loads the scripts panel.js depends on:');
const loaded = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
// U1_CONFIG is read by auth.js, U1Auth by panel.js — check each against its
// actual consumer rather than assuming everything is used from panel.js.
for (const [file, global, consumer, consumerName] of [
  ['config.js', 'U1_CONFIG', auth, 'auth.js'],
  ['auth.js', 'U1Auth', panel, 'panel.js'],
  ['store.js', 'U1Store', panel, 'panel.js'],
]) {
  if (!loaded.includes(file)) fail(`${file} is not loaded by panel.html`);
  else if (!consumer.includes(global)) fail(`${file} is loaded but ${global} is never used by ${consumerName}`);
  else pass(`${file} loaded, ${global} used by ${consumerName}`);
}
if (loaded.indexOf('config.js') > loaded.indexOf('auth.js')) {
  fail('config.js must load before auth.js — auth.js reads U1_CONFIG at call time');
}

// --- The CSP permits the server the code will call ------------------------

console.log('\nCSP allows the configured server:');
const serverUrl = config.match(/SERVER_URL:\s*'([^']*)'/)?.[1];
const csp = manifest.content_security_policy.extension_pages;
const connectSrc = csp.match(/connect-src ([^;]+)/)?.[1] || '';

if (!serverUrl) {
  fail('config.js has no SERVER_URL');
} else if (connectSrc.includes(serverUrl) || connectSrc.split(/\s+/).some((src) => {
  if (!src.includes('*')) return false;
  const re = new RegExp('^' + src.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+') + '$');
  return re.test(serverUrl);
})) {
  pass(`connect-src covers ${serverUrl}`);
} else {
  fail(`config.js points at ${serverUrl} but connect-src is "${connectSrc}" — every request would be blocked`);
}

// --- Credentials can never travel inside a backup ------------------------

console.log('\nSession data stays out of backups:');
if (!/getExportable\(\)/.test(panel)) {
  fail('the backup export no longer goes through U1Store.getExportable() — a refresh token could be exported');
} else if (!/isPrivate\(key\)\) delete all\[key\]/.test(store)) {
  fail('U1Store.getExportable() no longer strips private keys');
} else {
  pass('export goes through the store, which strips every private key');
}
if (!/__studioAuth/.test(auth)) fail('auth.js no longer uses the "__" storage prefix');
else pass('auth state is stored under a "__" key, which sanitizeImport rejects');

// --- Storage goes through one door --------------------------------------

console.log('\nStorage access is centralised:');
// Direct chrome.storage.local calls are how the tap gets bypassed. The store
// itself is the one legitimate caller.
const storageUsers = [['panel.js', panel], ['background.js', background], ['report-gen.js', reportGen], ['auth.js', auth]];
let leaks = 0;
for (const [name, src] of storageUsers) {
  const direct = (src.match(/chrome\.storage\.local\./g) || []).length;
  if (direct) { fail(`${name} calls chrome.storage.local directly ${direct}×  — use U1Store instead`); leaks++; }
}
if (!leaks) pass(`no direct chrome.storage.local calls outside store.js (${storageUsers.length} files checked)`);

const storeCalls = storageUsers.reduce((n, [, src]) => n + (src.match(/U1Store\./g) || []).length, 0);
pass(`${storeCalls} call sites go through U1Store`);

// The service worker has no <script> tags — it must pull the store in itself.
if (!/importScripts\(['"]store\.js['"]\)/.test(background)) {
  fail('background.js does not importScripts("store.js") — U1Store would be undefined in the service worker');
} else {
  pass('background.js imports the store (service worker has no <script> tags)');
}
if (loaded.indexOf('store.js') === -1) fail('panel.html does not load store.js');
else if (loaded.indexOf('store.js') > loaded.indexOf('panel.js')) fail('store.js must load before panel.js');
else pass('panel.html loads store.js before its users');

// --- Every shipped file must parse as a CLASSIC browser script -------------
//
// `node --check` is not this check. package.json sets "type": "module", so node
// parses these as ESM — where top-level `await` is legal. The browser loads them
// with <script src> as classic scripts, where it is a SyntaxError that kills the
// whole file. That gap let a broken panel.js pass every check and get pushed.
// `new Function(src)` parses with exactly the browser's classic-script rules.

// ── Every script panel.html loads is actually packaged ──────────────────────
// The build's FILES list is hand-maintained and nothing compared it with the
// markup, so adding a <script src> and forgetting the list shipped a panel that
// died on a missing file — with the zip reporting success.
console.log('\nEvery script panel.html loads is in the build:');
{
  const build = read('scripts/build.mjs');
  const listed = new Set([...build.matchAll(/'([\w.-]+\.(?:js|css|html|json|md))'/g)].map((m) => m[1]));
  const loadedSrcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const missing = loadedSrcs.filter((f) => !listed.has(f));
  if (missing.length) fail(`panel.html loads ${missing.join(', ')} but build.mjs does not package ${missing.length === 1 ? 'it' : 'them'}`);
  else pass(`all ${loadedSrcs.length} scripts panel.html loads are packaged`);
}

// ── Every field says how to RECOGNISE its element ───────────────────────────
// `desc` says what a field is, in U1's words. FIELD_HOW says which element on
// the page it is, in ours — and the gap between those two is where mappings go
// wrong. Enforced rather than remembered: a twentieth component type cannot
// arrive without criteria, because this fails the build.
console.log('\nEvery selector field says how to recognise its element:');
{
  // The two objects are EVALUATED, not pattern-matched. A first attempt read
  // the keys with a regex and reported four fields missing that were present:
  // `selectors:{…}` contains nested groups (year, month, days), so the
  // non-greedy match stopped at the first inner `},` and read half the block.
  // Object literals should be parsed by the thing that parses object literals.
  const grab = (name) => {
    const from = panel.indexOf(`const ${name} = {`);
    const to = panel.indexOf('\n};', from);
    return new Function(`return ${panel.slice(from + `const ${name} = `.length, to + 2)}`)();
  };
  let schemas, how;
  try { schemas = grab('COMPONENT_SCHEMAS'); how = grab('FIELD_HOW'); }
  catch (e) { schemas = null; fail(`could not read the schemas: ${e.message}`); }

  if (schemas) {
    // Nested groups are addressed dotted — `days.table` — exactly as `fields`
    // and `req` already spell them.
    const keysOf = (sel, prefix) => Object.entries(sel).flatMap(([k, v]) =>
      (v && typeof v === 'object') ? keysOf(v, `${prefix}${k}.`) : [prefix + k]);

    const missing = [];
    for (const [type, schema] of Object.entries(schemas)) {
      if (!schema.selectors) continue;
      for (const key of keysOf(schema.selectors, '')) {
        if (!how[type] || !how[type][key]) missing.push(`${type}.${key}`);
      }
    }
    if (missing.length) fail(`FIELD_HOW has no criterion for: ${missing.join(', ')}`);
    else pass('every component type states how to identify each of its fields');
  }
}

console.log('\nShipped files parse as classic browser scripts:');
const SCRIPTS = [
  'panel.js', 'selector-intel.js', 'ai-advisor.js', 'event-recorder.js',
  'test-engine.js', 'background.js', 'store.js', 'auth.js', 'config.js',
  'grid-nav.js', 'docx-gen.js', 'report-gen.js', 'report-view.js',
];
let unparseable = 0;
for (const name of SCRIPTS) {
  let src;
  try { src = readFileSync(join(ROOT, name), 'utf8'); }
  catch { continue; } // not every file is present in every checkout
  try {
    new Function(src);
  } catch (e) {
    fail(`${name} is not a valid classic script — ${e.message}`);
    unparseable++;
  }
}
if (!unparseable) pass(`all ${SCRIPTS.length} scripts parse (no top-level await, no ESM-only syntax)`);

// ── …and actually RUN, defining what panel.html expects ─────────────────────
// Parsing is not enough, and this is not theoretical: a backtick inside the
// backtick-quoted DISCOVER_PROMPT turned `.dropdown` into a TAGGED TEMPLATE.
// Perfectly valid syntax, so the check above passed — and at load it threw
// "…is not a function", ai-advisor.js never finished, and every scan died on
// "U1AI is not defined". A file that parses and does not initialise is exactly
// as broken as one that does not parse, and was invisible here.
console.log('\nThe library scripts run and define their globals:');
{
  // The globals a script is loaded FOR. panel.js is excluded — it is the page's
  // own code and expects a DOM the moment it runs.
  const GLOBALS = {
    'config.js': 'U1_CONFIG',
    'store.js': 'U1Store',
    'auth.js': 'U1Auth',
    'sync.js': 'U1Sync',
    'ai-advisor.js': 'U1AI',
    'selector-intel.js': '__u1SelectorIntel',
  };
  let broken = 0;
  for (const [name, globalName] of Object.entries(GLOBALS)) {
    let src;
    try { src = readFileSync(join(ROOT, name), 'utf8'); } catch { continue; }
    const sandbox = {
      chrome: { runtime: { getURL: (p) => p }, storage: { local: {} } },
      fetch: async () => ({ ok: false }),
      document: undefined,
      window: undefined,
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    // The binding is read back from INSIDE the script's own scope. A classic
    // script's top-level `const U1_CONFIG = …` is script-scoped: later scripts
    // see it as a global, but it never becomes a property of window — so
    // testing sandbox[name] reports three perfectly good files as broken.
    let value;
    try {
      value = new Function('sandbox',
        `with (sandbox) { ${src}\n; return typeof ${globalName} !== 'undefined' ? ${globalName} : undefined; }`
      )(sandbox);
    } catch (e) {
      fail(`${name} throws at load — ${e.message.slice(0, 120)}`);
      broken++;
      continue;
    }
    if (typeof value === 'undefined') {
      fail(`${name} ran but never defined ${globalName}`);
      broken++;
    }
  }
  if (!broken) pass(`all ${Object.keys(GLOBALS).length} library scripts define their global`);
}

// ── Every model call has a deadline, measuring the right thing ──────────────
// A request with no timeout is indistinguishable from a request that is
// working. So is a request with the WRONG timeout: a total-elapsed deadline of
// 150s killed a 94-element section that was busy answering, marked it "not
// read", and left the work billed. The response is streamed now, so the
// deadline is silence rather than duration — a long healthy answer is not a
// hung one, and only a stream can tell them apart.
{
  const src = readFileSync(join(ROOT, 'ai-advisor.js'), 'utf8');
  const calls = (src.match(/await fetch\(endpoint\(\)/g) || []).length;
  const aborts = /new AbortController\(\)/.test(src) && /signal: ctl \? ctl\.signal/.test(src);
  const streams = /stream: true/.test(src) && /await readStream\(res, armIdle\)/.test(src);
  const idle = /const CALL_IDLE_MS = \d+/.test(src) && /clearTimeout\(idle\);/.test(src);
  const says = /AbortError/.test(src) && /sent nothing for/.test(src);
  if (calls && aborts && streams && idle && says) {
    pass('the model call gives up on silence, not on a long answer');
  } else {
    fail(`the model call's deadline is wrong — controller:${aborts} stream:${streams} ` +
         `idle:${idle} message:${says}`);
  }
}

// ── The background camera ───────────────────────────────────────────────────
// captureVisibleTab photographs whatever is in front, so with it as the only
// camera a run can only ever WAIT while you work elsewhere. Page.captureScreenshot
// over the debugger protocol photographs the tab it is attached to, unfocused —
// which is the whole difference between pausing and running in the background.
{
  const mf = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  const src = readFileSync(join(ROOT, 'panel.js'), 'utf8');
  const perm = (mf.permissions || []).includes('debugger');
  const uses = /Page\.captureScreenshot/.test(src);
  // Attached for the run and detached the moment it ends: Chrome's banner stays
  // up for exactly as long as we are attached.
  const detaches = /await endBackgroundCapture\(\);/.test(src) &&
                   /chrome\.debugger\.detach/.test(src);
  // And it must degrade rather than fail: DevTools open on that tab is an
  // ordinary reason to be refused, and Chrome allows one debugger at a time.
  const degrades = /already attached/i.test(src) && /awaitTabVisible\(tab, onWait\)/.test(src);
  if (perm && uses && detaches && degrades) {
    pass('the sweep can photograph a tab that is not in front, and lets go afterwards');
  } else {
    fail(`background capture incomplete — permission:${perm} uses:${uses} detaches:${detaches} degrades:${degrades}`);
  }
}

// ── The two modes that cost money are locked until there is a key ──────────
//
// Both AI modes were freely enterable without one. Pressing either put you in
// front of the whole flow — the estimate, the tick list, the button — and the
// key was asked for at the LAST step, by a modal, after the choosing was done.
console.log('\nAI modes are gated on the key, at the door:');
{
  const css = read('styles.css');
  const locked = /btn\.classList\.toggle\('is-locked', !aiUnlocked\)/.test(panel);
  const gated = /if \(await aiModeAllowed\(\)\) setMapMode\('auto'\)/.test(panel) &&
                /if \(await aiModeAllowed\(\)\) setMapMode\('sweep'\)/.test(panel);
  const onBoot = /await refreshAiLocks\(\);\n  await loadConfigForm\(\)/.test(panel);
  const onSave = /showNotice\(\$aiKeyStatus, 'Key saved[^\n]*\n\s*\/\/[^\n]*\n\s*await refreshAiLocks\(\)/.test(panel);
  if (locked && gated && onBoot && onSave) {
    pass('the AI modes lock without a key, and unlock the moment one is saved');
  } else {
    fail(`AI gating incomplete — marks:${locked} blocks:${gated} onBoot:${onBoot} onSave:${onSave}`);
  }

  // Refusing is not the job. A locked mode has somewhere to send you, and that
  // somewhere has to exist — the key moved out of a Picker modal into a Setup
  // section, and a scrollIntoView on a missing id is a silent no-op.
  const dest = /id="aiKeySection"/.test(html);
  const goes = /getElementById\('aiKeySection'\)/.test(panel);
  const noModal = !/aiBox/.test(panel) && !/aiBox/.test(html);
  if (dest && goes && noModal) {
    pass('a locked mode sends you to the Setup section that unlocks it');
  } else {
    fail(`the destination is wrong — section:${dest} goes:${goes} modalGone:${noModal}`);
  }

  // `disabled` would be the easy way and the wrong one: it takes the button out
  // of the keyboard order and says nothing about why, and this button has both
  // something to say and somewhere to go.
  if (/aria-disabled', String\(!aiUnlocked\)/.test(panel) &&
      !/\$modeAutoBtn\.disabled = /.test(panel)) {
    pass('a locked mode stays reachable by keyboard and says why');
  } else {
    fail('a locked mode is disabled outright — unreachable, and silent about the reason');
  }

  // The redesign's palette: purple brand, no orange. Amber survives as WARNING
  // only, which the handoff's own token list specifies — a warning that stopped
  // being amber would be following the sentence and breaking the spec.
  const brandOrange = /--u1-accent-line:[^;]*(?:70|25)\s*\)/s.test(css) ||
                      /--u1-dot:\s*var\(--u1-warm/.test(css) ||
                      /u1-gradient-text[\s\S]{0,200}--u1-warm/.test(css);
  if (!brandOrange) pass('the brand marks are purple — no orange in the accent line, dot or wordmark');
  else fail('orange is still in the brand: accent line, logo dot or gradient wordmark');

  // Fonts are NAMED but not fetched. The CSP is default-src 'self' with no
  // font-src, so a Google Fonts link is blocked rather than falling back —
  // every measurement made against the intended face would be wrong.
  const namesFonts = /--u1-font:\s*'Inter'/.test(css) && /--u1-font-mono:\s*'JetBrains Mono'/.test(css);
  const fetchesNone = !/@import/.test(css) && !/fonts\.googleapis/.test(css) && !/fonts\.googleapis/.test(html);
  if (namesFonts && fetchesNone) {
    pass('Inter and JetBrains Mono are named first, and nothing is fetched past the CSP');
  } else {
    fail(`typography wrong — names:${namesFonts} noFetch:${fetchesNone}`);
  }

  // ── Two settings that stopped being settings ──────────────────────────────
  //
  // Both defaulted to OFF and both only ever made the tool worse when off.
  // Precise event detection off means a trigger is guessed from tag/role/aria,
  // which finds nothing on a page written without any of those — the exact
  // page this tool exists for. The labelling pause off means paying for a
  // section you could have named for free.
  const noPrecise = !/preciseEventsToggle/.test(panel) && !/preciseEventsToggle/.test(html);
  const alwaysPrecise = /if \(!existing\.length\) await setPreciseEvents\(true\)/.test(panel);
  if (noPrecise && alwaysPrecise) {
    pass('precise event detection is on always, with no checkbox to forget');
  } else {
    fail(`precise events wrong — checkboxGone:${noPrecise} alwaysOn:${alwaysPrecise}`);
  }

  const noTick = !/sweepLabelTick/.test(panel) && !/sweepLabelTick/.test(html);
  const alwaysLabel = /const sweepLabel = \{ on: true,/.test(panel);
  if (noTick && alwaysLabel) {
    pass('the naming pause is on always — a free section cannot be missed by forgetting');
  } else {
    fail(`the naming pause is still optional — checkboxGone:${noTick} alwaysOn:${alwaysLabel}`);
  }
  // Removing a control must not remove what it explained.
  if (/The scan pauses on each section/.test(html) &&
      /a trigger is guessed|Precise event detection used to be a checkbox/.test(html)) {
    pass('what those two do is still stated, now that nothing asks about them');
  } else {
    fail('a behaviour became automatic and undocumented at the same time');
  }

  // ── Config knew nothing about the skip links the page already has ─────────
  //
  // Setup listed three, read off the live page. Config said "No skip links
  // configured" at the same moment. Both true; neither mentioned the other.
  if (/detectedSkipLinks\.length\s*\n?\s*\?/.test(panel) &&
      /skip-detected-flag/.test(panel) && /skip-detected-flag/.test(read('styles.css'))) {
    pass("Config names the skip links the site already has, instead of only its own");
  } else {
    fail('Config still reports "none" while Setup lists the page\'s own skip links');
  }

  // ── The Picker's three modes ─────────────────────────────────────────────
  const noEmoji = !/map-mode-btn[^>]*>\s*[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(html);
  const litPurple = /\.map-mode-btn \{[^}]*color: var\(--u1-primary-text\)/s.test(read('styles.css'));
  const darkActive = /\.map-mode-btn\.active \{[^}]*var\(--u1-primary-hover\)/s.test(read('styles.css'));
  if (noEmoji && litPurple && darkActive) {
    pass('the mode tabs are words, light purple, and darker when you are on one');
  } else {
    fail(`mode tabs wrong — noEmoji:${noEmoji} light:${litPurple} darkActive:${darkActive}`);
  }

  // A check for boot-order hazards lived here briefly and was removed: it was
  // written on a wrong diagnosis (a temporal dead zone that cannot happen —
  // init() is the last line of the file, so every top-level binding is
  // initialised before it runs) and it reported seven healthy functions as
  // broken. scripts/verify-boot.mjs replaces it by starting the panel for real,
  // which is the only thing that would have caught the actual fault.

  // One family per role. Forty hardcoded stacks meant a palette change could
  // not reach half of them.
  const stray = [...css.matchAll(/font-family:\s*([^;]+);/g)]
    .map((m) => m[1].trim())
    .filter((v) => !/var\(--u1-font/.test(v) && v !== 'inherit' && !/serif$/.test(v));
  if (!stray.length) pass('every font-family goes through the two type tokens');
  else fail(`${stray.length} hardcoded font stacks left: ${[...new Set(stray)].join(' | ')}`);
}

console.log(failures === 0 ? '\n✅ All extension checks passed.\n' : `\n❌ ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

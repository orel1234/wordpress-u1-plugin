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
// soft: the CRM backend is a sibling repo, present on a developer's machine
// and not in CI. A check that cannot run must not be reported as a failure.
const read = (p, soft) => {
  try { return readFileSync(join(ROOT, p), 'utf8'); }
  catch (e) { if (soft) return null; throw e; }
};

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
  const streams = /stream: true/.test(src) && /await readStream\(res, armIdle\b/.test(src);
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

// ── The monitoring allowlist reaches the client ─────────────────────────────
//
// The monitor calls the site from Railway, which round-robins outbound traffic
// across three fixed addresses. A client who allows only the one they saw in a
// log is unblocked until the next request leaves from a different one — and
// the block then looks like a new, unrelated fault. All three, or it comes
// back.
{
  const gen = read('docx-gen.js');
  const ips = ['152.55.180.240', '162.220.234.242', '152.55.180.243'];
  const hasAll = ips.every((ip) => gen.includes(ip));
  if (hasAll) pass('all three monitoring addresses are in the guide, not just one');
  else fail(`monitoring IPs missing: ${ips.filter((ip) => !gen.includes(ip)).join(', ')}`);

  // The reason has to travel WITH the addresses. "Allow these three" without
  // the why invites a firewall admin to allow one and call it done.
  const explains = /balances outbound traffic/.test(gen) && /rotation/.test(gen) &&
                   /allowing a single address is not enough/.test(gen) && /Railway/.test(gen);
  if (explains) pass('…and it says why three, so nobody allows one and calls it done');
  else fail('the guide lists the addresses without explaining the round-robin');

  // Only when the site is actually monitored — asking for three addresses to
  // be opened on a site with no monitor is asking for a change nobody needs.
  const gated = /files && files\.monitoring \? monitoringSection\(hostname/.test(gen);
  if (gated) pass('…and it is only asked for when the monitor is in the package');
  else fail('the allowlist section is not gated on the monitor being included');

  // A sheet of its own: whoever runs the firewall is usually not whoever
  // implements the library, and a WordPress guide to find one paragraph in is
  // how the request gets ignored.
  const standalone = /function buildMonitoringOnlyDocumentXml/.test(gen) &&
                     /function generateAndDownloadMonitoringGuide/.test(gen) &&
                     /U1-Monitoring-\$\{safeFilenamePart\(hostname\)\}\.docx/.test(gen);
  const wired = /getElementById\('exportMonitoringBtn'\)/.test(read('panel.js')) &&
                /id="exportMonitoringBtn"/.test(read('panel.html'));
  if (standalone && wired) pass('…and the monitoring guide can be downloaded on its own');
  else fail(`standalone monitoring guide — built:${standalone} wired:${wired}`);

  // Self-contained: it is forwarded on its own, weeks after the .zip was sent
  // and lost, usually to somebody who never saw the implementation guide. So
  // it carries the install, the script's own source, and the allowlist.
  const whole = /heading\('Installing the monitoring hook'/.test(gen) &&
                /add_action\('wp_footer', 'u1_load_monitoring'\)/.test(gen) &&
                /heading\('The script itself'/.test(gen) &&
                /codeBlock\(src\)/.test(gen) &&
                /heading\('Checking it works'/.test(gen);
  if (whole) pass('…carrying the install, the script itself and how to verify it');
  else fail('the standalone monitoring guide is missing the install or the script');

  // The panel has to HAND it the script, or the section renders empty.
  const fed = /generateAndDownloadMonitoringGuide\(currentHostname, src, platform\)/.test(read('panel.js')) &&
              /buildDeployableCode\(stored\[mKey\] \|\| \[\], currentHostname\)\)\.monitoring/.test(read('panel.js'));
  if (fed) pass('…and the panel passes the built script into it, not just the hostname');
  else fail('the standalone guide is not given the monitoring source');

  // The guide row named the file "A", because it led with an article where
  // every other row leads with a filename.
  const named = /<strong>U1-Implementation-Guide\.docx<\/strong>/.test(read('panel.html')) &&
                !/<strong>A \.docx guide<\/strong>/.test(read('panel.html'));
  if (named) pass('the export list names the guide file instead of calling it "A"');
  else fail('the export list still reads "A .docx guide"');
}

// ── The patch has to reach the page at all ──────────────────────────────────
//
// Its injection used to live inside injectMappings, which is only reached when
// the site has at least one NON-custom mapping. So a site with none — or with
// only custom ones, which is what a link-list or a keyboard-grid is — never
// got the patch: its corrections silently did not apply, and its recorder had
// nothing to record. Least available exactly where it is most useful, on a
// client site you have just arrived at with nothing mapped yet.
{
  const bg = read('background.js');
  const standalone = /async function injectPatch\(tabId\) \{/.test(bg) &&
                     /files: \['u1-patch\.js'\]/.test(bg);
  if (standalone) pass('the patch is injected by a function of its own, not only alongside mappings');
  else fail('u1-patch.js injection is still welded to injectMappings');

  // At document_start and BEFORE the config preset — that preset does
  // `window.u1 = window.u1 || {}`, and the patch would rather intercept the
  // library's own assignment than have to notice a bare object we made
  // ourselves. That ordering is the whole reason it runs this early.
  //
  // This check used to demand it run UNCONDITIONALLY, and that was wrong in a
  // way that reached the user: it meant a document-wide keyboard interceptor
  // on every site in the browser, and on Gmail it ate every space and every
  // newline typed into compose. The race it was protecting only ever existed
  // on a site we hold data for, so the gate costs nothing and the ordering —
  // the part that mattered — is unchanged.
  const at = bg.indexOf('if (hasWork) await injectPatch(tabId);');
  const cfg = bg.indexOf('await injectConfig(tabId, stored[`config_${hostname}`])');
  const gated = /if \(early\.length\)[\s\S]{0,80}injectMappings/.test(bg);
  if (at > 0 && cfg > at && gated) {
    pass('…at document_start on a site we have data for, ahead of the config preset');
  } else {
    fail(`patch injection order wrong — patch@${at} config@${cfg}`);
  }
}

// ── The guide says nothing about skip links at all ─────────────────────────
//
// Three states, in order. It printed them as markup to paste after <body> —
// wrong, because they ship in u1-config.js and U1 renders them from
// config.skipLinks, so pasting gave a second set that scrolled without moving
// focus. It was then replaced with a paragraph explaining that. Also wrong:
// a numbered install guide had a section whose whole content was "there is
// nothing to do here", i.e. the history of an instruction we withdrew. Now
// there is no section, and the skip links work from the config file the guide
// already tells them to load. Both the markup and the explanation must stay
// gone; the config must still carry them.
{
  const gen = read('docx-gen.js');
  const prose = gen.replace(/^\s*\/\/.*$/gm, '');   // comments may keep the history

  const noPaste = !/class="skip-link"/.test(prose) && !/skipLinksHtmlOf/.test(prose);
  if (noPaste) pass('the guide no longer tells anybody to paste skip-link HTML');
  else fail('the guide still prints skip links as markup to paste — that duplicates the config');

  const noSection = !/Skip links are NOT pasted/.test(prose) &&
                    !/'Skip links', 'CodeLabel'/.test(prose) &&
                    !/Nothing to add here/.test(prose);
  if (noSection) pass('…nor carries a section explaining why there is nothing to do');
  else fail('the guide still has a skip-links section whose content is "nothing to do here"');

  // A heading that promises skip links is the same broken promise as a section.
  const noHeading = !/heading\('Step [^']*Skip Links'/.test(prose);
  if (noHeading) pass('…and no step heading still promises skip links it will not deliver');
  else fail('a step is still titled as covering skip links, but no longer covers them');

  // The one place they may still be named: saying what u1-config.js holds.
  const stillNamed = /the skip links, which U1 renders itself from here/.test(prose);
  if (stillNamed) pass('…while the order section still says the config is what carries them');
  else fail('nothing tells the implementer the config is where skip links come from');

  // And they must genuinely be in the config file the package ships — the
  // whole reason the section can be dropped without leaving a real gap.
  const inConfig = /skipLinks/.test(prose) && /safeConfigOf\(config, skipLinks\)/.test(prose);
  if (inConfig) pass('…while u1-config.js really does carry them');
  else fail('skip links are not in the generated u1-config.js — now nothing supplies them');
}

// ── The embed is shown once, whole, and in order ───────────────────────────
//
// Reported as: "it is not clear where I embed the files, and in what order."
// Both guides split the embed across two steps — the SDK tag in one, our files
// in the next — leaving the implementer to assemble the final markup from two
// places. Order is the one thing here that cannot be got wrong safely: every
// package file calls window.u1, so any of them loading before the SDK does
// nothing, silently. So each guide must print the complete ordered block in
// one piece, and say why that order.
{
  const gen = read('docx-gen.js');

  // JS guide: one code block carrying the SDK tag AND the package tags, so
  // there is nothing left to assemble.
  const wholeBlock = /codeBlock\(`<script id="u1-js" src="\$\{jsLink\}"[^`]*`\s*\+\s*fileTags\)/.test(gen);
  if (wholeBlock) pass('the JS guide prints the SDK and the package files as ONE ordered block');
  else fail('the JS guide still splits the embed across two code blocks to be assembled by hand');

  // …and Step 2 must say its lone SDK line is the same line, not a second one.
  const noDoubleSdk = /Step 3 replaces\s*'\s*\+\s*\n?\s*'this single line/.test(gen) ||
                      /Step 3 replaces this single line/.test(gen.replace(/'\s*\+\s*\n\s*'/g, ''));
  if (noDoubleSdk) pass('…and Step 2 says Step 3 replaces that same line, so the SDK is not added twice');
  else fail('Step 2 offers the SDK tag with no hint that Step 3 reprints it — invites a double load');

  // WordPress: both wp_footer callbacks carry explicit priorities, so the order
  // is a property of the code and not of where the blocks were pasted.
  const prio = /add_action\('wp_footer', 'add_u1_js', 10\)/.test(gen) &&
               /add_action\('wp_footer', 'u1_load_fix_files', 20\)/.test(gen);
  if (prio) pass('the WordPress guide pins wp_footer priorities (10, 20) so order cannot invert');
  else fail('the WordPress hooks have no priorities — order depends on paste position alone');

  // Both guides explain the order rather than only asserting it.
  const why = (gen.match(/Why that order/g) || []).length;
  if (why >= 2) pass(`both guides carry a "Why that order" section (${why} found)`);
  else fail(`only ${why} guide(s) explain the load order`);

  // Match on the fragments, not whole sentences — the prose is assembled from
  // concatenated string literals, so a sentence-long regex only ever passes
  // until the next line-wrap moves a word across the join.
  const reasons = /window\.u1 does not exist until it has run/.test(gen) &&
                  /finds nothing to /.test(gen) && /without an error/.test(gen);
  if (reasons) pass('…naming the real consequences (no window.u1; nothing for a fix to call)');
  else fail('the order sections assert an order without saying what breaks');

  // The "put them where you like" freedom must survive, with the caveat.
  const relocatable = /change them to match where you actually put them/.test(gen) &&
                      /add that subfolder to the paths below/.test(gen);
  if (relocatable) pass('…and both still allow relocating the files, with the path caveat');
  else fail('the guides lost the note that the files may live elsewhere');
}

// ── The client-facing text describes what the patch ADDS, not what U1 lacks ──
//
// The guide called u1-patch.js "the library corrections" and said it "corrects
// defects in the library". Both true internally, and both wrong to hand a
// customer: the document that tells them how to install U1 also told them the
// product they bought is defective. What the file actually does is extend the
// runtime over ground U1's current infrastructure does not reach yet — which
// is the same fact, stated as what is gained rather than what is broken.
// Per-region engineering comments keep the precise language; the surfaces that
// leave the building do not.
{
  const shipped = [
    ['docx-gen.js', read('docx-gen.js').replace(/^\s*\/\/.*$/gm, '')],   // guide prose
    ['panel.html',  read('panel.html')],                                  // export list
    ['u1-patch.js', read('u1-patch.js').split('(function ()')[0]],        // file header
  ];
  let clean = true;
  for (const [name, text] of shipped) {
    const m = text.match(/library corrections|corrects? defects|defects in the library/i);
    if (m) { fail(`${name} still tells the client about "${m[0]}" — that reads as "U1 is broken"`); clean = false; }
  }
  if (clean) pass('no client-facing surface describes the patch as fixing U1 defects');

  // And the replacement has to actually say something, not just soften.
  const gen = read('docx-gen.js');
  const positive = /runtime extensions they depend on/.test(gen) &&
                   /does not cover yet/.test(gen);
  if (positive) pass('…they say what it adds and what U1 does not cover yet instead');
  else fail('the patch is now described vaguely — say what it extends and over what gap');
}

// ── The load-order list is uniform, bolded, and cannot split across a page ──
//
// Three separate complaints about the same list. It mixed forms ("The U1 SDK"
// beside bare filenames), skipped u1-fixes.js entirely, ran in a different
// order from the code block it explains, and closed on a monitoring entry that
// described when the file activates rather than what it is — so the last
// bullet read as a different kind of fact from the ones above it. It also came
// out of Word with the heading and a bullet and a half at the foot of a page
// and the rest overleaf.
{
  const gen = read('docx-gen.js');

  // One shared builder, so the two guides cannot drift apart again.
  const shared = (gen.match(/\.\.\.orderBullets\(names,/g) || []).length;
  if (shared === 2) pass('both guides build the load-order list from one shared function');
  else fail(`the load-order list is built ${shared} time(s) from orderBullets — expected 2`);

  // Every entry, including the SDK, is a bold filename in the same shape.
  const bolded = /<w:r><w:rPr><w:b\/><\/w:rPr><w:t[^>]*>\$\{xe\(name\)\}/.test(gen);
  if (bolded) pass('…each entry opens with its script name in bold');
  else fail('the load-order entries no longer bold the script name');

  const filesNamed = ['u1_vanilla-js-a11y.js', 'u1-config.js', 'u1-patch.js',
                      'u1-fixes.js', 'u1-monitoring.js']
    .filter((n) => new RegExp(`bulletFile\\('${n.replace(/[.*]/g, '\\$&')}'`).test(gen));
  if (filesNamed.length === 5) pass('…and all five files get an entry, the SDK and u1-fixes.js included');
  else fail(`only ${filesNamed.length}/5 files have a load-order entry (${filesNamed.join(', ')})`);

  // The bullet inserts its own em dash; a second one right after reads as a typo.
  const nested = (gen.match(/bulletFile\([\s\S]*?\n\s*\}/)?.[0] || '');
  const dashPileup = /'[a-z][^']*—[^']*' \+\n\s*'/.test(
    gen.slice(gen.indexOf('function orderBullets'), gen.indexOf('function buildDocumentXml')));
  if (!dashPileup) pass('…with no second em dash colliding with the one the bullet adds');
  else fail('a load-order entry piles an em dash onto the one bulletFile already inserts');

  // Monitoring must say what it IS, not only that it is harmless.
  const monitoringExplained = /daily health check/.test(gen) &&
                              /silently stops applying/.test(gen) &&
                              /re-tests every/.test(gen);
  if (monitoringExplained) pass('…and u1-monitoring.js is explained by what it catches, not just when it runs');
  else fail('the monitoring entry still only says it is inert without ?u1qa=1');

  // Word must not strand the heading from its list.
  const keeps = /<w:keepNext\/><w:keepLines\/>/.test(gen) &&
                /w:keepLines\/>\s*<\/w:pPr>[\s\S]{0,200}xe\(name\)/.test(gen);
  if (keeps) pass('…and headings keepNext with their bullets so the section cannot split');
  else fail('headings/bullets carry no keepNext/keepLines — the section can break across pages');
}

// ── Finish project: one bundle, with a real PDF in it ──────────────────────
//
// The handover is taken once, at the end of a project, and must not be an
// assembly job: the guide, every generated file, and the close-out report as a
// PDF, in one zip named for the client.
//
// The PDF is the part that could not exist before. The ⬇ Download PDF button
// hands the job to Chrome's print dialog, which is right for a person reading
// the report and useless here — it cannot produce a FILE for a zip without
// somebody standing at it choosing a destination. Page.printToPDF over CDP
// does, and the manifest already carried the `debugger` permission for it.
{
  const gen = read('docx-gen.js');
  const pan = read('panel.js');
  const bg  = read('background.js');
  const htm = read('panel.html');
  const mf  = JSON.parse(read('manifest.json'));

  const hasBuilder = /function buildHandoverZip\(/.test(gen);
  if (hasBuilder) pass('the handover bundle is built by a function of its own');
  else fail('there is no buildHandoverZip — the handover has nothing to assemble');

  // Export package (.zip) is the developer's artefact, taken many times during
  // a project. Bolting the handover onto it would change what that button
  // produces, and the two will drift apart.
  const separate = /function generateAndDownloadPackage\(/.test(gen) &&
                   !/closeOutPdf/.test(gen.slice(gen.indexOf('function generateAndDownloadPackage')));
  if (separate) pass('…without changing what Export package produces');
  else fail('the handover was bolted onto generateAndDownloadPackage');

  // The PDF is added to the file LIST, which both the upload and the zip are
  // built from — so it cannot be in one and missing from the other.
  const pdfInBundle = /name: `U1-CloseOut-Report-\$\{safeHost\}\.pdf`, mime: 'application\/pdf'/.test(gen);
  if (pdfInBundle) pass('…and the close-out report goes in as a PDF, named for the client');
  else fail('the bundle carries no close-out PDF');

  if (/for \(const f of buildHandoverFiles\(/.test(gen))
    pass('…with the zip built from that same list, so the two cannot diverge');
  else fail('the zip and the upload are assembled separately and will drift');

  // A project with no mappings has no report; that must not stop the code
  // files, which are the part the client cannot proceed without.
  const pdfOptional = /if \(closeOutPdf && closeOutPdf\.length\)/.test(gen) &&
                      /let pdf = null, pdfErr = null;/.test(pan);
  if (pdfOptional) pass('…and a missing or failed PDF still ships everything else');
  else fail('a failed PDF takes the whole handover down with it');

  // Printing without a dialog.
  const cdp = /Page\.printToPDF/.test(bg) && /chrome\.debugger\.attach/.test(bg);
  if (cdp) pass('the PDF is printed by Chrome itself, with no dialog');
  else fail('nothing prints the report to a PDF file');

  if ((mf.permissions || []).includes('debugger')) pass('…using the debugger permission the manifest already had');
  else fail('Page.printToPDF needs the debugger permission and the manifest lacks it');

  // An attached debugger leaves the "U1 Studio is debugging this browser" bar
  // across the tab permanently if a failure skips the detach.
  const detaches = /\} finally \{[\s\S]{0,200}chrome\.debugger\.detach/.test(bg);
  if (detaches) pass('…and always detaches, including when the print fails');
  else fail('the debugger is detached only on success — a failure strands the banner');

  // Backgrounds are the report's colour coding; without this the badges print
  // as white boxes.
  if (/printBackground: true/.test(bg)) pass('…printing backgrounds, so the colour coding survives');
  else fail('printToPDF drops the report\'s backgrounds');

  // report-view.js writes the document AFTER load, so tab "complete" is not
  // "the report is on the page". A fixed delay prints blank on a slow machine.
  // ── Knowing when the report is actually on the page ──────────────────────
  //
  // This polled the tab with chrome.scripting.executeScript, looking for the
  // report's root. The scripting API does not inject into an extension's OWN
  // pages, so the poll saw nothing, ran its whole 15s budget out and reported
  // "the report did not finish rendering" about a report that had rendered
  // perfectly — every time, so the handover never once contained a PDF.
  const view = read('report-view.js');
  const noInject = /async function waitForReportRendered/.test(pan) &&
                   !/executeScript/.test(pan.slice(pan.indexOf('async function waitForReportRendered'),
                                                   pan.indexOf('async function waitForReportRendered') + 900));
  if (noInject) pass('…waiting on a signal rather than injecting into an extension page');
  else fail('the wait still injects into report.html, which Chrome does not allow');

  const handshake = /__closeOutReportReady/.test(view) && /__closeOutReportReady/.test(pan);
  if (handshake) pass('…which the report page itself raises once the document is written');
  else fail('nothing tells the panel the report finished rendering');

  // A flag left from the previous handover reads as "ready" instantly and
  // prints a blank page.
  if (/U1Store\.remove\('__closeOutReportReady'\)/.test(pan))
    pass('…cleared before the tab opens, so a stale flag cannot print an empty page');
  else fail('the ready flag is never cleared — a second handover prints the wrong thing');

  // The button, and the folder it opens.
  if (/id="finishProjectBtn"/.test(htm)) pass('there is a Finish project button');
  else fail('the Finish project button is not in the panel');

  // Nothing to fill in. A field for the parent folder was there briefly and was
  // exactly wrong: it made a step look manual that the server had already
  // decided, and a pasted parent would let any signed-in panel write anywhere
  // the CRM identity can reach.
  const noFolderField = !/driveFolderUrl/.test(pan) && !/driveFolderUrl/.test(htm);
  if (noFolderField) pass('…with no folder for anyone to paste — the server owns it');
  else fail('the panel still asks for a Drive folder the server already decides');

  // The folder that IS opened must be the one the server just created.
  if (/uploaded\.folderUrl/.test(pan) && /chrome\.tabs\.create\(\{ url: uploaded\.folderUrl \}\)/.test(pan))
    pass('…and the folder opened afterwards is the one the server created');
  else fail('the panel does not open the folder the upload returned');

  // ── Uploaded by the CRM, which already holds a Google identity ───────────
  //
  // Google has no anonymous write API. An OAuth client inside the extension
  // would mean every specialist authorising Drive again on every machine; the
  // CRM already signs in to Google for Sheets, Tasks and pricing screenshots,
  // so the panel sends the files and the server uploads them.
  const syn = read('sync.js');
  if (/async function uploadHandover\(hostname, files\)/.test(syn) &&
      /path\(hostname, '\/handover'\)/.test(syn)) pass('the handover is POSTed to the CRM for upload');
  else fail('nothing uploads the handover — the CRM route is not called');

  // The parent folder must be the server's decision. A parent id off the wire
  // would let any signed-in panel write anywhere that identity can reach.
  if (!/parentId|folderId/.test(syn.slice(syn.indexOf('async function uploadHandover'),
                                          syn.indexOf('async function uploadHandover') + 700)))
    pass('…without sending a destination folder, which the server decides');
  else fail('the panel sends a Drive parent folder — that lets it write anywhere');

  // A handover is the guides plus a PDF: multi-megabyte. btoa needs a binary
  // string, and String.fromCharCode(...bytes) on that size throws RangeError,
  // so it would have failed only on the real files.
  if (/for \(let i = 0; i < bytes\.length; i \+= 0x8000\)/.test(pan))
    pass('…base64-encoded in chunks, so a multi-MB docx does not blow the stack');
  else fail('base64 encoding will throw RangeError on a real-sized docx');

  // The client is meant to SEE the guide and the PDF in their folder.
  if (/function buildHandoverFiles\(/.test(gen) && /uploadHandover\(currentHostname,\s*\n?\s*files\.map/.test(pan))
    pass('…as individual files, not one zip the client has to unpack');
  else fail('the handover uploads a zip rather than the files themselves');

  // A server that refuses must not leave the specialist with nothing.
  if (/Not uploaded \(\$\{uploadErr\}\)/.test(pan) && /buildHandoverZip\(\.\.\.args\)/.test(pan))
    pass('…and a failed upload still downloads the bundle, saying why');
  else fail('a failed upload leaves the specialist with nothing');

  // Only ever open a real Drive URL: this value is opened in a tab, and a
  // pasted javascript:/data: link must not be navigable.
  // The URL opened comes from our own server's response, not from user input,
  // so it needs no scheme check — but it must be built server-side from the id
  // rather than echoed back from anything the panel sent.
  const bg2 = read('../user1st_project/user1st-backend/src/modules/studio/studioHandover.controller.ts', true);
  if (bg2 === null) pass('(backend not checked out here — skipping its assertions)');
  else if (/folderUrl: `https:\/\/drive\.google\.com\/drive\/folders\/\$\{folderId\}`/.test(bg2))
    pass('…and the server builds that URL from the id it created');
  else fail('the server does not return a folder URL built from the created folder');
}

console.log(failures === 0 ? '\n✅ All extension checks passed.\n' : `\n❌ ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

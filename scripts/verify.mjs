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

console.log(failures === 0 ? '\n✅ All extension checks passed.\n' : `\n❌ ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

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
if (!/for \(const key of Object\.keys\(all\)\)[\s\S]{0,120}startsWith\('__'\)/.test(panel)) {
  fail('the backup export no longer strips "__" keys — a refresh token could be exported');
} else {
  pass('export strips all "__" keys');
}
if (!/__studioAuth/.test(auth)) fail('auth.js no longer uses the "__" storage prefix');
else pass('auth state is stored under a "__" key, which sanitizeImport rejects');

console.log(failures === 0 ? '\n✅ All extension checks passed.\n' : `\n❌ ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

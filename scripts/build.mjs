// Packages the extension into dist/u1-studio-<version>.zip.
//
// package.json is the single source of truth for the version. manifest.json and
// the badge in panel.html must agree with it — a zip built from files that
// disagree is how "which version is the client running?" becomes unanswerable.
// Run with --check-only to assert agreement without building.

import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Everything the packaged extension needs, and nothing else.
const FILES = [
  'manifest.json', 'rules.json',
  'panel.html', 'panel.js', 'styles.css',
  'config.js', 'store.js', 'auth.js',
  // The site's shared work — mappings, settings and scans on the server.
  // panel.html loads it, so leaving it out ships a panel that dies on a
  // missing script. verify.mjs now checks that list against this one.
  'sync.js',
  'background.js', 'test-engine.js', 'grid-nav.js',
  // Injected on demand to operate a component and watch what it does.
  // probe-net.js is probe.js's MAIN-world counterpart (see the comment atop
  // each) — without it in the package, panel.js's ensureProbeNet() injection
  // 404s and the net silently falls back to isolated-world-only blocking.
  'probe.js', 'probe-net.js',
  // Read at export time and inlined into the client's script. Without it in the
  // package the export silently ships without the library corrections.
  'u1-patch.js',
  // selector-intel.js is loaded by panel.html AND injected into the page;
  // event-recorder.js is registered dynamically when precise event detection
  // is switched on. Both are read from the package, so both must ship.
  'selector-intel.js', 'event-recorder.js',
  // The third-party scan engines, injected into the page on a scan. Vendored
  // rather than fetched: the extension CSP allows 'self' only, and a scan that
  // depended on a CDN would fail on exactly the locked-down sites that most
  // need scanning.
  'scan-engines.js', 'vendor/axe.min.js',
  // ai-advisor.js talks to api.anthropic.com — which must stay listed in the
  // manifest's connect-src, or every review dies at the CSP.
  'ai-advisor.js',
  // The scan's rules, fetched at runtime by ai-advisor. Editing this file
  // changes what the scan flags, so it has to be in the package — without it
  // the scan silently falls back to the built-in rules only.
  'a11y-rules.md',
  // And the BUILD's rules, per component, fetched the same way. a11y-rules.md
  // decides what is wrong; this decides what to do about it. Missing from the
  // package, every mapping is worked out with no rules at all — which is how a
  // tab strip came back with tabList, tab and tabPanel all set to the strip.
  'component-rules.md',
  'docx-gen.js', 'report-gen.js',
  'report.html', 'report-view.js',
];

const version = JSON.parse(read('package.json')).version;
const problems = [];

const manifestVersion = JSON.parse(read('manifest.json')).version;
if (manifestVersion !== version) {
  problems.push(`manifest.json version is ${manifestVersion}, expected ${version}`);
}

// The badge is display-only, so it carries major.minor: v3.0 for 3.0.0.
const expectedBadge = `v${version.split('.').slice(0, 2).join('.')}`;
const badge = read('panel.html').match(/<span class="version"[^>]*>([^<]*)<\/span>/)?.[1];
if (badge !== expectedBadge) {
  problems.push(`panel.html version badge is ${badge ?? '(missing)'}, expected ${expectedBadge}`);
}

if (problems.length) {
  console.error('Version mismatch:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

if (process.argv.includes('--check-only')) {
  console.log(`Versions agree at ${version}.`);
  process.exit(0);
}

const stage = join(ROOT, 'dist', `u1-studio-${version}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const f of FILES) cpSync(join(ROOT, f), join(stage, f));

// Stamp the commit into the package.
//
// "I loaded the new version" and "the browser is running the new version" are
// different claims, and this project spent several rounds unable to tell them
// apart: a fix would ship, the symptom would persist, and both sides would
// reason about code that was not on the machine. The manifest version rarely
// moves; the commit always does, and Chrome shows version_name verbatim on
// chrome://extensions — so the answer is readable without opening a file.
{
  let sha = '';
  try {
    sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT })
      .toString().trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT })
      .toString().trim().length > 0;
    if (dirty) sha += '+';   // built from a tree with uncommitted changes
  } catch { sha = 'nogit'; }
  const manPath = join(stage, 'manifest.json');
  const man = JSON.parse(readFileSync(manPath, 'utf8'));
  man.version_name = `${version} (${sha})`;
  writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
}

// Which server the build talks to must be stated every time.
//
// This used to default to the value sitting in config.js, which is localhost.
// That meant a plain `npm run build` silently overwrote a correctly-targeted
// package with a localhost one, in the same folder Chrome has loaded — and the
// only symptom was "Could not reach the licence server" long after the build.
// Nothing about the package looks wrong; you have to open config.js to find out.
// So: say where it points, or say --dev out loud.
const serverArg = process.argv.find((a) => a.startsWith('--server='));
const isDev = process.argv.includes('--dev');

if (!serverArg && !isDev) {
  console.error(
    '\nRefusing to build without a target.\n\n' +
    '  npm run build -- --server=https://your-server.example.com   (for a real build)\n' +
    '  npm run build -- --dev                                      (localhost, for development)\n',
  );
  process.exit(1);
}

// --dev used to leave the staged manifest exactly as checked in — which,
// since the source manifest now names the real production host instead of a
// wildcard (see below), meant a --dev build's CSP no longer matched
// config.js's localhost default and every request died. So --dev takes the
// same rewrite path as --server=, just pointed at localhost: one code path
// for "which server does this build talk to", not two that can drift apart.
const serverUrl = serverArg
  ? serverArg.slice('--server='.length).replace(/\/+$/, '')
  : (isDev ? 'http://localhost:3001' : null);

if (serverUrl) {
  if (!/^https?:\/\/[^\s'"]+$/.test(serverUrl)) {
    console.error(`Invalid --server value: ${serverUrl}`);
    process.exit(1);
  }
  // '.' is deliberately excluded from the disallowed-char set the regex above
  // checks — it's needed for real hostnames — but that also means
  // `--server=https://a.example;script-src https://evil.example` would pass
  // it (';' IS excluded) only because ';' is blocked; belt-and-braces here:
  // parse it as a URL and require the origin to equal what was typed, so
  // nothing beyond scheme+host+port can ride along into the CSP directive
  // built from this string below.
  try {
    const parsed = new URL(serverUrl);
    if (parsed.origin !== serverUrl) throw new Error('not a bare origin');
  } catch {
    console.error(`Invalid --server value: ${serverUrl} (must be a bare origin, e.g. https://host.example)`);
    process.exit(1);
  }
  if (serverUrl.startsWith('http://') && !serverUrl.startsWith('http://localhost')) {
    console.error('Refusing to build: Chrome will not let the extension talk to a plain-HTTP server. Use https://.');
    process.exit(1);
  }

  const cfgPath = join(stage, 'config.js');
  const cfg = readFileSync(cfgPath, 'utf8');
  const SERVER_URL_RE = /SERVER_URL:\s*'[^']*'/;
  // Checked on whether the pattern MATCHED, not on whether the string came out
  // different — a --dev build's target (http://localhost:3001) is also
  // config.js's own checked-in default, so replacing "found" text with the
  // same text is a real, successful rewrite that produces an identical
  // string. Comparing before/after treated that as failure and refused to
  // build.
  if (!SERVER_URL_RE.test(cfg)) {
    console.error('Could not rewrite SERVER_URL in config.js — has the field been renamed?');
    process.exit(1);
  }
  writeFileSync(cfgPath, cfg.replace(SERVER_URL_RE, `SERVER_URL: '${serverUrl}'`));

  // Rewrite connect-src to the licence server — but KEEP the hosts the panel
  // needs regardless of which server a build targets. Blowing the whole
  // directive away used to drop api.anthropic.com, so AI mode worked unpacked
  // and died on a CSP error in every packaged build: exactly the class of
  // silent, late-discovered misconfiguration this script exists to prevent.
  const ALWAYS_ALLOWED = ['https://api.anthropic.com'];
  const manPath = join(stage, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manPath, 'utf8'));
  const sources = ["'self'", serverUrl, ...ALWAYS_ALLOWED];
  manifest.content_security_policy.extension_pages =
    manifest.content_security_policy.extension_pages.replace(
      /connect-src [^;]+;/,
      `connect-src ${[...new Set(sources)].join(' ')};`,
    );
  writeFileSync(manPath, JSON.stringify(manifest, null, 2) + '\n');

  // The panel calls these hosts directly; if one is missing from the built CSP
  // the failure surfaces as an opaque network error at runtime, so check here.
  const csp = manifest.content_security_policy.extension_pages;
  for (const host of ALWAYS_ALLOWED) {
    if (!csp.includes(host)) {
      console.error(`Build aborted: ${host} is missing from connect-src.`);
      process.exit(1);
    }
  }

  console.log(`Pointed build at ${serverUrl} (config.js + manifest connect-src).`);
}

// Read the target back out of the staged files rather than trusting the flag —
// this is what Chrome will actually load, and it is the one line worth checking
// before reloading the extension.
const builtUrl = readFileSync(join(stage, 'config.js'), 'utf8').match(/SERVER_URL:\s*'([^']*)'/)?.[1];
const builtCsp = JSON.parse(readFileSync(join(stage, 'manifest.json'), 'utf8'))
  .content_security_policy.extension_pages.match(/connect-src ([^;]+)/)?.[1];

if (!builtCsp?.includes(builtUrl ?? ' ')) {
  console.error(`\nBuild aborted: config.js points at ${builtUrl} but connect-src is "${builtCsp}".`);
  console.error('Chrome would block every request. This should be impossible — check scripts/build.mjs.\n');
  process.exit(1);
}

const zip = `u1-studio-${version}.zip`;
execFileSync('zip', ['-qr', zip, `u1-studio-${version}`], { cwd: join(ROOT, 'dist') });
console.log(`Built dist/${zip} (${FILES.length} files, version ${version}).`);
console.log(`\n  ➜  This build talks to: ${builtUrl}\n`);

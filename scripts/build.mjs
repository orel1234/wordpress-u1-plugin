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
  'config.js', 'auth.js',
  'background.js', 'test-engine.js', 'grid-nav.js',
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
const badge = read('panel.html').match(/<span class="version">([^<]*)<\/span>/)?.[1];
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

// --server=https://… points the packaged build at a licence server. It has to be
// rewritten in two places that must never disagree: config.js, which is what the
// code calls, and the manifest's connect-src, which is what Chrome permits. A
// build that updates only one of them fails at runtime with an opaque CSP error.
const serverArg = process.argv.find((a) => a.startsWith('--server='));
if (serverArg) {
  const serverUrl = serverArg.slice('--server='.length).replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s'"]+$/.test(serverUrl)) {
    console.error(`Invalid --server value: ${serverUrl}`);
    process.exit(1);
  }
  if (serverUrl.startsWith('http://') && !serverUrl.startsWith('http://localhost')) {
    console.error('Refusing to build: Chrome will not let the extension talk to a plain-HTTP server. Use https://.');
    process.exit(1);
  }

  const cfgPath = join(stage, 'config.js');
  const cfg = readFileSync(cfgPath, 'utf8');
  const rewritten = cfg.replace(/SERVER_URL:\s*'[^']*'/, `SERVER_URL: '${serverUrl}'`);
  if (rewritten === cfg) {
    console.error('Could not rewrite SERVER_URL in config.js — has the field been renamed?');
    process.exit(1);
  }
  writeFileSync(cfgPath, rewritten);

  const manPath = join(stage, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manPath, 'utf8'));
  manifest.content_security_policy.extension_pages =
    manifest.content_security_policy.extension_pages.replace(
      /connect-src [^;]+;/,
      `connect-src 'self' ${serverUrl};`,
    );
  writeFileSync(manPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Pointed build at ${serverUrl} (config.js + manifest connect-src).`);
}

const zip = `u1-studio-${version}.zip`;
execFileSync('zip', ['-qr', zip, `u1-studio-${version}`], { cwd: join(ROOT, 'dist') });
console.log(`Built dist/${zip} (${FILES.length} files, version ${version}).`);

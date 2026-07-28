// Packages the extension into dist/u1-studio-<version>.zip.
//
// package.json is the single source of truth for the version. manifest.json and
// the badge in panel.html must agree with it — a zip built from files that
// disagree is how "which version is the client running?" becomes unanswerable.
// Run with --check-only to assert agreement without building.

import { readFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Everything the packaged extension needs, and nothing else.
const FILES = [
  'manifest.json', 'rules.json',
  'panel.html', 'panel.js', 'styles.css',
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

const zip = `u1-studio-${version}.zip`;
execFileSync('zip', ['-qr', zip, `u1-studio-${version}`], { cwd: join(ROOT, 'dist') });
console.log(`Built dist/${zip} (${FILES.length} files, version ${version}).`);

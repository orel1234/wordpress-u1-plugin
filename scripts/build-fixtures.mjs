// Regenerate the detection fixtures from their source of truth.
//
//   node scripts/build-fixtures.mjs
//
// The fixture pages are not authored here. They are the STEP shoe-store site,
// which lives in the sibling checkout, and its two variant generators:
//
//   …/user1st_project/new website copy/make-realistic.mjs
//   …/user1st_project/new website copy/make-hostile.mjs
//
// Until this script existed, the pipeline was: run the generators over there,
// then hand-copy six files into fixtures/ under different names. The hostile
// rename map is a POSITIONAL index over a length-sorted token set, so the map
// and the HTML are only ever valid as a matched pair from one run — and the
// hand-copy missed the map once. Result: three labels that failed loudly
// (".c2n — the LABEL does not resolve"), ~123 more that translated to the
// WRONG elements silently, and a hostile score that measured the stale corpus
// instead of the detector. This script makes the copy atomic and then REFUSES
// to finish unless the pair actually agrees.
//
// It also rewrites the pages' own <script src> / <link href> to the fixture
// filenames. The generator's public/ dir is self-consistent under its own
// names; the old copy renamed the files but not the references, so loading
// fixtures/step.html in a real browser 404'd every script and stylesheet and
// none of the JS-built components existed. verify-browser.mjs loads these
// pages in real Chromium, so the references have to hold.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = join(ROOT, '..', 'user1st_project', 'new website copy');
const PUB = join(GEN, 'public');
const FIX = join(ROOT, 'fixtures');

if (!existsSync(join(GEN, 'make-hostile.mjs'))) {
  console.error(`Cannot find the generator checkout at ${GEN}`);
  process.exit(1);
}

// ── 1. Run both generators, so every emitted file is from ONE run ──────────
for (const gen of ['make-realistic.mjs', 'make-hostile.mjs']) {
  process.stdout.write(`  running ${gen}… `);
  execFileSync('node', [gen], { cwd: GEN, stdio: ['ignore', 'pipe', 'inherit'] });
  console.log('done');
}

// ── 2. Copy, rename, and rewrite self-references ───────────────────────────
// [source in public/, fixture name, {from: to} reference rewrites]
const REFS_FRIENDLY = {
  'src="script.js"': 'src="step-script.js"',
  'src="mega.js"': 'src="step-mega.js"',
  'href="styles.css"': 'href="step-styles.css"',
  'href="mega.css"': 'href="step-mega.css"',
};
const REFS_REAL = {
  'src="real-script.js"': 'src="step-real-script.js"',
  'src="real-mega.js"': 'src="step-real-mega.js"',
  'href="real-styles.css"': 'href="step-real-styles.css"',
  'href="real-mega.css"': 'href="step-real-mega.css"',
};
const REFS_HOSTILE = {
  'src="hostile-script.js"': 'src="step-hostile-script.js"',
  'src="hostile-mega.js"': 'src="step-hostile-mega.js"',
  'href="hostile-styles.css"': 'href="step-hostile-styles.css"',
  'href="hostile-mega.css"': 'href="step-hostile-mega.css"',
};
const FILES = [
  ['friendly.html', 'step.html', REFS_FRIENDLY],
  ['script.js', 'step-script.js', null],
  ['mega.js', 'step-mega.js', null],
  ['styles.css', 'step-styles.css', null],
  ['mega.css', 'step-mega.css', null],
  ['realistic.html', 'step-real.html', REFS_REAL],
  ['real-script.js', 'step-real-script.js', null],
  ['real-mega.js', 'step-real-mega.js', null],
  ['real-styles.css', 'step-real-styles.css', null],
  ['real-mega.css', 'step-real-mega.css', null],
  ['hostile.html', 'step-hostile.html', REFS_HOSTILE],
  ['hostile-script.js', 'step-hostile-script.js', null],
  ['hostile-mega.js', 'step-hostile-mega.js', null],
  ['hostile-styles.css', 'step-hostile-styles.css', null],
  ['hostile-mega.css', 'step-hostile-mega.css', null],
  ['hostile-map.json', 'step-hostile-map.json', null],
];

for (const [src, dst, refs] of FILES) {
  let text = readFileSync(join(PUB, src), 'utf8');
  if (refs) for (const [from, to] of Object.entries(refs)) text = text.split(from).join(to);
  writeFileSync(join(FIX, dst), text);
}
console.log(`  copied ${FILES.length} files into fixtures/`);

// ── 3. The pair must agree, or nothing above happened ──────────────────────
// (a) Every mapped class that the FRIENDLY page actually uses must have its
//     code present in the hostile output. The map's token sweep covers the
//     whole site (checkout, product pages, the shared stylesheet), so plenty
//     of mapped tokens legitimately never reach this one page's build — but a
//     token that IS on this page and whose code is nowhere in the hostile
//     build means map and build are from different runs, which is the exact
//     corruption this script exists to prevent.
const map = JSON.parse(readFileSync(join(FIX, 'step-hostile-map.json'), 'utf8'));
const hostileText = ['step-hostile.html', 'step-hostile-mega.js', 'step-hostile-script.js']
  .map((f) => readFileSync(join(FIX, f), 'utf8')).join('\n');
// "Used by the friendly page" means used AS A CLASS — read off class="…"
// attributes in the page and its own renderer, not off prose ("Join the
// newsletter") or the shared script's other-page code paths, both of which
// produced false alarms when this was a bare word-boundary sweep.
const friendlyText = ['step.html', 'step-mega.js']
  .map((f) => readFileSync(join(FIX, f), 'utf8')).join('\n');
const usedClasses = new Set();
for (const m of friendlyText.matchAll(/class="([^"]*)"/g)) {
  for (const t of m[1].split(/\s+/)) if (t) usedClasses.add(t);
}
const missing = Object.entries(map.classes)
  .filter(([name]) => usedClasses.has(name))
  .filter(([, code]) => !new RegExp(`\\b${code}\\b`).test(hostileText))
  .map(([name, code]) => `${name} → ${code}`);
if (missing.length) {
  console.error(`  MAP/BUILD MISMATCH: ${missing.length} classes used by the friendly page ` +
    `have codes that occur nowhere in the hostile output. Map and build are from different runs.`);
  console.error('    ' + missing.slice(0, 10).join('\n    '));
  process.exit(1);
}

// (b) Every LABEL must survive translation: its class/id tokens, run through
//     the map the same way verify-detect translates them, must appear in the
//     hostile HTML. This is the check that would have caught .c2n/.c3f/.c2s.
const labels = JSON.parse(readFileSync(join(FIX, 'step.labels.json'), 'utf8'));
const hostileHtml = readFileSync(join(FIX, 'step-hostile.html'), 'utf8');
const bad = [];
for (const c of labels.components) {
  const sels = [c.root, ...Object.values(c.fields || {})];
  for (const sel of sels) {
    for (const m of String(sel).matchAll(/([.#])([\w-]+)/g)) {
      const [, sigil, name] = m;
      const code = sigil === '.' ? map.classes[name] : map.ids[name];
      if (!code) continue;   // untranslated tokens are the generator's business
      if (!new RegExp(`\\b${code}\\b`).test(hostileHtml) &&
          !new RegExp(`\\b${code}\\b`).test(hostileText)) {
        bad.push(`${c.type} ${sel}: ${sigil}${name} → ${sigil}${code} (nowhere in hostile build)`);
      }
    }
  }
}
if (bad.length) {
  console.error('  LABELS BROKEN BY TRANSLATION:');
  for (const b of bad) console.error('    ' + b);
  process.exit(1);
}
console.log('  map/build pair verified: every mapped label token resolves in the hostile output');
console.log('  fixtures rebuilt.');

// One runner for the whole suite.
//
//   npm run verify   →   node scripts/verify-all.mjs
//
// The old `verify` script chained nineteen node invocations with `&&`. Two
// things were wrong with that, and both bit: the chain stops at the first
// failing file, so later suites never report; and there is no summary, so
// "did everything pass" was answered by grepping the scroll — which is how
// two failing verify-store checks were reported green for three commits
// (their failure line said "❌ 2 check(s) failed", the grep looked for
// "N failed"). This runner runs EVERY suite regardless of earlier failures,
// trusts exit codes rather than output formats, prints one table, and exits
// non-zero if anything failed. Reports open with this table now.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Order preserved from the old chain. verify-browser is NOT here: it needs a
// Chromium download and ~2 minutes, and it is run explicitly around detection
// work (`npm run verify:browser`).
const SUITES = [
  ['verify-probe', ['scripts/verify-probe.mjs']],
  ['verify', ['scripts/verify.mjs']],
  ['verify-boot', ['scripts/verify-boot.mjs']],
  ['verify-store', ['scripts/verify-store.mjs']],
  ['verify-mappings', ['scripts/verify-mappings.mjs']],
  ['verify-checks', ['scripts/verify-checks.mjs']],
  ['verify-patch', ['scripts/verify-patch.mjs']],
  ['verify-patch-context', ['scripts/verify-patch-context.mjs']],
  ['verify-patch-focus', ['scripts/verify-patch-focus.mjs']],
  ['verify-breadcrumb', ['scripts/verify-breadcrumb.mjs']],
  ['verify-sweep', ['scripts/verify-sweep.mjs']],
  ['verify-signin', ['scripts/verify-signin.mjs']],
  ['verify-stream', ['scripts/verify-stream.mjs']],
  ['verify-anon', ['scripts/verify-anon.mjs']],
  ['verify-visual-guard', ['scripts/verify-visual-guard.mjs']],
  ['verify-scan-engines', ['scripts/verify-scan-engines.mjs']],
  ['verify-detect', ['scripts/verify-detect.mjs']],
  ['verify-detect --real', ['scripts/verify-detect.mjs', '--real']],
  ['verify-detect --hostile', ['scripts/verify-detect.mjs', '--hostile']],
  ['verify-pins', ['scripts/verify-pins.mjs']],
];

// Count what the output SAYS where it says it in a known shape, but never
// decide pass/fail from it — the exit code decides. The two shapes in use:
//   "N passed, M failed"   (check-style suites, possibly several per file)
//   "❌ N check(s) failed" / "✅ …"   (boolean-style suites)
function counts(text) {
  let passed = 0, failed = 0, seen = false;
  for (const m of text.matchAll(/(\d+)\s+passed,\s+(\d+)\s+failed/g)) {
    passed += Number(m[1]); failed += Number(m[2]); seen = true;
  }
  for (const m of text.matchAll(/❌\s+(\d+)\s+check/g)) {
    failed += Number(m[1]); seen = true;
  }
  const ok = (text.match(/✅/g) || []).length;
  if (ok && !seen) { passed = ok; seen = true; }
  else if (ok) passed += ok;
  return seen ? { passed, failed } : null;
}

const rows = [];
let anyFailed = false;
const t0 = Date.now();
for (const [name, args] of SUITES) {
  const started = Date.now();
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  if (!ok) anyFailed = true;
  const c = counts(out);
  rows.push({
    name, ok,
    passed: c ? String(c.passed) : '—',
    failed: c ? String(c.failed) : (ok ? '—' : '?'),
    ms: Date.now() - started,
  });
  if (!ok) {
    // The failing suite's own voice, in full — a table row cannot be debugged.
    console.log(`\n──── ${name} FAILED ─────────────────────────────────────`);
    process.stdout.write(out);
    console.log('─'.repeat(58));
  }
}

console.log('\n  suite                      passed   failed   result   time');
console.log('  ' + '─'.repeat(60));
for (const r of rows) {
  console.log(`  ${r.name.padEnd(26)} ${r.passed.padStart(6)}   ${r.failed.padStart(6)}   ${r.ok ? '  ok  ' : ' FAIL '}   ${(r.ms / 1000).toFixed(1)}s`);
}
const totalPassed = rows.reduce((a, r) => a + (r.passed === '—' ? 0 : Number(r.passed)), 0);
const totalFailed = rows.reduce((a, r) => a + (/^\d+$/.test(r.failed) ? Number(r.failed) : 0), 0);
console.log('  ' + '─'.repeat(60));
console.log(`  ${String(rows.length).padStart(2)} suites` +
  `${''.padEnd(17)}${String(totalPassed).padStart(6)}   ${String(totalFailed).padStart(6)}   ` +
  `${anyFailed ? ' FAIL ' : '  ok  '}   ${((Date.now() - t0) / 1000).toFixed(1)}s`);

process.exit(anyFailed ? 1 : 0);

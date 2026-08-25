// The third-party static-analysis engines, and the merge that keeps the scan
// list countable.
//
//   node scripts/verify-scan-engines.mjs
//
// Asked for as "I want the scans from every static engine". The built-in rules
// were the only ones running, so a client asking "what does axe say" got our
// answer to a different question. axe-core and IBM Equal Access now run in the
// page beside them.
//
// The merge is the part worth testing hardest. All three flag a missing lang
// attribute and call it html-has-lang, html_lang_exists and lang-missing —
// three rows for one fault, and a list that cannot be counted is a list nobody
// can act on. Merging wrongly is the more expensive mistake though: two real
// faults folded into one row means the survivor hides the other, so these
// checks pin the not-merging direction just as hard.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const PANEL = read('panel.js');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// panel.js touches `document` at the top level, so the merge is lifted out by
// brace-matching — the pattern every suite here uses.
function lift(name) {
  const i = PANEL.indexOf(`function ${name}(`);
  if (i === -1) throw new Error(`${name} not found in panel.js`);
  let depth = 0;
  for (let k = PANEL.indexOf('{', i); k < PANEL.length; k++) {
    if (PANEL[k] === '{') depth++;
    else if (PANEL[k] === '}' && --depth === 0) return PANEL.slice(i, k + 1);
  }
  throw new Error(`unbalanced braces lifting ${name}`);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  PANEL.slice(PANEL.indexOf('const SCAN_CONCEPTS'), PANEL.indexOf('async function scanPageStatic')) +
  '\n' + lift('mergeScanFindings'), ctx);
const merge = (f) => vm.runInContext('mergeScanFindings', ctx)(f);

// ── The engines load and answer ────────────────────────────────────────────
console.log('\nthe engines run');
{
  const BAD = `<!doctype html><html><head><title></title></head><body>
    <img src="a.png"><a href="#"></a><input type="text"><button></button></body></html>`;
  const dom = new JSDOM(BAD, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  for (const f of ['vendor/axe.min.js', 'vendor/ace.js', 'scan-engines.js']) w.eval(read(f));

  const out = await w.__u1ScanEngines();
  check('both engines answer', out.ran.length === 2 && out.ran.includes('axe') && out.ran.includes('ibm'), out.ran.join(','));
  check('…and each returns findings', ['axe', 'ibm'].every((e) => out.findings.some((f) => f.engine === e)));

  // A finding the list cannot render is worse than no finding: it becomes a
  // blank row nobody can act on.
  const incomplete = out.findings.filter((f) => !f.ruleId || !f.severity || !f.issue);
  check('…every finding carries ruleId, severity and issue', incomplete.length === 0, `${incomplete.length} incomplete`);

  const sevs = new Set(out.findings.map((f) => f.severity));
  check('…with severities the list already sorts by',
    [...sevs].every((s) => ['Critical', 'High', 'Medium', 'Low'].includes(s)), [...sevs].join(','));

  // axe's "incomplete" results mean "a human must check", and mixing them into
  // a list of faults is how a scan starts crying wolf.
  check('axe is asked for violations only, not its needs-review results',
    /resultTypes: \['violations'\]/.test(read('scan-engines.js')));
  // IBM returns every PASS too — the bulk of its output.
  check('IBM passes are filtered out, not counted as findings',
    /if \(!level \|\| level === 'PASS'\) return;/.test(read('scan-engines.js')));
}

// ── The merge ──────────────────────────────────────────────────────────────
console.log('\nequivalent findings become one row');
{
  const f = (engine, ruleId, selector, extra = {}) =>
    ({ engine, ruleId, selector, severity: 'High', issue: `${engine} says`, ...extra });

  const lang = merge([
    f('u1', 'lang-missing', 'html', { issue: 'Missing page language', why: 'ours', fix: 'ours' }),
    f('axe', 'axe.html-has-lang', 'html'),
    f('ibm', 'ibm.html_lang_exists', 'html'),
  ]);
  check('three engines on one fault produce ONE row', lang.length === 1, `${lang.length} rows`);
  check('…listing all three', lang[0].engines.join(',') === 'u1,axe,ibm', lang[0].engines.join(','));
  check('…keeping the wording written for the reader', lang[0].issue === 'Missing page language');

  // The safe direction to be wrong in.
  const twoElements = merge([
    f('axe', 'axe.image-alt', 'img.a'),
    f('axe', 'axe.image-alt', 'img.b'),
  ]);
  check('the same rule on two elements stays two rows', twoElements.length === 2);

  const twoFaults = merge([
    f('axe', 'axe.image-alt', 'img.a'),
    f('axe', 'axe.color-contrast', 'img.a'),
  ]);
  check('two different faults on one element stay two rows', twoFaults.length === 2);

  const unknown = merge([
    f('axe', 'axe.some-new-rule', 'div'),
    f('ibm', 'ibm.some_other_rule', 'div'),
  ]);
  check('rules not in the table keep their own identity', unknown.length === 2);

  // Engines disagree about impact; quietly taking the milder verdict is how a
  // critical fault sorts to the bottom of the list.
  const sev = merge([
    f('ibm', 'ibm.html_lang_exists', 'html', { severity: 'Medium' }),
    f('axe', 'axe.html-has-lang', 'html', { severity: 'Critical' }),
  ]);
  check('the most severe verdict wins', sev[0].severity === 'Critical', sev[0].severity);

  const wcag = merge([
    f('ibm', 'ibm.html_lang_exists', 'html', { wcag: '' }),
    f('u1', 'lang-missing', 'html', { wcag: '3.1.1' }),
  ]);
  check('…and a WCAG reference is kept over none', wcag[0].wcag === '3.1.1');

  check('a lone finding still reports its engine', merge([f('axe', 'axe.x', 'p')])[0].engines.join(',') === 'axe');
}

// ── Wiring ─────────────────────────────────────────────────────────────────
console.log('\nwired into the scan, and honest about what ran');
{
  const build = read('scripts/build.mjs');
  for (const f of ['scan-engines.js', 'vendor/axe.min.js', 'vendor/ace.js']) {
    check(`${f} ships in the package`, build.includes(`'${f}'`));
  }
  // A CDN would fail on exactly the locked-down sites that most need scanning.
  check('the engines are vendored, not fetched at runtime',
    !/https?:\/\/[^'"]*(axe|ace)[^'"]*\.js/.test(read('scan-engines.js')));

  check('the panel runs them on a scan', /await runScanEngines\(tab\.id\)/.test(PANEL));
  check('…and merges all three sources together', /mergeScanFindings\(\[\.\.\.ours, \.\.\.theirs\]\)/.test(PANEL));
  check('…showing which engines flagged each row', /class="engine-chip engine-\$\{e\}"/.test(PANEL));

  // "No faults" from one engine and from three are different claims.
  check('an engine that could not run is stated, not hidden',
    /could not run on this page/.test(PANEL) && /scanEnginesRan\.length < 2/.test(PANEL));
  check('…and a clean page says which engines agreed it was clean',
    /No automatic faults found on this page \(\$\{ran\.join/.test(PANEL));
  // Our own rules know things a general engine cannot; losing them because a
  // 540KB bundle would not load on one page is a bad trade.
  check('a failed engine never takes the built-in rules down with it',
    /catch \(e\) \{[\s\S]{0,220}scan engines could not run[\s\S]{0,120}return \{ findings: \[\], ran: \[\]/.test(PANEL));
}

console.log(fail === 0
  ? `\n✅ scan engines: ${pass} checks passed.\n`
  : `\n❌ scan engines: ${fail} of ${pass + fail} failed.\n`);
process.exit(fail === 0 ? 0 : 1);

// The third-party static-analysis engine (axe-core), its translation into our
// words, and the merge that keeps the scan list countable.
//
//   node scripts/verify-scan-engines.mjs
//
// axe runs under the hood. What reaches the reader is never its message: every
// rule it can fire is translated in panel.js's AXE_RULES into the same plain
// title / why / fix a hand-written rule carries, and filed under a checklist
// question. The first check here is the one that matters most across versions:
// every rule in the vendored axe build has a translation or a written reason
// to be skipped. A rule missing from both would surface in axe's words under
// "Other findings" — exactly what was asked to go away.
//
// The merge is the part worth testing hardest. axe and our rules both flag a
// missing lang attribute and call it html-has-lang and lang-missing — two rows
// for one fault, and a list that cannot be counted is a list nobody can act
// on. Merging wrongly is the more expensive mistake though: two real faults
// folded into one row means the survivor hides the other, so these checks pin
// the not-merging direction just as hard.
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

// panel.js touches `document` at the top level, so the pieces are lifted out
// by slicing and brace-matching — the pattern every suite here uses.
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
function sliceConst(name) {
  const i = PANEL.indexOf(`const ${name} = `);
  if (i === -1) throw new Error(`${name} not found`);
  const end = PANEL.indexOf('\n};', i) !== -1 && PANEL.indexOf('\n};', i) < PANEL.indexOf('\n];', i) + (PANEL.indexOf('\n];', i) === -1 ? 1e9 : 0)
    ? PANEL.indexOf('\n};', i) + 3 : PANEL.indexOf('\n];', i) + 3;
  return PANEL.slice(i, end);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  sliceConst('SCAN_RULES') + '\n' +
  PANEL.slice(PANEL.indexOf('const SCAN_CONCEPTS'), PANEL.indexOf('async function scanPageStatic')) + '\n' +
  sliceConst('SCAN_CHECKS') + '\n' +
  sliceConst('STATIC_WHY_NOT') + '\n' +
  sliceConst('STATIC_FIXABLE') + '\n' +
  lift('mergeScanFindings'), ctx);
const g = (n) => vm.runInContext(n, ctx);
const merge = (f) => g('mergeScanFindings')(f);
const axeCatalog = g('axeCatalog');
const conceptOfRule = g('conceptOfRule');
const AXE_RULES = g('AXE_RULES'), AXE_SKIP = g('AXE_SKIP'), SCAN_RULES = g('SCAN_RULES');
const SCAN_CHECKS = g('SCAN_CHECKS'), SCAN_CONCEPTS = g('SCAN_CONCEPTS');
const STATIC_WHY_NOT = g('STATIC_WHY_NOT'), STATIC_FIXABLE = g('STATIC_FIXABLE');

// ── The engine loads and answers ───────────────────────────────────────────
console.log('\nthe engine runs');
let axeRuleIds = [];
{
  const BAD = `<!doctype html><html><head><title></title></head><body>
    <img src="a.png"><a href="#"></a><input type="text"><button></button>
    <h4>skip</h4><h4>skip2</h4></body></html>`;
  const dom = new JSDOM(BAD, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  for (const f of ['vendor/axe.min.js', 'scan-engines.js']) w.eval(read(f));
  axeRuleIds = w.axe.getRules().map((r) => r.ruleId);

  const out = await w.__u1ScanEngines();
  check('axe answers, and is the only engine', out.ran.length === 1 && out.ran[0] === 'axe', out.ran.join(','));
  check('…and returns findings', out.findings.length > 0 && out.findings.every((f) => f.engine === 'axe'));

  // A finding the list cannot render is worse than no finding: it becomes a
  // blank row nobody can act on.
  const incomplete = out.findings.filter((f) => !f.ruleId || !f.severity || !f.issue);
  check('…every finding carries ruleId, severity and issue', incomplete.length === 0, `${incomplete.length} incomplete`);
  check('…and the short selector + index our own rules use, plus axe\'s precise path',
    out.findings.every((f) => typeof f.selector === 'string' && typeof f.idx === 'number' && typeof f.target === 'string'));

  // Two <h4>s with the same short selector: the index tells them apart.
  const alts = out.findings.filter((f) => f.ruleId === 'axe.image-alt');
  check('an image finding names the element the way scanPageStatic would (`img`, index 0)',
    alts.length === 1 && alts[0].selector === 'img' && alts[0].idx === 0, JSON.stringify(alts.map((a) => [a.selector, a.idx])));

  const sevs = new Set(out.findings.map((f) => f.severity));
  check('…with severities the list already sorts by',
    [...sevs].every((s) => ['Critical', 'High', 'Medium', 'Low'].includes(s)), [...sevs].join(','));

  // axe's "incomplete" results mean "a human must check", and mixing them into
  // a list of faults is how a scan starts crying wolf.
  check('axe is asked for violations only, not its needs-review results',
    /resultTypes: \['violations'\]/.test(read('scan-engines.js')));
  check('IBM Equal Access is gone from the engine file, the build list and the scan',
    !/ace\.Checker|runIbm/.test(read('scan-engines.js')) && !/vendor\/ace\.js/.test(read('scripts/build.mjs')) &&
    !/vendor\/ace\.js/.test(PANEL) && !/'ibm'/.test(PANEL.slice(PANEL.indexOf('const SCAN_STEP_LABEL'), PANEL.indexOf('const SCAN_STEP_LABEL') + 400)));
}

// ── Every axe rule has our wording ─────────────────────────────────────────
console.log('\nevery axe rule reads in our words');
{
  const untranslated = axeRuleIds.filter((id) => !AXE_RULES[id] && !AXE_SKIP[id]);
  check(`every rule in axe ${axeRuleIds.length ? '' : '(none loaded!) '}has a translation or a written reason to be skipped`,
    axeRuleIds.length > 90 && untranslated.length === 0, untranslated.join(', '));
  const stale = Object.keys(AXE_RULES).concat(Object.keys(AXE_SKIP)).filter((id) => !axeRuleIds.includes(id));
  check('…and no translation names a rule this axe build does not have', stale.length === 0, stale.join(', '));

  const broken = Object.entries(AXE_RULES).filter(([, t]) => t.as ? !SCAN_RULES[t.as] : !(t.concept && t.title && t.why && t.fix && t.severity && t.category));
  check('each translation is either a real hand-written rule (`as`) or complete on its own', broken.length === 0, broken.map(([k]) => k).join(', '));

  const c = axeCatalog('axe.image-alt');
  check('a rule that IS one of ours takes its title, why, fix and rule id', c && c.ruleId === 'img-alt-missing' && c.title === SCAN_RULES['img-alt-missing'].title && c.concept === 'img-alt');
  const cc = axeCatalog('axe.color-contrast');
  check('a rule of its own carries a concept and our wording', cc && cc.concept === 'contrast' && /faint|contrast/i.test(cc.title) && !/Ensure/.test(cc.title));
  check('a skipped rule answers null, an unknown one undefined', axeCatalog('axe.frame-tested') === null && axeCatalog('axe.no-such-rule') === undefined);
  check('duplicate ids from axe become the same NOTE our rule is', axeCatalog('axe.duplicate-id-aria').note === true && axeCatalog('axe.duplicate-id-aria').severity === 'Low');

  // No wording anywhere in the catalogue is axe's "Ensure …" boilerplate.
  const ensure = Object.values(AXE_RULES).filter((t) => !t.as && /^Ensure\b/.test(t.title));
  check('no title is axe\'s "Ensure …" phrasing', ensure.length === 0);
}

// ── Every rule lands under a checklist question ────────────────────────────
console.log('\nevery rule has a question to answer');
{
  const concepts = new Set();
  for (const id of Object.keys(SCAN_RULES)) concepts.add(SCAN_CONCEPTS[id] || id);
  for (const id of axeRuleIds) { const c = axeCatalog('axe.' + id); if (c) concepts.add(c.concept); }
  const claimed = new Set(SCAN_CHECKS.flatMap((c) => c.rules));
  const orphans = [...concepts].filter((c) => !claimed.has(c));
  check('every concept a rule can produce is claimed by a checklist row (nothing falls to "Other findings")', orphans.length === 0, orphans.join(', '));
  const dangling = [...claimed].filter((c) => !concepts.has(c));
  check('…and no checklist row lists a concept nothing produces', dangling.length === 0, dangling.join(', '));
  check('there is a colour-contrast question, answered by the engine', SCAN_CHECKS.some((c) => c.id === 'contrast' && c.engine === 'axe' && c.rules.includes('contrast')));
  check('conceptOfRule agrees for ours and for axe', conceptOfRule('heading-skip') === 'heading-order' && conceptOfRule('axe.heading-order') === 'heading-order' && conceptOfRule('axe.definition-list') === 'list-structure' && conceptOfRule('list-stray-br') === 'list-structure');

  // Every rule that is not bulk-fixable says why, so a row never falls silent.
  const silent = Object.keys(SCAN_RULES).filter((id) => !STATIC_FIXABLE[id] && !STATIC_WHY_NOT[id]);
  check('every hand-written rule either offers a bulk fix or says why not', silent.length === 0, silent.join(', '));
}

// ── The merge ──────────────────────────────────────────────────────────────
console.log('\nequivalent findings become one row');
{
  const f = (engine, ruleId, selector, extra = {}) =>
    ({ engine, ruleId, selector, severity: 'High', issue: `${engine} says`, ...extra });

  const lang = merge([
    f('u1', 'lang-missing', '', { issue: 'Missing page language', why: 'ours', fix: 'ours' }),
    f('axe', 'axe.html-has-lang', ''),
  ]);
  check('two engines on one fault produce ONE row', lang.length === 1, `${lang.length} rows`);
  check('…listing both', lang[0].engines.join(',') === 'u1,axe', lang[0].engines.join(','));
  check('…keeping the wording written for the reader', lang[0].issue === 'Missing page language');

  // The safe direction to be wrong in.
  const twoElements = merge([
    f('axe', 'axe.image-alt', 'img', { idx: 0 }),
    f('axe', 'axe.image-alt', 'img', { idx: 1 }),
  ]);
  check('the same rule on two elements with the same short selector stays two rows (index)', twoElements.length === 2);

  const sameElement = merge([
    f('u1', 'heading-skip', 'h4', { idx: 2, detail: 'H2 → H4' }),
    f('axe', 'axe.heading-order', 'h4', { idx: 2, detail: '<h4 style="">…</h4>' }),
  ]);
  check('ours and axe on the SAME heading fold into one row even though their details differ', sameElement.length === 1 && sameElement[0].ruleId === 'heading-skip');

  const twoFaults = merge([
    f('axe', 'axe.image-alt', 'img', { idx: 0 }),
    f('axe', 'axe.color-contrast', 'img', { idx: 0 }),
  ]);
  check('two different faults on one element stay two rows', twoFaults.length === 2);

  const unknown = merge([
    f('axe', 'axe.some-new-rule', 'div'),
    f('u1', 'some_other_rule', 'div'),
  ]);
  check('rules not in the table keep their own identity', unknown.length === 2);

  // Engines disagree about impact; quietly taking the milder verdict is how a
  // critical fault sorts to the bottom of the list.
  const sev = merge([
    f('u1', 'lang-missing', '', { severity: 'Medium' }),
    f('axe', 'axe.html-has-lang', '', { severity: 'Critical' }),
  ]);
  check('the most severe verdict wins the merged row', sev[0].severity === 'Critical', sev[0].severity);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

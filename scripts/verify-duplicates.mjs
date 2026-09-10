// One container, one mapping.
//
//   node scripts/verify-duplicates.mjs
//
// molinahealthcare.com had two listbox mappings on `#dd-country_child>ul`:
// fix #3 with trigger `#dd-country` (the original <select>, parked by
// msDropDown in a zero-height overflow:hidden holder — unreachable) and fix
// #12 with trigger `#dd-country_titleText` (what a person presses). mappingKey
// keeps both apart on purpose, for dialogs. For a listbox that meant Apply All
// ran the broken one first, U1 marked the list handled, and the good one was a
// no-op. These checks pin the rule that folds them and the choice it makes.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSrc = readFileSync(join(ROOT, 'panel.js'), 'utf8');

function lift(kind, name) {
  const needle = `${kind} ${name}`;
  const a = panelSrc.indexOf(needle + (kind === 'const' ? ' =' : '('));
  if (a < 0) throw new Error(`could not find ${needle}`);
  // The body brace, not a destructured parameter's — `({ editingKey = null })`
  // would otherwise close the "function" after its argument list.
  let i = panelSrc.indexOf(kind === 'const' ? '{' : ') {', a), depth = 0;
  if (kind !== 'const') i += 2;
  for (; i < panelSrc.length; i++) {
    const c = panelSrc[i];
    if (c === '{') depth++;
    else if (c === '}') { if (--depth === 0) { i++; break; } }
    else if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      for (i++; i < panelSrc.length; i++) {
        if (panelSrc[i] === '\\') { i++; continue; }
        if (panelSrc[i] === quote) break;
      }
    } else if (c === '/' && panelSrc[i + 1] === '/') { i = panelSrc.indexOf('\n', i); }
    else if (c === '/' && panelSrc[i + 1] === '*') { i = panelSrc.indexOf('*/', i) + 1; }
  }
  return panelSrc.slice(a, i) + (kind === 'const' ? ';' : '');
}

const ctx = vm.createContext({});
vm.runInContext(
  [lift('function', 'mappingKey'), lift('function', 'containerKey'),
   lift('function', 'pickContainerSurvivor'), lift('function', 'describeCollapse')].join('\n') +
  '\nthis.mappingKey = mappingKey; this.containerKey = containerKey; ' +
  'this.pickContainerSurvivor = pickContainerSurvivor; this.describeCollapse = describeCollapse;', ctx);
const { mappingKey, containerKey, pickContainerSurvivor, describeCollapse } = ctx;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
  if (!ok) failed++;
};

// The molina pair, as stored.
const bad  = { type: 'listbox', primary: '#dd-country_child>ul', firstArg: '#dd-country',           capturedAt: 1788439663250, fixNo: 3,  id: 'm-b8a218d4' };
const good = { type: 'listbox', primary: '#dd-country_child>ul', firstArg: '#dd-country_titleText', capturedAt: 1788439766436, fixNo: 12, id: 'm-dcf12206' };

check('mappingKey still tells the two apart (dialogs rely on it)', mappingKey(bad) !== mappingKey(good));
check('containerKey says they are the same mapping', containerKey(bad) === containerKey(good) && containerKey(bad) === 'listbox::#dd-country_child>ul');
check('a dialog has no containerKey — several triggers may open one dialog',
  containerKey({ type: 'dialog', primary: '#m', firstArg: '#open' }) === null);
check('a legacy string mapping has no containerKey', containerKey('u1.fix.link("#x")') === null);

const measured = { '#dd-country': false, '#dd-country_titleText': true };
check('the reachable trigger survives, whatever the order',
  pickContainerSurvivor([bad, good], measured) === good && pickContainerSurvivor([good, bad], measured) === good);
check('the reachable trigger survives even when it is the OLDER one',
  pickContainerSurvivor([{ ...bad, capturedAt: 9e12 }, good], measured) === good);
check('unmeasured (no page to ask): the newest wins',
  pickContainerSurvivor([bad, good], null) === good && pickContainerSurvivor([{ ...bad, capturedAt: 9e12 }, good], null).capturedAt === 9e12);
check('measured-true beats unmeasured beats measured-false',
  pickContainerSurvivor([bad, good], { '#dd-country': true }) === bad &&
  pickContainerSurvivor([bad, good], { '#dd-country_titleText': false }) === bad);

const said = describeCollapse([{ kept: good, dropped: [bad], usable: measured }]);
check('the notice names the kept trigger and why the other went',
  /Kept #dd-country_titleText \(reachable\)/.test(said) && /dropped #dd-country \(not reachable on this page\)/.test(said), said);

// Wiring, asserted on the source: the rule is only worth anything if the one
// save path and the list loader actually use it.
const save = lift('async function', 'saveMappingEntry');
check('saveMappingEntry folds a same-container twin into the existing row', /containerKey\(template\)/.test(save) && /pickContainerSurvivor\(/.test(save));
check('saveMappingEntry refuses or repairs an unreachable listbox trigger',
  /triggersUsableOnPage\(\[template\.firstArg\]\)/.test(save) && /nobody can reach it/.test(save) && /listboxShape/.test(save));
check('saveMappingEntry checks the trigger BEFORE it looks for a twin (so a repaired trigger can match the good row)',
  save.indexOf('triggersUsableOnPage([template.firstArg])') < save.indexOf('containerKey(template)'));
const load = lift('async function', 'loadMappingsList');
check('loadMappingsList heals stored duplicates before rendering',
  /collapseContainerDuplicates\(list, key\)/.test(load) && load.indexOf('collapseContainerDuplicates') < load.indexOf('renderElemScanSaved(list)'));
const collapse = lift('async function', 'collapseContainerDuplicates');
check('a dropped duplicate gets the same bookkeeping as a deliberate delete',
  /rememberSelfApplied\(goneKeys\)/.test(collapse) && /forgetDeclinedFixes\(goneKeys\)/.test(collapse));
const usableFn = lift('async function', 'triggersUsableOnPage');
check('reachability looks through clipping ancestors, not just the element\'s own box',
  /overflow/.test(usableFn) && /parentElement/.test(usableFn));

console.log(failed ? `\n❌ ${failed} check(s) failed` : '\n✅ verify-duplicates passed');
process.exit(failed ? 1 : 0);

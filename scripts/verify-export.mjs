// The files a customer's page loads — u1-patch.js, u1-fixes.js,
// u1-monitoring.js — built by the panel's REAL export (export-harness.mjs) from
// a Molina-shaped mapping set (fixtures/export/molina-sample.json).
//
//   node scripts/verify-export.mjs
//
// What it holds the export to (2026-10-11, "the files the client embeds are
// too heavy" — and "the client must still be able to change things in the
// fixes when an element changes or breaks"):
//   - the patch and the engines ship MINIFIED, and the minified patch still
//     parses as one script;
//   - u1-fixes.js writes the accessible-name code ONCE, with one observer,
//     and each name is one readable line — and those lines name elements
//     exactly as the old per-mapping code did (run side by side in jsdom);
//   - every mapping keeps its own readable block: a /* ---- m-id ---- */
//     header and its selectors spelled out, so it can be found and edited;
//   - the menu focus region reaches a site with a menu (it never shipped
//     before: its name has a hyphen the old pattern could not match);
//   - the monitoring hook still logs the exact line the monitor parses;
//   - a size budget, so the weight does not creep back.
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { loadExportBuilder } from './export-harness.mjs';
import { minifyRegions } from './minify-regions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

// The minified regions, written where the harness reads them — exactly what
// scripts/build.mjs puts in the package.
const minDir = mkdtempSync(join(tmpdir(), 'u1-min-'));
for (const [file, prefix, keep] of [['u1-patch.js', 'u1-patch', []], ['grid-nav.js', 'u1-engine', []], ['urs-compat.js', 'u1-engine', ['jquery']]]) {
  const { regions, failed } = await minifyRegions(readFileSync(join(ROOT, file), 'utf8'), prefix, { keep });
  check(`${file}: every region minifies`, failed.length === 0, failed.join('; '));
  writeFileSync(join(minDir, file.replace(/\.js$/, '.min.json')), JSON.stringify(regions));
}

const fixture = JSON.parse(readFileSync(join(ROOT, 'fixtures/export/molina-sample.json'), 'utf8'));
const { buildDeployableCode, get } = loadExportBuilder({ fromDir: minDir });
const built = await buildDeployableCode(fixture.mappings, fixture.site);

console.log('\nsizes');
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log(`  u1-patch.js ${kb(built.patch)} · u1-fixes.js ${kb(built.fixes)} · u1-monitoring.js ${kb(built.monitoring)}`);
// Budgets for this fixture, with headroom. The un-minified export was 94.5 /
// 36.2 / 4.0 KB on it.
check('u1-patch.js within 70 KB', Buffer.byteLength(built.patch) < 70 * 1024, kb(built.patch));
check('u1-fixes.js within 16 KB', Buffer.byteLength(built.fixes) < 16 * 1024, kb(built.fixes));
check('u1-monitoring.js within 3.5 KB', Buffer.byteLength(built.monitoring) < 3.5 * 1024, kb(built.monitoring));

console.log('\nevery file is one valid script');
for (const [name, code] of Object.entries(built)) {
  let err = '';
  try { new vm.Script(code); } catch (e) { err = e.message; }
  check(`u1-${name}.js parses`, !err, err);
}

console.log('\nthe patch');
check('ships minified (no indented source lines)', !/\n {4}\S/.test(built.patch.split('\n').slice(3).join('\n')));
check('the menu focus region ships with a menu mapping', /focusOpensSubmenu/.test(built.patch));
const noMenu = await buildDeployableCode(fixture.mappings.filter((m) => m.type !== 'menu'), fixture.site);
check('…and not without one', noMenu.patch.length < built.patch.length - 2000);

console.log('\nu1-fixes.js stays editable');
const blocks = fixture.mappings.filter((m) => m.id);
check('every mapping has its own /* ---- id ---- */ block', blocks.every((m) => built.fixes.includes(`/* ---- ${m.id} — `)),
  blocks.filter((m) => !built.fixes.includes(`/* ---- ${m.id} — `)).map((m) => m.id).join(', '));
const menu = fixture.mappings.find((m) => m.type === 'menu' && m.config && m.config.selectors && m.config.selectors.submenus);
check('a component\'s selectors are spelled out one per line', !!menu && built.fixes.includes(`submenus: ${JSON.stringify(menu.config.selectors.submenus)}`));
check('a name is one readable line', /__u1Name\(\{ target: "\.content>div>p>a", middle: "about", heading: "\.item>h4" \}\);/.test(built.fixes));
check('a typed name keeps its words', built.fixes.includes('label: "Open live chat"'));

console.log('\nthe name code is written once');
const count = (re) => (built.fixes.match(re) || []).length;
check('one language table', count(/var ABOUT = /g) === 1, String(count(/var ABOUT = /g)));
check('one __u1Name runtime', count(/function __u1Name\(/g) === 1);
const names = fixture.mappings.filter((m) => m.custom === 'ariaLabel');
check('one call per name', count(/__u1Name\(\{/g) === names.length, `${count(/__u1Name\(\{/g)} vs ${names.length}`);

console.log('\nthe names come out the same as before');
// The old per-mapping script (buildAriaLabelCode) and the new one-line form,
// on the same page, must leave the same aria-label on every element.
const html = `<!doctype html><html lang="en"><body>
  <div class="item"><h4>Medicaid plans.</h4><div class="content"><div><p><a href="#a">Learn more</a></p></div></div></div>
  <div class="item"><h4>Medicare</h4><div class="content"><div><p><a href="#b">Read more</a></p></div></div></div>
  <div lang="es"><div class="item"><h4>Planes</h4><div class="content"><div><p><a href="#c">Más</a></p></div></div></div></div>
  <div class="content"><div><p><a href="#d">Orphan</a></p></div></div>
  <a class="chat-btn" href="#chat">💬</a></body></html>`;
const buildAriaLabelCode = get('buildAriaLabelCode');
const runtime = get('ARIA_NAME_RUNTIME');
const ariaNameCall = get('ariaNameCall');
const sample = [
  { primary: '.content>div>p>a', config: { middleText: 'about', headingSelector: '.item>h4' } },
  { primary: '.chat-btn', config: { label: 'Open live chat' } },
];
const labels = (code) => {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  dom.window.eval(code);
  return [...dom.window.document.querySelectorAll('a')].map((a) => a.getAttribute('aria-label'));
};
const before = labels(sample.map((m) => buildAriaLabelCode(m.primary, m.config.middleText || '', m.config.headingSelector || '', m.config.label || '')).join('\n'));
const after = labels(runtime + '\n' + sample.map((m) => ariaNameCall(m)).join('\n'));
check('identical aria-labels', JSON.stringify(before) === JSON.stringify(after), `${JSON.stringify(before)} vs ${JSON.stringify(after)}`);
check('…and they are the expected names', after[0] === 'Learn more about Medicaid plans' && after[2] === 'Más sobre Planes' && after[3] === null && after[4] === 'Open live chat', JSON.stringify(after));

console.log('\nthe monitoring hook');
check('logs the line the monitor parses', built.monitoring.includes(`'U1-VALIDATION-ERROR | domain=' + location.hostname + ' | type=' + c[1] + ' | id=' + c[0] + ' | field=' + c[2] + ' | selector=' + c[3] + ' | page=' + location.pathname`));
check('inert without ?u1qa=1', built.monitoring.includes(`get('u1qa') !== '1') return;`));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

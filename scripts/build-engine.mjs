// Emits dist/u1-keyboard-engines.js — the standalone, hostable build of the
// keyboard engines in grid-nav.js.
//
// Why a hosted file rather than inlined source: every client site that uses a
// custom engine was pasting the engine into its own pages. That is 5–26KB of
// duplicated code per site, and — worse — a bug fix in the engine could only
// reach a site by someone re-pasting it there. One hosted file turns the
// client's paste into a single <script src> line and makes fixes central.
//
// Ships ALL THREE engines: a hosted file is shared across clients, so it cannot
// be narrowed to one site's needs, and one cached request beats three files.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const { version } = JSON.parse(read('package.json'));

// Same rule the inlined export follows: the delivered file must read as
// ordinary accessibility code, with no notes about how the authoring tool
// works. Strings and regex literals are respected so code is never corrupted.
function stripComments(src) {
  let out = '', i = 0;
  const n = src.length;
  let inS = null;
  let prev = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (inS) {
      out += c;
      if (c === '\\') { out += (src[i + 1] || ''); i += 2; continue; }
      if (c === inS) inS = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inS = c; out += c; i++; continue; }
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c;
    if (c.trim()) prev = c;
    i++;
  }
  return out;
}

const engine = stripComments(read('grid-nav.js'))
  .split('\n')
  .filter((l) => l.trim())          // blank lines left behind by the comments
  .join('\n');

const banner =
  `/*! U1 keyboard engines ${version} — accessible grid/datepicker, keyboard-operable\n` +
  ` *  elements, and tab strips. Applies ARIA roles, names, states, roving tabindex\n` +
  ` *  and arrow-key navigation, and re-applies after framework re-renders.\n` +
  ` *  Standalone: needs neither the U1 library nor the U1 Studio extension. */\n`;

const out = `${banner}(function () {\n${engine}\n})();\n`;

mkdirSync(join(ROOT, 'dist'), { recursive: true });
const target = join(ROOT, 'dist', 'u1-keyboard-engines.js');
writeFileSync(target, out);

const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log(`\nBuilt dist/u1-keyboard-engines.js  (${kb(out.length)})`);
console.log(`  from grid-nav.js (${kb(read('grid-nav.js').length)} with comments)`);
console.log('\n  Host it, then point the guide at it. The client pastes one line:');
console.log('    <script src="https://<your-host>/u1-keyboard-engines.js"></script>\n');

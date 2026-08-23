// The visual guard in panel.js's apply path.
//
//   node scripts/verify-visual-guard.mjs
//
// "אסור ששום תיקון ישנה את העיצוב של האתר" — no fix may change how the site
// looks — is the hard rule on this product, and until now it was enforced by
// reading code. That failed twice: images disappeared on tamam.co.il, and
// reading the engine could not say which fix did it, because it depends on
// the live page. A fix that hides something throws nothing and reports
// success, so the only thing that can catch it is measuring the page around
// each call. These checks pin that measurement's behaviour, including the
// cases where it must stay QUIET — a guard that cries wolf gets ignored, and
// then it is worth nothing on the day it is right.
import { JSDOM } from 'jsdom';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'panel.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// Same brace-matching lift the other suites use: panel.js touches `document`
// at the top level and cannot be imported.
function lift(name) {
  const i = SRC.indexOf(`const ${name} = `);
  if (i === -1) throw new Error(`${name} not found in panel.js`);
  let depth = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}' && --depth === 0) return SRC.slice(i, k + 1) + ';';
  }
  throw new Error(`unbalanced braces lifting ${name}`);
}

const dom = new JSDOM('<!doctype html><body></body>');
const { window } = dom;
// jsdom without runScripts hands back Node's own Function, so the lifted code
// compiles in this realm and sees none of the window globals it uses. Pass
// them in explicitly rather than turning on script execution for four
// pure-ish helpers.
const api = new Function('VIS_CAP', 'document', 'getComputedStyle',
  ['visualSnap', 'describeEl', 'isImagey', 'visualLosses'].map(lift).join('\n') +
  '; return { visualSnap, describeEl, isImagey, visualLosses };')
  .call(window, 4000, window.document, window.getComputedStyle.bind(window));

const el = (html) => { window.document.body.innerHTML = html; return window.document.body.firstElementChild; };
const box = (w, h, boxed = true) => ({ w, h, boxed });

// ── What counts as a loss ───────────────────────────────────────────────────
{
  const n = el('<img src="/a/hero.png">');
  const was = new Map([[n, box(300, 200)]]);

  check('display:none is a loss',        api.visualLosses(was, new Map([[n, box(0, 0, false)]])).length === 1);
  check('zero height is a loss',         api.visualLosses(was, new Map([[n, box(300, 0)]])).length === 1);
  check('zero width is a loss',          api.visualLosses(was, new Map([[n, box(0, 200)]])).length === 1);
  check('unchanged is not a loss',       api.visualLosses(was, new Map([[n, box(300, 200)]])).length === 0);

  // A hidden separator span can nudge a neighbour a pixel. Reporting that
  // would bury a real disappearance under noise, so resizes are not losses.
  check('a resize is NOT reported',      api.visualLosses(was, new Map([[n, box(280, 190)]])).length === 0);

  // Something already invisible before the fix is not this fix's doing.
  const hidden = new Map([[n, box(0, 0, false)]]);
  check('already-hidden stays quiet',    api.visualLosses(hidden, new Map([[n, box(0, 0, false)]])).length === 0);

  // A fix that REVEALS something must never be reported as harm.
  check('newly revealed is not a loss',  api.visualLosses(hidden, new Map([[n, box(300, 200)]])).length === 0);

  // An element gone from the DOM has no "after" entry. U1 does not delete
  // nodes; a framework re-render during the wait does, and blaming the fix
  // for that would be a false accusation.
  check('dropped from the map is skipped', api.visualLosses(was, new Map()).length === 0);
}

// ── Naming what vanished, so the message is actionable ──────────────────────
{
  check('an image is named by its file', api.describeEl(el('<img src="/wp/uploads/hero-2x.png">')) === '<img hero-2x.png>');
  check('…falling back to data-src',     api.describeEl(el('<img data-src="/lazy/slide.jpg">')) === '<img slide.jpg>');
  check('…and to a bare tag',            api.describeEl(el('<img>')) === '<img>');
  check('an id wins for a plain element', api.describeEl(el('<div id="hero"></div>')) === 'div#hero');
  check('classes are capped at two',     api.describeEl(el('<div class="a b c d"></div>')) === 'div.a.b');
}

// ── Which losses are called out as images ───────────────────────────────────
{
  check('<img> is imagey',   api.isImagey(el('<img src="x.png">')) === true);
  check('<video> is imagey', api.isImagey(el('<video></video>')) === true);
  check('a bare div is not', api.isImagey(el('<div></div>')) === false);
  // Elementor slides carry their picture as a CSS background, which is exactly
  // the case that started this.
  const bg = el('<div style="background-image:url(/s/slide1.jpg)"></div>');
  check('a background-image div is imagey', api.isImagey(bg) === true);
}

// ── It is wired into the apply path, not merely defined ─────────────────────
{
  const before = SRC.indexOf('const vBefore = visualSnap();');
  const call   = SRC.indexOf('raw.fix[it.type](sel, it.config);');
  const after  = SRC.indexOf('visualLosses(vBefore, visualSnap())');
  const waited = SRC.indexOf('await waitForChange(before, roots, 4000)');
  check('a snapshot is taken before the fix call', before !== -1 && before < call);
  // U1 decorates asynchronously. Sampling straight after the call shows a
  // clean page every time — the whole check would silently never fire.
  check('…and compared only after waitForChange', after !== -1 && after > waited);

  check('a violation is reported as an error line', /HID \$\{?/.test(SRC) || SRC.includes('HID ${vanished.length}'));
  check('…tells the reader the rule it broke',
        SRC.includes('A fix must never change what the site looks like'));
  check('…and is collected on its own channel, not as a duplicate detail',
        SRC.includes('hidContent.push({') && !SRC.includes("status: 'hid-content'"));
  check('…leads the headline',
        SRC.includes("CHANGED THE PAGE'S APPEARANCE"));
  check('…and forces the report to error styling even when everything applied',
        /\(hidContent\.length \|\| failed \|\| noEffect/.test(SRC));
  check('the result carries it back to the caller',
        /return \{ ok: true, applied, failed, noEffect, errs, details, hidContent,/.test(SRC));
}

// ── Language and direction come from the page, not from a constant ─────────
//
// The Config form defaulted to English/LTR from the markup, so any site whose
// Config tab nobody opened was preset with language:'en', direction:'ltr'.
// tamam.co.il — Hebrew, RTL — was, and it is not cosmetic: the engine's
// getDirectionByLanguage() calls Utils.isRtl(getLang()) and multiplies its
// step by -1 for RTL. With 'en' on a Hebrew page every arrow-key move through
// a carousel, menu or tab strip goes the wrong way, while the fix reports
// success.
{
  const HTML = readFileSync(join(ROOT, 'panel.html'), 'utf8');

  check('the panel can read the page\'s own lang/dir', /async function pageLangDir\(\)/.test(SRC));
  check('…falling back through body and computed style, not just <html dir>',
        /document\.body\?\.getAttribute\('dir'\)/.test(SRC) && /getComputedStyle\(h\)\.direction/.test(SRC));
  check('…and it seeds the form only when nothing is saved',
        /if \(!cfg\) \{[\s\S]{0,400}await pageLangDir\(\)/.test(SRC));
  // Selecting a language the <select> does not offer leaves the value empty,
  // which is worse than the wrong default it replaced.
  check('…only for a language the picker actually offers',
        /\$langSelect\.options\].some\(o => o\.value === site\.lang\)/.test(SRC));

  // A saved config is the specialist's setting. Say it is wrong; do not
  // silently rewrite stored data.
  check('a saved config that contradicts the page is flagged, not overwritten',
        SRC.includes("getElementById('langMismatch')") &&
        !/if \(site\.dir[\s\S]{0,120}U1Store\.set/.test(SRC));
  check('…in a box the panel actually has', /id="langMismatch"/.test(HTML));
  check('…naming the real consequence, not just the mismatch',
        SRC.includes('steps ') && SRC.includes('backwards while still reporting the fix as applied'));
}

// ── The reports can be saved as PDF ────────────────────────────────────────
//
// They already carried an @media print block and no way to reach it — the only
// route was the browser's own menu, which nobody hunts for on a page that
// looks like an app. Chrome's print dialog writes PDF natively, so a button
// calling window.print() is the whole feature. The two ways it can be dead on
// arrival are what these checks are for.
{
  const GEN  = readFileSync(join(ROOT, 'report-gen.js'), 'utf8');
  const VIEW = readFileSync(join(ROOT, 'report-view.js'), 'utf8');

  check('all three reports carry the button', (GEN.match(/\$\{reportPdfButton\(/g) || []).length === 3);
  check('…and the print stylesheet',          (GEN.match(/\$\{REPORT_PRINT_CSS\}/g) || []).length === 3);

  // MV3's script-src 'self' drops inline handlers silently: the button would
  // render, look right, and do nothing.
  check('no inline onclick — MV3 would silently drop it', !/onclick=/.test(GEN));
  check('…so report.html binds it from an external file',
        /\[data-print\]/.test(VIEW) && /window\.print\(\)/.test(VIEW));
  // Each report is ALSO downloaded as a standalone .html with no
  // report-view.js beside it; on disk there is no extension CSP to stop an
  // inline script, so the same button works there too.
  check('…and the standalone download carries its own inline fallback',
        (GEN.match(/\$\{REPORT_PDF_SCRIPT\}/g) || []).length === 3);

  // Print drops background colours by default, and this report IS its colour
  // coding — the type badges would come out as white boxes.
  check('backgrounds survive printing', /print-color-adjust: exact/.test(GEN));
  check('the button itself never prints', /\.pdf-btn \{ display: none !important; \}/.test(GEN));
  // A fix split from its own screenshot is what makes a close-out report
  // useless as a deliverable.
  check('cards are not split across pages',
        /\.issue, \.element, \.fix, tr \{ break-inside: avoid/.test(GEN));
  check('…nor are screenshots', /img \{ break-inside: avoid; page-break-inside: avoid;/.test(GEN));

  // section.page holds every fix on one page of the site and is routinely
  // taller than A4. Asking not to break inside it cannot be honoured, and the
  // engine's answer is to push the whole block to the next sheet — which left
  // page 1 of the PDF holding nothing but the title.
  // Tested against the rules alone: the comment explaining WHY section.page is
  // absent naturally contains the words, and matched the check itself.
  const printRules = GEN.slice(GEN.indexOf('@media print')).replace(/\/\*[\s\S]*?\*\//g, '');
  check('…but a whole page-section is NOT, or sheet 1 comes out blank',
        !/section\.page[^{}]*\{[^}]*break-inside/.test(printRules));
  check('a per-page heading never trails its sheet', /\.page-head \{ break-after: avoid; \}/.test(GEN));
  // Same trap one level up: the report head is followed by a section taller
  // than the sheet, so break-after there split the title from its own summary.
  check('…while the report head is held together, not glued to what follows',
        /\.report-head \{ break-inside: avoid; \}/.test(GEN) &&
        !/\.report-head \{ break-after/.test(GEN));

  // Chrome paints its date/title/chrome-extension:// URL into the page margin.
  // No property disables them; with no margin there is nowhere to paint.
  // ── The saved file is recognisable as a PDF ──────────────────────────────
  //
  // Chrome names the PDF after document.title and will NOT append ".pdf" to a
  // name that already looks like it has an extension — and every hostname ends
  // in one. A report titled "… - tamam.co.il" saved as a file with no
  // extension at all, which macOS refused to open: "There is no application
  // set to open the document". The PDF was fine; nothing could tell it was one.
  check('the print filename has every dot stripped out',
        /replace\(\/\[\^A-Za-z0-9-\]\+\/g, '-'\)/.test(GEN));
  check('…carried on the button, the one channel both print paths can read',
        /data-pdf-name="/.test(GEN) && /getAttribute\("data-pdf-name"\)/.test(GEN));
  // Two worlds: the inline script is blocked in the extension page and is the
  // one that runs in the standalone download; report-view.js is the reverse.
  // Both have to rename, or one of the two routes still saves an extensionless
  // file.
  check('…renamed by the extension page too, not only the downloaded copy',
        /beforeprint/.test(VIEW) && /data-pdf-name/.test(VIEW));
  check('…and the readable title is put back afterwards',
        /addEventListener\('afterprint'/.test(VIEW) && /afterprint/.test(GEN));

  check('Chrome\'s own header and footer are squeezed out', /@page \{ margin: 0; \}/.test(GEN));
  check('…and the whitespace comes back on the body instead',
        /body \{ padding: 12mm !important; \}/.test(GEN));
}

// ── A missing screenshot leaves no trace ───────────────────────────────────
//
// The report drew a dashed box reading "No screenshot captured. Open the
// element's page and use the 📷 button on the mapping." That is an instruction
// to US, printed in the CLIENT'S document, and it implies something is missing
// from a fix that actually shipped. The fix and its selectors are the
// substance; a picture that does not exist is simply not shown.
{
  const GEN = readFileSync(join(ROOT, 'report-gen.js'), 'utf8');

  check('no placeholder text survives in any report', !/No screenshot/.test(GEN));
  check('…and the dead .no-shot styling went with it', !/\.no-shot \{/.test(GEN));

  // Leaving the 320px track empty is its own bug: a blank gutter beside the
  // text reads as a picture that failed to load.
  const collapse = (GEN.match(/\.(element|issue)\.no-shot-el \{ grid-template-columns: 1fr; \}/g) || []).length;
  check('…and all three reports collapse the empty screenshot column', collapse === 3, String(collapse));
  check('…flagged on the block itself so the CSS can find it',
        (GEN.match(/\$\{shot \? '' : ' no-shot-el'\}/g) || []).length === 3);
  // The shot markup must be conditional, not a variable that is always emitted.
  check('…and the image element is emitted only when there is an image',
        !/\$\{img\}/.test(GEN) && /\$\{shot \? `<div class="element-shot">/.test(GEN));
}

// ── The report prints a URL a person can read ──────────────────────────────
//
// A Hebrew path arrives percent-encoded from tab.url, so a report written FOR
// the client, ABOUT their own site, printed two lines of %d7%a7%d7%99… where
// the page's name should be.
{
  const GEN = readFileSync(join(ROOT, 'report-gen.js'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(GEN.slice(GEN.indexOf('function reportCleanUrl'),
                            GEN.indexOf('function reportSafeImg')), ctx);
  const disp = vm.runInContext('reportDisplayUrl', ctx);
  const clean = vm.runInContext('reportCleanUrl', ctx);

  const heb = 'https://www.tamam.co.il/%d7%a7%d7%99%d7%99%d7%98%d7%a8%d7%99%d7%a0%d7%92';
  check('a Hebrew path is shown in Hebrew', disp(heb) === 'https://www.tamam.co.il/קייטרינג');
  // The href must keep the canonical form: it is the spelling guaranteed to
  // resolve, and the one the report groups pages by.
  check('…while the canonical form is left encoded for the href',
        clean(heb) === heb && /reportEsc\(page\.url\)/.test(GEN));
  check('…and the link TEXT is the readable one',
        /<a href="\$\{reportEsc\(page\.url\)\}">\$\{reportEsc\(reportDisplayUrl\(page\.url\)\)\}/.test(GEN));
  // Decoding is per segment: one stray '%' throws, and a single bad segment
  // must not cost the whole URL.
  check('an invalid escape does not destroy the rest of the URL',
        disp('https://a.com/%d7%a7/bad%zz') === 'https://a.com/ק/bad%zz');
  check('a plain ASCII URL is unchanged', disp('https://a.com/about') === 'https://a.com/about');
  check('an empty URL stays empty', disp('') === '');
  check('all three reports use it', (GEN.match(/reportDisplayUrl\(/g) || []).length === 4);
}

console.log(fail === 0
  ? `\n✅ visual guard: ${pass} checks passed.\n`
  : `\n❌ visual guard: ${fail} of ${pass + fail} failed.\n`);
process.exit(fail === 0 ? 0 : 1);

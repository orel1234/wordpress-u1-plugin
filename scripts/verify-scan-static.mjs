// The hand-written page checks in panel.js's scanPageStatic, run over real DOM.
//
//   node scripts/verify-scan-static.mjs
//
// Three of these were wrong on a real client page and nothing said so:
//
//   · The carousel pause check looked INSIDE the carousel for an aria-label
//     saying "pause". Molina's control is <a title="Pause" class="pausebtn">
//     Play/Pause</a> in a sibling <div> before it — so the page was told it
//     had no pause button while the button sat on screen. A client who checks
//     and finds the button stops trusting the list.
//   · Findings carried a short selector (`a.externalLink`) and highlighted its
//     FIRST match, so "I can't find this link" was the tool pointing at the
//     wrong link. Every finding now carries the index of its element.
//   · Duplicate ids were failed as if someone were blocked by them. They are
//     a note for the developers unless a label or ARIA reference points at
//     the id; they are listed, in full, and weigh nothing.
//
// JSDOM has no layout, so every element is given a box and an opacity; the
// logic under test is what the checks READ, not geometry.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PANEL = readFileSync(join(ROOT, 'panel.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, x = '') => c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`));

// The check function is the inline `func: () => { … }` handed to
// chrome.scripting.executeScript inside scanPageStatic. Lift its body.
function liftPageFunc() {
  const start = PANEL.indexOf('async function scanPageStatic');
  const f = PANEL.indexOf('func: () => {', start);
  let depth = 0;
  for (let k = PANEL.indexOf('{', f); k < PANEL.length; k++) {
    if (PANEL[k] === '{') depth++;
    else if (PANEL[k] === '}' && --depth === 0) return PANEL.slice(PANEL.indexOf('{', f), k + 1);
  }
  throw new Error('unbalanced');
}
const BODY = liftPageFunc();

function scan(html, { head = '' } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Members – Test</title>${head}</head><body>${html}</body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
  const w = dom.window;
  w.HTMLElement.prototype.getBoundingClientRect = function () { return { width: 100, height: 30, left: 0, top: 0, right: 100, bottom: 30 }; };
  Object.defineProperty(w.HTMLElement.prototype, 'offsetParent', { get() { return this.ownerDocument.body; }, configurable: true });
  const gcs = w.getComputedStyle.bind(w);
  w.getComputedStyle = (el) => { const s = gcs(el); if (!s.opacity) { try { s.opacity = '1'; } catch (e) {} } return s; };
  if (!w.CSS) w.CSS = {};
  if (!w.CSS.escape) w.CSS.escape = (s) => String(s).replace(/([^\w-])/g, '\\$1');
  const ctx = vm.createContext(w);
  return vm.runInContext(`(() => ${BODY})()`, ctx);
}
const hits = (res, rule) => res.results.filter((r) => r.ruleId === rule);

// ── The carousel pause control, wherever the site put it ───────────────────
console.log('\ncarousel pause control');
{
  // Molina's banner, verbatim in shape: the control is a sibling BEFORE the carousel.
  const molina = `
    <div class="container homeBanner">
      <div class="contrlbutton"><a title="Pause" class="pausebtn" href="javascript:void(0)">Play/Pause</a></div>
      <div id="carouselExampleIndicators" class="carousel slide" data-ride="carousel" role="group" aria-roledescription="carousel">
        <ol class="carousel-indicators"><li class="active"></li><li></li></ol>
        <div class="carousel-inner">
          <div class="carousel-item active">one</div>
          <div class="carousel-item" aria-hidden="true">two</div>
        </div>
      </div>
    </div>`;
  check('Molina: a Play/Pause link beside the carousel counts as its pause control', hits(scan(molina), 'carousel-nopause').length === 0);

  const none = molina.replace(/<div class="contrlbutton">.*?<\/div>/s, '');
  check('…and without it, the same carousel is flagged once', hits(scan(none), 'carousel-nopause').length === 1);

  const bootstrapOnly = `
    <div class="carousel slide" data-ride="carousel">
      <div class="carousel-inner"><div class="carousel-item active">one</div><div class="carousel-item">two</div></div>
    </div>`;
  check('a Bootstrap carousel whose markup says it auto-advances (data-ride) is checked even before U1 decorates it',
    hits(scan(bootstrapOnly), 'carousel-nopause').length === 1);

  const withButton = bootstrapOnly.replace('<div class="carousel-inner">', '<button class="carousel-pause" aria-pressed="false"><img src="p.svg" alt="Pause slideshow"></button><div class="carousel-inner">');
  check('an icon button whose alt says "Pause" is found', hits(scan(withButton), 'carousel-nopause').length === 0);

  const staticOne = `<div class="carousel slide"><div class="carousel-inner"><div class="carousel-item active">one</div></div></div>`;
  check('a carousel that does not move is not asked for a pause control', hits(scan(staticOne), 'carousel-nopause').length === 0);

  const farAway = `<header><button aria-label="Pause video">x</button></header><main><section><div>` + none + `</div></section></main>`;
  check('a pause button elsewhere on the page (more than three levels up) does not count', hits(scan(farAway), 'carousel-nopause').length === 1);
}

// ── Each finding names ITS element ─────────────────────────────────────────
console.log('\nfindings carry the index of their element');
{
  const res = scan(`
    <p><a class="externalLink" href="https://a.test/">Partner site</a></p>
    <p>Need help? Find more resources <a class="externalLink" href="https://988lifeline.org/">here</a>.</p>`);
  const vague = hits(res, 'link-generic');
  check('the vague link is found', vague.length === 1 && vague[0].text === 'here');
  check('…with the short selector AND the index of the one that is vague (the second external link)',
    vague[0].selector === 'a.externalLink' && vague[0].idx === 1, JSON.stringify(vague[0]));

  const h = scan(`<h1>T</h1><h2>A</h2><h4>Get Active!</h4><h3>B</h3><h2>C</h2><h4>Careers</h4>`);
  const skips = hits(h, 'heading-skip');
  check('two skipped headings that share the selector `h4` are told apart by index',
    skips.length === 2 && skips[0].idx === 0 && skips[1].idx === 1 && skips[1].text === 'Careers', JSON.stringify(skips));
}

// ── Duplicate ids: a note, listed in full ──────────────────────────────────
console.log('\nduplicate ids are a note');
{
  const res = scan(`
    <script id="_cls_detector"></script><script id="_cls_detector"></script>
    <label for="q">Search</label><input id="q"><div id="q"></div>
    <div id="fine"></div>`);
  const d = hits(res, 'dup-ids');
  check('duplicates on invisible elements (<script>) are listed too — the developers want the full list', d.some((r) => /_cls_detector/.test(r.text)));
  check('…and the one a <label for> points at says so, because that one CAN break something',
    d.some((r) => /id="q"/.test(r.text) && /label\/ARIA reference/.test(r.text)) && !d.some((r) => /_cls_detector/.test(r.text) && /reference/.test(r.text)));
  const rules = PANEL.slice(PANEL.indexOf("'dup-ids':"), PANEL.indexOf("'dup-ids':") + 400);
  check('the rule is a Low-severity NOTE in our words, not a failure', /severity: 'Low', note: true/.test(rules) && /note for the developers/i.test(rules));
}

// ── The checks the removed engine used to make ─────────────────────────────
console.log('\nstatic checks IBM used to make, in our words');
{
  const res = scan(`
    <img src="/x/Career_HealthNews.jpg" alt="Career_HealthNews">
    <img src="/x/personal-care-kit.jpg" alt="personal care kit">
    <img src="/x/photo.png" alt="banner.png">
    <img src="/x/AZ-Boulder.png" alt="brush fire">
    <img src="/x/spacer.gif" alt="">`);
  const fn = hits(res, 'img-alt-filename');
  check('a bare file-name token, or an alt ending in .png, is flagged; real words ("personal care kit", "brush fire") are not',
    fn.length === 2 && !fn.some((r) => /brush fire|personal care kit/.test(r.text)), JSON.stringify(fn.map((r) => r.text)));

  const lab = scan(`<label for="nope">Email</label><input id="email" type="email" aria-label="Email">`);
  check('a <label for> pointing at no field is flagged', hits(lab, 'label-for-broken').length === 1);

  const nw = scan(`<a href="https://a.test" target="_blank">Careers</a><a href="https://b.test" target="_blank">Blog (opens in a new tab)</a><a href="https://c.test" target="_blank" title="Opens in new window">News</a>`);
  check('a new-tab link that does not say so is flagged; ones that say it (text or title) are not', hits(nw, 'link-newwindow').length === 1 && hits(nw, 'link-newwindow')[0].text === 'Careers');

  const media = scan(`<video src="a.mp4"></video><video src="bg.mp4" muted loop autoplay></video><audio src="x.mp3" controls></audio>`);
  check('a video with no controls is flagged; a muted looping background video and a controlled audio are not', hits(media, 'media-nocontrols').length === 1);

  const lm = scan(`<div role="form"><label for="s" hidden>Search</label><input id="s"></div><form aria-label="Newsletter"></form><div role="region" aria-labelledby="h"><h2 id="h">Offers</h2></div>`);
  check('ONE unnamed role="form" is not a fault — it is simply not a landmark; nothing is flagged', hits(lm, 'landmark-noname').length === 0);
  const lm2 = scan(`<div role="form"><input id="a" placeholder="Search"></div><div role="form"><input id="b" placeholder="Email"></div>`);
  check('two or more unnamed forms are a NOTE each ("form, form" in the landmark list), not failures', hits(lm2, 'landmark-noname').length === 2 && /one of 2 without a name/.test(hits(lm2, 'landmark-noname')[0].text));
  const lm3 = scan(`<div role="form" u1st-avoid-change-detection="true"><input id="a" placeholder="Search"></div><div role="form" u1st-avoid-change-detection="true"><input id="b" placeholder="Email"></div>`);
  check('forms that ARE U1 mappings (the engine\'s marker) are never counted — the mapping is the treatment', hits(lm3, 'landmark-noname').length === 0);
  const srch2 = scan(`<div class="input-group" role="form" u1st-avoid-change-detection="true"><label for="q" hidden>Search</label><input id="searchInputText"></div>`);
  check('a mapped form around the search field counts as the search landmark', srch2.inventory.landmarks.search === 1 && srch2.inventory.landmarks.searchUnmarked === 0);

  // Lists: a stray <br> is one fixable finding; real junk is another; a list
  // carrying roles is judged by them and passes.
  const lists = scan(`
    <ul class="a"><li>1</li><br><li>2</li><br></ul>
    <ul class="b"><li>1</li><div>not an item</div></ul>
    <ul class="c" role="menu"><li role="none"><a role="menuitem" href="#">x</a></li><div>junk</div></ul>
    <ul class="d"><li>1</li><span role="listitem">2</span></ul>`);
  const br = hits(lists, 'list-stray-br'), junk = hits(lists, 'list-structure');
  check('a <br> between items is its own finding (fixable: aria-hidden), not "bad list"', br.length === 1 && br[0].selector === 'ul.a');
  check('real non-item content is the structure finding', junk.length === 1 && junk[0].selector === 'ul.b');
  check('a list with roles (a menu on <ul>, role=listitem children) passes', !br.concat(junk).some((r) => /ul\.(c|d)/.test(r.selector)));
  check('axe\'s own list rules are skipped in favour of ours', /'list': 'ours instead/.test(PANEL) && /'listitem': 'ours instead/.test(PANEL));

  const alt2 = scan(`<img src="/x/ViewPersonalHealthRecord.png" alt="View Personal Health Record"><img src="/x/mp_payprem_mem_t.jpg" alt="mp_payprem_mem_t">`);
  check('an alt made of real words that happens to match the file name is NOT flagged; a bare token is',
    hits(alt2, 'img-alt-filename').length === 1 && /mp_payprem/.test(hits(alt2, 'img-alt-filename')[0].text));

  const lvl = scan(`<h1>T</h1><h2>A</h2><h4 aria-level="3">Get Active!</h4>`);
  check('a real <h4> re-levelled with aria-level=3 reads as H3 — no skip, and the outline says H3',
    hits(lvl, 'heading-skip').length === 0 && lvl.inventory.headings.some((h) => h.text === 'Get Active!' && h.level === 3));

  const srch = scan(`<form><input type="text" id="searchInputText" placeholder="Search"></form>`);
  check('a search field without role=search is counted as "found, not marked"', srch.inventory.landmarks.search === 0 && srch.inventory.landmarks.searchUnmarked === 1);
  const named = scan(`<div class="input-group" role="form" aria-label="Search" u1st-avoid-change-detection="true"><label for="q" hidden>Search</label><input id="searchInputText"></div>`);
  check('a NAMED form around the search field (what a U1 form mapping leaves) counts as the search landmark', named.inventory.landmarks.search === 1 && named.inventory.landmarks.searchUnmarked === 0 && hits(named, 'landmark-noname').length === 0);
  check('the focus-outline CSS check is gone from the static scan', !/focus-not-visible/.test(PANEL));

  const weak = scan(``);
  check('a real title is not flagged as weak', hits(weak, 'title-weak').length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

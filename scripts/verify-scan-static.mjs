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

  // molinahealthcare.com: `.Search_short_search__N2BwJ` is a <button
  // aria-label="Open search panel">, not an input — the real field is not in
  // the DOM until it is pressed. Both counts above look for an <input> and
  // always read 0 for this shape; the chip needs a third signal that says so
  // rather than reading as "no search on this page at all".
  const srchBtn = scan(`<button aria-label="Open search panel"><span>Search</span></button>`);
  check('a collapsed search TRIGGER (no input in the DOM yet) is recorded as searchTrigger, not silently 0',
    srchBtn.inventory.landmarks.search === 0 && srchBtn.inventory.landmarks.searchUnmarked === 0 &&
    srchBtn.inventory.landmarks.searchTrigger === true);
  const noSearch = scan(`<button aria-label="Log in">Log in</button>`);
  check('an unrelated button does not get mistaken for a search trigger', noSearch.inventory.landmarks.searchTrigger === false);
  check('the chip tells the two silent-zero cases apart',
    /search: opens on click/.test(PANEL) && /searchTrigger/.test(PANEL));

  // molinahealthcare.com: U1's own "Skip to navigation" / "Skip to footer"
  // passed the whole skip-link question while the <header> had no link.
  const u1Only = scan(`
    <a class="u1st-skip-link" href="#n">Skip to navigation</a><a class="u1st-skip-link" href="#f">Skip to footer</a>
    <header>top</header><nav id="n">menu</nav><div class="content">x</div><footer id="f">end</footer>`);
  const lmMiss = hits(u1Only, 'skip-link-landmark').map((r) => r.detail);
  check('with only U1\'s nav and footer links, the header is reported as having no skip link',
    lmMiss.includes('header') && !lmMiss.includes('navigation') && !lmMiss.includes('footer'), lmMiss.join(','));
  const covered = scan(`
    <a class="u1st-skip-link" href="#h">Skip to header</a><a class="u1st-skip-link" href="#n">Skip to navigation</a>
    <header id="h">top</header><nav id="n"><ul id="m"><li>a</li></ul></nav>`);
  check('a skip link to the header (or into a landmark) covers it', hits(covered, 'skip-link-landmark').length === 0);
  const wrapper = scan(`
    <a class="u1st-skip-link" href="#all">Skip to content</a><div id="all"><header>top</header><main>x</main></div>`);
  check('a link to a wrapper around everything reaches no landmark in particular',
    hits(wrapper, 'skip-link-landmark').map((r) => r.detail).sort().join(',') === 'header,main content');
  const inArticle = scan(`<a class="u1st-skip-link" href="#m">Skip to main content</a><main id="m"><article><header>card</header></article></main>`);
  check('a <header> inside an article is not the page header — no link asked for it', hits(inArticle, 'skip-link-landmark').length === 0);
  // The real molina shape: the <nav> sits INSIDE the <header>. U1's "Skip to
  // navigation" lands inside the header — that is a link to the nav, not to
  // the header, and must not count as one.
  const nested = scan(`
    <a class="u1st-skip-link" href="#n">Skip to navigation</a><a class="u1st-skip-link" href="#f">Skip to footer</a>
    <header><nav id="n">menu</nav></header><div>x</div><footer id="f">end</footer>`);
  check('a nav inside the header: the nav link does not count as a skip link to the header',
    hits(nested, 'skip-link-landmark').map((r) => r.detail).includes('header'));
  const reach = Object.fromEntries(nested.inventory.skipReach.map((k) => [k.key, k.present ? (k.reached ? 'green' : 'red') : 'absent']));
  check('the chips say it per kind: header red, nav and footer green, main absent',
    reach.header === 'red' && reach.nav === 'green' && reach.footer === 'green' && reach.main === 'absent', JSON.stringify(reach));
  check('the Skip link row renders one chip per kind, green ✓ or red ✗',
    /Skip links to/.test(PANEL) && /\$\{k\.key\} ✓/.test(PANEL) && /\$\{k\.key\} ✗/.test(PANEL));
  const btn = scan(`<a class="u1st-skip-link" href="#m">Skip to main content</a><main id="m">x</main><button aria-label="Open search panel">Search</button>`);
  check('a search that only opens on click asks for a skip link to its button',
    hits(btn, 'skip-link-landmark').map((r) => r.detail).join(',') === 'search');
  check('the focus-outline CSS check is gone from the static scan', !/focus-not-visible/.test(PANEL));

  const weak = scan(``);
  check('a real title is not flagged as weak', hits(weak, 'title-weak').length === 0);
}

// ── The checks PowerMapper (SortSite) makes that we did not ────────────────
// Same rules, same fixtures shape, in monitoring.scanPage.ts and the Auto
// Checker's catalog-checks.ts.
console.log('\nchecks SortSite makes, in our words');
{
  const same = scan(`
    <nav><a href="/products/medicaid">Products</a><a href="/about">About us</a></nav>
    <footer><a href="/products/medicare">Products</a><a href="https://www.x.test/about/">About us</a><a href="/a">Read more</a><a href="/b">Read more</a></footer>`);
  const st = hits(same, 'link-same-text');
  check('"Products" to two pages is flagged once, on the second', st.length === 1 && st[0].text === 'Products', JSON.stringify(st));
  check('…while "About us" twice to the same page (www / trailing slash aside) is not, and vague "Read more" is left to its own rule',
    !st.some((r) => /about|read more/i.test(r.text)));

  // scan() always writes <html lang="en">; these need the page's own attributes.
  const scanHtml = (htmlAttrs, body) => {
    const dom = new JSDOM(`<!doctype html><html ${htmlAttrs}><head><title>Members – Test</title></head><body>${body}</body></html>`,
      { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.test/' });
    const w = dom.window;
    w.HTMLElement.prototype.getBoundingClientRect = function () { return { width: 100, height: 30, left: 0, top: 0, right: 100, bottom: 30 }; };
    Object.defineProperty(w.HTMLElement.prototype, 'offsetParent', { get() { return this.ownerDocument.body; }, configurable: true });
    if (!w.CSS) w.CSS = {};
    if (!w.CSS.escape) w.CSS.escape = (s) => String(s).replace(/([^\w-])/g, '\\$1');
    return vm.runInContext(`(() => ${BODY})()`, vm.createContext(w));
  };
  const parts = scanHtml('lang="he" dir="rtl"', `
    <p>ברוכים הבאים לאתר שלנו, כאן תמצאו את כל המידע</p>
    <p>Welcome to our website, here you will find everything</p>
    <p lang="en">This paragraph is marked as English correctly</p>
    <p>Molina Healthcare</p>`);
  const lp = hits(parts, 'lang-of-parts');
  check('an English paragraph inside a Hebrew page is flagged; a marked one and a two-word brand name are not',
    lp.length === 1 && /^Welcome/.test(lp[0].text), JSON.stringify(lp.map((r) => r.text)));
  check('…and a page that is mostly Hebrew is not called mis-declared', hits(parts, 'lang-page-mismatch').length === 0);

  const wrongPage = scanHtml('lang="en"', [1, 2, 3, 4, 5, 6].map((i) => `<p>זוהי פסקה מספר ${i} שכתובה כולה בעברית רגילה</p>`).join(''));
  check('a Hebrew page declared lang="en" is ONE page-level finding, not a row per paragraph',
    hits(wrongPage, 'lang-page-mismatch').length === 1 && hits(wrongPage, 'lang-of-parts').length === 0);

  check('a Hebrew page with no dir="rtl" is flagged', hits(scanHtml('lang="he"', '<p>שלום</p>'), 'dir-missing').length === 1);
  check('…with dir="rtl" it is not', hits(scanHtml('lang="he" dir="rtl"', '<p>שלום</p>'), 'dir-missing').length === 0);
  check('…an English page marked dir="rtl" is', hits(scanHtml('lang="en" dir="rtl"', '<p>Hi</p>'), 'dir-missing').length === 1);
  check('…a page in a script we do not classify is not judged', hits(scanHtml('lang="ja"', '<p>こんにちは</p>'), 'dir-missing').length === 0);

  const fields = scan(`
    <div style="background-color: rgb(255, 255, 255)">
      <input id="faint" aria-label="Email" style="background-color: rgb(255, 255, 255); border: 1px solid rgb(204, 204, 204)">
      <input id="ok" aria-label="Name" style="background-color: rgb(255, 255, 255); border: 1px solid rgb(118, 118, 118)">
      <input id="filled" aria-label="Phone" style="background-color: rgb(80, 80, 80); border: 0px none rgb(0, 0, 0)">
      <input id="shadow" aria-label="Zip" style="background-color: rgb(255, 255, 255); border: 1px solid rgb(230, 230, 230); box-shadow: 0 0 0 1px rgb(0, 0, 0)">
    </div>`);
  const cc = hits(fields, 'control-contrast');
  check('a #ccc border on white is flagged (1.6:1); #767676 (4.5:1), a dark fill, and a shadow-drawn edge are not',
    cc.length === 1 && cc[0].selector === '#faint' && /1\.6:1/.test(cc[0].detail), JSON.stringify(cc));
  const rules = PANEL.slice(PANEL.indexOf("'control-contrast':"), PANEL.indexOf("'control-contrast':") + 200);
  check('…and it is a NOTE, like faint text — a CSS change U1 does not make', /severity: 'Low', note: true/.test(rules));

  const moves = scan(`
    <select name="state" onchange="window.location = this.value"><option>NY</option></select>
    <select name="size" onchange="updatePrice(this)"><option>S</option></select>
    <input name="q" aria-label="Search" onblur="this.form.submit()">`);
  const cm = hits(moves, 'change-moves-page');
  check('a <select> that navigates on change and a field that submits on blur are flagged; one that only updates a price is not',
    cm.length === 2 && cm.some((r) => /^onchange/.test(r.detail)) && cm.some((r) => /^onblur/.test(r.detail)), JSON.stringify(cm));

  for (const id of ['link-same-text', 'lang-of-parts', 'lang-page-mismatch', 'dir-missing', 'control-contrast', 'change-moves-page'])
    check(`${id} has our wording and answers a checklist question`, PANEL.includes(`'${id}':`) && new RegExp(`rules: \\[[^\\]]*'${id}'`).test(PANEL));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

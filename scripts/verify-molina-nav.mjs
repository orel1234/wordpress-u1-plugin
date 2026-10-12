// molinahealthcare.com's 2026 header, pinned as a fixture.
//
// The site was rebuilt (Next.js, CSS-module class names) some time before
// 2026-10-04. The hand-built mapping set — `.mainNav`, `.signin-dropdown`,
// `.clicker` — points at markup that no longer exists, and the readers, run
// against the new header, got every menu wrong:
//
//   — menuShape answered null for BOTH bars. The top bar's four buttons share
//     no class (three carry `…_menu_items__hash`, "More Sites" carries
//     `main_menu_item`), and the only answer is the container's own tag
//     path, `<bar>>li>button`, which commonSelectorFor never tried. The mega
//     bar's rows wrap EVERY link in a <ul> of its own, so the first nested
//     list a row holds has one child and the row was read as plain — the
//     DIV-panel fallback never ran because a list HAD been found.
//   — menuIsReallyListbox retyped the whole mega bar as a listbox whose
//     "list" was the first row and whose "trigger" was the second row's
//     button. The nav veto counts pressables OUTSIDE the element, and
//     pointed at the bar itself everything is inside it.
//   — the language selector's list is rendered client-side, so the climb to
//     the parent found the font-size buttons beside it and called THEM the
//     list.
//   — every selector carried a build hash (`.Megamenu_menu__GnzK6`), rated
//     "Medium — fine, as long as the class is stable", and it is not: the
//     hash changes on the next deploy.
//
// The markup below is copied from https://www.molinahealthcare.com/ (fetched
// 2026-10-04), trimmed to the header. Class names are verbatim, hash and all.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(join(ROOT, 'package.json'))('jsdom');
const INTEL = readFileSync(join(ROOT, 'selector-intel.js'), 'utf8');

const col = (title, links) => `<div class="Megamenu_mega_menu_column__SZTFx col">
  <div class="Megamenu_title_link__RCpTe"><span>${title}</span></div>
  ${links.map(([t, h]) => `<ul><li><a href="${h}" aria-label="${t}">${t}</a></li></ul>`).join('\n  ')}
</div>`;
const mega = (cls, label, slug, cols) => `<li class="Megamenu_menu_item__naE0U Megamenu_mega__5aka6 ${cls}">
  <button aria-label="${label}" type="button"><span>${label}</span></button>
  <div class="Megamenu_mega_menu_content__m8pFV transition duration-300 ease-in-out" style="transition:opacity 0.3s, transform 0.3s;transform:translateY(-10px);opacity:0;visibility:hidden">
    <div class="Megamenu_mega_menu_content_wrapper___zUB3 container">
      <div class="Megamenu_left_section__qilt0">
        <div class="Megamenu_left_section_title__oYhxQ">${label}</div>
        <div class="Megamenu_left_section_description__ea_fE">Molina Healthcare provides…</div>
        <a class="Button_btn__YB2Li Button_Secondary__cfMml undefined undefined" href="/${slug}" aria-label="${label}"><span class="Button_link_text__G3TI_">${label}</span></a>
      </div>
      <div class="Megamenu_middle_section__LBaWJ" style="width:75%">
        ${cols.join('\n        ')}
      </div>
    </div>
  </div>
</li>`;

const dom = new JSDOM(`<!doctype html><html><body><div id="__next">
<header id="healthcareHeader" class="HeaderHC_headerContainer__WhVzH ">
  <div class="HeaderHC_icon_section__HXIJ_ row">
    <div class="HeaderHC_right_container__Xfghy col-12">
      <div class="d-flex align-items-center">
        <a class="HeaderHC_helpText__I2tFB" href="/help" aria-label="Help">Help</a>
        <div class="FontSizeAdjustor_fontSizeAdjustor__GC2MM">
          <button class="FontSizeAdjustor_decreaseFont__DJSDx  FontSizeAdjustor_disabled__8Q_kN" aria-label="-">-</button>
          <span class="FontSizeAdjustor_fontText__eV7Z1">A<span>A</span></span>
          <button class="FontSizeAdjustor_increaseFont__mYodj " aria-label="+">+</button>
        </div>
        <div class="dropdown">
          <button class="dropdown-toggle LanguageSelector_LanguageSelectorBtn__Bi9jH " aria-expanded="false" aria-haspopup="true" aria-label="Language" type="button"><span>Language</span><span class="LanguageSelector_selectedLang__sOg6D"></span></button>
        </div>
      </div>
    </div>
  </div>
  <div class="HeaderHC_top_section__cBflm row">
    <div class="HeaderHC_logo_container__ft07r col-4"><a class="undefined " href="/" aria-label="Help"><span class="HeaderHC_header-logo__5hyHY"></span></a></div>
    <div class="HeaderHC_menu_container__SKz96 col-6">
      <ul class="PrimaryNavigationMenu_menu_wrapper__6AN1E">
        <li class="main_menu_item"><button class="medicare PrimaryNavigationMenu_menu_items__W2yml " aria-label="Medicare" type="button">Medicare</button></li>
        <li class="main_menu_item"><button class="medicaid PrimaryNavigationMenu_menu_items__W2yml " aria-label="Medicaid" type="button">Medicaid</button></li>
        <li class="main_menu_item"><button class="ifp PrimaryNavigationMenu_menu_items__W2yml " aria-label="Individual &amp; Family" type="button">Individual &amp; Family</button></li>
        <li class="PrimaryNavigationMenu_menu_more___eoCC">
          <button class="main_menu_item undefined" aria-label="More Sites" type="button"><span>More Sites</span></button>
          <ul class=" undefined PrimaryNavigationMenu_hide__6YjlW">
            <li><button class="providers PrimaryNavigationMenu_menu_items__W2yml main_menu_item" aria-label="Providers" type="button">Providers</button></li>
            <li><button class="brokers-agents PrimaryNavigationMenu_menu_items__W2yml main_menu_item" aria-label="Brokers &amp; Agents" type="button">Brokers &amp; Agents</button></li>
            <li><button class="chip PrimaryNavigationMenu_menu_items__W2yml main_menu_item" aria-label="CHIP" type="button">CHIP</button></li>
            <li><button class="ep PrimaryNavigationMenu_menu_items__W2yml main_menu_item" aria-label="Essential Plan" type="button">Essential Plan</button></li>
          </ul>
        </li>
      </ul>
    </div>
    <div class="HeaderHC_right_container__Xfghy col-2">
      <div class="dropdown Login_dropdown__XO0X0">
        <div class="Login_loginWrapper__bXvle" aria-haspopup="true">
          <a class="Button_btn__YB2Li Button_PrimarySmall__b5tys undefined undefined  w-10" href="/home#" aria-label="Log In"><span class="Button_link_text__G3TI_">Log In</span></a>
        </div>
      </div>
    </div>
  </div>
</header>
<div>
  <div class="Megamenu_sub_menu_wrapper__A5oDR">
    <div class="Megamenu_desktop_max__nXZqn">
      <nav class="Megamenu_mega_menu__nX_VO container">
        <ul class="Megamenu_menu__GnzK6">
          ${mega('Insurance Plans', 'Insurance Plans', 'insurance-plans', [
            col('Medicare', [['Dual-Eligible Special Needs Plan (D-SNP)', '/medicare/plans-benefits'], ['Medicare Advantage', '/medicare/plans-benefits']]),
            col('Medicaid', [['Medicaid plans', '/medicaid'], ['Apply', '/medicaid/apply']]),
          ])}
          ${mega('member-resources', 'Member resources', 'member-resources', [
            col('Find care', [['Find a provider', 'https://molina.sapphirethreesixtyfive.com/'], ['Find a pharmacy', 'https://molina.sapphirethreesixtyfive.com/']]),
          ])}
          ${mega('knowledgecenter', 'Knowledge center', 'knowledge-center', [
            col('Learn', [['Health library', '/knowledge-center/health'], ['FAQ', '/knowledge-center/faq']]),
          ])}
          ${mega('About Molina', 'About Molina ', 'about', [
            col('Company', [['Who we are', '/about'], ['Careers', '/careers']]),
          ])}
        </ul>
      </nav>
    </div>
  </div>
</div>
</div></body></html>`, { url: 'https://www.molinahealthcare.com/' });

const w = dom.window;
new Function('globalThis',
  `const window = globalThis; const document = globalThis.document; ` +
  `const getComputedStyle = globalThis.getComputedStyle.bind(globalThis); ${INTEL}`)(w);
const S = w.__u1SelectorIntel;
const d = w.document;

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  ' + (extra || '')));
  ok ? pass++ : fail++;
};
const q = (sel) => { try { return Array.from(d.querySelectorAll(sel)); } catch (e) { return null; } };
const same = (sel, els) => { const got = q(sel); return !!got && got.length === els.length && els.every((e) => got.includes(e)); };
const HASH = /__[A-Za-z0-9_-]{5}(?![\w-])/;   // a CSS-module hash left inside a selector

const primary = d.querySelector('.PrimaryNavigationMenu_menu_wrapper__6AN1E');
const moreLi = d.querySelector('.PrimaryNavigationMenu_menu_more___eoCC');
const megaNav = d.querySelector('nav.Megamenu_mega_menu__nX_VO');
const megaUl = d.querySelector('.Megamenu_menu__GnzK6');

console.log('selectors on a CSS-module site carry no build hash');
{
  const s1 = S.robustSelector(primary), s2 = S.robustSelector(megaUl), s3 = S.robustSelector(moreLi);
  check('the top bar is named by the stable part of its class', !!s1 && !HASH.test(s1) && same(s1, [primary]), s1);
  check('…and so is the mega bar', !!s2 && !HASH.test(s2) && same(s2, [megaUl]), s2);
  check('…and the "More Sites" row, whose hash has no digit in it', !!s3 && !HASH.test(s3) && same(s3, [moreLi]), s3);
  check('every one of them is U1-valid', S.isU1Valid(s1) && S.isU1Valid(s2) && S.isU1Valid(s3));
  const g = S.selectorStrength('.Megamenu_menu__GnzK6');
  check('a raw hashed class is graded WEAK, and the reason says why',
    g.level === 'weak' && /hash|build|deploy/i.test(g.reasons.join(' ')), JSON.stringify(g));
  const g2 = S.selectorStrength(s2);
  check('the stable-prefix form is not graded weak', g2.level !== 'weak' && g2.level !== 'invalid', JSON.stringify(g2));
  const ul = S.robustSelector(d.querySelector('.PrimaryNavigationMenu_menu_more___eoCC>ul'));
  check('React\'s literal "undefined" is not a class name', !/undefined/.test(ul), ul);
}

console.log('\nthe top bar: Medicare · Medicaid · Individual & Family · More Sites ▾');
{
  const sh = S.menuShape(S.robustSelector(primary));
  const tops = Array.from(primary.querySelectorAll(':scope>li>button'));
  check('menuShape answers for the bar at all', !!sh, JSON.stringify(sh));
  check('items are the four top-level buttons — no shared class, so the bar\'s own tag path',
    !!sh && same(sh.items, tops), sh && sh.items);
  check('the one trigger is "More Sites"', !!sh && same(sh.triggers, [moreLi.querySelector(':scope>button')]), sh && sh.triggers);
  check('its submenu is the hidden <ul> beside it', !!sh && same(sh.submenus, [moreLi.querySelector(':scope>ul')]), sh && sh.submenus);
  check('nothing in the shape carries a build hash', !!sh && !Object.values(sh).some((v) => HASH.test(v)), JSON.stringify(sh));
}

console.log('\nthe mega bar: four buttons, each over a DIV panel of link columns');
{
  const sh = S.menuShape(S.robustSelector(megaUl));
  const tops = Array.from(megaUl.querySelectorAll(':scope>li>button'));
  const panels = Array.from(megaUl.querySelectorAll(':scope>li>div'));
  check('menuShape answers for the mega bar', !!sh, JSON.stringify(sh));
  check('items are the four top-level buttons', !!sh && same(sh.items, tops), sh && sh.items);
  check('all four are triggers', !!sh && same(sh.triggers, tops), sh && sh.triggers);
  check('the submenus are the four DIV panels, not the one-link <ul>s inside them',
    !!sh && same(sh.submenus, panels), sh && sh.submenus);
  check('nothing in the shape carries a build hash', !!sh && !Object.values(sh).some((v) => HASH.test(v)), JSON.stringify(sh));
  check('pointed at the <nav>, menuItemsRoot descends to the list',
    same(S.menuItemsRoot(S.robustSelector(megaNav)) || '', [megaUl]), S.menuItemsRoot(S.robustSelector(megaNav)));
}

console.log('\nR0 — trigger count decides: a bar of two or more is a MENU, never a listbox');
{
  for (const [name, el] of [['the mega bar', megaUl], ['the top bar', primary], ['the <nav> around the mega bar', megaNav]]) {
    const v = S.menuIsReallyListbox(S.robustSelector(el));
    check(`${name} is not retyped as a listbox`, v === null, JSON.stringify(v));
  }
  const v = S.menuIsReallyListbox(S.robustSelector(moreLi));
  check('"More Sites" is one of four top-level items — the bar\'s SUBMENU, not a lone listbox', v === null, JSON.stringify(v));
}

console.log('\nthe language selector: its list is rendered client-side and is not in the markup');
{
  const v = S.menuIsReallyListbox('.dropdown');
  check('no list → no listbox; the font-size buttons beside it are NOT the answer', v === null, JSON.stringify(v));
  const lb = S.listboxShape('.d-flex');
  check('…and read off the shared parent, the font-size pair is still not a listbox for the Language button',
    !lb || !/FontSizeAdjustor/.test(lb.listbox), JSON.stringify(lb));
}

console.log('\nthe header wrapper is not a listbox, and a glyph is not a name (2026-10-05)');
{
  // The build climbed from the language dropdown to its parent and read the
  // whole header: top section = listbox, its columns = options, the font-size
  // "−" button = trigger. A list is rows of one kind with one control each.
  for (const sel of ['[class*="HeaderHC_right_container__"]', '[class*="HeaderHC_top_section__"]', '[class*="HeaderHC_icon_section__"]']) {
    const v = S.listboxShape(sel);
    check(`${sel} is no listbox`, v === null, JSON.stringify(v));
  }
  const minus = d.querySelector('[class*="FontSizeAdjustor_decreaseFont__"]');
  const ms = S.robustSelector(minus);
  check('the font-size "−" button is not named by its one-character aria-label', !/aria-label="-"/.test(ms), ms);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

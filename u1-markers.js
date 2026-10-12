/*
 * u1 attribute markers → U1 Studio mappings.
 *
 * Sites integrated with the old u1 technique carry the work in their own
 * markup: `<ul u1-menu u1-menubar>`, `<a u1-item>`, `<div u1-accordion>`,
 * `<h3 u1-header>`, `<button u1-button>`… and the u1 library finds them by
 * itself (auto mode). This file reads those markers off the page in front of
 * the panel and turns every component instance into an ordinary Studio
 * mapping — the same types a specialist maps by hand, exported as
 * `window.u1.fix.<type>(…)` calls. No compatibility engine is involved.
 *
 * Marker families understood (normalised to the @u1/a11y names first):
 *   @u1/a11y          u1-x / data-u1-x            (boolean attributes)
 *   React hooks       data-u1-<type>="token …"    (value tokens)
 *   Angular           u1-a11y-<x>
 *   Vue directives    u1-<type>-<x> variants (u1-accordion-header, u1-tab-panel…)
 *   legacy vanilla    pre-0.20 names (u1-dialog root, u1-close-btn, u1-list…)
 *
 * Selectors are built from the markers themselves (they are the site's own,
 * maintained hooks), scoped to their root with `>` chains when a page has more
 * than one instance of a type — Studio/U1 refuse descendant spaces.
 *
 * scanInPage() is self-contained so the panel can hand it to
 * chrome.scripting.executeScript; it returns plain data.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.U1Markers = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function scanInPage() {
    // ── 1. normalise every element's markers to canonical a11y names ───────
    // React hooks: data-u1-<type>="tok tok"  → canonical names per type
    var REACT = {
      menu: { menu: 'menu', item: 'item', submenu: 'submenu', 'open-submenu': 'trigger', horizontal: 'horizontal', focus: 'open-by-focus', mouseover: 'open-by-mouseover' },
      accordion: { header: 'header', content: 'content' },
      tabs: { tab: 'tab', 'tab-panel': 'panel', 'tab-list': 'tabs-list' },
      dialog: { dialog: 'dialog', 'dialog-modal': 'dialog', trigger: 'dialog-trigger', 'close-btn': 'dialog-close-btn', heading: 'dialog-title', content: 'dialog-content' },
      checkbox: { checkbox: 'checkbox', label: 'label', exclude: 'hide', disabled: 'disabled' },
      radio: { 'radio-group': 'radio-group', 'radio-btn': 'radio-button' },
      table: { table: 'table', row: 'row', cell: 'cell', columnheader: 'col-header', rowheader: 'row-header' },
      grid: { row: 'row', cell: 'cell', 'col-header': 'col-header' },
      listbox: { listbox: 'list', trigger: 'trigger', options: 'option', label: 'label' },
      combobox: { combobox: 'combobox-input', textbox: 'textbox', listbox: 'listbox', option: 'option', label: 'label', 'empty-option': 'empty-option' },
      carousel: { container: 'carousel', label: 'label', slide: 'slide', prev: 'prev-btn', next: 'next-btn', picker: 'picker' },
      datepicker: { modal: 'modal', trigger: 'trigger', month: 'month-label', 'month-prev': 'month-prev-btn', 'month-next': 'month-next-btn', year: 'year-label', 'year-prev': 'year-prev-btn', 'year-next': 'year-next-btn', calendar: 'days-table', day: 'day', 'selected-day': 'selected-day', disable: 'disabled-day' },
      form: { form: 'form', label: 'label', required: 'required', err: 'error' },
      tooltip: { trigger: 'tooltip-trigger', tooltip: 'tooltip' },
      button: { button: 'button' }, link: { link: 'link' },
    };
    // A React root is the element carrying the hook; its token says what it is.
    var REACT_ROOT_TOKEN = { menu: 'menu', accordion: null, tabs: null, dialog: 'dialog-trigger', table: 'table', listbox: 'listbox', combobox: null, carousel: 'container', form: 'form', button: 'button', link: 'link' };
    // Angular u1-a11y-* and Vue/legacy spellings → canonical
    var ALIAS = {
      // angular
      'a11y-menu': 'menu', 'a11y-menu-item': 'item', 'a11y-submenu': 'submenu', 'a11y-open-submenu': 'trigger', 'a11y-horizontal': 'horizontal', 'a11y-focus': 'open-by-focus', 'a11y-mouseover': 'open-by-mouseover',
      'a11y-accordion': 'accordion', 'a11y-accordion-header': 'header', 'a11y-accordion-content': 'content', 'a11y-disabled': 'disabled',
      'a11y-dialog-trigger': 'dialog-trigger', 'a11y-dialog-modal': 'dialog', 'a11y-dialog-close-btn': 'dialog-close-btn', 'a11y-dialog-heading': 'dialog-title', 'a11y-dialog-content': 'dialog-content',
      'a11y-tabs': 'tabs', 'a11y-tab': 'tab', 'a11y-tab-panel': 'panel', 'a11y-tab-list': 'tabs-list',
      'a11y-carousel': 'carousel', 'a11y-carousel-slide': 'slide', 'a11y-carousel-previous-button': 'prev-btn', 'a11y-carousel-next-button': 'next-btn', 'a11y-carousel-slide-picker-button': 'picker',
      'a11y-root': 'listbox', 'a11y-listbox-root': 'listbox', 'a11y-listbox': 'list', 'a11y-listbox-trigger': 'trigger', 'a11y-listbox-options': 'option', 'a11y-listbox-label': 'label',
      'a11y-radio-group': 'radio-group', 'a11y-radio-btn': 'radio-button', 'a11y-row': 'row', 'a11y-cell': 'cell', 'a11y-col-header': 'col-header', 'a11y-row-header': 'row-header',
      'a11y-form-label': 'label', 'a11y-form-required': 'required', 'a11y-form-err-msg': 'error',
      // vue
      'accordion-header': 'header', 'accordion-content': 'content', 'tab-list': 'tabs-list', 'tab-panel': 'panel',
      'radio-btn': 'radio-button', 'table-row': 'row', 'table-cell': 'cell', 'table-col-header': 'col-header', 'table-row-header': 'row-header',
      'listbox-root': 'listbox', 'listbox-trigger': 'trigger', 'listbox-options': 'option', 'listbox-label': 'label',
      'combobox-listbox': 'listbox', 'combobox-label': 'label', 'combobox-wrapper': 'combobox',
      // legacy vanilla (pre 0.20.1)
      'close-btn': 'dialog-close-btn', 'content-dynamic': 'dialog-content-dynamic', 'datepicker-today': 'today',
    };
    var SKIP_ATTR = /^(u1-a11y-ref|data-u1-a11y-ref|data-u1-ref|u1-a11y-options|u1-a11y-manual)$/;

    var marks = new Map(); // el → { names: {canonical: {attr, value}} }
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!el.attributes || !el.attributes.length) continue;
      for (var j = 0; j < el.attributes.length; j++) {
        var at = el.attributes[j], n = at.name;
        if (n.indexOf('u1') === -1 || SKIP_ATTR.test(n)) continue;
        var m = /^(data-)?u1-(.+)$/.exec(n);
        if (!m) continue;
        var raw = m[2], val = at.value;
        var add = function (name, attrSel, v) {
          var rec = marks.get(el); if (!rec) { rec = {}; marks.set(el, rec); }
          if (!rec[name]) rec[name] = { sel: attrSel, value: v };
        };
        if (m[1] && REACT[raw] && val && !/^(true|false|\d+)$/.test(val)) {
          // React value tokens
          val.split(/\s+/).forEach(function (tok) {
            var canon = REACT[raw][tok]; if (!canon) return;
            var sel = '[' + n + '~="' + tok + '"]';
            if (REACT_ROOT_TOKEN[raw] === tok) add(raw === 'dialog' ? 'dialog-trigger' : raw === 'carousel' ? 'carousel' : raw, sel, '');
            add(canon, sel, '');
          });
          // (for accordion/tabs/combobox the root is the hook element itself,
          // whose attribute is empty — handled by the a11y branch below)
          continue;
        }
        var canon2 = ALIAS[raw] || raw;
        add(canon2, '[' + n + ']', val);
      }
    }
    // checkbox / radio checked-state attributes in other spellings
    marks.forEach(function (rec) {
      if (rec['checkbox-checked'] && !rec.checked) rec.checked = rec['checkbox-checked'];
      if (rec['radio-checked'] && !rec.checked) rec.checked = rec['radio-checked'];
      if (rec['checkbox-exclude'] && !rec.hide) rec.hide = rec['checkbox-exclude'];
    });

    var elsWith = function (name) { var out = []; marks.forEach(function (rec, e) { if (rec[name]) out.push(e); }); return out; };
    var has = function (e, name) { var r = marks.get(e); return !!(r && r[name]); };
    var attrSelOf = function (e, name) { return marks.get(e)[name].sel; };
    var valOf = function (e, name) { return marks.get(e)[name].value; };

    var EXPECTED = { modal: 1, trigger: 1, 'days-table': 1, day: 1, 'selected-day': 1, 'disabled-day': 1, 'month-label': 1, 'month-prev-btn': 1, 'month-next-btn': 1, 'year-label': 1, 'year-prev-btn': 1, 'year-next-btn': 1,
      listbox: 1, option: 1, textbox: 1, list: 1, submenu: 1, item: 1, 'dialog-close-btn': 1, 'dialog-title': 1, 'dialog-content': 1, slide: 1, panel: 1, tab: 1, header: 1, content: 1, error: 1, invalid: 1, success: 1, page: 1 };
    // ── 2. selectors ──────────────────────────────────────────────────────
    var cssId = function (id) { return (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/([^a-zA-Z0-9_-])/g, '\\$1'); };
    var okId = function (id) { return id && !/^u1st-/.test(id) && document.querySelectorAll('#' + cssId(id)).length === 1; };
    // Unique selector for one element: its id, else a > chain of tag:nth-child
    // up to the nearest ancestor with an id (or body). No spaces, U1-safe.
    var uniq = function (e) {
      if (okId(e.id)) return '#' + cssId(e.id);
      var steps = [];
      for (var n = e; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
        if (n !== e && okId(n.id)) { steps.unshift('#' + cssId(n.id)); return steps.join('>'); }
        var idx = 1; for (var s = n.previousElementSibling; s; s = s.previousElementSibling) idx++;
        steps.unshift(n.tagName.toLowerCase() + ':nth-child(' + idx + ')');
      }
      steps.unshift('body');
      return steps.join('>');
    };
    // The marker attribute selectors in use for a canonical name, de-duplicated
    var attrUnion = function (els, name) {
      var s = []; els.forEach(function (e) { var a = attrSelOf(e, name); if (s.indexOf(a) < 0) s.push(a); }); return s;
    };
    // Children of `rootEl` carrying `name`, as a selector. Plain marker
    // selector when no other root of the same type exists (resilient); else a
    // `rootSel>tag>…>[marker]` chain per distinct path (scoped, no spaces).
    // A child the page has not rendered yet (a datepicker's calendar, a
    // combobox's list, a submenu built on open) is not in the DOM at scan
    // time. Auto mode passes its marker selector anyway and the library waits
    // for it, so for @u1/a11y roots the same marker is written here, in the
    // root's own spelling. (Other families name children differently.)
    var a11yFamily = function (rootEl) {
      var rec = marks.get(rootEl); if (!rec) return '';
      for (var k in rec) { var m = /^\[(data-)?u1-[a-z-]+\]$/.exec(rec[k].sel); if (m) return m[1] ? 'data-u1-' : 'u1-'; }
      return '';
    };
    var childSel = function (rootEl, rootSel, name, shared, includeRoot) {
      var kids = []; marks.forEach(function (rec, e) { if (rec[name] && (rootEl.contains(e) && (includeRoot || e !== rootEl))) kids.push(e); });
      if (!kids.length) {
        var fam = a11yFamily(rootEl);
        if (!fam || !EXPECTED[name]) return '';
        var base = '[' + fam + name + ']';
        return shared ? rootSel + '>' + base + ',' + base : base; // not rendered yet: the library waits for it
      }
      if (!shared) return attrUnion(kids, name).join(',');
      var chains = [];
      kids.forEach(function (k) {
        if (k === rootEl) { var c0 = rootSel + attrSelOf(k, name); if (chains.indexOf(c0) < 0) chains.push(c0); return; }
        var steps = [attrSelOf(k, name)];
        for (var p = k.parentElement; p && p !== rootEl; p = p.parentElement) steps.unshift(p.tagName.toLowerCase());
        var c = rootSel + '>' + steps.join('>');
        if (chains.indexOf(c) < 0) chains.push(c);
      });
      return chains.join(',');
    };
    // root selector: the marker itself when the page has one root of the type
    var rootSelOf = function (rootEl, name, count) { return count === 1 ? attrSelOf(rootEl, name) : uniq(rootEl); };
    // a compound appended to a selector's last step (checked states on the root)
    var withAttr = function (sel, attr) { return sel.split(',').map(function (s) { return s + attr; }).join(','); };

    var refOf = function (e) { return e.getAttribute('u1-a11y-ref') || e.getAttribute('data-u1-a11y-ref') || e.getAttribute('data-u1-ref') || ''; };
    // u1-a11y-ref pairing: the same suffix auto mode adds ([u1-a11y-ref='v'])
    var refAttr = function (e) { return ['u1-a11y-ref', 'data-u1-a11y-ref', 'data-u1-ref'].filter(function (a) { return e.hasAttribute(a); })[0] || ''; };
    var refSuffix = function (e) { var a = refAttr(e); return a ? '[' + a + '="' + e.getAttribute(a) + '"]' : ''; };
    // A paired element's selector: marker + ref when it has one; the bare
    // marker when it is the only one of its kind; else a unique path.
    var pairSel = function (e, name) {
      if (refSuffix(e)) return attrSelOf(e, name) + refSuffix(e);
      return elsWith(name).length === 1 ? attrSelOf(e, name) : uniq(e);
    };

    // ── 3. component types ────────────────────────────────────────────────
    var out = [], notes = [];
    var push = function (type, primary, firstArg, selectors, extra, el, label) {
      var sel = {}; Object.keys(selectors).forEach(function (k) {
        var v = selectors[k];
        if (v && typeof v === 'object') { var sub = {}; Object.keys(v).forEach(function (kk) { if (v[kk]) sub[kk] = v[kk]; }); if (Object.keys(sub).length) sel[k] = sub; }
        else if (v) sel[k] = v;
      });
      var cfg = { selectors: sel }; Object.keys(extra || {}).forEach(function (k) { cfg[k] = extra[k]; });
      out.push({ type: type, custom: null, primary: primary, firstArg: firstArg || primary, config: cfg, label: label || '', text: ((el && el.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 60) });
    };
    var each = function (name, fn) {
      var roots = elsWith(name);
      roots.forEach(function (r) { fn(r, rootSelOf(r, name, roots.length), roots.length > 1); });
    };
    var inside = function (e, name) { for (var p = e.parentElement; p; p = p.parentElement) if (has(p, name)) return true; return false; };

    // button, link (+ u1-to focus target). A button or link is the element
    // itself — no children to scope — so every instance on the page is ONE
    // mapping on the marker (Studio's patch applies a fix to every match, as
    // auto mode does). Paths like #main>app-main:nth-child(2)>div… break the
    // moment the page re-renders; the marker does not. Buttons that send focus
    // to different targets stay apart.
    ['button', 'link'].forEach(function (tp) {
      var groups = {};
      elsWith(tp).forEach(function (r) { var to = tp === 'button' ? (r.getAttribute('u1-to') || '') : ''; (groups[to] = groups[to] || []).push(r); });
      Object.keys(groups).forEach(function (to) {
        var els = groups[to];
        var sel = attrUnion(els, tp).map(function (a) { return to ? a + '[u1-to="' + to + '"]' : a; }).join(',');
        if (Object.keys(groups).length > 1 && !to) sel = attrUnion(els, tp).map(function (a) { return a + ':not([u1-to])'; }).join(',');
        var s2 = { element: sel }; if (to) s2.focusTo = '#' + cssId(to);
        push(tp, sel, sel, s2, {}, els[0], els.length > 1 ? els.length + ' elements' : '');
      });
    });
    // heading — grouped by level
    var levels = {};
    elsWith('heading').forEach(function (h) { var v = valOf(h, 'heading'); if (!/^[1-6]$/.test(v || '')) return; (levels[v] = levels[v] || []).push(h); });
    Object.keys(levels).forEach(function (lv) {
      var sel = attrUnion(levels[lv], 'heading').map(function (a) { return a.replace(/\]$/, '="' + lv + '"]'); }).join(',');
      push('heading', sel, sel, { heading: sel }, { level: Number(lv) }, levels[lv][0], levels[lv].length + ' element(s)');
    });
    // accordion
    each('accordion', function (r, R, shared) {
      push('accordion', childSel(r, R, 'header', shared) || R, null, { headerSelector: childSel(r, R, 'header', shared), contentSelector: childSel(r, R, 'content', shared), disabledElementsSelector: childSel(r, R, 'disabled', shared) }, { headingLevel: 2, collapsesOthers: false }, r);
    });
    // tabs
    each('tabs', function (r, R, shared) {
      push('tabs', childSel(r, R, 'tab', shared), R, { tabList: childSel(r, R, 'tabs-list', shared) || childSel(r, R, 'list', shared), tab: childSel(r, R, 'tab', shared), tabPanel: childSel(r, R, 'panel', shared) }, { isVertical: false }, r);
    });
    // menu
    each('menu', function (r, R, shared) {
      var hz = childSel(r, R, 'horizontal', shared, true);
      push('menu', R, R, {
        menu: R, items: childSel(r, R, 'item', shared), submenus: childSel(r, R, 'submenu', shared), triggers: childSel(r, R, 'trigger', shared),
        horizontalMenu: hz, openByMouseover: childSel(r, R, 'open-by-mouseover', shared), openByFocus: childSel(r, R, 'open-by-focus', shared),
      }, { menubar: has(r, 'menubar'), menuDescription: '', focusOpensSubmenu: false }, r);
    });
    // dialog — current: root is the trigger, paired by u1-a11y-ref; legacy: root is the dialog
    var byRef = function (name, ref) { return elsWith(name).filter(function (e) { return refOf(e) === ref; }); };
    elsWith('dialog-trigger').forEach(function (t) {
      var ref = refOf(t);
      var dlg = ref ? byRef('dialog', ref)[0] : null;
      if (!dlg) { notes.push({ kind: 'dialog', reason: 'trigger without a paired u1-dialog (u1-a11y-ref)', where: uniq(t) }); return; }
      var D = pairSel(dlg, 'dialog'), T = pairSel(t, 'dialog-trigger');
      var fb = ref ? byRef('dialog-focus-back', ref)[0] : null;
      var shared = elsWith('dialog').length > 1;
      push('dialog', D, T, { dialog: D, trigger: T, closeBtn: childSel(dlg, D, 'dialog-close-btn', shared), heading: childSel(dlg, D, 'dialog-title', shared), textContent: childSel(dlg, D, 'dialog-content', shared), focusTo: fb ? pairSel(fb, 'dialog-focus-back') : '' }, {}, dlg);
    });
    elsWith('dialog').forEach(function (d) {
      if (refOf(d) && elsWith('dialog-trigger').some(function (t) { return refOf(t) === refOf(d); })) return; // done above
      var D = uniq(d), shared = elsWith('dialog').length > 1;
      push('dialog', D, D, { dialog: D, closeBtn: childSel(d, D, 'dialog-close-btn', shared), heading: childSel(d, D, 'dialog-title', shared) || childSel(d, D, 'heading', shared), textContent: childSel(d, D, 'dialog-content', shared) || childSel(d, D, 'content', shared) }, {}, d);
      notes.push({ kind: 'dialog', reason: 'dialog without a trigger marker — map the trigger in the panel', where: D });
    });
    // listbox (not the one inside a combobox)
    var lbRoots = elsWith('listbox').filter(function (e) { return !inside(e, 'combobox') && !has(e, 'combobox'); });
    lbRoots.forEach(function (r) {
      var R = lbRoots.length === 1 ? attrSelOf(r, 'listbox') : uniq(r), shared = lbRoots.length > 1;
      var L = childSel(r, R, 'list', shared, true) || R;
      push('listbox', L, childSel(r, R, 'trigger', shared), { listbox: L, trigger: childSel(r, R, 'trigger', shared), options: childSel(r, R, 'option', shared), label: childSel(r, R, 'label', shared) }, { closeOnSelect: true, enterSelects: false }, r);
    });
    // combobox
    each('combobox', function (r, R, shared) {
      var C = childSel(r, R, 'combobox-input', shared, true) || R;
      // auto mode reads the label page-wide, paired by ref ([u1-label]R)
      var lab = childSel(r, R, 'label', shared);
      if (!lab) { var ref = refOf(r); var l = elsWith('label').filter(function (e) { return ref ? refOf(e) === ref : !inside(e, 'checkbox') && !inside(e, 'listbox') && !inside(e, 'form'); })[0]; if (l) lab = pairSel(l, 'label'); }
      push('combobox', C, C, { combobox: C, listbox: childSel(r, R, 'listbox', shared), textbox: childSel(r, R, 'textbox', shared), options: childSel(r, R, 'option', shared), label: lab }, { isAutocompleteList: true }, r);
    });
    // checkbox — the root is the checkbox
    each('checkbox', function (r, R) {
      push('checkbox', R, R, { element: R, checkedState: withAttr(R, attrSelOfState(r, 'true')), uncheckedState: withAttr(R, attrSelOfState(r, 'false')), disabled: childSel(r, R, 'disabled', true, true), exclude: childSel(r, R, 'hide', true, true), label: childSel(r, R, 'label', true) }, {}, r);
    });
    function attrSelOfState(e, v) { var rec = marks.get(e).checked; var nm = rec ? rec.sel.replace(/^\[|\]$/g, '').split(/[~=]/)[0] : 'u1-checked'; return '[' + nm + '="' + v + '"]'; }
    // radio — fields are page-wide in u1; scoped here when several groups exist
    each('radio', function (r, R, shared) {
      var G = childSel(r, R, 'radio-group', shared, true) || R;
      push('radio', G, G, { radioGroup: G, radioButton: childSel(r, R, 'radio-button', shared), checkedState: '[u1-checked="true"]', uncheckedState: '[u1-checked="false"]', exclude: childSel(r, R, 'hide', shared) }, {}, r);
    });
    // table, grid
    ['table', 'grid'].forEach(function (tp) {
      each(tp, function (r, R, shared) {
        var s = { row: childSel(r, R, 'row', shared), cell: childSel(r, R, 'cell', shared), columnheader: childSel(r, R, 'col-header', shared), rowheader: childSel(r, R, 'row-header', shared) };
        s[tp] = R; push(tp, R, R, s, tp === 'grid' ? { isColumnHeaderFocusable: false, isRowHeaderFocusable: false, isRowClickable: false } : {}, r);
      });
    });
    // carousel
    each('carousel', function (r, R, shared) {
      var slide = childSel(r, R, 'slide', shared);
      push('carousel', R, slide || R, { carouselContainer: R, slide: slide, prevButton: childSel(r, R, 'prev-btn', shared), nextButton: childSel(r, R, 'next-btn', shared), slidePickerButtons: childSel(r, R, 'picker', shared), absoluteCarouselContainerLabel: childSel(r, R, 'label', shared) }, {}, r);
    });
    // pagination
    each('pagination', function (r, R, shared) {
      var pb = childSel(r, R, 'page', shared);
      push('pagination', R, pb || R, { container: R, pageButtons: pb, prevBtn: childSel(r, R, 'prev', shared), nextBtn: childSel(r, R, 'next', shared), prevSkip: childSel(r, R, 'prev-skip', shared), nextSkip: childSel(r, R, 'next-skip', shared), results: childSel(r, R, 'result', shared) }, { skipAmount: 0, autoFocus: false }, r);
    });
    // datepicker
    each('datepicker', function (r, R, shared) {
      var c = function (n) { return childSel(r, R, n, shared); };
      var T = c('trigger');
      push('datepicker', c('modal') || R, T, {
        container: c('modal') || R, trigger: T,
        year: { label: c('year-label'), prevButton: c('year-prev-btn'), nextButton: c('year-next-btn') },
        month: { label: c('month-label'), prevButton: c('month-prev-btn'), nextButton: c('month-next-btn') },
        days: { table: c('days-table'), day: c('day'), selected: c('selected-day'), disabled: c('disabled-day') },
      }, { isYearClickable: false, isMonthClickable: false, doubleDatepicker: false }, r);
    });
    // form
    each('form', function (r, R, shared) {
      var c = function (n) { return childSel(r, R, n, shared); };
      push('form', R, R, { form: R, submitButton: c('submit'), requiredField: c('required'), invalidField: c('invalid'), errorMsg: c('error'), successMsg: c('success'), formLabelAbsolute: c('label') }, { focusOnInvalidField: false }, r);
    });
    // tooltip — root is the trigger; pairs by ref
    elsWith('tooltip-trigger').forEach(function (t) {
      var ref = refOf(t), tip = ref ? byRef('tooltip', ref)[0] : (elsWith('tooltip').length === 1 ? elsWith('tooltip')[0] : null);
      if (!tip) { notes.push({ kind: 'tooltip', reason: 'trigger without a paired u1-tooltip', where: uniq(t) }); return; }
      push('tooltip', pairSel(tip, 'tooltip'), pairSel(t, 'tooltip-trigger'), { tooltip: pairSel(tip, 'tooltip'), trigger: pairSel(t, 'tooltip-trigger') }, {}, tip);
    });
    // loading
    var ld = elsWith('loading');
    if (ld.length) { var LS = attrUnion(ld, 'loading').join(','); push('loading', LS, LS, { loadingBar: LS }, {}, ld[0], ld.length + ' element(s)'); }

    // ── 4. global markers ─────────────────────────────────────────────────
    var hide = elsWith('hide').filter(function (e) { return valOf(e, 'hide') !== 'false' && !inside(e, 'checkbox') && !has(e, 'checkbox') && !inside(e, 'radio') && !has(e, 'radio'); });
    if (hide.length) { var HS = attrUnion(hide, 'hide').map(function (a) { return a.replace(/\]$/, '="true"]'); }).join(','); out.push({ type: 'hide-element', custom: 'hideElement', primary: HS, firstArg: HS, config: { selectors: { target: HS } }, label: hide.length + ' element(s)', text: '' }); }

    var UNSUPPORTED = {
      toggle: 'toggle button (u1.fix.toggle) — Studio has no toggle type',
      landmark: 'landmark — Studio has no landmarks type (skip links in Config can make main/nav/footer landmarks)',
      exclude: 'u1-exclude (role=presentation + out of tab order) — no Studio type',
      'focus-to': 'u1-focus-to (focus when it appears) — no Studio type',
      status: 'u1-status (live announcement) — no Studio type',
      'custom-order': 'u1-custom-order (item order) — no Studio field',
      'empty-option': 'combobox empty option — no Studio field',
      group: 'listbox option group — no Studio field',
      today: 'datepicker "today" day — no Studio field',
    };
    Object.keys(UNSUPPORTED).forEach(function (k) { var e = elsWith(k); if (e.length) notes.push({ kind: k, reason: UNSUPPORTED[k], count: e.length, where: e.slice(0, 3).map(uniq).join(' , ') }); });

    var total = 0; marks.forEach(function () { total++; });
    return { url: location.href, markedElements: total, mappings: out, notes: notes };
  }

  // Panel/terminal side: stamp the Studio bookkeeping fields onto the scan.
  function toStudioMappings(scan, opts) {
    opts = opts || {};
    var now = opts.now || Date.now(), n = opts.firstFixNo || 1;
    var u; try { u = new URL(scan.url); } catch (e) { u = null; }
    return scan.mappings.map(function (m) {
      return {
        type: m.type, custom: m.custom || null, primary: m.primary, firstArg: m.firstArg || m.primary,
        config: m.config, code: null, overwriteRole: null,
        note: 'From u1 markers in the page markup' + (m.label ? ' (' + m.label + ')' : '') + (m.text ? ': "' + m.text + '"' : '') + '. Keep the markers in the markup — the selectors use them.',
        parent: null, screenshot: null,
        pageUrl: scan.url, pageTitle: opts.title || '',
        scope: 'site', pagePath: u ? (decodeURIComponent(u.pathname).replace(/\/+$/, '') || '/') : '',
        capturedAt: now, fixNo: n++, source: 'u1-markers',
        id: 'm-mk' + Math.random().toString(36).slice(2, 10),
      };
    });
  }

  return { scanInPage: scanInPage, toStudioMappings: toStudioMappings };
});

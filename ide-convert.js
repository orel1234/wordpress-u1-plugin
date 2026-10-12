/*
 * IDE (uRemediate Studio / UFE "Scripter") → U1 Studio mappings.
 *
 * In IDE a site's work is a set of JavaScript files, each a handler
 *   var handler = function (api) { api.dialog({...}); api.executeScript(...); ... }
 * published as one bundle that `ide.user1st.info/api/frontend/scripts` serves
 * (anonymous). The `api` is the IDE fixers library (window.u1st).
 *
 * Conversion, per handler:
 *  - every top-level `api.<component>(…)` call whose arguments are plain data
 *    (literals, objects, template strings built from the handler's own
 *    constants) becomes a NATIVE Studio mapping — menu, dialog, tabs… with the
 *    props translated to u1.fix's shape;
 *  - whatever is left (executeScript, descriptions with callbacks, DOM code,
 *    conditionals, jQuery-only selectors) stays as one `ide-compat` mapping per
 *    handler, source verbatim, run by the compatibility engine (urs-compat.js),
 *    which provides the IDE `api` and forwards component calls to u1.fix.
 *
 * Runs in the panel (window.U1Ide, needs window.acorn) and in node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.U1Ide = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ORIGIN = 'https://ide.user1st.info';

  async function fetchSite(opts) {
    var fetchText = opts.fetchText, domain = opts.domain, say = opts.onProgress || function () {};
    var tried = [], bundle = null, used = null;
    var cands = [domain, domain.replace(/^www\./, ''), 'www.' + domain.replace(/^www\./, '')].filter(function (d, i, a) { return a.indexOf(d) === i; });
    for (var i = 0; i < cands.length && !bundle; i++) {
      say('Reading IDE scripts for ' + cands[i] + '…');
      try {
        var r = await fetchText(ORIGIN + '/api/frontend/scripts?url=' + encodeURIComponent(cands[i]) + '&profiles=ScreenReader');
        if (r && r.status === 200 && /handler/.test(r.text)) { bundle = r.text; used = cands[i]; }
        else tried.push(cands[i] + ': ' + (r ? r.status : 'no answer'));
      } catch (e) { tried.push(cands[i] + ': ' + e.message); }
    }
    if (!bundle) throw new Error('IDE has no published scripts for this site. Tried ' + tried.join('; '));
    var localization = {}, langScript = '';
    try { say('Reading IDE texts…'); var l = await fetchText(ORIGIN + '/api/frontend/lang?url=' + encodeURIComponent(used) + '&lang=en'); if (l && l.status === 200) localization = JSON.parse(l.text || '{}') || {}; } catch (e) { /* none */ }
    try { var ls = await fetchText(ORIGIN + '/api/frontend/lang/script?url=' + encodeURIComponent(used)); if (ls && ls.status === 200) langScript = ls.text || ''; } catch (e) { /* none */ }
    return { bundle: bundle, localization: localization, langScript: langScript, domain: used };
  }

  // Is there IDE work for this host? (404 for any non-customer domain)
  async function probe(fetchText, domain) {
    try { var r = await fetchText(ORIGIN + '/api/frontend/device-enabled?url=' + encodeURIComponent(domain)); return !!(r && r.status === 200); } catch (e) { return false; }
  }

  // ── static evaluation of plain-data arguments ─────────────────────────────
  var NOPE = { nope: true };
  function evaluate(node, env) {
    if (!node) return NOPE;
    switch (node.type) {
      case 'Literal': return node.regex ? NOPE : node.value;
      case 'TemplateLiteral': {
        var s = '';
        for (var i = 0; i < node.quasis.length; i++) {
          s += node.quasis[i].value.cooked;
          if (i < node.expressions.length) { var v = evaluate(node.expressions[i], env); if (v === NOPE || (typeof v !== 'string' && typeof v !== 'number')) return NOPE; s += v; }
        }
        return s;
      }
      case 'BinaryExpression': {
        if (node.operator !== '+') return NOPE;
        var a = evaluate(node.left, env), b = evaluate(node.right, env);
        if (a === NOPE || b === NOPE) return NOPE;
        return a + b;
      }
      case 'UnaryExpression': {
        var u = evaluate(node.argument, env); if (u === NOPE) return NOPE;
        if (node.operator === '!') return !u; if (node.operator === '-') return -u; return NOPE;
      }
      case 'Identifier': return Object.prototype.hasOwnProperty.call(env, node.name) ? env[node.name] : (node.name === 'undefined' ? undefined : NOPE);
      case 'ArrayExpression': {
        var arr = [];
        for (var j = 0; j < node.elements.length; j++) { var e = evaluate(node.elements[j], env); if (e === NOPE) return NOPE; arr.push(e); }
        return arr;
      }
      case 'ObjectExpression': {
        var o = {};
        for (var k = 0; k < node.properties.length; k++) {
          var p = node.properties[k];
          if (p.type !== 'Property' || p.computed || p.kind !== 'init' || p.method) return NOPE;
          var key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
          var val = evaluate(p.value, env); if (val === NOPE) return NOPE;
          o[key] = val;
        }
        return o;
      }
      default: return NOPE;
    }
  }
  // identifiers assigned anywhere after declaration are not constants
  function reassigned(body) {
    var set = {};
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') set[n.left.name] = 1;
      if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') set[n.argument.name] = 1;
      for (var k in n) { var c = n[k]; if (k === 'parent') continue; if (Array.isArray(c)) c.forEach(walk); else if (c && typeof c.type === 'string') walk(c); }
    })(body);
    return set;
  }

  // ── IDE props → Studio mapping ────────────────────────────────────────────
  // jQuery-only pseudos are not CSS: Studio/u1 cannot resolve them, so a call
  // using one stays with the compatibility engine (which resolves via jQuery).
  var JQ_ONLY = /:(visible|hidden|contains|eq|gt|lt|first(?![-\w])|last(?![-\w])|even|odd|header|input|button|text|checkbox|radio|selected|animated|parent)\b/;
  function cssOk(v) { return typeof v === 'string' && v.trim() !== '' && !JQ_ONLY.test(v); }
  // The form Studio stores a selector in (normalizeU1Selector): no whitespace
  // around > + ~ or after commas — u1 refuses `a > b` even though CSS takes it.
  // Quotes and [attribute] contents are left exactly as they are.
  function normSel(v) {
    var out = '', q = null, br = 0;
    for (var i = 0; i < v.length; i++) {
      var c = v[i];
      if (q) { out += c; if (c === '\\') { out += v[++i] || ''; } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; out += c; continue; }
      if (c === '[') br++; if (c === ']') br--;
      if (br === 0 && /\s/.test(c)) {
        var j = i; while (j < v.length && /\s/.test(v[j])) j++;
        var next = v[j], prev = out[out.length - 1];
        if (/[>+~,]/.test(next || '') || /[>+~,(]/.test(prev || '') || j >= v.length || next === ')') { i = j - 1; continue; }
        out += ' '; i = j - 1; continue;
      }
      out += c;
    }
    return out.trim();
  }
  function clean(sel) { var o = {}; Object.keys(sel).forEach(function (k) { var v = sel[k]; if (v && typeof v === 'object' && !Array.isArray(v)) { var c = clean(v); if (Object.keys(c).length) o[k] = c; } else if (typeof v === 'string' && v.trim()) o[k] = normSel(v); }); return o; }
  function allCss(sel) { return Object.keys(sel).every(function (k) { var v = sel[k]; return v && typeof v === 'object' ? allCss(v) : cssOk(v); }); }
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; }
  function onlyKeys(o, keys) { return Object.keys(o || {}).every(function (k) { return keys.indexOf(k) > -1; }); }

  // IDE fixer → u1.fix. `sel` maps IDE selector keys to u1's, `opts` the
  // options u1 understands; anything else is dropped and reported (u1 has no
  // equivalent — the compatibility engine, which forwards to u1.fix through
  // this same function, would drop it too).
  var SPEC = {
    button: { type: 'button', primary: 'element', sel: { element: 'element' } },
    link: { type: 'link', primary: 'element', sel: { element: 'element' } },
    toggleButton: { type: 'toggle', studio: false, primary: 'element', sel: { element: 'element', toggleSelectors: 'toggleSelectors' } },
    listbox: { type: 'listbox', primary: 'listbox', firstArg: 'trigger', sel: { listbox: 'listbox', trigger: 'trigger', options: 'options', label: 'label' }, defaults: { closeOnSelect: true, enterSelects: false } },
    combobox: { type: 'combobox', primary: 'combobox', sel: { combobox: 'combobox', textbox: 'textbox', options: 'options', listbox: 'listbox', label: 'label' }, opts: ['isAutocompleteList'] },
    menu: { type: 'menu', primary: 'menu', sel: { menu: 'menu', submenus: 'submenus', items: 'items', triggers: 'triggers', horizontalMenu: 'horizontalMenu', openByMouseover: 'openByMouseover', openByMouseenter: 'openByMouseenter', openByFocus: 'openByFocus' }, opts: ['menuDescription'], defaults: { menubar: true, menuDescription: '', focusOpensSubmenu: false } }, // IDE's MenuV2 always made the root a menubar
    dialog: { type: 'dialog', primary: 'dialog', firstArg: 'trigger', sel: { dialog: 'dialog', trigger: 'trigger', closeBtn: 'closeBtn', heading: 'heading', textContent: 'textContent', focusOnElementOnClose: 'focusTo', waitForElement: 'waitForElement' }, opts: ['type', 'blockNavigation', 'avoidFocusOnOpen'] },
    accordion: { type: 'accordion', primary: 'headerSelector', sel: { headerSelector: 'headerSelector', contentSelector: 'contentSelector', disabledElementsSelector: 'disabledElementsSelector' }, opts: ['headingLevel', 'collapsesOthers'], defaults: { headingLevel: 2, collapsesOthers: false } },
    tabs: { type: 'tabs', primary: 'tabList', firstArg: 'tabList', sel: { tab: 'tab', tabPanel: 'tabPanel', tabList: 'tabList' }, opts: ['isVertical'], defaults: { isVertical: false } },
    form: { type: 'form', primary: 'form', sel: { form: 'form', formLabelAbsolute: 'formLabelAbsolute', invalidField: 'invalidField', requiredField: 'requiredField', errorMessageAbsolute: 'errorMsg' }, defaults: { focusOnInvalidField: false } },
    checkbox: { type: 'checkbox', primary: 'element', sel: { element: 'element', checkedState: 'checkedState', uncheckedState: 'uncheckedState', excludeEl: 'exclude' } },
    radio: { type: 'radio', primary: 'radioGroup', sel: { radioGroup: 'radioGroup', radioButton: 'radioButton', checkedState: 'checkedState', uncheckedState: 'uncheckedState' } },
    interactiveTable: { type: 'grid', primary: 'grid', sel: { grid: 'grid', row: 'row', cell: 'cell', columnheader: 'columnheader', rowheader: 'rowheader' }, opts: ['isColumnHeaderFocusable', 'isRowHeaderFocusable', 'isRowClickable'] },
    table: { type: 'table', primary: 'table', sel: { table: 'table', row: 'row', cell: 'cell', columnheader: 'columnheader', rowheader: 'rowheader' } },
    carousel: { type: 'carousel', primary: 'carouselContainer', firstArg: 'slide', sel: { absoluteSliderContainer: 'carouselContainer', sliderItem: 'slide', prevButton: 'prevButton', nextButton: 'nextButton', slidePickerButtons: 'slidePickerButtons' } },
    datepicker: { type: 'datepicker', primary: 'container', firstArg: 'trigger', sel: { container: 'container', trigger: 'trigger', year: 'year', month: 'month', days: 'days' }, opts: ['isYearClickable', 'isMonthClickable', 'doubleDatepicker'], defaults: { isYearClickable: false, isMonthClickable: false, doubleDatepicker: false } },
  };
  var IGNORED_PROPS = { waitForFixer: 1, waitForElement: 1 };

  // returns {type, primary, firstArg, config, dropped[]} or null
  function translate(fn, args) {
    if (fn === 'heading') {
      if (typeof args[0] !== 'string' || typeof args[1] !== 'number' || !cssOk(args[0])) return null;
      var hs = normSel(args[0]);
      return { type: 'heading', studio: true, primary: hs, firstArg: hs, config: { selectors: { heading: hs }, level: args[1] }, dropped: [], claim: args[0], claimName: 'HeadingFixer' };
    }
    var spec = SPEC[fn], p = args[0];
    if (!spec || !p || typeof p !== 'object' || Array.isArray(p)) return null;
    var dropped = [], src = p.selectors;
    // older shapes
    if (fn === 'tabs' && !src && p.tabListSelector) src = { tabList: p.tabListSelector, tab: [].concat(p.tabSelectors || []).join(','), tabPanel: [].concat(p.tabPanelSelectors || []).join(','), descriptorElement: p.descriptorElementSelector };
    if (fn === 'datepicker' && !src && p.container) {
      var cal = p.calendar || {}, mo = p.month || {}, yr = p.year || {};
      src = { container: p.container, trigger: p.trigger,
        month: { label: mo.text && mo.text.selector, prevButton: mo.prevButton, nextButton: mo.nextButton },
        year: { label: yr.text && yr.text.selector, prevButton: yr.prevButton, nextButton: yr.nextButton },
        days: { table: cal.table, selected: cal.selectedDay, day: cal.activeDays, disabled: cal.disabledDays } };
      p = Object.assign({}, p, { isMonthClickable: !!(mo.text && mo.text.isClickable), isYearClickable: !!(yr.text && yr.text.isClickable) });
    }
    if (!src || typeof src !== 'object') return null; // e.g. menu V1 — no u1 equivalent
    var sel = {};
    Object.keys(src).forEach(function (k) {
      if (typeof src[k] === 'function') { dropped.push('selectors.' + k + ' (function)'); return; }
      if (spec.sel[k]) sel[spec.sel[k]] = src[k]; else if (src[k] != null && src[k] !== '') dropped.push('selectors.' + k);
    });
    sel = clean(sel);
    if (!Object.keys(sel).length || !allCss(sel)) return null;
    var cfg = { selectors: sel };
    Object.keys(spec.defaults || {}).forEach(function (k) { cfg[k] = spec.defaults[k]; });
    Object.keys(p).forEach(function (k) {
      if (k === 'selectors' || IGNORED_PROPS[k]) return;
      if (/Selector(s)?$/.test(k) && (fn === 'tabs' || fn === 'datepicker')) return; // older-shape fields, read above
      if (fn === 'datepicker' && /^(container|trigger|calendar|month|year)$/.test(k)) return;
      if ((spec.opts || []).indexOf(k) > -1 && typeof p[k] !== 'function') cfg[k] = p[k];
      else dropped.push(k + (typeof p[k] === 'function' ? ' (function)' : ''));
    });
    var prim = sel[spec.primary] || Object.values(sel)[0];
    // the element the IDE fixer waited for — it claimed that element in the
    // IDE change detection (see urs-compat.src.js, IDE section)
    var CLAIM = { form: 'form', button: 'element', link: 'element', checkbox: 'element', toggleButton: 'element', listbox: 'trigger', combobox: 'textbox', accordion: 'headerSelector', tabs: 'tabList', table: 'table', interactiveTable: 'grid', radio: 'radioGroup', carousel: 'absoluteSliderContainer', datepicker: 'container', menu: 'menu' };
    var claim = fn === 'dialog' ? (src.trigger || src.dialog) : src[CLAIM[fn]];
    return { type: spec.type, studio: spec.studio !== false, primary: prim, firstArg: (spec.firstArg && sel[spec.firstArg]) || prim, config: cfg, dropped: dropped,
      claim: typeof claim === 'string' && claim.trim() ? claim : null, claimName: fn.charAt(0).toUpperCase() + fn.slice(1) + 'Fixer' };
  }
  var NATIVE = { button: 1, link: 1, listbox: 1, combobox: 1, menu: 1, dialog: 1, accordion: 1, tabs: 1, form: 1, checkbox: 1, radio: 1, interactiveTable: 1, table: 1, carousel: 1, datepicker: 1, heading: 1 }; // toggleButton has no Studio type

  // ── the bundle → handlers ─────────────────────────────────────────────────
  function handlersOf(acorn, bundle) {
    var ast = acorn.parse(bundle, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, ranges: true });
    var out = [];
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'handler' && n.init && /Function/.test(n.init.type)) {
        var fnNode = n.init, param = fnNode.params[0];
        out.push({ fn: fnNode, apiName: param && param.type === 'Identifier' ? param.name : 'api' });
        return;
      }
      for (var k in n) { var c = n[k]; if (Array.isArray(c)) c.forEach(walk); else if (c && typeof c.type === 'string') walk(c); }
    })(ast);
    // the context each handler was invoked with, in order
    var ctxs = []; // (quote characters written as \x27 \x22 \x60: the Studio export strips
    // comments with a scanner that does not know regex literals, and a quote in
    // a regex would be read as the start of a string)
    var re = /handler\(\s*window\.u1st\.evaluate\(\s*([\x27\x22\x60])([\s\S]*?)\1\s*\)\s*\)/g, m;
    while ((m = re.exec(bundle))) ctxs.push(m[2]);
    out.forEach(function (h, i) { h.context = ctxs[i] || 'body'; });
    return out;
  }

  function convert(opts) {
    var acorn = opts.acorn, bundle = opts.bundle, host = opts.host, now = opts.now || Date.now();
    var handlers = handlersOf(acorn, bundle);
    var claimsOnly = [];
    var mappings = [], compat = [], worklist = { calls: {}, native: 0, compatCalls: 0, handlers: handlers.length, reasons: {} };
    var fixNo = opts.firstFixNo || 1;
    handlers.forEach(function (h, hi) {
      var body = h.fn.body.type === 'BlockStatement' ? h.fn.body.body : [];
      var re = reassigned(h.fn.body), env = {}, keep = [], api = h.apiName;
      body.forEach(function (st) {
        if (st.type === 'VariableDeclaration') {
          st.declarations.forEach(function (d) { if (d.id.type === 'Identifier' && !re[d.id.name]) { var v = evaluate(d.init, env); if (v !== NOPE) env[d.id.name] = v; } });
          keep.push(st); return;
        }
        var call = st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' ? st.expression : null;
        var callee = call && call.callee.type === 'MemberExpression' ? call.callee : null;
        var fname = null;
        if (callee && callee.object.type === 'Identifier' && callee.object.name === api && !callee.computed) fname = callee.property.name;
        else if (callee && callee.object.type === 'MemberExpression' && callee.object.object.type === 'Identifier' && callee.object.object.name === api) fname = callee.object.property.name + '.' + callee.property.name;
        if (fname) worklist.calls[fname] = (worklist.calls[fname] || 0) + 1;
        if (fname && NATIVE[fname] && h.context === 'body') {
          var args = call.arguments.map(function (a) { return evaluate(a, env); });
          var t = args.indexOf(NOPE) === -1 ? translate(fname, args) : null;
          if (t && t.studio) {
            // the same call made in two scripts is one mapping
            var dupe = mappings.some(function (x) { return x.type === t.type && x.primary === t.primary && JSON.stringify(x.config) === JSON.stringify(t.config); });
            if (t.claim) keep.push({ type: '__claim', text: api + '.__claim(' + JSON.stringify(t.claim) + ', ' + JSON.stringify(t.claimName) + ');' });
            if (dupe) { worklist.duplicates = (worklist.duplicates || 0) + 1; return; }
            worklist.native++;
            if (false && t.claim) keep.push({ type: '__claim', text: api + '.__claim(' + JSON.stringify(t.claim) + ', ' + JSON.stringify(t.claimName) + ');' });
            if (t.dropped.length) (worklist.dropped = worklist.dropped || []).push({ script: hi + 1, call: fname, dropped: t.dropped });
            mappings.push({
              type: t.type, custom: null, primary: t.primary, firstArg: t.firstArg, config: t.config, code: null, overwriteRole: null,
              note: 'From IDE: api.' + fname + ' in script ' + (hi + 1) + '.' + (t.dropped.length ? ' Not carried (no u1 equivalent): ' + t.dropped.join(', ') + '.' : ''), parent: null, screenshot: null,
              pageUrl: 'https://' + host + '/', pageTitle: '', scope: 'site', pagePath: '', capturedAt: now, fixNo: fixNo++, source: 'ide',
              id: 'm-ide' + hi + 'n' + mappings.length,
            });
            return;
          }
          worklist.reasons[fname] = (worklist.reasons[fname] || 0) + 1;
        }
        if (fname) worklist.compatCalls++;
        keep.push(st);
      });
      // what remains, verbatim; nothing but constants left → nothing to run
      var meaningful = keep.some(function (st) { return st.type !== 'VariableDeclaration' && st.type !== 'EmptyStatement' && st.type !== '__claim'; });
      if (!meaningful) {
        // nothing left to run, but the converted calls still claimed elements in IDE
        keep.filter(function (st) { return st.type === '__claim'; }).forEach(function (st) { claimsOnly.push({ index: hi + 1, text: st.text }); });
        return;
      }
      var src = keep.map(function (st) { return st.type === '__claim' ? st.text : bundle.slice(st.range[0], st.range[1]); }).join('\n');
      var calls = keep.filter(function (st) { return st.type !== '__claim'; }).map(function (st) { var m = /^\s*([A-Za-z_$][\w$]*)\.([A-Za-z]+)(?:\.([A-Za-z]+))?\s*\(/.exec(bundle.slice(st.range[0], st.range[1])); return m && m[1] === api ? m[2] + (m[3] ? '.' + m[3] : '') : null; }).filter(Boolean);
      // Studio (and the team server) identify a mapping by type + selector, so
      // each script card needs a selector of its own: still the page body.
      var own = 'body:not([data-u1-ide-script="' + (hi + 1) + '"])';
      compat.push({
        type: 'ide-compat', custom: 'ideCompat', primary: own, firstArg: own,
        config: { selectors: { target: own }, script: { index: hi + 1, context: h.context, apiName: api, code: src, calls: calls } },
        code: null, overwriteRole: null,
        note: 'IDE script ' + (hi + 1) + ': ' + (calls.length ? [...new Set(calls)].join(', ') : 'free JavaScript') + '. Runs through the compatibility engine.',
        parent: null, screenshot: null, pageUrl: 'https://' + host + '/', pageTitle: 'IDE script ' + (hi + 1), scope: 'site', pagePath: '',
        capturedAt: now, fixNo: 0, source: 'ide', id: 'm-ide' + hi + 'c',
      });
    });
    compat.forEach(function (m) { m.fixNo = fixNo++; });
    // the site's texts and language script travel once, on the first compat mapping
    var all = mappings.concat(compat);
    var carrier = compat[0] || null;
    if (carrier) { carrier.config.site = { localization: opts.localization || {}, langScript: opts.langScript || '', host: host, claims: claimsOnly }; }
    return { mappings: all, worklist: worklist, totals: { handlers: handlers.length, native: mappings.length, compat: compat.length, calls: Object.values(worklist.calls).reduce(function (a, b) { return a + b; }, 0) } };
  }

  return { fetchSite: fetchSite, probe: probe, convert: convert, _translate: translate, _evaluate: evaluate, _normSel: normSel, ORIGIN: ORIGIN };
});

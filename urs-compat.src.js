/*
 * URS compatibility engine — the legacy uRemediate client engine, re-implemented
 * so a site converted from URS keeps every fix with no User1st server behind it.
 *
 * What runs here is the data the converter carried over (user1st-all/urs-migration):
 * one `urs-compat` mapping per URS pattern, each holding the pattern's selector,
 * its metadata rows (role, description, hideFromSR, tabIndexContainer, …) and its
 * executeScript actions verbatim. The root pattern also carries the language
 * texts and the site scripts.
 *
 * Fidelity decisions, taken deliberately and listed so nobody has to rediscover them:
 *  - Keyboard and screen-reader behaviours are ALWAYS on, together. The legacy
 *    engine switched them per visitor profile; the profile menu no longer exists.
 *  - Colour behaviours (high contrast, grayscale) follow the visitor's own system:
 *    forced-colors / prefers-contrast for contrast, the u1 toolbar state (or
 *    window.__u1UrsModes) for grayscale. Nothing is forced on everyone.
 *  - Tabbability is the screen-reader model (tabindex=0 / -1), never the legacy
 *    keyboard model's positive tabindexes.
 *  - A visible dialog gets role=dialog + aria-modal instead of the legacy trick of
 *    aria-hidden on every sibling. Same effect for assistive tech, far less churn.
 *  - A description on a link or button becomes aria-label; the legacy screen-reader
 *    profile rewrote the visible text, which cannot be done for every visitor.
 *  - Redundant links (actionControl) are hidden from AT rather than stripped of href.
 *  - Scripts travel as source strings and are compiled here with Function(), the
 *    same requirement the legacy engine's eval() placed on the site's CSP.
 *
 * Public surface (all on window):
 *   __u1UrsRegister(mapping)   collect one converted pattern
 *   __u1UrsApply()             build the tree and run (idempotent; re-runs on DOM change)
 *   __u1UrsApplyOne(mapping)   register + apply, for the panel's test button
 *   __u1UrsModes               optional overrides: { isGrayScale, isHighContrast, langCode }
 */
(function () {
  'use strict';
  if (window.__u1UrsRegister) return; // already here (panel re-injection)

  var $ = window.uf$ || window.jQuery;
  if (!$) { console.warn('[u1 urs-compat] jQuery is missing; the engine cannot run.'); return; }

  // ── jQuery extensions the legacy scripts rely on ───────────────────────────
  function actuallyVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (!el.getClientRects().length) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return false;
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var cs = window.getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || cs.opacity === '0') return false;
    }
    return true;
  }
  var FOCUSABLE = 'a[href],area[href],button,input,select,textarea,iframe,summary,[tabindex],[contenteditable=true]';
  function isFocusable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (!$(el).is(FOCUSABLE)) return false;
    if (el.disabled) return false;
    var ti = el.getAttribute('tabindex');
    if (ti !== null && Number(ti) < 0) return false;
    return actuallyVisible(el);
  }
  if ($.expr && $.expr[':']) {
    $.expr[':'].actualVisible = function (el) { return actuallyVisible(el); };
    $.expr[':'].hasSize = function (el) { var r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
    $.expr[':'].focusable = function (el) { return isFocusable(el); };
    $.expr[':'].innerHTMLContains = function (el, i, m) { return (el.innerHTML || '').indexOf(m[3]) > -1; };
  }
  $.fn.setAttr = function (n, v) { return this.each(function () { setAttr(this, n, v); }); };
  $.fn.getAttr = function (n) { return this.length ? this[0].getAttribute(n) : undefined; };
  $.fn.setData = function (k, v) { return this.each(function () { $(this).data(k, v); }); };
  $.fn.getData = function (k) { return this.length ? $(this.get(0)).data(k) : undefined; };
  $.fn.exists = function () { return this.length > 0; };
  $.fn.existsInDocument = function () { return this.length > 0 && document.documentElement.contains(this[0]); };
  $.fn.nonBlockedKeydown = function (fn) { return this.on('keydown', fn); };

  // ── small helpers ──────────────────────────────────────────────────────────
  var uid = 0;
  function ensureId(el) { if (!el.id) el.id = 'u1st-' + (++uid) + '-' + Math.random().toString(36).slice(2, 7); return el.id; }
  function setAttr(el, name, value) {
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName.toLowerCase();
    if (name === 'role') {
      if (el.getAttribute('u1st-status') === '16') return;
      if ((tag === 'select' || tag === 'option') && value !== 'presentation') return;
      if (value === 'button' && (tag === 'button' || tag === 'input')) return;
      if ((value === 'dialog' || value === 'region') && (tag === 'select' || tag === 'input' || tag === 'textarea')) return;
      if (value === 'status') el.setAttribute('aria-atomic', 'true');
    }
    if (el.getAttribute(name) === String(value)) return;
    el.setAttribute(name, value);
  }
  function orFlag(el, attr, bit) { var v = Number(el.getAttribute(attr)) || 0; el.setAttribute(attr, String(v | bit)); }
  function hasFlag(el, attr, bit) { return ((Number(el.getAttribute(attr)) || 0) & bit) === bit; }
  function pureText(node, exclude) {
    var out = '';
    (function walk(n) {
      if (!n) return;
      if (n.nodeType === 3) { out += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      if (exclude && (typeof exclude === 'function' ? exclude(n) : $(n).is([].concat(exclude).join(',')))) return;
      var tag = n.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') return;
      for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
      if (/^(li|p|h[1-4])$/.test(tag) && out && !/[.!?]\s*$/.test(out)) out += '.';
      out += ' ';
    })(node.jquery ? node[0] : node);
    return out.replace(/\s+/g, ' ').trim();
  }
  function warn() { try { console.warn.apply(console, ['[u1 urs-compat]'].concat([].slice.call(arguments))); } catch (e) { /* noop */ }
  }
  function debug() { if (window.__u1UrsDebug) try { console.log.apply(console, ['[u1 urs-compat]'].concat([].slice.call(arguments))); } catch (e) { /* noop */ } }

  // ── relative-selector expressions: {=parent(.card).descendant(.title)} ─────
  // Grammar (legacy RelativeSelectorHelper): tokens self | parent | child | next |
  // prev | descendant, each with optional (selector) and [index], chained with
  // dots; an optional trailing value token .title | .allClasses | .ariaLabel |
  // .name | .alt | .attr(x) | .firstLevelText[i]. No value token → .text().
  var TOKEN_RE = /^(self|parent|child|next|prev|descendant)(?:\((.*?)\))?(?:\[(\d+)\])?$/i;
  var VALUE_RE = /^(title|allClasses|ariaLabel|name|alt|attr\((.*?)\)|firstLevelText(?:\[(\d+)\])?)$/i;
  function splitTokens(expr) {
    var parts = [], depth = 0, cur = '';
    for (var i = 0; i < expr.length; i++) {
      var ch = expr[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === '.' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts.filter(function (p) { return p !== ''; });
  }
  function unq(s) { return (s || '').replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1'); }
  function evalRelative($from, expr, wantValue) {
    var $el = $from.jquery ? $from : $($from), value, parts = splitTokens(expr.trim()), i, m, sel, idx;
    for (i = 0; i < parts.length; i++) {
      m = TOKEN_RE.exec(parts[i]);
      if (!m) {
        var v = VALUE_RE.exec(parts[i]);
        if (v && i === parts.length - 1) {
          var name = v[1].toLowerCase();
          if (name.indexOf('attr(') === 0) value = $el.attr(unq(v[2]));
          else if (name.indexOf('firstleveltext') === 0) value = $el.contents().filter(function () { return this.nodeType === 3; }).eq(Number(v[3]) || 0).text();
          else value = $el.attr({ title: 'title', allclasses: 'class', arialabel: 'aria-label', name: 'name', alt: 'alt' }[name]);
          break;
        }
        warn('unknown token in expression', parts[i], 'of', expr);
        return wantValue ? '' : $();
      }
      sel = m[2] ? unq(m[2]) : null; idx = m[3] ? Number(m[3]) : 0;
      switch (m[1].toLowerCase()) {
        case 'self': break;
        case 'parent': $el = sel ? $el.parents(sel).eq(idx) : (m[3] ? $el.parents().eq(idx) : $el.parent()); break;
        case 'child': $el = sel ? $el.children(sel).eq(idx) : $el.children().eq(idx); break;
        case 'next': $el = sel ? $el.nextAll(sel).eq(idx) : (m[3] ? $el.nextAll().eq(idx) : $el.next()); break;
        case 'prev': $el = sel ? $el.prevAll(sel).eq(idx) : (m[3] ? $el.prevAll().eq(idx) : $el.prev()); break;
        case 'descendant': $el = sel ? $el.find(sel).eq(idx) : $el.find('*').eq(idx); break;
      }
    }
    if (!wantValue) return $el;
    if (value === undefined) value = $el.text();
    return (value == null ? '' : String(value)).replace(/\s+/g, ' ').trim();
  }

  // ── registry ───────────────────────────────────────────────────────────────
  var R = {
    mappings: [], byUrsId: {}, roots: [], texts: {}, site: null, started: false,
    applying: false, observer: null, popups: [], ranOnce: {}, langCode: 'en',
    deferred: [], readyFired: false, menuWidgets: [],
  };

  function modes() {
    var o = window.__u1UrsModes || {};
    var mm = function (q) { try { return window.matchMedia && window.matchMedia(q).matches; } catch (e) { return false; } };
    var htmlCls = (document.documentElement.className || '') + ' ' + (document.body ? document.body.className : '');
    var grayAttr = /grayscale|gray-scale|monochrome/i.test(htmlCls) ||
      !!document.querySelector('html[data-u1-grayscale], body[data-u1-grayscale], html[data-grayscale="true"]');
    return {
      isScreenReader: true,
      isKeyboardNav: true,
      isHighContrast: o.isHighContrast != null ? !!o.isHighContrast : (mm('(forced-colors: active)') || mm('(prefers-contrast: more)')),
      isGrayScale: o.isGrayScale != null ? !!o.isGrayScale : grayAttr,
      isMagnified: false, isLowVision: false, isInvert: false, isColorBlind: false, isNoStyle: false,
    };
  }
  var UA = navigator.userAgent || '';
  var isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));
  var isMobile = !isTablet && /Mobi|Android|iPhone|iPod|Windows Phone/i.test(UA);
  var isDesktop = !isMobile && !isTablet;
  var deviceType = isDesktop ? 1 : isMobile ? 2 : 3;

  function pickLang() {
    var o = window.__u1UrsModes || {};
    var raw = o.langCode || document.documentElement.getAttribute('lang') || (R.site && R.site.languages && R.site.languages[0]) || navigator.language || 'en';
    return String(raw).toLowerCase();
  }
  function text(id) {
    var t = R.texts[id];
    if (!t) return undefined;
    var lang = R.langCode, short = lang.split(/[-_]/)[0];
    if (t[lang] != null) return t[lang];
    if (t[short] != null) return t[short];
    var langs = (R.site && R.site.languages) || [];
    for (var i = 0; i < langs.length; i++) if (t[langs[i]] != null) return t[langs[i]];
    for (var k in t) if (t[k] != null) return t[k];
    return undefined;
  }
  var GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ── media queries (legacy ids) ─────────────────────────────────────────────
  var MQ = { 0: [0, 'all'], 1: [1, 'all'], 2: [3, 'all'], 3: [2, 'all'], 4: [3, '(orientation: portrait)'], 5: [3, '(orientation: landscape)'] };
  function mediaMatches(list) {
    if (!list || !list.length) return true;
    var ok = false;
    for (var i = 0; i < list.length; i++) {
      var mq = MQ[list[i]]; if (!mq) continue;
      var dev = mq[0] === 0 || mq[0] === deviceType;
      var q = true; try { q = window.matchMedia(mq[1]).matches; } catch (e) { /* noop */ }
      if (dev && q) ok = true;
    }
    return ok;
  }

  // ── pattern elements ───────────────────────────────────────────────────────
  function findPatternElements(m) {
    var sel = m.primary || (m.config && m.config.selectors && m.config.selectors.target) || '';
    var level = (m.config && m.config.pattern && m.config.pattern.childrenLevel) || 0;
    if (!sel) return [];
    if (sel === '{BODY}' || sel === '.') sel = 'body';
    var $els;
    try { $els = $(document).find(sel); } catch (e) { warn('bad pattern selector', sel, e.message); return []; }
    for (var i = 0; i < level && $els.length; i++) {
      $els = $els.parent();
      if ($els.length && /^(body|html)$/i.test($els[0].tagName)) return [];
    }
    return $els.toArray();
  }
  // Metadata / script targets: "." is the pattern element; anything else is a
  // DESCENDANT of it (never the element itself, never outside) — legacy MetaDataHelper.
  function findTargets(patternEl, target) {
    if (!target) return [patternEl];
    var sel = typeof target === 'string' ? target : target.selector;
    var level = (typeof target === 'object' && target.childrenLevel) || 0;
    if (!sel || sel === '.') return [patternEl];
    var out = [];
    try {
      $(patternEl).find(sel).each(function () {
        var $e = $(this);
        for (var i = 0; i < level; i++) $e = $e.parent();
        if ($e.length) out.push($e[0]);
      });
    } catch (e) { warn('bad target selector', sel, e.message); }
    return out;
  }
  function findInPatternOrDocument(patternEl, sel) {
    var found = [];
    try { found = $(patternEl).find(sel).toArray(); if (!found.length) found = $(document).find(sel).toArray(); } catch (e) { warn('bad selector', sel); }
    return found;
  }

  // ── metadata value (descriptions) ──────────────────────────────────────────
  function originalText(el) {
    var d = $(el).data('u1st-originalText');
    if (d == null) { d = pureText(el); $(el).data('u1st-originalText', d); }
    return d;
  }
  function evaluateExpression(targetEl, tmpl, patternEl) {
    if (tmpl == null) return '';
    return String(tmpl).replace(/\{original\}/g, function () { return originalText(targetEl); })
      .replace(/\{=([^}]*)\}/g, function (_, e) { return evalRelative($(targetEl), e, true); })
      .replace(/\{\$>([^}]*)\}/g, function (_, s) { try { return $(s, patternEl).first().text().trim(); } catch (x) { return ''; } })
      .replace(/\{\$([^}]*)\}/g, function (_, s) { try { return $(s).first().text().trim(); } catch (x) { return ''; } });
  }
  function metadataValue(v, targetEl, patternEl) {
    var val;
    if (v.srcAbsValue != null && v.srcAbsValue !== '') {
      var t = GUID_RE.test(v.srcAbsValue) ? text(v.srcAbsValue) : undefined;
      if (t === undefined && GUID_RE.test(v.srcAbsValue)) throw new Error('text ' + v.srcAbsValue + ' missing in every language');
      val = t !== undefined ? t : v.srcAbsValue;
      if (/\{(original|=|\$)/.test(val)) val = evaluateExpression(targetEl, val, patternEl); // URS expressions stored as texts
    } else if (v.bindableSelector) {
      var srcSel = typeof v.bindableSelector === 'object' ? v.bindableSelector.selector : v.bindableSelector;
      var src = srcSel === '.' ? patternEl : $(patternEl).find(srcSel)[0];
      if (!src) throw new Error('bind source not found: ' + srcSel);
      val = v.sourceAttr ? src.getAttribute(v.sourceAttr) : pureText(src);
      if (v.targetAttrTmpl) {
        var tm = GUID_RE.test(v.targetAttrTmpl) ? text(v.targetAttrTmpl) : v.targetAttrTmpl;
        val = String(tm || '').replace(/\{0\}/g, val || '').replace(/\{ot\}/g, originalText(targetEl));
      }
    } else if (v.exp) {
      var tmpl = GUID_RE.test(v.exp) ? text(v.exp) : v.exp;
      if (tmpl === undefined) throw new Error('expression text ' + v.exp + ' missing');
      val = evaluateExpression(targetEl, tmpl, patternEl);
    }
    if (val == null) throw new Error('no value');
    return String(val).replace(/\s+/g, ' ').trim();
  }

  function computedHeadingLevel(el) {
    var levels = [];
    $(el).parents().each(function () {
      $(this).children('h1,h2,h3,h4,h5,h6').each(function () { levels.push(Number(this.tagName[1])); });
    });
    if (!levels.length) return 2;
    levels.sort(function (a, b) { return a - b; });
    return Math.min(6, levels[levels.length - 1] + 1);
  }

  // ── tabbability (screen-reader model) ──────────────────────────────────────
  var COMMAND_ROLES = /^(combobox|listbox|button|checkbox|link|option|radio|tab|textbox|slider|spinbutton|gridcell|item|menuitem|menuitemcheckbox|menuitemradio|switch)$/;
  function makeTabbable(el) {
    if (el.getAttribute('u1st-shouldExcludeTabIndex') === '1') return;
    if (hasFlag(el, 'u1st-avoidU1st', 64)) return;
    if ($(el).is('a[href],button,input,select,textarea,[contenteditable=true]') && !el.disabled) return;
    if (el.getAttribute('tabindex') === null || Number(el.getAttribute('tabindex')) < 0) {
      if (el.getAttribute('u1st-ingoreTI') === '1') return;
      el.setAttribute('tabindex', '0');
    }
  }
  function removeFromTabOrder(el) {
    if (el.getAttribute('u1st-tiBackup') === null) el.setAttribute('u1st-tiBackup', el.getAttribute('tabindex') === null ? '' : el.getAttribute('tabindex'));
    el.setAttribute('tabindex', '-1');
  }
  function restoreTabOrder(el) {
    var b = el.getAttribute('u1st-tiBackup');
    if (b === null) return;
    if (b === '') el.removeAttribute('tabindex'); else el.setAttribute('tabindex', b);
    el.removeAttribute('u1st-tiBackup');
  }
  function tabbablesIn(root) {
    return $(root).find(FOCUSABLE).filter(function () { return isFocusable(this) && this.getAttribute('u1st-shouldExcludeTabIndex') !== '1'; }).toArray();
  }

  // ── metadata appliers ──────────────────────────────────────────────────────
  var LANDMARKS = { main: 'main', header: 'banner', banner: 'banner', footer: 'contentinfo', contentinfo: 'contentinfo', navigation: 'navigation', siteNav: 'navigation', search: 'search', form: 'form', complementary: 'complementary', region: 'region', application: 'application' };
  var APPLIERS = {
    role: function (ctx, v, targets) {
      var role = String(v.role || '').trim(); if (!role) return;
      var lower = role.toLowerCase();
      if (lower === 'dialog' || lower === 'popup') {
        targets.forEach(function (t) { t.setAttribute('u1st-ticont', '1'); });
        if (targets[0]) setAttr(targets[0], 'role', 'dialog');
        return;
      }
      targets.forEach(function (t) {
        var tag = t.tagName.toLowerCase();
        if ((tag === 'select' || tag === 'option') && lower !== 'presentation') return;
        if (lower === 'heading' && !hasFlag(t, 'u1st-avoidU1st', 16)) setAttr(t, 'aria-level', String(computedHeadingLevel(t)));
        if (lower === 'closebutton') { t.setAttribute('u1st-closeButton', 'true'); setAttr(t, 'role', 'button'); }
        else setAttr(t, 'role', role);
        if (COMMAND_ROLES.test(lower === 'closebutton' ? 'button' : lower) && !(lower === 'tab' && t.getAttribute('aria-selected') !== 'true')) makeTabbable(t);
      });
    },
    landmark: function (ctx, v, targets) {
      var role = LANDMARKS[v.role] || v.role; if (!role) return;
      targets.forEach(function (t) { setAttr(t, 'role', role); });
    },
    description: function (ctx, v, targets) {
      if (!targets.length) return;
      var first = targets[0], tag = first.tagName.toLowerCase();
      var isImgInput = tag === 'input' && (first.getAttribute('type') || '').toLowerCase() === 'image';
      var plainBind = v.bindableSelector && !v.sourceAttr && !v.srcAbsValue && !v.targetAttrTmpl && !v.exp;
      targets.forEach(function (t) {
        var ttag = t.tagName.toLowerCase();
        if (plainBind) {
          var srcSel = typeof v.bindableSelector === 'object' ? v.bindableSelector.selector : v.bindableSelector;
          var src = srcSel === '.' ? ctx.patternEl : $(ctx.patternEl).find(srcSel)[0];
          if (!src) return;
          if (/^(input|select|textarea)$/.test(ttag) && src.tagName.toLowerCase() === 'label') { src.setAttribute('for', ensureId(t)); return; }
          setAttr(t, 'aria-labelledby', ensureId(src));
          return;
        }
        var val = metadataValue(v, t, ctx.patternEl);
        if (!val) return;
        if (/^(img|area)$/.test(ttag) || (ttag === 'input' && (t.getAttribute('type') || '').toLowerCase() === 'image')) { setAttr(t, 'alt', val); return; }
        if (/^(embed|object)$/.test(ttag)) { t.setAttribute('u1st-data', escape(val)); return; }
        if (/^(input|select|textarea)$/.test(ttag)) {
          var type = (t.getAttribute('type') || '').toLowerCase();
          if (ttag === 'input' && /^(submit|button|reset)$/.test(type)) { t.setAttribute('value', val); return; }
          setAttr(t, 'aria-label', val); return;
        }
        if (/^(a|button)$/.test(ttag)) {
          var imgs = $(t).find('img');
          if (!pureText(t) && imgs.length === 1) { setAttr(imgs[0], 'alt', val); return; }
          setAttr(t, 'aria-label', val); return;
        }
        if (t === ctx.patternEl) {
          var heading = $(t).find('h1,h2,h3,h4,h5,h6').filter(function () { return !!pureText(this); })[0];
          if (ctx.pattern.patternType === 'dialog' && heading) { setAttr(t, 'aria-labelledby', ensureId(heading)); return; }
          setAttr(t, 'aria-label', val); return;
        }
        if (ttag === 'table') { setAttr(t, 'aria-label', val); return; }
        setAttr(t, 'aria-label', val);
      });
      if (isImgInput) { /* handled above per target */ }
    },
    noDescription: function (ctx, v, targets) {
      targets.forEach(function (t) {
        var tag = t.tagName.toLowerCase();
        if (tag === 'img' || (tag === 'input' && (t.getAttribute('type') || '').toLowerCase() === 'image')) { t.setAttribute('alt', ''); orFlag(t, 'u1st-status', 8); }
      });
    },
    hideFromSR: function (ctx, v, targets) {
      var val = String(v.srcAbsValue == null || v.srcAbsValue === '' ? 'true' : v.srcAbsValue);
      if (val === '0' || val === '1') val = 'true';
      targets.forEach(function (t) {
        if (hasFlag(t, 'u1st-avoidU1st', 128)) return;
        setAttr(t, 'aria-hidden', val); orFlag(t, 'u1st-status', 256);
        if (val === 'true') { if (isFocusable(t) || t.getAttribute('tabindex') !== null) removeFromTabOrder(t); tabbablesIn(t).forEach(removeFromTabOrder); }
        else { restoreTabOrder(t); $(t).find('[u1st-tiBackup]').each(function () { restoreTabOrder(this); }); }
      });
    },
    tabIndexContainer: function (ctx, v, targets) { targets.forEach(function (t) { t.setAttribute('u1st-ticont', '1'); }); },
    excludeTabIndex: function (ctx, v, targets) {
      targets.forEach(function (t) {
        t.setAttribute('u1st-shouldExcludeTabIndex', '1'); t.setAttribute('tabindex', '-1');
        if (t.tagName.toLowerCase() === 'img' && t.getAttribute('usemap')) {
          var name = t.getAttribute('usemap').replace(/^#/, '');
          $('map[name="' + name + '"]>area').each(function () { this.setAttribute('u1st-shouldExcludeTabIndex', '1'); this.setAttribute('tabindex', '-1'); });
        }
      });
    },
    reverseTabIndexDir: function (ctx, v, targets) { targets.forEach(function (t) { t.setAttribute('u1st-reversedTI', '1'); }); },
    scrollable: function (ctx, v, targets) {
      targets.forEach(function (t) { t.setAttribute('u1st-ticont', '1'); t.style.setProperty('overflow', 'auto', 'important'); makeTabbable(t); });
    },
    replaceTagName: function (ctx, v, targets) {
      var tag = String(v.srcAbsValue || '').trim().toLowerCase(); if (!/^[a-z][a-z0-9]*$/.test(tag)) return;
      targets.forEach(function (t) { if (t.tagName.toLowerCase() !== tag) ctx.deferred.push(function () { replaceTag(t, tag); }); });
    },
    containerElement: function (ctx, v, targets) { targets.forEach(function (t) { if (/^h[1-6]$/i.test(t.tagName)) ctx.deferred.push(function () { replaceTag(t, 'div'); }); }); },
    headingToDiv: function (ctx, v, targets) { APPLIERS.containerElement(ctx, v, targets); },
    redundentAttr: function (ctx, v, targets) {
      var names = [].concat(v.srcAbsValue || []).join(',').split(/[\s,]+/).filter(Boolean);
      targets.forEach(function (t) { names.forEach(function (n) { t.removeAttribute(n); }); });
    },
    haspopup: function (ctx, v, targets) { targets.forEach(function (t) { setAttr(t, 'aria-haspopup', 'true'); }); },
    multiline: function (ctx, v, targets) { targets.forEach(function (t) { setAttr(t, 'aria-multiline', 'true'); }); },
    multiselectable: function (ctx, v, targets) { targets.forEach(function (t) { setAttr(t, 'aria-multiselectable', 'true'); }); },
    readonly: function (ctx, v, targets) { targets.forEach(function (t) { setAttr(t, 'aria-readonly', 'true'); }); },
    required: function (ctx, v, targets) { targets.forEach(function (t) { setAttr(t, 'aria-required', 'true'); }); },
    checked: function (ctx, v, targets) {
      targets.forEach(function (t) { setAttr(t, 'aria-checked', v.srcAbsValue != null && v.srcAbsValue !== '' ? String(v.srcAbsValue) : 'true'); });
    },
    unchecked: function (ctx, v, targets) { targets.forEach(function (t) { setAttr(t, 'aria-checked', v.srcAbsValue != null && v.srcAbsValue !== '' ? String(v.srcAbsValue) : 'false'); }); },
    level: function (ctx, v, targets) { targets.forEach(function (t) { setAttr(t, 'aria-level', String(v.srcAbsValue)); orFlag(t, 'u1st-avoidU1st', 16); }); },
    statable: function (ctx, v, targets) { targets.forEach(function (t) { t.setAttribute('u1st-statable', '1'); }); },
    actionControl: function (ctx, v, targets) {
      // Legacy: among links with the same href, the flagged one keeps it and the
      // others lose their href. Here: the others are taken out of the AT tree
      // and tab order instead, so the mouse still works for everyone.
      targets.forEach(function (t) {
        $(t).data('actionControl', true);
        var href = t.getAttribute('href'); if (!href) return;
        $(ctx.patternEl).find('a[href]').each(function () {
          if (this !== t && this.getAttribute('href') === href && !$(this).data('actionControl')) { setAttr(this, 'aria-hidden', 'true'); removeFromTabOrder(this); }
        });
      });
    },
    stateChangingSection: function (ctx, v, targets) {
      // Legacy blockedArea: while the element matches the condition selector it is
      // blocked — hidden from AT and out of the tab order; unblocked otherwise.
      var cond = String(v.srcAbsValue || '').trim(); if (!cond) return;
      targets.forEach(function (t) {
        var blocked = false; try { blocked = $(t).is(cond); } catch (e) { blocked = $(t).hasClass(cond); }
        if (blocked) { t.setAttribute('u1st-blocked', '1'); setAttr(t, 'aria-hidden', 'true'); tabbablesIn(t).forEach(removeFromTabOrder); }
        else if (t.getAttribute('u1st-blocked') === '1') { t.setAttribute('u1st-blocked', '2'); t.removeAttribute('aria-hidden'); $(t).find('[u1st-tiBackup]').each(function () { restoreTabOrder(this); }); }
      });
    },
    dataTable: function (ctx, v, targets) {
      targets.forEach(function (t) {
        if (t.tagName.toLowerCase() !== 'table' || $(t).data('u1st-dataTable')) return;
        $(t).data('u1st-dataTable', true);
        var cols = String(v.colHeaders || v.columns || '').split(',').map(Number).filter(Boolean);
        var rows = String(v.rowHeaders || v.rows || '').split(',').map(Number).filter(Boolean);
        $(t).find('tr').each(function (ri) {
          $(this).children('td,th').each(function (ci) {
            var isCol = cols.indexOf(ri + 1) > -1, isRow = rows.indexOf(ci + 1) > -1;
            if (!isCol && !isRow) return;
            var cell = this;
            if (cell.tagName.toLowerCase() === 'td' && pureText(cell)) cell = replaceTag(cell, 'th');
            if (isCol) cell.setAttribute('scope', 'col'); else cell.setAttribute('scope', 'row');
          });
        });
      });
    },
    highContrast: function (ctx, v, targets) { if (ctx.modes.isHighContrast || ctx.modes.isGrayScale) targets.forEach(wrapContrast); },
    inverseHighContrast: function (ctx, v, targets) { APPLIERS.highContrast(ctx, v, targets); },
    excludeColorContrast: function (ctx, v, targets) { targets.forEach(function (t) { $(t).data('u1st-excludeColorContrast', true); }); },
    lazyLoading: function () { /* the mutation observer already re-applies */ },
    lazyLoadingTimeout: function () { /* idem */ },
    confirmAction: function (ctx, v, targets) {
      targets.forEach(function (t) {
        if ($(t).data('u1st-confirm')) return; $(t).data('u1st-confirm', true);
        t.addEventListener('click', function (e) {
          var msg = ''; try { msg = metadataValue(v, t, ctx.patternEl); } catch (x) { msg = ''; }
          if (msg && !window.confirm(msg)) { e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);
      });
    },
    formValidation: function (ctx, v, targets) {
      // Minimal faithful subset of the legacy FormValidationHandler: required
      // fields announce as required, invalid fields as invalid, error messages
      // as live alerts, and the first invalid field gets focus after submit.
      var sel = function (k) { var x = v[k]; return x && (typeof x === 'object' ? x.selector : x); };
      targets.forEach(function (form) {
        var req = sel('requiredFieldsSelector'), inv = sel('invalidFieldSelector'), err = sel('errorMsgSelector'), ok = sel('successMsgSelector');
        try { if (req) $(form).find(req).each(function () { setAttr(this, 'aria-required', 'true'); }); } catch (e) { /* noop */ }
        try { if (err) $(form).find(err).each(function () { setAttr(this, 'role', 'alert'); setAttr(this, 'aria-live', 'assertive'); }); } catch (e) { /* noop */ }
        try { if (ok) $(form).find(ok).each(function () { setAttr(this, 'role', 'status'); }); } catch (e) { /* noop */ }
        var mark = function () {
          try {
            $(form).find('[aria-invalid]').each(function () { if (!(inv && $(this).is(inv))) this.removeAttribute('aria-invalid'); });
            if (inv) $(form).find(inv).each(function () { setAttr(this, 'aria-invalid', 'true'); });
          } catch (e) { /* noop */ }
        };
        mark();
        if (!$(form).data('u1st-fv')) {
          $(form).data('u1st-fv', true);
          var onSubmit = function () {
            setTimeout(function () {
              mark();
              if (v.doNotMoveFocus === 'true' || !inv) return;
              var firstBad; try { firstBad = $(form).find(inv).filter(':visible')[0]; } catch (e) { firstBad = null; }
              if (firstBad) { try { firstBad.focus(); } catch (e) { /* noop */ } }
            }, Number(v.waitUntil) || 300);
          };
          form.addEventListener('submit', onSubmit, true);
          $(form).find('[type=submit],button:not([type]),button[type=submit]').each(function () { this.addEventListener('click', onSubmit, true); });
        }
      });
    },
    // ── menu widget ────────────────────────────────────────────────────────
    // The legacy keyboard menu widget (MenuHandler.js), re-done with real ARIA.
    // Rows arrive in three kinds: menuWidget (the menubar: direction,
    // siteNavigation), menuWidgetItem (items: selector relative to their menu,
    // type item|openByClick|openByHover|openByExecuteScript|itemContainer|…),
    // menuWidgetMenu with level ≥ 1 (a submenu: ABSOLUTE selector, direction,
    // closeBy). A submenu is tied to its item the way the legacy did it: when
    // it becomes visible, the item that had focus is its trigger.
    menuWidget: function (ctx, v, targets) {
      targets.forEach(function (bar) {
        var w = menuWidgetOf(bar, true);
        w.direction = String(v.direction || 'horizontal').toLowerCase();
        w.siteNavigation = !!v.siteNavigation;
        bar.setAttribute('u1st-menuWidget', '1'); bar.setAttribute('u1st_menu', 'true');
        setAttr(bar, 'role', 'menubar');
        if (w.direction === 'vertical') setAttr(bar, 'aria-orientation', 'vertical'); else bar.removeAttribute('aria-orientation');
        if (w.siteNavigation && !bar.getAttribute('aria-label') && !bar.getAttribute('aria-labelledby')) setAttr(bar, 'aria-label', R.langCode.indexOf('he') === 0 ? 'תפריט ניווט' : 'Navigation menu');
        installMenuKeys(bar);
      });
    },
    menuWidgetMenu: function (ctx, v, targets) {
      if (String(v.level || '0') === '0') return; // level 0 is the menubar row itself
      var selv = v.selector && (typeof v.selector === 'object' ? v.selector.selector : v.selector);
      if (!selv || selv === '.') return;
      targets.forEach(function (bar) {
        var w = menuWidgetOf(bar, true);
        var key = selv;
        if (!w.submenus[key]) w.submenus[key] = { selector: selv, level: Number(v.level) || 1, direction: String(v.direction || 'vertical').toLowerCase(), closeBy: v.closeBy || '', closeBySelector: v.closeBySelector || v.closeButtonSelector || null, closeScript: v.closeByExecuteScriptFunc || null, attached: v.attachedMenu === 'true', items: [] };
        var sub = w.submenus[key];
        if (sub.closeBySelector && typeof sub.closeBySelector === 'object') sub.closeBySelector = sub.closeBySelector.selector;
        try { $(selv); } catch (e) { warn('menu selector', selv, e.message); }
      });
    },
    menuWidgetItem: function (ctx, v, targets) {
      var selv = v.selector && (typeof v.selector === 'object' ? v.selector.selector : v.selector); if (!selv) return;
      var level = Number(v.level) || 0;
      var type = String(v.type || 'item').trim();
      var script = v.openByExecuteScriptFunc || v.script || null;
      targets.forEach(function (bar) {
        var w = menuWidgetOf(bar, true);
        if (level === 0) {
          if (w.itemSelectors.indexOf(selv) < 0) w.itemSelectors.push(selv);
          w.itemTypes[selv] = { type: type, script: script, openAttached: v.openAttachedMenu === 'true' };
          markMenuItems(bar, bar, selv, w.itemTypes[selv], 0);
        } else {
          var ms = v.menuSelector && (typeof v.menuSelector === 'object' ? v.menuSelector.selector : v.menuSelector);
          if (!ms || ms === '.') return;
          var sub = w.submenus[ms] || (w.submenus[ms] = { selector: ms, level: level, direction: 'vertical', closeBy: '', closeBySelector: null, closeScript: null, attached: false, items: [] });
          if (!sub.items.some(function (i) { return i.selector === selv && i.type === type; })) sub.items.push({ selector: selv, type: type, script: script });
        }
      });
    },
    datePicker: function (ctx, v, targets) { if (!ctx.warned.datePicker) { ctx.warned.datePicker = true; warn('datePicker widget: not re-implemented; map it with the native Studio "datepicker" type.'); } },
  };
  ['selected', 'disabled', 'expanded', 'autocomplete', 'live', 'valuemax', 'valuemin', 'valueMax', 'valueMin'].forEach(function (k) {
    APPLIERS[k] = function (ctx, v, targets) {
      var attr = 'aria-' + k.toLowerCase();
      targets.forEach(function (t) { var val; try { val = metadataValue(v, t, ctx.patternEl); } catch (e) { val = v.srcAbsValue; } if (val != null) setAttr(t, attr, String(val)); });
    };
  });
  ['controls', 'owns', 'flowto', 'describedby'].forEach(function (k) {
    APPLIERS[k] = function (ctx, v, targets) {
      var ids = [];
      if (v.elementID) ids = [String(v.elementID)];
      else if (v.elementSelector) {
        var sel = typeof v.elementSelector === 'object' ? v.elementSelector.selector : v.elementSelector;
        ids = findInPatternOrDocument(ctx.patternEl, sel).map(ensureId);
      }
      if (!ids.length) return;
      targets.forEach(function (t) { setAttr(t, 'aria-' + k, ids.join(' ')); $(t).data('u1st-' + k + '-selector', v.elementID ? '#' + v.elementID : (typeof v.elementSelector === 'object' ? v.elementSelector.selector : v.elementSelector)); });
    };
  });

  // ── menu widget runtime ───────────────────────────────────────────────────
  var OPEN_TYPES = { openByClick: 1, openByHover: 1, openByExecuteScript: 1 };
  function menuWidgetOf(bar, create) {
    var w = $(bar).data('u1st-mw');
    if (!w && create) { w = { bar: bar, direction: 'horizontal', siteNavigation: false, itemSelectors: [], itemTypes: {}, submenus: {}, pending: null, polled: false }; $(bar).data('u1st-mw', w); R.menuWidgets.push(w); }
    return w;
  }
  function markMenuItems(bar, menuEl, selector, info, level) {
    var found = [];
    try { found = (selector === '.') ? [menuEl] : $(menuEl).find(selector).toArray(); } catch (e) { warn('menu item selector', selector, e.message); return; }
    found.forEach(function (it) {
      it.setAttribute('u1st_menuItem', info.type);
      $(it).data('u1st-mwInfo', info); $(it).data('u1st-mwBar', bar); $(it).data('u1st-mwMenu', menuEl);
      if (info.type === 'itemContainer') { it.setAttribute('u1st-ticont', '1'); setAttr(it, 'role', 'menuitem'); }
      else if (info.type === 'menuitemcheckbox' || info.type === 'menuitemradio') setAttr(it, 'role', info.type);
      else setAttr(it, 'role', 'menuitem');
      if (OPEN_TYPES[info.type]) { setAttr(it, 'aria-haspopup', 'true'); if (it.getAttribute('aria-expanded') === null) setAttr(it, 'aria-expanded', 'false'); }
      $(it).parent('li').each(function () { if (!this.getAttribute('role')) setAttr(this, 'role', 'none'); });
      orFlag(it, 'u1st-avoidU1st', 2);
    });
    rovingTabindex(menuEl);
  }
  function markSubmenu(menuEl, sub, bar) {
    if ($(menuEl).data('u1st-mwSub')) return;
    $(menuEl).data('u1st-mwSub', sub); $(menuEl).data('u1st-mwBar', bar);
    menuEl.setAttribute('u1st_menu', 'true');
    setAttr(menuEl, 'role', 'menu');
    if (sub.direction === 'horizontal') setAttr(menuEl, 'aria-orientation', 'horizontal');
    sub.items.forEach(function (it) { markMenuItems(bar, menuEl, it.selector, it, sub.level); });
    $(menuEl).find('li').each(function () { if (!this.getAttribute('role')) setAttr(this, 'role', 'none'); });
    installMenuKeys(menuEl);
  }
  function menuItemsOf(menuEl, visibleOnly) {
    var items = $(menuEl).find('[u1st_menuItem]').toArray();
    if (menuEl.getAttribute('u1st_menuItem')) items.unshift(menuEl);
    // items of a nested submenu belong to that submenu, not to this one
    items = items.filter(function (it) { var m = $(it).parent().closest('[u1st_menu]')[0]; return m === menuEl || !m || (it === menuEl); });
    return visibleOnly ? items.filter(actuallyVisible) : items;
  }
  // One tab stop per menu: the current (or first visible) item is 0, the rest -1.
  function rovingTabindex(menuEl, current) {
    var items = menuItemsOf(menuEl, false);
    var vis = items.filter(actuallyVisible);
    var cur = current || items.filter(function (i) { return i.getAttribute('tabindex') === '0'; })[0] || vis[0];
    items.forEach(function (it) { it.setAttribute('tabindex', it === cur ? '0' : '-1'); it.setAttribute('u1st-shouldExcludeTabIndex', it === cur ? '0' : '1'); });
  }
  function focusMenuItem(it) { if (!it) return; var m = $(it).parent().closest('[u1st_menu]')[0] || $(it).data('u1st-mwMenu'); if (m) rovingTabindex(m, it); try { it.focus(); } catch (e) { /* noop */ } }
  function siblingItem(it, dir) {
    var m = $(it).parent().closest('[u1st_menu]')[0] || $(it).data('u1st-mwMenu'); if (!m) return null;
    var vis = menuItemsOf(m, true); if (!vis.length) return null;
    var i = vis.indexOf(it); if (i < 0) return vis[0];
    return vis[(i + dir + vis.length) % vis.length];
  }
  function releaseForcedHidden(bar) {
    var w = bar && menuWidgetOf(bar); if (!w) return;
    Object.keys(w.submenus).forEach(function (k) { try { $(w.submenus[k].selector).each(function () { if ($(this).data('u1st-mwForcedHidden')) { this.style.display = ''; $(this).removeData('u1st-mwForcedHidden'); } }); } catch (e) { /* noop */ } });
  }
  function runOpen(it) {
    var info = $(it).data('u1st-mwInfo') || {};
    var bar = $(it).data('u1st-mwBar');
    var w = bar && menuWidgetOf(bar);
    releaseForcedHidden(bar);
    if (w) { w.lastOpened = it; w.lastOpenedAt = Date.now(); }
    R.lastFocused = it;
    setTimeout(function () {
      try {
        if (info.type === 'openByExecuteScript' && info.script) { var fn = new Function('return (' + unescapeMaybe(info.script) + ');')(); fn.call(it, it, $, apiProxy); return; }
        if (info.type === 'openByHover') {
          // replay the hover the site listens for, on the item and its ancestors up to the menubar
          var chain = [it].concat($(it).parentsUntil(bar).toArray()); if (bar) chain.push(bar);
          chain.forEach(function (el) { ['mouseenter', 'mouseover', 'mousemove', 'focusin'].forEach(function (t) { evt(el, t); }); });
          return;
        }
        // openByClick means "open the submenu", never "follow the link": the
        // site's click handlers run (they open the menu), the anchor's own
        // navigation does not. Enter still navigates natively.
        var href = it.getAttribute && it.getAttribute('href');
        if (href && !/^(#|javascript:)/i.test(href.trim())) it.addEventListener('click', function (e) { e.preventDefault(); }, { capture: true, once: true });
        if (!anySubmenuVisible(w, it)) fireHover(it, bar, HOVER_IN);
        if (!anySubmenuVisible(w, it)) it.click();
      } catch (e) { warn('menu open failed:', e.message); }
    }, 50);
  }
  function unescapeMaybe(s) { try { return /%[0-9A-Fa-f]{2}/.test(s) ? decodeURIComponent(s) : s; } catch (e) { return unescape(s); } }
  function closeSubmenu(menuEl, then) {
    var sub = $(menuEl).data('u1st-mwSub') || {}, bar = $(menuEl).data('u1st-mwBar');
    var trigger = $(menuEl).data('u1st-mwTrigger');
    var w = bar && menuWidgetOf(bar); if (w && w.hovered === trigger) w.hovered = null;
    var done = function () { if (then) then(trigger); };
    try {
      if (sub.closeBy === 'clickOnTrigger' && trigger) { trigger.click(); }
      else if (sub.closeBy === 'clickOnButton' && sub.closeBySelector) { var b = bar ? $(bar).find(sub.closeBySelector)[0] : null; if (!b) b = $(sub.closeBySelector)[0]; if (b) b.click(); }
      else if (sub.closeBy === 'closeByExecuteScript' && sub.closeScript) { var fn = new Function('return (' + unescapeMaybe(sub.closeScript) + ');')(); fn.call(menuEl, menuEl, $, apiProxy); }
      else {
        var chain = [menuEl].concat($(menuEl).parentsUntil(bar).toArray());
        chain.forEach(function (el) { ['mouseleave', 'mouseout', 'focusout', 'blur'].forEach(function (t) { evt(el, t); }); });
        if (trigger) fireHover(trigger, bar, HOVER_OUT);
        // a bootstrap-style toggle closes on a second click; only when the click cannot navigate
        if (trigger && trigger.getAttribute('aria-expanded') === 'true' && !(trigger.getAttribute('href') && !/^(#|javascript:)/i.test(trigger.getAttribute('href')))) trigger.click();
      }
    } catch (e) { warn('menu close failed:', e.message); }
    // legacy fallback chain: still visible after 300ms → hide it ourselves
    setTimeout(function () { if (actuallyVisible(menuEl) && trigger) fireHover(trigger, bar, HOVER_OUT); setTimeout(function () { if (actuallyVisible(menuEl)) { $(menuEl).data('u1st-mwForcedHidden', true); menuEl.style.display = 'none'; } done(); }, 300); }, 300);
  }
  function openSubmenusOf(bar) { return $(bar).data('u1st-mwOpen') || []; }
  function closeAll(bar, then) {
    var open = openSubmenusOf(bar).slice().reverse(); // deepest first
    if (!open.length) { if (then) then(null); return; }
    var i = 0; var next = function (t) { if (i >= open.length) { if (then) then(t); return; } closeSubmenu(open[i++], next); }; next();
  }
  var HOVER_IN = ['mouseenter', 'mouseover', 'mousemove'], HOVER_OUT = ['mouseleave', 'mouseout'];
  function hoverChain(it, bar) { var chain = [it].concat($(it).parentsUntil(bar).toArray()); return chain; }
  function fireHover(it, bar, names) { hoverChain(it, bar).forEach(function (el) { names.forEach(function (n) { evt(el, n); }); }); }
  // Is a submenu of THIS item open? Submenu selectors are document-wide, so
  // only menus inside the item's own list entry count (an unrelated dropdown
  // elsewhere on the page must not look like "already open").
  function anySubmenuVisible(w, it) {
    var scope = (it && ($(it).closest('li')[0] || it.parentNode)) || w.bar;
    return Object.keys(w.submenus).some(function (k) { try { return $(w.submenus[k].selector).toArray().some(function (m) { return scope.contains(m) && actuallyVisible(m) && inViewport(m); }); } catch (e) { return false; } });
  }
  function installMenuHoverOnFocus(bar) {
    if ($(bar).data('u1st-mwHover')) return; $(bar).data('u1st-mwHover', true);
    var w = menuWidgetOf(bar);
    bar.addEventListener('focusin', function (e) {
      var it = e.target && e.target.closest && e.target.closest('[u1st_menuItem]'); if (!it) return;
      var info = $(it).data('u1st-mwInfo') || {};
      var menu = $(it).parent().closest('[u1st_menu]')[0]; if (menu !== bar) return; // only menubar items open by focus
      if (info.type === 'openByHover') return; // legacy: hover items were flagged avoid_focus
      if (w.hovered && w.hovered !== it && !$(w.hovered).parent().closest('li,[u1st_menuItem]').has(it).length) fireHover(w.hovered, bar, HOVER_OUT);
      if (w.hovered !== it) {
        w.hovered = it; w.lastFocusOpen = Date.now(); releaseForcedHidden(bar);
        // After the focus has settled, not inside its dispatch, and exactly
        // ONCE: a site whose hover handler toggles (Genesis does) closes the
        // menu on a second mouseover.
        // …and only if the site did not already open it on focus by itself
        // (Genesis does; a replayed hover would then toggle it shut again).
        setTimeout(function () {
          var open = anySubmenuVisible(w, it);
          debug('menu: 120ms after focus — still hovered:', w.hovered === it, '| submenu already open:', open);
          if (w.hovered === it && !open) { fireHover(it, bar, HOVER_IN); setTimeout(function () { debug('menu: 300ms after replay — open:', anySubmenuVisible(w, it)); }, 300); }
        }, 120);
        debug('menu: focus → hover on', it.textContent.trim().slice(0, 20));
      }
    }, true);
    document.addEventListener('focusin', function (e) {
      if (!w.hovered) return;
      var t = e.target; if (!t || t.nodeType !== 1) return;
      if (bar.contains(t)) return;
      if (openSubmenusOf(bar).some(function (m) { return m.contains(t); })) return;
      fireHover(w.hovered, bar, HOVER_OUT); w.hovered = null;
    }, true);
  }
  function installMenuKeys(el) {
    if ($(el).data('u1st-mwKeys')) return; $(el).data('u1st-mwKeys', true);
    if (el.getAttribute('u1st-menuWidget') === '1') installMenuHoverOnFocus(el);
    el.addEventListener('keydown', function (e) {
      var it = e.target; if (!it || it.nodeType !== 1 || !it.getAttribute('u1st_menuItem')) return;
      var bar = $(it).data('u1st-mwBar'); if (!bar) return;
      var w = menuWidgetOf(bar); if (!w) return;
      var menu = $(it).parent().closest('[u1st_menu]')[0] || $(it).data('u1st-mwMenu');
      var isBar = menu === bar;
      var sub = isBar ? null : $(menu).data('u1st-mwSub');
      var dir = isBar ? w.direction : ((sub && sub.direction) || 'vertical');
      var info = $(it).data('u1st-mwInfo') || {}; var opens = !!OPEN_TYPES[info.type];
      var rtl = window.getComputedStyle(it).direction === 'rtl';
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') { e.preventDefault(); e.stopPropagation(); if (opens) runOpen(it); return; }
      if (k === 'Escape') { if (!isBar) { e.preventDefault(); e.stopPropagation(); w.pending = null; closeSubmenu(menu, function (t) { w.hovered = t || w.lastOpened; focusMenuItem(t || w.lastOpened); }); } return; }
      if (k === 'Tab') {
        if (isBar) return; // roving tabindex: native Tab leaves the menubar
        e.preventDefault(); e.stopPropagation(); var shift = e.shiftKey;
        closeAll(bar, function () { var t = w.lastOpened || menuItemsOf(bar, true)[0]; focusMenuItem(t); setTimeout(function () { stepTab(t, shift); }, 30); });
        return;
      }
      if (k === 'Home' || k === 'End') { var vis = menuItemsOf(menu, true); focusMenuItem(k === 'Home' ? vis[0] : vis[vis.length - 1]); return; }
      if (!/^Arrow(Left|Right|Up|Down)$/.test(k)) return;
      e.preventDefault(); e.stopPropagation();
      var key = k.replace('Arrow', '');
      if (rtl) key = { Left: 'Right', Right: 'Left', Up: 'Up', Down: 'Down' }[key];
      if ((isBar && dir === 'vertical') || (!isBar && dir === 'horizontal')) key = { Left: 'Up', Right: 'Down', Down: 'Right', Up: 'Left' }[key];
      if (key === 'Left') {
        if (isBar) focusMenuItem(siblingItem(it, -1));
        else if (sub && sub.level === 1) { w.pending = 'prev'; closeSubmenu(menu, function (t) { afterClose(w, t); }); }
        else closeSubmenu(menu, function (t) { focusMenuItem(t); });
      } else if (key === 'Right') {
        if (isBar) focusMenuItem(siblingItem(it, 1));
        else if (opens) runOpen(it);
        else { w.pending = 'next'; closeAll(bar, function (t) { afterClose(w, t); }); }
      } else if (key === 'Up') { if (!isBar) focusMenuItem(siblingItem(it, -1)); }
      else if (key === 'Down') { if (isBar) { if (opens) runOpen(it); } else focusMenuItem(siblingItem(it, 1)); }
    }, true);
  }
  function afterClose(w, trigger) {
    var t = trigger || w.lastOpened; var pend = w.pending; w.pending = null;
    if (!t) return;
    focusMenuItem(t);
    if (pend === 'next' || pend === 'prev') {
      var vis = menuItemsOf(w.bar, true), i = vis.indexOf(t), n = vis.length;
      for (var step = 1; step <= n; step++) { var cand = vis[(i + (pend === 'next' ? step : -step) + n) % n]; var inf = $(cand).data('u1st-mwInfo') || {}; if (OPEN_TYPES[inf.type]) { focusMenuItem(cand); runOpen(cand); return; } }
    }
  }
  function stepTab(from, shift) {
    var all = $(FOCUSABLE).filter(function () { return isFocusable(this); }).toArray();
    var i = all.indexOf(from); if (i < 0) return;
    var bar = $(from).data('u1st-mwBar');
    for (var j = i + (shift ? -1 : 1); j >= 0 && j < all.length; j += (shift ? -1 : 1)) { if (bar && bar.contains(all[j])) continue; try { all[j].focus(); } catch (e) { /* noop */ } return; }
  }
  // Submenus are found by watching them appear, like the legacy popup poll.
  // Submenu selectors are document-wide and several menubars may share one
  // (a pattern selector that matches six <ul>s registers the same ".dropdown-menu"
  // six times), so each visible menu is judged ONCE per tick and handed to the
  // widget that owns its trigger — the item that opened it or had focus.
  function ownerWidgetFor(menuEl) {
    var now = Date.now(), best = null;
    R.menuWidgets.forEach(function (w) { if (w.lastOpened && now - (w.lastOpenedAt || 0) < 1500 && (!best || w.lastOpenedAt > best.lastOpenedAt)) best = w; });
    if (best) return { w: best, trigger: best.lastOpened };
    var it = R.lastFocused && R.lastFocused.closest ? R.lastFocused.closest('[u1st_menuItem]') : null;
    if (!it) return null;
    var bar = $(it).data('u1st-mwBar'); var w = bar && menuWidgetOf(bar);
    return w ? { w: w, trigger: it } : null;
  }
  function pollMenus() {
    var seen = [];
    R.menuWidgets.forEach(function (w) {
      if (!document.documentElement.contains(w.bar)) return;
      Object.keys(w.submenus).forEach(function (key) {
        var sub = w.submenus[key], els = [];
        try { els = $(sub.selector).toArray(); } catch (e) { return; }
        els.forEach(function (menuEl) {
          if (seen.indexOf(menuEl) > -1) return; seen.push(menuEl);
          try {
          if ($(menuEl).data('u1st-mwForcedHidden')) return; // hidden by us (legacy $menu.hide()); released on the next open
          var visible = actuallyVisible(menuEl) && inViewport(menuEl) && !!menuEl.querySelector('*');
          var was = $(menuEl).data('u1st-mwVisible') === true;
          debug('menu poll', menuEl.id || menuEl.className, 'visible', visible, 'was', was);
          if (visible && !was) { var o = ownerWidgetFor(menuEl); if (o) submenuOpened(o.w, menuEl, o.trigger); }
          else if (!visible && was) submenuClosed($(menuEl).data('u1st-mwOwner') || w, menuEl);
          } catch (e) { warn('menu poll:', e && e.message, e && e.stack && e.stack.split('\n')[1]); }
        });
      });
    });
  }
  function submenuOpened(w, menuEl, trigger) {
    if (!trigger) return; // opened by the mouse with no item focused: not ours to manage
    $(menuEl).data('u1st-mwVisible', true); $(menuEl).data('u1st-mwOwner', w);
    var sub = null; Object.keys(w.submenus).some(function (k) { try { if ($(menuEl).is(w.submenus[k].selector)) { sub = w.submenus[k]; return true; } } catch (e) { /* noop */ } return false; });
    if (sub && !$(menuEl).data('u1st-mwSub')) markSubmenu(menuEl, sub, w.bar);
    $(menuEl).data('u1st-mwTrigger', trigger);
    setAttr(trigger, 'aria-expanded', 'true');
    var open = openSubmenusOf(w.bar); if (open.indexOf(menuEl) < 0) open.push(menuEl); $(w.bar).data('u1st-mwOpen', open);
    menuEl.setAttribute('u1st-popup', '1');
    var opened = w.lastOpened === trigger && Date.now() - (w.lastOpenedAt || 0) < 1500;
    if (opened) {
      var tries = 0;
      var tryFocus = function () {
        if (!actuallyVisible(menuEl)) return;
        var first = menuItemsOf(menuEl, true)[0] || tabbablesIn(menuEl)[0];
        if (first) { focusMenuItem(first); return; }
        if (++tries < 12) setTimeout(tryFocus, 100); // the site is still animating it in
      };
      setTimeout(tryFocus, 30);
    }
  }
  function submenuClosed(w, menuEl) {
    $(menuEl).data('u1st-mwVisible', false);
    var trigger = $(menuEl).data('u1st-mwTrigger');
    if (trigger) setAttr(trigger, 'aria-expanded', 'false');
    $(w.bar).data('u1st-mwOpen', openSubmenusOf(w.bar).filter(function (m) { return m !== menuEl; }));
    var active = document.activeElement;
    if (trigger && (!active || active === document.body || menuEl.contains(active))) focusMenuItem(trigger);
  }

  function inViewport(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight) && r.left < (window.innerWidth || document.documentElement.clientWidth);
  }
  function replaceTag(el, tag) {
    if (!el.parentNode || el.tagName.toLowerCase() === tag) return el;
    var n = document.createElement(tag);
    for (var i = 0; i < el.attributes.length; i++) n.setAttribute(el.attributes[i].name, el.attributes[i].value);
    while (el.firstChild) n.appendChild(el.firstChild);
    var hadFocus = document.activeElement === el;
    el.parentNode.replaceChild(n, el);
    if (hadFocus) try { n.focus(); } catch (e) { /* noop */ }
    return n;
  }
  function wrapContrast(root) {
    if ($(root).data('u1st-excludeColorContrast')) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim() && !/^(script|style|u1st-span)$/i.test(n.parentNode.tagName)) nodes.push(n);
    nodes.forEach(function (tn) {
      var w = document.createElement('u1st-span');
      w.className = '_u1st_invertedSpanWrapper';
      w.style.cssText = 'color:#fff!important;background:#000!important;';
      tn.parentNode.insertBefore(w, tn); w.appendChild(tn);
    });
  }
  function unwrapContrast() {
    $('u1st-span._u1st_invertedSpanWrapper').each(function () { var p = this.parentNode; while (this.firstChild) p.insertBefore(this.firstChild, this); p.removeChild(this); });
  }

  // ── the scripts API (options.api) ──────────────────────────────────────────
  function els(T, ctx) {
    if (T == null) return [];
    if (typeof T === 'string') { try { return $(T, ctx || document.body).toArray(); } catch (e) { warn('api: bad selector', T); return []; } }
    if (T.jquery) return T.toArray();
    if (T.nodeType) return [T];
    if (T.length != null) return [].slice.call(T);
    return [];
  }
  var cssRuleIds = {};
  var HT = { mouseover: 1, mouseout: 2, click: 4, flowToSR: 8, ariaLevel: 16, triggerElement: 32, tabindex: 64, ariaHidden: 128, dynamic: 256, cssHoverFocus: 512, cssHoverBlur: 1024, bgImgProcess: 2048 };
  var FEAT = { screenReader: 1, keyboard: 2, colors: 4, help: 8, blockBlinking: 16, fontSize: 32, all: 0xFFFF };
  var trackedListeners = [];
  function evt(el, type) {
    var e;
    try {
      if (/^(click|dblclick|mouse\w+)$/.test(type)) e = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
      else if (/^key/.test(type)) e = new KeyboardEvent(type, { bubbles: true, cancelable: true });
      else e = new Event(type, { bubbles: true, cancelable: true });
    } catch (x) { e = document.createEvent('Event'); e.initEvent(type, true, true); }
    el.dispatchEvent(e);
  }
  function resolveTarget(spec, triggerEl) {
    if (typeof spec === 'string') return spec.charAt(0) === '=' ? evalRelative($(triggerEl), spec.slice(1), false)[0] : $(spec).first()[0];
    if (spec && spec.jquery) return spec.first()[0];
    return spec && spec.nodeType ? spec : null;
  }
  var KEYS = { tab: function (e) { return e.key === 'Tab' && !e.shiftKey; }, shifttab: function (e) { return e.key === 'Tab' && e.shiftKey; }, enter: function (e) { return e.key === 'Enter'; }, space: function (e) { return e.key === ' ' || e.key === 'Spacebar'; }, up: function (e) { return e.key === 'ArrowUp'; }, down: function (e) { return e.key === 'ArrowDown'; }, right: function (e) { return e.key === 'ArrowRight'; }, left: function (e) { return e.key === 'ArrowLeft'; } };

  var api = {
    focus: function (T, ctx) { var e = els(T, ctx)[0]; if (e) try { e.focus(); } catch (x) { /* noop */ } },
    blur: function (T, ctx) { var e = els(T, ctx)[0]; if (e) try { e.blur(); } catch (x) { /* noop */ } },
    allowFocus: function (T, ctx) { els(T, ctx).forEach(function (e) { e.u1st_allowFocus = true; }); },
    allowBlur: function (T, ctx) { els(T, ctx).forEach(function (e) { e.u1st_allowBlur = true; }); },
    addEventListener: function (T, type, listener, useCapture) {
      var parts = String(type).split('.'), t = parts[0], ns = parts[1] || '';
      els(T).forEach(function (e) { e.addEventListener(t, listener, !!useCapture); trackedListeners.push({ el: e, type: t, ns: ns, fn: listener, cap: !!useCapture }); });
    },
    removeEventsListeners: function (T, types, ctx) {
      var want = [].concat(types || []);
      els(T, ctx).forEach(function (e) {
        trackedListeners = trackedListeners.filter(function (l) {
          if (l.el !== e || (want.length && want.indexOf(l.type) === -1 && want.indexOf(l.type + '.' + l.ns) === -1)) return true;
          e.removeEventListener(l.type, l.fn, l.cap); return false;
        });
      });
    },
    getElementEventsListeners: function (T) {
      var e = els(T)[0], out = {}; if (!e) return out;
      trackedListeners.forEach(function (l) { if (l.el === e) (out[l.type] = out[l.type] || []).push(l.fn); });
      return out;
    },
    blockEventsListeners: function (T, type, ctx) { els(T, ctx).forEach(function (e) { e['u1st_blockListener' + type] = true; }); },
    replaceElementEventWithAnother: function (T, orgType, newType, orgCallback, predicate, ctx) {
      els(T, ctx).forEach(function (e) {
        var inline = e['on' + orgType];
        if (inline) { e['on' + orgType] = null; }
        var mine = trackedListeners.filter(function (l) { return l.el === e && l.type === orgType; });
        mine.forEach(function (l) { e.removeEventListener(l.type, l.fn, l.cap); });
        e.addEventListener(newType, function (ev) {
          if (predicate && !predicate.call(e, ev)) return;
          if (inline) inline.call(e, ev);
          mine.forEach(function (l) { l.fn.call(e, ev); });
        });
        if (orgCallback) e.addEventListener(orgType, orgCallback);
      });
    },
    eventFire: function (el, type) { var e = els(el)[0]; if (!e) return; if (type === 'click' && e.click) e.click(); else evt(e, type); },
    bindEventsToTargetEvent: function (ctx, trigger, triggerEvents, targets, targetEvent, latency, predicate, cb) {
      var trig = els(trigger, ctx); var evs = [].concat(triggerEvents || ['click']);
      trig.forEach(function (te) {
        evs.forEach(function (tev) {
          te.addEventListener(tev, function (ev) {
            if (predicate && !predicate.call(te, ev)) return;
            var tries = 0;
            var go = function () {
              [].concat(targets).forEach(function (spec) {
                var t = resolveTarget(spec, te);
                if (t && actuallyVisible(t)) {
                  if ((targetEvent || 'focus') === 'focus') { makeTabbable(t); try { t.focus(); } catch (x) { /* noop */ } } else evt(t, targetEvent);
                  if (cb) cb.call(t);
                } else if (++tries < 20) setTimeout(go, 50);
              });
            };
            setTimeout(go, Number(latency) || 0);
          });
        });
      });
    },
    setNextFocus: function (ctx, trigger, keys, targets, latency, cb) {
      [].concat(keys || []).forEach(function (k) {
        var pred = KEYS[String(k).toLowerCase()]; if (!pred) return;
        els(trigger, ctx).forEach(function (te) {
          te.addEventListener('keydown', function (ev) {
            if (!pred(ev)) return;
            ev.preventDefault();
            var tries = 0;
            var go = function () {
              [].concat(targets).forEach(function (spec) {
                var t = resolveTarget(spec, te);
                if (t && actuallyVisible(t)) { makeTabbable(t); try { t.focus(); } catch (x) { /* noop */ } if (cb) cb.call(t); }
                else if (++tries < 20) setTimeout(go, 50);
              });
            };
            setTimeout(go, Number(latency) || 0);
          });
        });
      });
    },
    blockKeybaordListenerforKeys: function (T, which, ctx) { els(T, ctx).forEach(function (e) { for (var k in which) if (which[k]) e['u1st_block' + k + 'Applied'] = true; }); },
    setAttr: function (el, name, value) { els(el).forEach(function (e) { setAttr(e, name, value); }); },
    getAttr: function (el, name) { var e = els(el)[0]; return e ? e.getAttribute(name) : undefined; },
    addAttrListener: function (T, attr, cb) {
      els(T).forEach(function (e) {
        new MutationObserver(function (recs) { recs.forEach(function (r) { if (r.attributeName === attr) setTimeout(function () { cb({ el: e, attrName: attr, value: e.getAttribute(attr) }); }, 10); }); }).observe(e, { attributes: true });
      });
    },
    forceRoleValue: function (T, role, ctx) { els(T, ctx).forEach(function (e) { if (role) e.setAttribute('role', role); else e.removeAttribute('role'); e.setAttribute('u1st-status', '16'); }); },
    replaceElementTagName: function (T, tag, ctx) { return $(els(T, ctx).map(function (e) { return replaceTag(e, String(tag).toLowerCase()); })); },
    forceTabbable: function (T, ctx) { els(T, ctx).forEach(function (e) { orFlag(e, 'u1st-status', 512); e.setAttribute('u1st-forcedTabbable', '1'); makeTabbable(e); }); },
    hideElement: function (T, screenReader, keyboard) {
      if (screenReader === undefined && keyboard === undefined) { screenReader = true; keyboard = true; }
      els(T).forEach(function (e) {
        if (keyboard) { e.setAttribute('u1st-ingoreTI', '1'); if (isFocusable(e) || e.getAttribute('tabindex') !== null) removeFromTabOrder(e); }
        if (screenReader) { orFlag(e, 'u1st-status', 256); if (e.getAttribute('u1st-ahBackup') === null) e.setAttribute('u1st-ahBackup', e.getAttribute('aria-hidden') || ''); e.setAttribute('aria-hidden', 'true'); }
      });
    },
    unHideElement: function (T) {
      els(T).forEach(function (e) {
        e.removeAttribute('u1st-ingoreTI'); restoreTabOrder(e);
        var b = e.getAttribute('u1st-ahBackup'); if (b !== null) { if (b) e.setAttribute('aria-hidden', b); else e.removeAttribute('aria-hidden'); e.removeAttribute('u1st-ahBackup'); }
      });
    },
    setIsVisible: function (T, fn, ctx) { els(T, ctx).forEach(function (e) { $(e).data('u1st-isVisible', fn); }); },
    setHasSize: function (T, fn, ctx) { els(T, ctx).forEach(function (e) { $(e).data('u1st-hasSize', fn); }); },
    setInstructions: function (T, inst, features, opts, ctx) {
      opts = opts || {};
      els(T, ctx).forEach(function (e) {
        var txt = typeof inst === 'object' && inst ? (inst[R.langCode] || inst[R.langCode.split(/[-_]/)[0]] || inst[Object.keys(inst)[0]]) : inst;
        if (!txt) return;
        txt = evaluateExpression(e, String(txt), e);
        var where = opts.placement || opts.location || 'before';
        if (where === 'ariaLabel' || where === 'tempAriaLabel') { setAttr(e, 'aria-label', txt); return; }
        if ($(e).data('u1st-instText') === txt) return;
        $(e).data('u1st-instText', txt);
        $(e).data('u1st-instNode') && $($(e).data('u1st-instNode')).remove();
        var span = document.createElement('span');
        span.className = 'u1st-instructions';
        span.style.cssText = 'position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
        span.textContent = txt;
        if (where === 'append') e.appendChild(span); else if (where === 'prepend') e.insertBefore(span, e.firstChild);
        else if (where === 'after') e.parentNode && e.parentNode.insertBefore(span, e.nextSibling);
        else e.parentNode && e.parentNode.insertBefore(span, e);
        $(e).data('u1st-instNode', span);
        e.setAttribute('u1st-inst', '1');
      });
    },
    setAutocompleteList: function (T, ctx) { els(T, ctx).forEach(function (e) { e.setAttribute('u1st-autocompleteDropdown', 'true'); }); },
    setImportantIframes: function (T, ctx) { els(T, ctx).forEach(function (e) { e.setAttribute('u1st-importantIframe', 'true'); }); },
    linkToExpression: function (T, expr, ctx) { if (typeof expr !== 'string') throw new Error('linkToExpression: expression must be a string'); els(T, ctx).forEach(function (e) { e.setAttribute('u1st-linkToExp', expr); }); },
    constants: { handlingTypes: HT, features: FEAT },
    consts: HT,
    isDesktop: function () { return isDesktop; }, isTablet: function () { return isTablet; }, isMobile: function () { return isMobile; },
    isIE: function () { return /Trident|MSIE/.test(UA); }, isIE8: function () { return false; },
    isFirefox: function () { return /Firefox/.test(UA); }, isChrome: function () { return /Chrome/.test(UA) && UA.indexOf('Edg/') === -1; }, isSafari: function () { return /Safari/.test(UA) && !/Chrome/.test(UA); },
    isJaws: function () { return isDesktop; },
    avoidU1stFeature: function (T, type, ctx) { els(T, ctx).forEach(function (e) { if (type === 256) e['u1st-avoidDynamic'] = true; else orFlag(e, 'u1st-avoidU1st', type); }); },
    forceU1stAnchorHandler: function (T, ctx) { els(T, ctx).forEach(function (e) { e.setAttribute('u1st-forceU1stAnchorHandler', 'true'); e.removeAttribute('u1st-avoidU1stAnchorHandler'); }); },
    avoidU1stAnchorHandler: function (T, ctx) { els(T, ctx).forEach(function (e) { e.setAttribute('u1st-avoidU1stAnchorHandler', 'true'); }); },
    ensureDialogTriggerEl: function (cfg, ctx) {
      var targets = els(cfg && cfg.targetElements, ctx);
      targets.forEach(function (e) { e.addEventListener('click', function () { R.forcedTrigger = { element: e, at: Date.now() }; }, true); });
    },
    setFocusAfterRefresh: function (selectors) {
      try { sessionStorage.setItem('u1st-focusAfterRefresh', JSON.stringify({ selectors: [].concat(selectors), until: Date.now() + 60000 })); } catch (e) { /* noop */ }
    },
    forceShowHighlighter: function () { /* the u1 visual focus handles the ring */ },
    adjustHighlighter: function () { /* idem */ },
    addCssRule: function (id, selector, rules, mediaQuery) {
      if (arguments.length < 3) { rules = selector; selector = id; id = 'u1st-executeScriptAPIStyle'; }
      id = id || 'u1st-executeScriptAPIStyle';
      if (cssRuleIds[id]) return; // one rule per id, as the legacy did
      cssRuleIds[id] = true;
      var style = document.getElementById(id);
      if (!style) { style = document.createElement('style'); style.id = id; style.setAttribute('u1st-avoidDynamic', '1'); (document.head || document.documentElement).appendChild(style); }
      var css = typeof rules === 'string' ? rules : Object.keys(rules || {}).map(function (k) { return k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + ':' + rules[k]; }).join(';');
      var body = selector + '{' + css + '}';
      if (mediaQuery) body = '@media ' + mediaQuery + '{' + body + '}';
      try { return style.sheet.insertRule(body, 0); } catch (e) { style.appendChild(document.createTextNode(body)); return 0; }
    },
    enableDynamicStyleSheets: function () { }, enableStyleSheetsUsingForColorProfilesChanges: function () { }, preventElementsStylesChangesDuringDomWalker: function () { },
    getText: function (node, exclude) { return pureText(node, exclude); },
    showScreenReaderStatus: function (txt) {
      var d = document.createElement('div');
      d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'assertive');
      d.style.cssText = 'position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);';
      document.body.appendChild(d);
      setTimeout(function () { d.textContent = String(txt); }, 50);
      setTimeout(function () { d.parentNode && d.parentNode.removeChild(d); }, 10000);
    },
    tooltip: { setLocation: function (T, loc, ctx) { els(T, ctx).forEach(function (e) { $(e).data('u1st-tooltipLocation', loc); }); }, disable: function (T, ctx) { els(T, ctx).forEach(function (e) { $(e).data('u1st-toolTipApplied', true); }); } },
    setTooltipIcon: function () { },
    tabControl: { setBehavior: function (T, conf, ctx) { els(T, ctx).forEach(function (e) { $(e).data('u1st-tabControl-Conf', conf); }); }, setInstructions: function (T, inst, features, opts, ctx) { api.setInstructions(T, inst, features, opts, ctx); } },
    global: {
      allowFocus: function () { }, allowBlur: function () { },
      tabControl: { setBehavior: function () { }, setInstructions: function () { } },
      dialog: { setBehavior: function (b) { R.dialogBehavior = b || {}; } },
    },
    altNav: { excludeLinks: function (T, sel, ctx) { els(T, ctx).forEach(function (e) { $(e).data('u1st-avoidAltNavigation', { selector: sel }); }); }, unExcludeLinks: function (T, ctx) { els(T, ctx).forEach(function (e) { $(e).removeData('u1st-avoidAltNavigation'); }); }, avoidLinkBehavior: function () { } },
    utilities: { register: function (name, fn) { if (api.utilities[name]) return false; api.utilities[name] = function () { try { return fn.apply(this, arguments); } catch (e) { warn('utility', name, e); } }; return true; } },
    setFormValidationWaitUntilReset: function (T, ms, ctx) { els(T, ctx).forEach(function (e) { $(e).data('u1st_formValidation_WaitUntilReset', ms); }); },
    resetSkipLinksHandlerState: function () { },
  };
  // Anything a script calls that is not implemented: warn once, return undefined,
  // and let the rest of the script run — a missing nicety must not kill a fix.
  var apiProxy = typeof Proxy === 'function' ? new Proxy(api, {
    get: function (t, k) {
      if (k in t || typeof k !== 'string') return t[k];
      return function () { if (!api['__warned_' + k]) { api['__warned_' + k] = true; warn('options.api.' + k + ' is not implemented'); } };
    },
  }) : api;

  // ── scripts ────────────────────────────────────────────────────────────────
  function compile(entry, siteScript) {
    if (entry.fn) return entry.fn;
    if (entry._fn) return entry._fn;
    var code = String(entry.code || '').trim();
    if (!code) return null;
    try {
      // Site scripts are bodies; pattern scripts are full function expressions.
      entry._fn = siteScript ? new Function('$', 'options', code) : new Function('return (' + code + ');')();
      if (typeof entry._fn !== 'function') { warn('script is not a function:', entry.name || '(site)'); entry._fn = null; }
    } catch (e) { warn('script failed to compile:', entry.name || '(site)', e.message); entry._fn = null; }
    return entry._fn;
  }
  function baseOptions(scope, extra) {
    var m = modes();
    var o = {
      scope: scope, langCode: R.langCode, api: apiProxy, parameters: {}, featuresParamaters: {}, callbacks: {},
      isMobile: isMobile, isDesktop: isDesktop, isTablet: isTablet,
      isChrome: api.isChrome, isSafari: api.isSafari, isFirefox: api.isFirefox, isIE: api.isIE,
      services: { getLangTextLookup: function () { var out = {}; for (var id in R.texts) out[id] = text(id); return out; }, getFeatures: function () { return m; }, getElementsInfoLookup: function () { return {}; }, getImagesLangDesc: function () { return {}; } },
      userSettings: { profileID: 'screenReader+keyboard', features: m }, patternTypes: {},
    };
    for (var k in m) if (m[k]) o[k] = true;
    if (m.isMagnified) o.magnifyScale = 1;
    for (var x in extra || {}) o[x] = extra[x];
    return o;
  }
  function runScript(entry, patternEl, scope, extra) {
    var fn = compile(entry, false); if (!fn) return;
    var tgt = entry.target, sel = tgt && (typeof tgt === 'object' ? tgt.selector : tgt);
    var targets = (!sel || sel === '.') ? [patternEl] : findTargets(patternEl, tgt);
    targets.forEach(function (t) {
      var onceKey = 'u1st-ran-' + entry._key;
      if (scope === 2) { if ($(t).data(onceKey)) return; $(t).data(onceKey, true); }
      var arg = (!sel || sel === '.') ? t : $(t);
      try { fn.call(arg, arg, $, baseOptions(scope, extra), apiProxy); }
      catch (e) { warn('script "' + (entry.name || '?') + '" threw:', e && e.message ? e.message : e); }
    });
  }
  function runSiteScripts(eventType, el, extra) {
    if (!R.site) return;
    (R.site.siteScripts || []).forEach(function (s) {
      if (Number(s.eventType) !== eventType) return;
      if (s._skip) return;
      if (s._skip == null) {
        s._skip = false;
        if (s.urlPattern) { try { s._skip = !new RegExp(s.urlPattern, 'i').test(document.URL); } catch (e) { s._skip = false; } }
      }
      if (s._skip) return;
      var fn = compile(s, true); if (!fn) return;
      try { fn.call(el || document.body, $, baseOptions(2, extra)); } catch (e) { warn('site script (event ' + eventType + ') threw:', e && e.message ? e.message : e); }
    });
  }

  // ── applying one pattern on one element ───────────────────────────────────
  var POPUP_TYPES = { dialog: 1, dropdown: 1, popup: 1, blockedTooltip: 1, menu: 1 };
  var BLOCKER_TYPES = { dialog: 1, popup: 1 };
  function applyPatternOn(m, el, scope, deferred, extra) {
    var cfg = m.config || {}, pat = cfg.pattern || {}, mm = modes();
    var ctx = { patternEl: el, pattern: pat, modes: mm, deferred: deferred, warned: R.warned = R.warned || {} };
    if (el.getAttribute('u1st-blocked') === '1' && scope !== 8) return;
    var scripts = cfg.scripts || [];
    scripts.forEach(function (s, i) { s._key = (m.id || pat.ursId || '') + ':' + i; });
    var isDyn = !!(pat.data && (pat.data.isDynamic || pat.data.isDynamicImproved));
    var pageScope = scope === 2 || (scope === 4 && isDyn) ? (scope === 4 ? 4 : 2) : scope;
    // A dynamic pass re-runs a pattern's scripts only when the pattern is
    // dynamic AND something changed inside it — not because something changed
    // elsewhere on the page (a menu opening must not re-run the gallery's
    // "pause the carousel" script, whose click would close the menu).
    var touched = scope !== 4 || (isDyn && (!(extra && extra.targets) || extra.targets.some(function (t) { return t === el || el.contains(t); })));
    // 1024 / 1 / 2 / empty: immediately, before metadata
    scripts.forEach(function (s) { if ([1024, 1, 2, 0].indexOf(Number(s.when) || 0) > -1) { if (scope === 4 && !touched) return; runScript(s, el, pageScope, extra); } });
    if (scope === 4 && touched) scripts.forEach(function (s) { if (Number(s.when) === 16) runScript(s, el, 4, extra); });
    if (scope === 8 && extra && extra.popupMode === 'visible') scripts.forEach(function (s) { if (Number(s.when) === 64) runScript(s, el, 8, extra); });
    if (scope === 8 && extra && extra.popupMode === 'hidden') scripts.forEach(function (s) { if (Number(s.when) === 256) runScript(s, el, 8, extra); });
    // metadata
    (cfg.metadata || []).forEach(function (row) {
      var fn = APPLIERS[row.type];
      if (!fn) { if (!ctx.warned[row.type]) { ctx.warned[row.type] = true; warn('no applier for metadata type', row.type); } return; }
      var targets = findTargets(el, row.values && row.values.target);
      try { fn(ctx, row.values || {}, targets); } catch (e) { debug('metadata', row.type, 'skipped:', e.message); }
    });
    // pattern-type implied semantics (the server used to inject these)
    if (LANDMARKS[pat.patternType] && !(cfg.metadata || []).some(function (r) { return r.type === 'landmark' && findTargets(el, r.values.target)[0] === el; })) setAttr(el, 'role', LANDMARKS[pat.patternType]);
    if (pat.patternType === 'alert') setAttr(el, 'role', 'alert');
    if (pat.patternType === 'notify') setAttr(el, 'role', 'status');
    if (pat.patternType === 'tooltip' || pat.patternType === 'blockedTooltip') setAttr(el, 'role', 'tooltip');
    if (pat.patternType === 'dialog' || pat.patternType === 'popup') { if (!el.getAttribute('role')) setAttr(el, 'role', 'dialog'); el.setAttribute('u1st-ticont', '1'); }
    if (pat.data && (pat.data.includeInNav === 'true' || pat.data.includeInNav === true)) el.setAttribute('u1st-ticont', '1');
    // deferred scripts (LIFO, after everything in this pass)
    scripts.forEach(function (s) {
      var w = Number(s.when);
      if (w === 4 && (scope !== 4 || touched)) deferred.push(function () { runScript(s, el, pageScope, extra); });
      if (w === 32 && scope === 4 && touched) deferred.push(function () { runScript(s, el, 4, extra); });
      if (w === 128 && scope === 8 && extra && extra.popupMode === 'visible') deferred.push(function () { runScript(s, el, 8, extra); });
      if (w === 512 && scope === 8 && extra && extra.popupMode === 'hidden') deferred.push(function () { runScript(s, el, 8, extra); });
    });
  }

  // ── the tree ───────────────────────────────────────────────────────────────
  function buildTree() {
    R.byUrsId = {}; R.roots = [];
    R.mappings.forEach(function (m) { var id = m.config && m.config.pattern && m.config.pattern.ursId; if (id) R.byUrsId[id] = m; m._children = []; });
    R.mappings.forEach(function (m) {
      var pid = m.config && m.config.pattern && m.config.pattern.parentUrsId;
      if (pid && R.byUrsId[pid]) R.byUrsId[pid]._children.push(m); else R.roots.push(m);
    });
    R.mappings.forEach(function (m) { if (m.config && m.config.site) { R.site = m.config.site; R.texts = m.config.texts || R.texts; } });
    R.langCode = pickLang();
  }
  // Pattern elements are found document-wide, then a child is attached to every
  // parent element that strictly contains it (legacy ItemsRepository). Elements
  // of a pattern whose media query does not match are skipped with the subtree.
  function applyTree(scope, extra, rootFilter) {
    var deferred = [], applied = 0;
    function visit(m, parentEls) {
      var pat = (m.config && m.config.pattern) || {};
      if (!mediaMatches(pat.mediaQueries)) return;
      var elsFound = findPatternElements(m);
      if (parentEls) elsFound = elsFound.filter(function (e) { return parentEls.some(function (p) { return p !== e && p.contains(e); }); });
      if (rootFilter) elsFound = elsFound.filter(rootFilter);
      if (!elsFound.length) return;
      elsFound.forEach(function (e) {
        e.setAttribute('u1st-itemid', pat.ursId || m.id || '');
        if (pat.data && (pat.data.isDynamic || pat.data.isDynamicImproved)) e.setAttribute('u1st-dynamicElement', '1');
        applyPatternOn(m, e, scope, deferred, extra); applied++;
      });
      m._children.forEach(function (c) { visit(c, elsFound); });
    }
    R.roots.forEach(function (r) { visit(r, null); });
    while (deferred.length) { var fn = deferred.pop(); try { fn(); } catch (e) { warn('deferred step threw:', e.message); } }
    return applied;
  }

  // ── global keyboard behaviour (legacy keyToMouseEvents) ───────────────────
  function installKeyboard() {
    if (R.keyboardInstalled) return; R.keyboardInstalled = true;
    document.addEventListener('keydown', function (e) {
      var t = e.target; if (!t || t.nodeType !== 1 || hasFlag(t, 'u1st-avoidU1st', 4)) return;
      if (e.key === 'Enter' && !e.u1stSynthetic) {
        if ($(t).is('input[type=image],[role=button]:not(input):not(button),[role=link]:not(input):not(a[href]),[role=option]:not(input):not(a[href]),a:not([href]),[role=menuitem]:not(a[href])')) {
          e.preventDefault(); e.stopPropagation(); evt(t, 'mousedown'); t.click(); evt(t, 'mouseup');
        }
      }
      if ((e.key === ' ' || e.key === 'Spacebar') && $(t).is('[role=checkbox]:not(input),[role=radio]:not(input),[role=button]:not(input):not(button)')) {
        e.preventDefault(); e.stopPropagation(); t.click();
      }
      if (e.key === 'Escape') {
        var popup = $(t).closest('[u1st-popup="1"]')[0];
        if (popup) { var close = popup.querySelector('[u1st-closeButton]'); if (close) { e.stopPropagation(); close.click(); } }
      }
    }, true);
    // tabindex containers: Enter steps in, Escape steps out
    document.addEventListener('keydown', function (e) {
      var t = e.target; if (!t || t.nodeType !== 1) return;
      if (e.key === 'Enter' && t.getAttribute('u1st-ticont') === '1' && !$(t).is('a[href],button,input,select,textarea,[role=button],[role=link]')) {
        var inner = tabbablesIn(t); if (inner.length) { e.preventDefault(); try { inner[0].focus(); } catch (x) { /* noop */ } }
      }
      if (e.key === 'Escape') {
        var cont = $(t).closest('[u1st-ticont="1"]:not([u1st-popup])')[0];
        if (cont && cont !== t && cont.getAttribute('tabindex') !== null) { e.preventDefault(); try { cont.focus(); } catch (x) { /* noop */ } }
      }
    }, true);
    document.addEventListener('focusin', function (e) { R.lastFocused = e.target; }, true);
  }

  // ── popups: visibility polling, like the legacy PopupsHandler ─────────────
  function collectPopups() {
    R.popups = [];
    R.mappings.forEach(function (m) {
      var pat = (m.config && m.config.pattern) || {};
      // A popup pattern scoped to another device is not polled on this one.
      if (POPUP_TYPES[pat.patternType] && mediaMatches(pat.mediaQueries)) R.popups.push(m);
    });
  }
  function pollPopups() {
    R.popups.forEach(function (m) {
      findPatternElements(m).forEach(function (el) {
        if ($(el).is('select,input,textarea')) return;
        var visible = actuallyVisible(el) && (!!el.textContent.trim() || !!el.querySelector('*'));
        var was = $(el).data('u1st-popupVisible') === true;
        if (visible && !was) popupOpened(m, el);
        else if (!visible && was) popupClosed(m, el);
      });
    });
  }
  function popupOpened(m, el) {
    var pat = m.config.pattern || {};
    $(el).data('u1st-popupVisible', true);
    el.setAttribute('u1st-popup', '1');
    var trigger = (R.forcedTrigger && Date.now() - R.forcedTrigger.at < 5000) ? R.forcedTrigger.element : R.lastFocused;
    if (trigger && !$(trigger).is(FOCUSABLE)) trigger = $(trigger).closest(FOCUSABLE)[0] || trigger;
    $(el).data('u1st-trigger', trigger || null);
    var extra = { popupMode: 'visible', triggerElement: trigger ? $(trigger) : $(), currentVisiblePopups: [el] };
    (m.config.scripts || []).forEach(function (s) { if (Number(s.when) === 2048) runScript(s, el, 8, extra); });
    runSiteScripts(5, el, extra);
    var deferred = [];
    applyPatternOn(m, el, 8, deferred, extra);
    m._children.forEach(function (c) { findPatternElements(c).filter(function (e) { return el.contains(e) && e !== el; }).forEach(function (e) { applyPatternOn(c, e, 8, deferred, extra); }); });
    while (deferred.length) { try { deferred.pop()(); } catch (e) { warn(e.message); } }
    var blocker = BLOCKER_TYPES[pat.patternType] || (pat.patternType === 'dropdown' && !isDesktop);
    if (blocker) {
      if (!el.getAttribute('role')) setAttr(el, 'role', 'dialog');
      if (el.getAttribute('role') === 'dialog') setAttr(el, 'aria-modal', 'true');
      var heading = $(el).find('h1,h2,h3,h4,h5,h6').filter(function () { return !!pureText(this); })[0];
      if (heading && !el.getAttribute('aria-labelledby') && !el.getAttribute('aria-label')) setAttr(el, 'aria-labelledby', ensureId(heading));
    }
    if (el.getAttribute('u1st-autocompleteDropdown') !== 'true' && !(document.activeElement && el.contains(document.activeElement))) {
      var first = tabbablesIn(el)[0];
      setTimeout(function () {
        if (document.activeElement && el.contains(document.activeElement)) return;
        if (first) { try { first.focus(); } catch (e) { /* noop */ } }
        else { if (el.getAttribute('tabindex') === null) el.setAttribute('tabindex', '-1'); try { el.focus(); } catch (e) { /* noop */ } }
      }, 30);
    }
  }
  function popupClosed(m, el) {
    $(el).data('u1st-popupVisible', false);
    var trigger = $(el).data('u1st-trigger');
    var extra = { popupMode: 'hidden', triggerElement: trigger ? $(trigger) : $(), currentVisiblePopups: [] };
    (m.config.scripts || []).forEach(function (s) { if (Number(s.when) === 256) runScript(s, el, 8, extra); });
    runSiteScripts(6, el, extra);
    var deferred = []; (m.config.scripts || []).forEach(function (s) { if (Number(s.when) === 512) deferred.push(function () { runScript(s, el, 8, extra); }); });
    while (deferred.length) { try { deferred.pop()(); } catch (e) { warn(e.message); } }
    if (hasFlag(trigger || el, 'u1st-avoidU1st', 32)) return;
    var flow = $(el).data('u1st-flowto-selector') || el.getAttribute('aria-flowto') || el.getAttribute('u1st-flowto');
    var dest = null;
    if (flow) { try { dest = flow.charAt(0) === '#' ? document.getElementById(flow.slice(1)) : $(flow)[0]; } catch (e) { dest = null; } }
    if (!dest && trigger && document.documentElement.contains(trigger) && actuallyVisible(trigger)) dest = trigger;
    if (dest && !(document.activeElement && document.activeElement !== document.body && actuallyVisible(document.activeElement) && !el.contains(document.activeElement))) {
      setTimeout(function () { if (dest.getAttribute('tabindex') === null && !$(dest).is(FOCUSABLE)) dest.setAttribute('tabindex', '-1'); try { dest.focus(); } catch (e) { /* noop */ } }, 30);
    }
  }

  // ── dynamic DOM: one observer, debounced, idempotent re-apply ─────────────
  function startObserver() {
    if (R.observer || !window.MutationObserver) return;
    var timer = null, pendingTargets = [];
    // What counts as a change (legacy DynamicElementHandler): nodes added or
    // removed; style / hidden anywhere; class and disabled only on elements
    // marked statable; src only on dynamic-marked elements. Nothing we wrote
    // ourselves (u1st-* attributes are not watched; applying is guarded).
    R.observer = new MutationObserver(function (recs) {
      if (R.applying) return;
      recs.forEach(function (r) {
        var t = r.target && r.target.nodeType === 1 ? r.target : (r.target && r.target.parentNode);
        if (!t || t.nodeType !== 1) return;
        if (t.getAttribute('u1st-avoidDynamic') || t['u1st-avoidDynamic'] || $(t).closest('[u1st-avoidDynamic]').length) return;
        var ok = false;
        if (r.type === 'childList') ok = !!(r.addedNodes.length || r.removedNodes.length);
        else if (r.type === 'attributes') {
          var a = r.attributeName;
          if (a === 'style' || a === 'hidden' || a === 'open') ok = true;
          else if (a === 'class' || a === 'disabled') ok = t.getAttribute('u1st-statable') === '1';
          else if (a === 'src') ok = t.getAttribute('u1st-dynamicElement') === '1';
        }
        if (ok && pendingTargets.indexOf(t) < 0) pendingTargets.push(t);
      });
      if (!pendingTargets.length) return;
      clearTimeout(timer);
      timer = setTimeout(function () { var targets = pendingTargets; pendingTargets = []; reapply(4, targets); }, 220);
    });
    R.observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled', 'src', 'hidden', 'open'] });
  }
  function reapply(scope, targets) {
    if (R.applying) return 0;
    R.applying = true;
    var n = 0;
    try {
      if (scope === 4) runSiteScripts(3, document.body);
      n = applyTree(scope, scope === 4 ? { dynamic: true, targets: targets || null } : null);
      if (scope === 4) runSiteScripts(4, document.body);
      if (modes().isHighContrast || modes().isGrayScale) { /* wrappers added by appliers */ } else unwrapContrast();
    } catch (e) { warn('apply failed:', e && e.message ? e.message : e); }
    finally { if (R.observer) R.observer.takeRecords(); R.applying = false; }
    return n;
  }

  // ── public ────────────────────────────────────────────────────────────────
  window.__u1UrsRegister = function (m) {
    if (!m || typeof m !== 'object') return;
    var key = m.id || (m.config && m.config.pattern && m.config.pattern.ursId) || m.primary;
    for (var i = 0; i < R.mappings.length; i++) if ((R.mappings[i].id || (R.mappings[i].config && R.mappings[i].config.pattern && R.mappings[i].config.pattern.ursId) || R.mappings[i].primary) === key) { R.mappings[i] = m; return; }
    R.mappings.push(m);
  };
  function start() {
    buildTree(); collectPopups(); installKeyboard();
    runSiteScripts(8, document.body);
    runSiteScripts(1, document.body);
    var n = reapply(2);
    runSiteScripts(2, document.body);
    startObserver();
    if (!R.popupTimer) R.popupTimer = setInterval(function () { pollPopups(); pollMenus(); }, 200);
    if (!R.readyFired) { R.readyFired = true; runSiteScripts(7, document.body); }
    if (window.matchMedia && !R.mqHooked) {
      R.mqHooked = true;
      ['(forced-colors: active)', '(prefers-contrast: more)'].forEach(function (q) { try { window.matchMedia(q).addEventListener('change', function () { reapply(4); }); } catch (e) { /* noop */ } });
    }
    if (!R.resizeHooked) {
      R.resizeHooked = true; var w = window.innerWidth;
      window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - w) > 50) { w = window.innerWidth; reapply(4); } });
    }
    try {
      var saved = sessionStorage.getItem('u1st-focusAfterRefresh');
      if (saved) { sessionStorage.removeItem('u1st-focusAfterRefresh'); var o = JSON.parse(saved); if (o.until > Date.now()) o.selectors.some(function (s) { var e = $(s)[0]; if (e) { try { e.focus(); } catch (x) { /* noop */ } return true; } return false; }); }
    } catch (e) { /* noop */ }
    R.started = true;
    debug('applied', n, 'pattern elements over', R.mappings.length, 'patterns');
    return n;
  }
  window.__u1UrsApply = function () {
    if (!R.mappings.length) return 0;
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { start(); }); return 0; }
    return start();
  };
  window.__u1UrsApplyOne = function (m) {
    try {
      var mapping = { id: m.id, primary: m.primary, config: m.config || {} };
      window.__u1UrsRegister(mapping);
      var n = R.started ? reapply(2) : start();
      var own = findPatternElements(mapping).length;
      if (!own) return { ok: false, err: 'No element matches ' + (mapping.primary || '(no selector)') + ' on this page.' };
      return { ok: true, applied: own, count: own, note: own + ' element' + (own === 1 ? '' : 's') + ' of this URS pattern, ' + ((mapping.config.metadata || []).length) + ' fixes, ' + ((mapping.config.scripts || []).length) + ' scripts (' + n + ' elements re-applied site-wide).' };
    } catch (e) { return { ok: false, err: e && e.message ? e.message : String(e) }; }
  };
  // Many at once (Apply All, and the background's auto-apply on page load):
  // register the whole set, then one pass — not one pass per mapping.
  window.__u1UrsApplyMany = function (list) {
    try {
      var n = 0;
      (list || []).forEach(function (m) { if (m && typeof m === 'object') { window.__u1UrsRegister({ id: m.id, primary: m.primary, config: m.config || {} }); n++; } });
      if (!n) return { ok: false, err: 'Nothing to apply.' };
      var applied = R.started ? reapply(2) : window.__u1UrsApply();
      return { ok: true, registered: n, applied: applied };
    } catch (e) { return { ok: false, err: e && e.message ? e.message : String(e) }; }
  };
  window.__u1UrsHover = function (sel, out) { var it = $(sel)[0]; var bar = $(it).data('u1st-mwBar'); fireHover(it, bar, out ? HOVER_OUT : HOVER_IN); return !!bar; };
  window.__u1UrsMenuDump = function () {
    return R.menuWidgets.map(function (w) {
      return Object.keys(w.submenus).map(function (k) {
        return $(w.submenus[k].selector).toArray().filter(function (m) { return actuallyVisible(m); }).map(function (m) {
          return { sel: k, id: m.id, cls: String(m.className).slice(0, 40), marked: !!$(m).data('u1st-mwSub'), visibleFlag: $(m).data('u1st-mwVisible'), trigger: ($(m).data('u1st-mwTrigger') || {}).textContent, items: menuItemsOf(m, false).length, visibleItems: menuItemsOf(m, true).length, tabbables: tabbablesIn(m).length, inViewport: inViewport(m), rect: (function (r) { return [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)]; })(m.getBoundingClientRect()) };
        });
      });
    });
  };
  window.__u1UrsMenus = function () { pollMenus(); return R.menuWidgets.map(function (w) { return { bar: w.bar.id, items: w.itemSelectors, submenus: Object.keys(w.submenus), open: openSubmenusOf(w.bar).length, lastOpened: w.lastOpened && w.lastOpened.id }; }); };
  window.__u1UrsState = function () { return { patterns: R.mappings.length, started: R.started, lang: R.langCode, modes: modes() }; };
})();

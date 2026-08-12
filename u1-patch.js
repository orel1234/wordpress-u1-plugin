'use strict';
//#region u1-patch:core
// ─────────────────────────────────────────────────────────────────────────────
//  U1 patch — corrects defects in the U1 library from the outside.
//
//  Every fix here was verified by reading u1_vanilla-js-a11y.js. The library is
//  a product on its own release cycle; this file closes the gap in the meantime
//  and is written so it becomes inert the day a defect is fixed upstream.
//
//  Two rules hold throughout:
//    1. Never touch a state that is already correct. Each fix checks first, so
//       a corrected library and this patch cannot fight each other.
//    2. Only observable DOM is touched. Nothing here reaches into U1 internals.
//
//  Runs only where U1 is loaded — it corrects what U1 produced.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  var W = window;
  if (W.__u1Patch) return;                       // one instance per page
  // Bump on every change that ships. The whole point is that a page can be
  // asked "which patch are you actually running" — "I reloaded, I promise" is
  // not something either of us can verify from the outside.
  var P = (W.__u1Patch = { correctors: [], build: '2026-08-12a' });

  var qsa = function (sel, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch (e) { return []; }
  };
  var get = function (el, n) { return el && el.getAttribute ? el.getAttribute(n) : null; };
  var set = function (el, n, v) {
    // Writing an attribute that already holds the value would retrigger our own
    // observer, so every write is guarded.
    if (el && get(el, n) !== String(v)) el.setAttribute(n, String(v));
  };
  var setTabIndex = function (el, v) { if (el && el.tabIndex !== v) el.tabIndex = v; };
  var closest = function (el, sel) {
    try { return el && el.closest ? el.closest(sel) : null; } catch (e) { return null; }
  };
  var isNative = function (el) {
    return !!el && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ||
           (!!el && el.tagName === 'A' && el.hasAttribute('href'));
  };
  var visible = function (el) {
    return !!el && !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true' &&
           !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };
  /** Rough but sufficient: does the element carry a name a screen reader can use? */
  var named = function (el) {
    if (!el) return false;
    if ((get(el, 'aria-label') || '').trim()) return true;
    var by = get(el, 'aria-labelledby');
    if (by) {
      for (var i = 0, ids = by.split(/\s+/); i < ids.length; i++) {
        var n = document.getElementById(ids[i]);
        if (n && (n.textContent || '').trim()) return true;
      }
    }
    return !!(el.textContent || '').trim();
  };
  var FOCUSABLE = 'a[href],button,input,select,textarea,summary,iframe,' +
    '[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])';

  P.util = { qsa: qsa, get: get, set: set, setTabIndex: setTabIndex, closest: closest,
             isNative: isNative, visible: visible, named: named, FOCUSABLE: FOCUSABLE };

  /** A correction pass. Registered by each region, run together and debounced. */
  P.correct = function (fn) { P.correctors.push(fn); };

  var queued = false;
  var run = function () {
    queued = false;
    for (var i = 0; i < P.correctors.length; i++) {
      try { P.correctors[i](); } catch (e) { /* one bad fix must not stop the rest */ }
    }
  };
  var schedule = function () {
    if (queued) return;
    queued = true;
    (W.requestAnimationFrame || setTimeout)(run, 0);
  };
  P.schedule = schedule;

  // U1 re-applies itself on re-render, so corrections have to follow it there.
  try {
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      // aria-expanded is here because the listbox region corrects it against
      // what the list is actually doing. Our own writes cannot loop: set()
      // skips a write that would not change the value, so the pass converges
      // after one round.
      attributeFilter: ['role', 'aria-selected', 'aria-checked', 'aria-hidden',
                        'aria-labeledby', 'aria-current', 'aria-expanded',
                        'tabindex', 'hidden'],
    });
  } catch (e) {}
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  }
  schedule();

  // ── 2.4.11 Focus Not Obscured ──────────────────────────────────────────────
  // A browser scrolls a focused element into view on its own, but only for the
  // scroller it thinks owns the element. It does not help when focus lands under
  // a sticky header or a cookie bar, and it does not help inside a horizontally
  // clipped strip that the page has already scrolled past. Both are ordinary on
  // a tab bar wide enough to overflow — and a focus ring nobody can see is the
  // same as no focus ring.
  //
  // It runs AFTER the browser's own scroll, as a correction to it rather than a
  // competitor, and it does nothing at all to an element that is already fully
  // visible and uncovered.
  var vpw = function () { return W.innerWidth || document.documentElement.clientWidth; };
  var vph = function () { return W.innerHeight || document.documentElement.clientHeight; };

  /**
   * The bottom edge of a pinned element covering the top of `el`, or 0.
   * Only fixed/sticky things count: anything else scrolls away with the page,
   * so scrolling further would chase it forever.
   */
  var coverAt = function (el, r) {
    var x = Math.min(Math.max(r.left + 8, 1), vpw() - 1);
    var y = Math.max(r.top + 4, 1);
    if (y >= vph()) return 0;
    var top;
    try { top = document.elementFromPoint(x, y); } catch (e) { return 0; }
    if (!top || top === el || el.contains(top) || top.contains(el)) return 0;
    var pos = '';
    try { pos = (W.getComputedStyle(top) || {}).position; } catch (e) {}
    if (pos !== 'fixed' && pos !== 'sticky') return 0;
    return top.getBoundingClientRect().bottom;
  };

  var reveal = function (el) {
    if (!el || !el.getBoundingClientRect || !el.scrollIntoView) return;
    var vw = vpw(), vh = vph();
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;                 // nothing to reveal

    // Something taller than the viewport can never be brought fully into view,
    // and 'nearest' on it lands on whichever edge happens to be closer — which
    // is how focusing a tab panel drops you into the middle of a product grid
    // with the tabs scrolled off above. Its top edge is the part that carries
    // meaning, so that is what a scroll aims at.
    //
    // But only when NO part of it is on screen. Requiring the top edge to be
    // visible looks right until you Shift+Tab backwards into a long panel from
    // below: you were reading its bottom, and the page yanks itself to the top.
    // Any part showing means the browser already did something reasonable.
    var tall = r.height > vh;
    var out = tall ? (r.bottom <= 0 || r.top >= vh)
                   : (r.top < 0 || r.bottom > vh || r.left < 0 || r.right > vw);
    if (out) {
      try {
        el.scrollIntoView(tall ? { block: 'start', inline: 'nearest' }
                               : { block: 'nearest', inline: 'nearest' });
      } catch (e) { try { el.scrollIntoView(); } catch (e2) { return; } }
      r = el.getBoundingClientRect();
    }

    // scrollIntoView aligns to the VIEWPORT, which parks the element underneath
    // any sticky header. 2.4.11 is about the focus being seen, not about a
    // scroll having happened, so the header's height has to come off.
    var cover = coverAt(el, r);
    // cover === 0 means nothing is covering it. Without that first test the
    // comparison is true for any element whose top is above the fold, and the
    // page scrolls by the whole distance for no reason.
    if (cover > 0 && cover > r.top) {
      var by = r.top - cover - 8;
      try { W.scrollBy({ top: by, left: 0, behavior: 'auto' }); }
      catch (e) { try { W.scrollBy(0, by); } catch (e2) {} }
    }
  };

  document.addEventListener('focusin', function (e) {
    var el = e.target;
    // One frame later: the browser has done its own scrolling by then, so this
    // corrects a settled position instead of racing one.
    if (W.requestAnimationFrame) W.requestAnimationFrame(function () { reveal(el); });
    else setTimeout(function () { reveal(el); }, 0);
  }, true);

  // ── Keyboard, in the capture phase ─────────────────────────────────────────
  // U1's own handlers sit on the elements themselves. A capture listener on the
  // document runs first, which is what lets a key be added without racing it.
  P.keys = function (containerSel, handler) {
    document.addEventListener('keydown', function (e) {
      var container = closest(e.target, containerSel);
      if (container) handler(e, container);
    }, true);
  };

  /**
   * Roving navigation across a set of items.
   *
   * With opts.arrows this TAKES OVER the arrow keys rather than supplementing
   * them. The library moves focus from an index it stores on the fixer object
   * (activeTabIndex), not from where focus actually is — and the two drift apart
   * the moment anything else moves focus: a click the fixer did not see, a
   * re-render, a Tab out and back. Once they have drifted, one arrow press jumps
   * to an unrelated item. Counting from document.activeElement instead cannot
   * drift, because there is no second copy of the answer to go stale.
   *
   * That means suppressing the library's own handler for these keys, which is
   * what stopImmediatePropagation in the capture phase does — it never runs, so
   * it can never move focus a second time.
   */
  P.rove = function (containerSel, itemSel, opts) {
    opts = opts || {};
    P.keys(containerSel, function (e, container) {
      var items = qsa(itemSel, container).filter(visible);
      var here = items.indexOf(closest(e.target, itemSel));
      if (here === -1) return;

      // 'auto' asks the container, so one registration covers a page holding
      // both a horizontal and a vertical strip. When the container declines to
      // say, the DEFAULT is the role's own default and differs per role — a
      // tablist is horizontal, a listbox is vertical — so the caller supplies
      // it rather than this function assuming one for everybody.
      var vertical = opts.vertical === 'auto'
        ? (get(container, 'aria-orientation') || opts.orientationDefault || 'horizontal') === 'vertical'
        : !!opts.vertical;
      var key = e.key, n = items.length;
      var prev = vertical ? 'ArrowUp' : 'ArrowLeft';
      var next = vertical ? 'ArrowDown' : 'ArrowRight';
      var to = -1;
      if (key === 'Home') to = 0;
      else if (key === 'End') to = n - 1;
      else if (opts.arrows && key === prev) to = (here - 1 + n) % n;
      else if (opts.arrows && key === next) to = (here + 1) % n;
      else return;

      e.preventDefault();
      if (opts.arrows) e.stopImmediatePropagation();
      var target = items[to];
      if (!target) return;
      target.focus();
      if (opts.activate) target.click();
    });
  };

  /** NumpadEnter: the library compares event.code, which excludes it. */
  P.numpadEnter = function (selector) {
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'NumpadEnter') return;
      var el = closest(e.target, selector);
      // Native controls activate on their own — clicking again would double-fire.
      if (!el || isNative(el)) return;
      e.preventDefault();
      el.click();
    }, true);
  };

  // ── Per-match application of u1.fix.* ──────────────────────────────────────
  // ChangeDetection hands each fixer every matching element, but several fixers
  // ignore it and re-query with querySelector, which returns only the first. The
  // result is that a page with two tab strips, two comboboxes or two dialogs
  // gets one of each fixed. Calling the original once per match, with a selector
  // narrowed to that match, sidesteps the internals entirely.
  var PER_MATCH = ['tabs', 'combobox', 'listbox', 'dialog', 'tooltip', 'pagination'];
  var MARK = 'data-u1p-instance';
  var seq = 0;

  // A fixer's first argument is a CONTEXT, and some fixers resolve their other
  // selectors against it — so the element the context names is not always an
  // element the fixer can work from. A region registers a resolver here to widen
  // it to one that is. See the tabs region for the case that needs it.
  P.contextRoot = {};

  var wrap = function () {
    var u1 = W.u1 !== undefined ? W.u1 : W.U1 !== undefined ? W.U1 : W.user1st;
    if (!u1 || !u1.fix || u1.fix.__u1PatchWrapped) return !!(u1 && u1.fix);

    PER_MATCH.forEach(function (name) {
      var orig = u1.fix[name];
      if (typeof orig !== 'function') return;
      u1.fix[name] = function (selector, props) {
        if (typeof selector !== 'string') return orig.apply(this, arguments);
        var els = qsa(selector);
        if (!els.length) return orig.apply(this, arguments);

        var resolve = P.contextRoot[name];
        var roots = els, widened = false;
        if (resolve) {
          roots = [];
          els.forEach(function (el) {
            var r = resolve(el, props);
            // false means "this one cannot work" — a selector that matched more
            // than the caller meant it to. Calling the fixer there would only
            // throw, and one throw takes the other instances down with it.
            if (r === false) { widened = true; return; }
            if (r && r !== el) { widened = true; roots.push(r); }
            else roots.push(el);
          });
          if (!roots.length) return;
        }

        // One match with nothing to widen is the common case and already
        // correct — leave it untouched so the patch adds no behaviour where
        // none is missing.
        if (roots.length < 2 && !widened) return orig.apply(this, arguments);

        var last;
        for (var i = 0; i < roots.length; i++) {
          var token = 'u1p' + (seq++);
          roots[i].setAttribute(MARK, token);
          last = orig.call(this, '[' + MARK + '="' + token + '"]', props);
        }
        return last;
      };
    });

    // landmarks(props, context) takes a different shape: the selectors live
    // inside props, one entry per role, so it needs its own expansion.
    var origLandmarks = u1.fix.landmarks;
    if (typeof origLandmarks === 'function') {
      u1.fix.landmarks = function (props, context) {
        if (!props || typeof props !== 'object') return origLandmarks.apply(this, arguments);
        var self = this, result;
        Object.keys(props).forEach(function (role) {
          var entries = [].concat(props[role] || []);
          entries.forEach(function (entry) {
            var sel = entry && entry.selectors && entry.selectors.landmark;
            var els = sel ? qsa(sel) : [];
            if (els.length < 2) {
              var one = {}; one[role] = entry;
              result = origLandmarks.call(self, one, context);
              return;
            }
            for (var i = 0; i < els.length; i++) {
              var token = 'u1p' + (seq++);
              els[i].setAttribute(MARK, token);
              var scoped = JSON.parse(JSON.stringify(entry));
              scoped.selectors.landmark = '[' + MARK + '="' + token + '"]';
              var single = {}; single[role] = scoped;
              result = origLandmarks.call(self, single, context);
            }
          });
        });
        return result;
      };
    }

    u1.fix.__u1PatchWrapped = true;
    return true;
  };

  if (!wrap()) {
    // The library may still be loading. Keep trying briefly, then stop.
    var tries = 0;
    var poll = setInterval(function () {
      if (wrap() || ++tries > 40) clearInterval(poll);
    }, 250);
  }

  // ── Skip links ────────────────────────────────────────────────────────────
  // U1 gives the target an id and nothing else. Following `href="#id"` moves the
  // scroll position, but focus only moves if the target can hold it — so on most
  // browsers the next Tab returns to the top of the page and the skip link
  // achieves nothing for the people who need it.
  P.correct(function () {
    qsa('a.u1st-skip-link[href^="#"]').forEach(function (link) {
      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      if (!target.hasAttribute('tabindex')) set(target, 'tabindex', '-1');
      if (link.__u1pSkip) return;
      link.__u1pSkip = true;
      // Browsers disagree about whether the target receives focus; doing it
      // explicitly is the only behaviour that is the same everywhere.
      link.addEventListener('click', function () {
        var t = document.getElementById(link.getAttribute('href').slice(1));
        if (t) setTimeout(function () { t.focus(); }, 0);
      });
    });
  });
})();
//#endregion

//#region u1-patch:dialog
// The worst defect in the library. focusInBound() opens with
//   querySelectorAll(TABBABLE, dialog).filter(isVisible)[0].focus()
// with no guard. A dialog holding nothing focusable throws there — and because
// onOpen() calls it BEFORE setting role="dialog" and aria-modal, all three are
// lost together: the dialog is served to a screen reader as a plain div, with no
// modality and no focus trap. aria-modal is also skipped entirely on mobile.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  P.correct(function () {
    u.qsa('[role="dialog"], [aria-modal="true"]').forEach(function (dlg) {
      if (!u.visible(dlg)) return;
      u.set(dlg, 'role', 'dialog');
      if (!u.get(dlg, 'aria-modal')) u.set(dlg, 'aria-modal', 'true');
      // A dialog with nothing focusable is exactly the case the library throws
      // on. Giving it a home for focus means there is always a first stop.
      if (!dlg.querySelector(u.FOCUSABLE) && !dlg.hasAttribute('tabindex')) {
        u.set(dlg, 'tabindex', '-1');
      }
    });
  });

  // Our own trap. U1's cannot be removed — it lives in a closure — so its Tab
  // handling is swallowed in the capture phase and replaced here. Ours is
  // symmetric: the library guards the forward direction with a modal check and
  // the backward direction with none, so a non-modal dialog traps Shift+Tab
  // while letting Tab out.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var dlg = u.closest(e.target, '[role="dialog"]');
    if (!dlg || !u.visible(dlg)) return;

    var items = u.qsa(u.FOCUSABLE, dlg).filter(u.visible);
    if (!items.length) return;

    var modal = u.get(dlg, 'aria-modal') === 'true';
    var first = items[0], last = items[items.length - 1];
    var atEdge = e.shiftKey ? e.target === first : e.target === last;
    if (!atEdge) return;

    // A non-modal dialog must let focus leave in BOTH directions.
    if (!modal) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    (e.shiftKey ? last : first).focus();
  }, true);
})();
//#endregion

//#region u1-patch:form
// FormFixer.fix() returns early when no errorMsg selector was configured — and
// the label-to-field linking sits after that return. A form mapped without an
// error selector therefore never gets its labels connected, which is a 1.3.1 and
// 3.3.2 failure caused by an unrelated field being left blank.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  P.correct(function () {
    u.qsa('form, [role="form"]').forEach(function (form) {
      u.qsa('input, select, textarea', form).forEach(function (field) {
        if (field.type === 'hidden' || field.disabled) return;
        if (u.named(field) || u.get(field, 'aria-labelledby') || u.get(field, 'aria-label')) return;
        if (field.labels && field.labels.length) return;      // already linked

        // A wrapping <label> names the field without any attribute at all.
        var wrapping = u.closest(field, 'label');
        if (wrapping) return;

        // Otherwise look for a label pointing at it, or the nearest one before it
        // inside the same field group.
        var id = field.id || (field.id = 'u1p-field-' + Math.random().toString(36).slice(2, 9));
        var label = form.querySelector('label[for="' + id + '"]');
        if (!label) {
          var group = field.parentElement;
          label = group && group.querySelector('label:not([for])');
        }
        if (!label || !(label.textContent || '').trim()) return;
        if (!label.getAttribute('for')) u.set(label, 'for', id);
      });
    });
  });
})();
//#endregion

//#region u1-patch:checkbox
// CheckboxFixer copies the label's innerText into aria-label and then hides the
// label with aria-hidden="true" — but the hiding sits outside the guard that
// checks whether any text was actually found. A visually hidden label returns an
// empty innerText, so the checkbox ends up with no name AND its label hidden
// from assistive technology. And when the label contains a link ("I accept the
// <a>terms</a>"), aria-hidden lands on an ancestor of focusable content, which
// is a violation in its own right.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  P.correct(function () {
    // Naming runs FIRST. The hidden-ancestor sweep below strips the very
    // aria-hidden that marks which element was the label, so looking for the
    // label afterwards would find nothing.
    u.qsa('[role="checkbox"], [role="radio"], [role="switch"]').forEach(function (box) {
      if (u.named(box)) return;
      var group = box.parentElement;
      if (!group) return;
      // Either still carrying U1's aria-hidden, or a plain <label> the sweep
      // has already uncovered on an earlier pass.
      var label = group.querySelector('[aria-hidden="true"], label');
      // textContent, not innerText: it does not depend on layout, which is why
      // a visually hidden label lost its name in the first place.
      if (!label || label === box || !(label.textContent || '').trim()) return;
      label.removeAttribute('aria-hidden');
      if (!label.id) label.id = 'u1p-label-' + Math.random().toString(36).slice(2, 9);
      u.set(box, 'aria-labelledby', label.id);
    });

    // Any hidden element wrapping something focusable is wrong regardless of
    // which fixer produced it.
    u.qsa('[aria-hidden="true"]').forEach(function (el) {
      if (el.querySelector(u.FOCUSABLE)) el.removeAttribute('aria-hidden');
    });
  });
})();
//#endregion

//#region u1-patch:tabs
// Five defects. The first one aborts the whole fixer, so it comes first.
//
// TabsFixer is given the TAB LIST as its context, then resolves the tab PANEL
// selectors against that context — and panels sit outside the tab list, which is
// the entire point of a tab strip. getElement finds nothing, throws
// "Selector '<panel>:eq(0)' returned null", and handleTabs never reaches the
// roving tabindex, the arrow keys or the click handler. Nothing is wired at all.
//
// Three lines earlier the SAME panel selectors are resolved against document.body
// (querySelector with no context) purely to decide isConditionalRendering. One of
// the two roots is wrong, and the one that throws is the wrong one — so this is a
// bug, not a contract the caller can satisfy. Widening the context to the nearest
// ancestor holding both the tabs and the panels satisfies both lookups.
//
// aria-labeledby is spelled with one L (the only occurrence in the
// whole library, so it is a typo and not a convention) and is therefore ignored
// by every browser. activeTabIndex is reset to 0 on every pass, so a strip that
// loads with the third tab open is announced as having the first one selected.
// Home/End are missing although the key constants exist and are used elsewhere.
// And arrows never call preventDefault, so vertical strips scroll the page.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  P.contextRoot.tabs = function (root, props) {
    var sel = props && props.selectors;
    if (!sel || !sel.tab || !sel.tabPanel) return null;

    // isVertical only chooses which arrow keys the library listens for; it never
    // reaches the DOM. aria-orientation="vertical" is what tells a screen reader
    // to announce the strip as vertical and to expect Up/Down — without it the
    // keys and the announcement disagree. This resolver is the one place that
    // sees the props for a specific strip, so the flag is recorded here and the
    // correction pass applies it.
    if (props && props.isVertical) root.setAttribute('data-u1p-vertical', '1');
    // Already reachable from here — the caller passed a context that works, and
    // widening it could only pull in a neighbouring strip's tabs.
    try { if (root.querySelector(sel.tabPanel)) return null; } catch (e) { return null; }
    // Nearest ancestor holding both. Nearest, not document.body: a page with two
    // strips must still give each fixer its own tabs and its own panels.
    var node = root, mine;
    try { mine = root.querySelectorAll(sel.tab).length; } catch (e) { return null; }
    if (!mine) return null;
    while ((node = node.parentElement)) {
      try {
        // The moment an ancestor sweeps in tabs that are not ours, it is the
        // wrong root — and every ancestor above it is worse. Without this the
        // walk reaches <body>, finds some other strip's panel there, and hands
        // the fixer both strips at once.
        if (node.querySelectorAll(sel.tab).length !== mine) return false;
        if (node.querySelector(sel.tabPanel)) return node;
      } catch (e) { return null; }
    }
    // No ancestor holds both. This match has no panels of its own — it happens
    // when a class matches two strips and the panel selector belongs to one of
    // them. Skip it rather than let it throw and take the other one down.
    return false;
  };

  P.correct(function () {
    // The misspelling, wherever it appears.
    u.qsa('[aria-labeledby]').forEach(function (el) {
      var v = u.get(el, 'aria-labeledby');
      if (v && !u.get(el, 'aria-labelledby')) u.set(el, 'aria-labelledby', v);
      el.removeAttribute('aria-labeledby');
    });

    u.qsa('[role="tablist"]').forEach(function (list) {
      var tabs = u.qsa('[role="tab"]', list);
      if (tabs.length < 2) return;

      if (list.hasAttribute('data-u1p-vertical')) u.set(list, 'aria-orientation', 'vertical');

      var ids = tabs.map(function (t) { return u.get(t, 'aria-controls') || ''; });
      var distinct = ids.filter(function (v, i) { return v && ids.indexOf(v) === i; });
      var active = -1;

      if (distinct.length > 1) {
        // A panel per tab. Which one is on screen is the page's own answer, and
        // it stays true when the tab changes by a route change or a click we
        // never saw.
        tabs.forEach(function (t, i) {
          var panel = ids[i] && document.getElementById(ids[i]);
          if (panel && u.visible(panel)) active = i;
        });
      } else {
        // ONE region that the site re-renders per tab. "Which panel is visible"
        // cannot answer anything here — the same panel is visible for all six
        // tabs, and reading it that way would mark the LAST tab active every
        // time. What does answer it is the panel's aria-labelledby: the APG
        // requires it to name the tab whose content is showing, and it is the
        // only statement of that left once the library has overwritten
        // aria-selected on every pass.
        var panel = distinct[0] ? document.getElementById(distinct[0]) : null;
        if (!panel) {
          // aria-controls naming an id that does not exist is its own 4.1.2
          // failure and it is common — a template writes a fixed value while
          // the real panel carries a different id. Find the panel by the link
          // that does resolve, then repair the one that does not.
          panel = u.qsa('[role="tabpanel"][aria-labelledby]').filter(function (p) {
            var by = (u.get(p, 'aria-labelledby') || '').split(/\s+/);
            for (var i = 0; i < tabs.length; i++) {
              if (tabs[i].id && by.indexOf(tabs[i].id) !== -1) return true;
            }
            return false;
          })[0] || null;
        }
        if (panel) {
          var by = (u.get(panel, 'aria-labelledby') || '').split(/\s+/);
          tabs.forEach(function (t, i) {
            if (t.id && by.indexOf(t.id) !== -1) active = i;
            if (panel.id) u.set(t, 'aria-controls', panel.id);
          });
        }
      }

      // Nothing ARIA could tell us. The site still styles its own active tab,
      // and that class is a statement of intent worth reading before giving up.
      if (active === -1) {
        tabs.forEach(function (t, i) {
          if (/(^|\s)(active|selected|current|is-active|is-selected)(\s|$)/i.test(t.className || '') ||
              u.get(t, 'aria-current') === 'true' || u.get(t, 'aria-current') === 'page') active = i;
        });
      }
      if (active === -1) return;   // no signal at all — leave the library's answer

      tabs.forEach(function (t, i) {
        u.set(t, 'aria-selected', i === active ? 'true' : 'false');
        u.setTabIndex(t, i === active ? 0 : -1);
      });
    });
  });

  P.rove('[role="tablist"]', '[role="tab"]', { arrows: true, activate: true, vertical: 'auto' });
  P.numpadEnter('[role="tab"]');
})();
//#endregion

//#region u1-patch:menu
// navigateMenuItem and navigateMenubarItem contain no preventDefault at all, so
// arrows move focus and scroll the page at the same time. Home and End are never
// handled even though KEYBOARD_EVENT_CODE defines them. And the RTL flip is
// applied to ArrowRight but not to ArrowLeft, so in Hebrew one direction is
// mirrored and the other is not.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;
  var SEL = '[role="menu"], [role="menubar"]';

  P.rove(SEL, '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
         { arrows: true });

  // The missing half of the RTL flip. The library mirrors ArrowRight; mirroring
  // ArrowLeft as well would double up, so this only completes the direction it
  // left out, and only when the menu really is right-to-left.
  P.keys(SEL, function (e, menu) {
    if (e.key !== 'ArrowLeft') return;
    var dir = '';
    try { dir = getComputedStyle(menu).direction; } catch (err) {}
    if (dir !== 'rtl') return;
    var items = u.qsa('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]', menu)
                 .filter(u.visible);
    var here = items.indexOf(u.closest(e.target, '[role^="menuitem"]'));
    if (here === -1) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    items[(here + 1) % items.length].focus();
  });
})();
//#endregion

//#region u1-patch:radio
// getCheckedRadio() returns the first radio that has NO aria-checked attribute —
// the inverse of what its name promises. handleFocusTabindex() then adds
// tabindex="0" to that element without clearing the one set earlier, so a radio
// group ends up with two tab stops and Tab lands on an unselected option.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  P.correct(function () {
    u.qsa('[role="radiogroup"]').forEach(function (group) {
      var radios = u.qsa('[role="radio"]', group).filter(u.visible);
      if (radios.length < 2) return;

      var checked = -1;
      radios.forEach(function (r, i) { if (u.get(r, 'aria-checked') === 'true') checked = i; });
      // APG: Tab enters the group on the selected option, or on the first one
      // when nothing is selected yet. Exactly one tab stop, either way.
      var entry = checked === -1 ? 0 : checked;
      radios.forEach(function (r, i) { u.setTabIndex(r, i === entry ? 0 : -1); });
    });
  });
})();
//#endregion

//#region u1-patch:combobox
// textboxKeydownFunction treats evt.code == "ShiftLeft" as a "move event", which
// then dispatches a click on the highlighted option. Pressing the left Shift key
// on its own — to type a capital letter, say — therefore selects an option the
// user never chose. ShiftRight is not in the list, so the behaviour is not even
// consistent between the two keys. Home/End are also missing.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Shift') return;
    if (!u.closest(e.target, '[role="combobox"], input[aria-autocomplete]')) return;
    // Shift alone is a modifier, never a commit. Stop it before U1 sees it.
    e.stopImmediatePropagation();
  }, true);

  // The roving for an open list lives in the listbox region, which a combobox
  // export pulls in with it — the popup a combobox opens IS a listbox, and the
  // corrections belong with the role, not with one of the two callers.
})();
//#endregion

//#region u1-patch:listbox
// A listbox comes out of U1 decorated and inoperable, and the two facts are not
// in tension: everything a static check reads is present, and nothing a keyboard
// user does works. This region is about the second half.
//
// It is also, until now, the only interactive type with no region at all. The
// one listbox line in the tree sat inside the combobox region, so an export
// containing a listbox and no combobox shipped no listbox corrections whatever.
//
// Four gaps, in the order a person meets them:
//
//   1. OPENING LEAVES FOCUS BEHIND. The trigger opens the list and focus stays
//      on the trigger. Sighted users see the list; a keyboard user has to guess
//      that Tab now leads somewhere new — and on a popup positioned out of DOM
//      order it does not. APG puts focus in the list on open. Nothing does.
//   2. ARROWS. No arrow handling reaches a standalone listbox, and the default
//      orientation for the role is vertical, so Up/Down are the keys that must
//      work. (In a combobox the textbox owns the arrows and focus never enters
//      an option; the roving below is inert there by construction.)
//   3. ESCAPE DOES NOT CLOSE, AND FOCUS DOES NOT COME BACK. Escape inside an
//      open list leaves it open, or closes it and strands focus on a detached
//      option — after which Tab restarts from the top of the document.
//   4. aria-expanded GOES STALE. U1 writes it once. When the SITE'S own script
//      opens or closes the list — which is the ordinary case, since the site
//      had a working dropdown before anyone accessibilised it — the attribute
//      keeps its old value and a screen reader announces "collapsed" over an
//      open list. This is the defect most likely to read as "it says it is
//      accessible and it is lying".
//
// What this region deliberately does NOT do is activate an option on
// Enter/Space. Whether the library already does is not readable from outside,
// and a second synthetic click on a <li><a> navigates twice. The keyboard test
// reports that gap instead of this file guessing at it.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  var OPT = '[role="option"]';
  var TRIGGER = '[aria-haspopup="listbox"],[u1st-trigger-element="true"]';
  var ITEM = 'li,[role="option"],[role="menuitem"],a[href],button';

  // ── The defect that leaves the list untouched entirely ─────────────────────
  // ListboxFixer is handed the TRIGGER as its context and then resolves
  // selectors.listbox and selectors.options against it — and the list is never
  // inside the button that opens it. getElement finds nothing and throws, and
  // the throw lands AFTER the trigger has been decorated and BEFORE anything
  // else is. Photographed on a live site: the button carries role="button",
  // aria-haspopup="listbox", aria-expanded and u1st-trigger-element, while the
  // <ul> and every <li> carry nothing at all.
  //
  // It is the same shape as the TabsFixer defect above and it takes the same
  // remedy: widen the context to the nearest ancestor holding both. Only when
  // the list is genuinely unreachable from the trigger — a site where the
  // current arrangement resolves is left exactly as it is.
  P.contextRoot.listbox = function (root, props) {
    var sel = props && props.selectors;
    if (!sel || !sel.listbox) return null;
    try {
      if (root.matches && root.matches(sel.listbox)) return null;
      if (root.querySelector(sel.listbox)) return null;
    } catch (e) { return null; }

    var node = root;
    while ((node = node.parentElement)) {
      try {
        // The moment an ancestor sweeps in a second trigger it is the wrong
        // root: the fixer would pair one component's button with another's
        // list. Every ancestor above it is worse, so stop rather than widen.
        if (sel.trigger && node.querySelectorAll(sel.trigger).length > 1) return false;
        if (node.querySelector(sel.listbox)) return node;
      } catch (e) { return null; }
    }
    return false;
  };

  /**
   * The popup a trigger opens.
   *
   * Deliberately NOT keyed on role="listbox". The case worth fixing is the one
   * where that role was never written — looking for it there finds nothing and
   * every correction below silently does nothing, which is how the first
   * version of this region managed to change absolutely nothing on the page it
   * was written for.
   */
  var listFor = function (trigger) {
    var id = u.get(trigger, 'aria-controls');
    var byId = id && document.getElementById(id);
    if (byId && !byId.contains(trigger)) return byId;

    // A sibling that is a CONTAINER OF ITEMS. Two or more children, each of
    // them an item or holding one — the same homogeneity test that separates a
    // <ul> from the <nav> around it everywhere else in this tool.
    var sib = trigger.nextElementSibling, seen = 0;
    while (sib && seen++ < 4) {
      if (u.get(sib, 'role') === 'listbox') return sib;
      var kids = u.qsa(':scope > *', sib);
      if (kids.length >= 2 && kids.every(function (k) {
        return (k.matches && k.matches(ITEM)) || u.qsa(ITEM, k).length > 0;
      })) return sib;
      sib = sib.nextElementSibling;
    }
    // Up a few levels only. Walking to <body> finds some other component's
    // list and pairs the two — worse than finding nothing.
    var node = trigger.parentElement, hops = 0;
    while (node && hops++ < 3) {
      var lb = node.querySelector('[role="listbox"]');
      if (lb && !lb.contains(trigger)) return lb;
      node = node.parentElement;
    }
    return null;
  };

  var triggerFor = function (list) {
    var found = null;
    u.qsa(TRIGGER).some(function (t) {
      if (listFor(t) === list) { found = t; return true; }
      return false;
    });
    return found;
  };

  var options = function (list) { return u.qsa(OPT, list).filter(u.visible); };

  /**
   * Put focus in the list — but only if it is still on the trigger. Anything
   * else has already decided where focus goes, and this must not overrule it.
   */
  var moveIn = function (trigger, list) {
    if (document.activeElement !== trigger) return;
    var opts = options(list);
    if (!opts.length) return;
    var chosen = opts.filter(function (o) { return u.get(o, 'aria-selected') === 'true'; })[0] || opts[0];
    // One tab stop, so Tab leaves the list instead of walking every option.
    // Native options (a link, a button) are left alone: taking a link out of
    // the tab order to impose a roving pattern removes a stop that worked.
    opts.forEach(function (o) { if (!u.isNative(o)) u.setTabIndex(o, o === chosen ? 0 : -1); });
    try { chosen.focus(); } catch (e) {}
  };

  // Opening by keyboard. ArrowDown on a closed trigger is also an open command
  // per APG, and no part of the library implements it.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return;
    var trigger = u.closest(e.target, TRIGGER);
    if (!trigger) return;
    var list = listFor(trigger);
    if (!list) return;

    if (e.key === 'ArrowDown' && !u.visible(list)) {
      e.preventDefault();
      trigger.click();
    }
    // Twice: once for a list that is already in the DOM, once for one the page
    // builds or animates in. moveIn is idempotent and refuses to act after
    // focus has left the trigger, so the second call costs nothing.
    setTimeout(function () { if (u.visible(list)) moveIn(trigger, list); }, 60);
    setTimeout(function () { if (u.visible(list)) moveIn(trigger, list); }, 260);
  }, true);

  // Escape: close, and put focus back where it came from. Give the library its
  // chance first — if the list did close on its own, only the focus return is
  // left to do, and clicking the trigger then would reopen it.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var list = u.closest(e.target, '[role="listbox"]');
    if (!list) return;
    var trigger = triggerFor(list);
    if (!trigger) return;
    setTimeout(function () {
      if (u.visible(list)) trigger.click();
      try { trigger.focus(); } catch (err) {}
      P.schedule();
    }, 90);
  }, true);

  // The site opening or closing the list is not something the attribute
  // observer sees — it happens by class or by inline style, and neither is in
  // the filter. So the click that could have caused it schedules the pass.
  document.addEventListener('click', function (e) {
    if (u.closest(e.target, TRIGGER) || u.closest(e.target, '[role="listbox"]')) {
      setTimeout(P.schedule, 0);
      setTimeout(P.schedule, 250);
    }
  }, true);

  P.correct(function () {
    u.qsa(TRIGGER).forEach(function (trigger) {
      var list = listFor(trigger);
      if (!list) return;

      // aria-expanded describes the list AS IT IS, not as it was when U1 ran.
      u.set(trigger, 'aria-expanded', u.visible(list) ? 'true' : 'false');

      // The trigger promises a listbox and the popup is not one.
      //
      // Where the popup carries NO role, writing it is repairing a broken
      // promise and destroys nothing. Where the SITE wrote a role — a <ul
      // role="menu"> is the common one — the decision to overwrite it belongs
      // to the person mapping the site, is asked in Studio, and is carried out
      // there by removing the attribute before u1.fix runs. If it is still
      // here, the answer was no: leave the role, and leave the items alone too,
      // because half-converting a menu into a listbox is worse than either.
      var authored = u.get(list, 'role');
      if (u.get(trigger, 'aria-haspopup') === 'listbox' && authored !== 'listbox') {
        if (authored) return;
        u.set(list, 'role', 'listbox');
      }

      // Rows that never got role="option", for the same reason.
      if (u.get(list, 'role') === 'listbox' && !list.querySelector(OPT)) {
        u.qsa(':scope > *', list).forEach(function (row) {
          // The element a person ACTIVATES. role="option" on a wrapper holding
          // a single link puts the focus on one element and the action on
          // another; where the row is ambiguous, the row itself is the safer
          // answer.
          var hits = u.qsa('a[href],button', row);
          var target = hits.length === 1 ? hits[0] : row;
          if (!u.get(target, 'role')) u.set(target, 'role', 'option');
        });
      }

      // Name the relationship so a screen reader can follow it, and so
      // listFor's first branch answers next time instead of guessing.
      if (!u.get(trigger, 'aria-controls')) {
        if (!list.id) list.id = 'u1p-listbox-' + Math.random().toString(36).slice(2, 9);
        u.set(trigger, 'aria-controls', list.id);
      }

      // An open list with no tab stop anywhere cannot be reached at all.
      if (!u.visible(list)) return;
      var opts = options(list);
      if (!opts.length) return;
      if (u.get(list, 'aria-activedescendant')) return;   // a different model, and a valid one
      var reachable = opts.some(function (o) { return u.isNative(o) || o.tabIndex === 0; });
      if (!reachable) {
        var chosen = opts.filter(function (o) { return u.get(o, 'aria-selected') === 'true'; })[0] || opts[0];
        u.setTabIndex(chosen, 0);
      }
    });
  });

  // Vertical by default: that is the role's default orientation, and unlike a
  // tablist a listbox that says nothing means Up/Down.
  P.rove('[role="listbox"]', OPT, { arrows: true, vertical: 'auto', orientationDefault: 'vertical' });
  // No `activate` — arrowing through a list of links must not follow them.
})();
//#endregion

//#region u1-patch:carousel
// Two problems. The library wires roles and the prev/next/picker clicks but has
// no pause mechanism at all — no reference to pause, stop or autoplay anywhere
// in the fixer — so a carousel that advances on its own leaves 2.2.2 unmet. And
// initialProps assumes slide 0 is the active one instead of reading the page.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  var label = function (running) { return running ? 'Pause the carousel' : 'Resume the carousel'; };

  P.correct(function () {
    u.qsa('[role="group"][aria-roledescription="carousel"], .u1st-carousel, [data-u1-carousel]')
      .forEach(function (car) {
        if (car.__u1pPause) return;
        // Only carousels that actually move need a control. A static one would
        // gain a button that does nothing, which is its own accessibility problem.
        if (!car.querySelector('[aria-hidden="true"], [hidden]')) return;
        car.__u1pPause = true;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'u1p-carousel-pause';
        btn.textContent = '⏸';
        btn.setAttribute('aria-label', label(true));
        btn.style.cssText = 'position:relative;z-index:2';

        var running = true;
        btn.addEventListener('click', function () {
          running = !running;
          btn.textContent = running ? '⏸' : '▶';
          btn.setAttribute('aria-label', label(running));
          // The site owns the timer, so the honest lever is the one every
          // carousel library already listens to.
          car.dispatchEvent(new CustomEvent(running ? 'mouseleave' : 'mouseenter',
            { bubbles: true }));
          car.setAttribute('data-u1p-paused', String(!running));
        });
        car.insertBefore(btn, car.firstChild);
      });
  });
})();
//#endregion

//#region u1-patch:loading
// role="meter" is wrong twice over. The spec requires aria-valuenow on it and
// the library sets none, so the role is invalid as written. And meter describes
// a static measurement within a known range — a progress indicator is
// role="progressbar", which is also allowed to carry no value while
// indeterminate.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  P.correct(function () {
    u.qsa('[role="meter"]').forEach(function (el) {
      u.set(el, 'role', 'progressbar');
      // An indeterminate progressbar legitimately has no value; a meter without
      // one is simply invalid. Only carry a value across if the page states one.
      var now = u.get(el, 'aria-valuenow');
      if (now === null && el.hasAttribute('value')) {
        u.set(el, 'aria-valuenow', el.getAttribute('value'));
      }
    });
  });
})();
//#endregion

//#region u1-patch:pagination
// ButtonsHandler tests `pageButtons.length` — the length of the selector string,
// not the number of elements it matched. A non-empty selector is always truthy,
// so the "not found" branch is unreachable and the element indexed may be
// undefined. aria-current is then pinned to the first page button and set to
// "true" rather than the token pagination calls for, "page".
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;
  var ACTIVE = /(^|\s)(active|selected|current|is-active|is-current)(\s|$)/i;

  P.correct(function () {
    u.qsa('nav[aria-label], [role="navigation"], .pagination, [data-u1-pagination]')
      .forEach(function (nav) {
        var marked = u.qsa('[aria-current]', nav);
        if (!marked.length) return;

        // The page's own class is the truth about which page is showing.
        var buttons = u.qsa('a, button', nav);
        var current = null;
        buttons.forEach(function (b) {
          if (ACTIVE.test(b.className || '') || b.getAttribute('aria-current') === 'page') current = b;
        });

        buttons.forEach(function (b) {
          if (b === current) u.set(b, 'aria-current', 'page');
          else if (b.hasAttribute('aria-current')) b.removeAttribute('aria-current');
        });
      });
  });
})();
//#endregion

//#region u1-patch:tooltip
// aria-describedby is attached only inside onTooltipShow, so the very first time
// a trigger takes focus there is nothing to announce. And 1.4.13 is only half
// met: the tooltip can be dismissed with Escape and on focusout, but it is not
// hoverable — moving the pointer onto the tooltip makes it disappear, which
// defeats reading it.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  P.correct(function () {
    u.qsa('[role="tooltip"]').forEach(function (tip) {
      if (!tip.id) tip.id = 'u1p-tip-' + Math.random().toString(36).slice(2, 9);

      // Keep the tooltip alive while the pointer is on it. The library dismisses
      // on the trigger's mouseout, which fires the moment the pointer leaves the
      // trigger — including when it moves onto the tooltip itself.
      if (!tip.__u1pHover) {
        tip.__u1pHover = true;
        tip.addEventListener('mouseenter', function () {
          tip.setAttribute('data-u1p-hovered', 'true');
        });
        tip.addEventListener('mouseleave', function () {
          tip.removeAttribute('data-u1p-hovered');
        });
      }
    });
  });
})();
//#endregion

//#region u1-patch:grid
// Navigation.navigate handles Home and End but, unlike the arrow cases, without
// preventDefault — so both keys move the cell focus and scroll the page at the
// same time. Enter is compared against event.code, which excludes NumpadEnter.
(function () {
  var P = window.__u1Patch; if (!P) return;

  P.keys('[role="grid"], [role="treegrid"]', function (e) {
    if (e.key === 'Home' || e.key === 'End') e.preventDefault();
  });
  P.numpadEnter('[role="gridcell"], [role="columnheader"], [role="rowheader"]');
})();
//#endregion

//#region u1-patch:link
// LinkFixer activates on `evt.code === "Enter"`, so Enter on the numeric keypad
// (NumpadEnter) does nothing on any element it turned into a link.
(function () {
  var P = window.__u1Patch; if (!P) return;
  P.numpadEnter('[role="link"]');
})();
//#endregion

//#region u1-patch:button
// ButtonFixer has the same event.code comparison, with the same consequence for
// the numeric keypad.
(function () {
  var P = window.__u1Patch; if (!P) return;
  P.numpadEnter('[role="button"], [role="tab"], [role="menuitem"], [role="option"]');
})();
//#endregion

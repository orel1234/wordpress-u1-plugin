'use strict';
//#region u1-patch:core
// ─────────────────────────────────────────────────────────────────────────────
//  U1 patch — extends the U1 runtime from the outside.
//
//  U1 covers the common shape of each component. Real sites keep turning up
//  ground the current infrastructure does not reach yet: a fix that decorates
//  one match where the page has many, a keyboard key a particular widget needs,
//  an ARIA state that goes stale, a component type this build carries no fixer
//  for at all. This file adds those, by wrapping window.u1.fix.* before the
//  site's own fixes call it.
//
//  Every addition here was written against the real u1_vanilla-js-a11y.js, not
//  guessed — each region records what it observed and why it acts. The library
//  is a product on its own release cycle; this file covers the gap in the
//  meantime and is written to stand down the day U1 covers the same ground.
//
//  Two rules hold throughout:
//    1. Never touch a state that is already correct. Each addition checks
//       first, so U1 and this file cannot fight each other.
//    2. Only observable DOM is touched. Nothing here reaches into U1 internals.
//
//  Runs only where U1 is loaded — it builds on what U1 produced.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  var W = window;
  if (W.__u1Patch) return;                       // one instance per page
  // Bump on every change that ships. The whole point is that a page can be
  // asked "which patch are you actually running" — "I reloaded, I promise" is
  // not something either of us can verify from the outside.
  // `skipped` is the record of every fix the wrapper declined to call, and it
  // exists because the alternative was silence. A tab strip whose `tab`
  // selector reached outside its list was refused here, u1.fix.tabs was never
  // called, and nothing anywhere said so — the mapping simply had no effect,
  // which is indistinguishable from a wrong selector. The panel reads this
  // after an apply.
  var P = (W.__u1Patch = { correctors: [], skipped: [], _calls: [], build: '2026-10-08v' });

  // ── Which page a call belongs to ──────────────────────────────────────────
  // A mapping set to "this page only" is called inside __u1OnPage (the
  // exported u1-fixes.js, and the extension's auto-apply), which names the
  // page in window.__u1CallPage while it runs. On a site that changes page
  // WITHOUT a reload — Next.js and every other SPA, molinahealthcare.com
  // among them — those calls must stop counting the moment the person
  // leaves their page and count again when they come back. Every reader of
  // P.calls gets the calls live HERE; P._calls keeps them all.
  var here = function () {
    try { return decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/'; } catch (e) { return location.pathname; }
  };
  P.here = here;

  // ── A heading is never put on a control ────────────────────────────────────
  // role="heading" on <a href> takes the LINK away — it is announced as a
  // heading and is no longer a link — and axe/WAVE report it as a role the
  // element may not have. molinahealthcare.com's footer titles are a span on
  // one column and a link on the next, under one class (2026-10-08). The
  // heading goes on the control's wrapper when the wrapper holds that
  // control and nothing else; otherwise nowhere.
  var CONTROL = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[role="option"],[role="checkbox"],[role="radio"],[role="switch"]';
  P.headingHost = function (el) {
    if (!el || !el.matches || !el.matches(CONTROL)) return el;
    var p = el.parentElement;
    if (!p || p === document.body || p.matches(CONTROL)) return null;
    if (/^H[1-6]$/.test(p.tagName)) return p;
    if (p.querySelectorAll(CONTROL).length !== 1) return null;
    if ((p.textContent || '').replace(/\s+/g, ' ').trim() !== (el.textContent || '').replace(/\s+/g, ' ').trim()) return null;
    return p;
  };
  P.live = function (c) { return !c || !c.page || c.page === here(); };
  try {
    Object.defineProperty(P, 'calls', {
      get: function () { return P._calls.filter(P.live); },
      set: function () {},
      enumerable: true, configurable: true,
    });
  } catch (e) { P.calls = P._calls; }

  // ── A page change without a reload ─────────────────────────────────────────
  // history.pushState / replaceState (a framework's router) and popstate
  // (Back/Forward). Each real change of path fires 'u1:route' on window and
  // a corrector pass, so every page-aware layer re-reads what is live.
  var lastPath = here();
  var routeChanged = function () {
    var now = here();
    if (now === lastPath) return;
    lastPath = now;
    try { W.dispatchEvent(new CustomEvent('u1:route', { detail: { path: now } })); } catch (e) {}
    if (P.schedule) P.schedule();
  };
  if (!W.__u1RouteHooked) {
    W.__u1RouteHooked = true;
    ['pushState', 'replaceState'].forEach(function (k) {
      var orig = history[k];
      if (typeof orig !== 'function') return;
      history[k] = function () { var r = orig.apply(this, arguments); setTimeout(routeChanged, 0); return r; };
    });
    W.addEventListener('popstate', function () { setTimeout(routeChanged, 0); });
  } else {
    W.addEventListener('popstate', function () { setTimeout(routeChanged, 0); });
  }
  W.addEventListener('u1:route', function () { lastPath = here(); if (P.schedule) P.schedule(); });

  var qsa = function (sel, root) {
    try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch (e) { return []; }
  };

  // ── A write that changes nothing is not made ──────────────────────────────
  // The library re-asserts tabindex and aria-* on every pass of its visibility
  // handler, same value or not: on molinahealthcare.com/medicaid, with the
  // search open, 852 writes of tabindex="0", 213 of tabindex="-1" and 275 of
  // aria-hidden="true" in three seconds, every one re-writing the value the
  // element already had. A same-value setAttribute still fires a mutation
  // record, and VoiceOver, which re-reads the element on every record, could
  // not move off the search field (2026-10-06). Same-value writes of the
  // attributes the library and the page fight over are dropped here, for
  // every writer: a no-op write has no observer worth waking.
  (function () {
    var QUIET = /^(tabindex|aria-[a-z]+|role)$/;
    var proto = W.Element && W.Element.prototype;
    if (!proto || proto.setAttribute.__u1pQuiet) return;
    var orig = proto.setAttribute;
    var quiet = function (name, value) {
      if (typeof name === 'string' && QUIET.test(name)) {
        try { if (this.getAttribute(name) === String(value)) return; } catch (e) {}
      }
      return orig.apply(this, arguments);
    };
    quiet.__u1pQuiet = true;
    try { proto.setAttribute = quiet; } catch (e) {}
  })();
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

  /**
   * Is the user typing into this?
   *
   * Every handler below that calls preventDefault on Space, Enter or an arrow
   * MUST ask this first, and none of them did. The menu region takes Space and
   * Enter whenever any ANCESTOR carries aria-expanded="false" — so a text field
   * inside a collapsed nav, a search box in a closed drawer, or Gmail's compose
   * body (which sits inside exactly such a container) could not receive a space
   * or a newline at all. Reported as "I cannot type spaces or Enter in Gmail
   * until I disable the extension", and it was never Gmail-specific: any client
   * site with a field inside a collapsed region had the same defect, less
   * visibly.
   *
   * A key that produces a character, or moves a caret, belongs to whatever the
   * caret is in. There is no accessibility fix worth taking it away for.
   */
  var isTyping = function (el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      // Checkbox, radio and button inputs genuinely act on Space — they are the
      // ones a keyboard fix is FOR. Everything else takes text.
      return !/^(checkbox|radio|button|submit|reset|image|file)$/i.test(el.type || 'text');
    }
    // contenteditable is inherited, so the attribute alone misses a caret
    // sitting in a child of the editable host — which is where Gmail's is.
    // isContentEditable answers that correctly and is the primary check; the
    // ancestor lookup is the fallback for anything that does not implement it.
    if (el.isContentEditable) return true;
    if (closest(el, '[contenteditable]:not([contenteditable="false"])')) return true;
    var role = el.getAttribute && el.getAttribute('role');
    if (role === 'textbox' || role === 'searchbox' || role === 'combobox' || role === 'spinbutton') return true;
    return false;
  };

  /**
   * Does this keystroke belong to the text the user is editing?
   *
   * Deliberately narrower than "is typing": vertical arrows are how a combobox
   * walks its own listbox while focus stays in the input, and taking those away
   * would break the interaction this file exists to provide. So only the keys
   * that always move or extend a caret are reserved — plus multi-line fields,
   * where up and down are line moves rather than list navigation.
   */
  var caretOwns = function (e) {
    var el = e.target;
    if (!isTyping(el)) return false;
    var k = e.key;
    if (k === ' ' || k === 'Enter' || k === 'Home' || k === 'End' ||
        k === 'ArrowLeft' || k === 'ArrowRight') return true;
    var multiline = el.tagName === 'TEXTAREA' || el.isContentEditable;
    return multiline && (k === 'ArrowUp' || k === 'ArrowDown');
  };

  P.util = { qsa: qsa, get: get, set: set, setTabIndex: setTabIndex, closest: closest,
             isNative: isNative, visible: visible, named: named, isTyping: isTyping,
             FOCUSABLE: FOCUSABLE };

  /** A correction pass. Registered by each region, run together and debounced. */
  P.correct = function (fn) { P.correctors.push(fn); };

  var queued = false;
  // The corrector pass is BUDGETED, twice over, because an unbounded pass
  // froze molinahealthcare.com outright (2026-09-01): U1's own initial scan
  // writes ARIA across the whole page, every write re-triggers the observer,
  // and "all correctors, every frame" saturated the main thread on a large
  // DOM. Now: passes start at most every 250ms, each pass spends at most
  // ~30ms and then yields, resuming from where it stopped — correction
  // latency degrades on huge pages; the page never does.
  var cursor = 0, lastStart = 0;
  var run = function () {
    queued = false;
    // Until u1 exists there is nothing to correct — the correctors correct
    // what the U1 ENGINE produced, nothing else. (The other half of the
    // molina freeze: an import handed the site its first mappings and this
    // whole machinery started riding every page load.)
    if (W.u1 === undefined && W.U1 === undefined && W.user1st === undefined) return;
    lastStart = Date.now();
    var began = lastStart;
    var n = P.correctors.length;
    for (var step = 0; step < n; step++) {
      var i = (cursor + step) % n;
      try { P.correctors[i](); } catch (e) { /* one bad fix must not stop the rest */ }
      if (Date.now() - began > 30 && step < n - 1) {
        cursor = (i + 1) % n;
        queued = true;
        setTimeout(run, 100);   // finish the rest of the round shortly
        return;
      }
    }
    cursor = 0;
  };
  var schedule = function () {
    if (queued) return;
    queued = true;
    var wait = Math.max(0, 250 - (Date.now() - lastStart));
    if (wait > 0) setTimeout(run, wait);
    else (W.requestAnimationFrame || setTimeout)(run, 0);
  };
  P.schedule = schedule;

  // U1 re-applies itself on re-render, so corrections have to follow it there.
  //
  // The DOCUMENT is watched, not its <html>: a framework that hydrates the
  // whole document replaces <html> outright — molinahealthcare.com (Next.js)
  // does, and an observer on the old element was left watching a detached
  // node. No corrector ever ran again on its own there: "Fix all" on the
  // new-tab links was pressed four times and undone by every reload
  // (2026-10-08). A Document target with subtree covers the swap itself and
  // everything below whatever <html> comes after it.
  try {
    new MutationObserver(schedule).observe(document, {
      childList: true, subtree: true, attributes: true,
      // aria-expanded is here because the listbox region corrects it against
      // what the list is actually doing. Our own writes cannot loop: set()
      // skips a write that would not change the value, so the pass converges
      // after one round.
      attributeFilter: ['role', 'aria-selected', 'aria-checked', 'aria-hidden',
                        'aria-labeledby', 'aria-current', 'aria-expanded',
                        'tabindex', 'hidden', 'lang', 'dir'],
    });
  } catch (e) {}
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  }
  schedule();

  // ── Heading levels follow re-renders ──────────────────────────────────────
  // fix.heading writes its level once, at the call, and the library's own
  // change detection handles an element once per load. A list that draws new
  // cards on the next page (molinahealthcare.com/knowledge-center/blog) kept
  // its levels on page 1 alone (2026-10-08). Each recorded heading call is
  // re-asserted on every pass: idempotent, so a pass with nothing new writes
  // nothing.
  P.correct(function () {
    (P.calls || []).forEach(function (c) {
      if (c.type !== 'heading') return;
      var n = parseInt(c.props && c.props.level, 10);
      var sel = (c.props && c.props.selectors && c.props.selectors.heading) || c.selector;
      if (!(n >= 1 && n <= 6) || typeof sel !== 'string') return;
      qsa(sel).forEach(function (el) {
        var r = get(el, 'role');
        // A control the library made a heading anyway: given back its own
        // role, and the heading goes on its wrapper (P.headingHost).
        if (r === 'heading' && el.matches('a[href],button,input,select,textarea,summary')) {
          el.removeAttribute('role'); el.removeAttribute('aria-level');
          r = null;
        }
        var host = P.headingHost(el);
        if (host !== el) {
          if (host && !/^H[1-6]$/.test(host.tagName)) { set(host, 'role', 'heading'); set(host, 'aria-level', String(n)); }
          else if (host && +host.tagName.charAt(1) !== n) set(host, 'aria-level', String(n));
          return;
        }
        if (r === 'button' || r === 'link') return;          // another mapping made it a control
        if (/^H[1-6]$/.test(el.tagName)) {
          if (+el.tagName.charAt(1) === n) { if (get(el, 'aria-level')) el.removeAttribute('aria-level'); }
          else set(el, 'aria-level', String(n));
        } else {
          if (el.querySelector('a[href],button,input,select,textarea,h1,h2,h3,h4,h5,h6')) return;   // a region, not a heading
          set(el, 'role', 'heading'); set(el, 'aria-level', String(n));
        }
      });
    });
  });

  // ── No Tab stop nobody can see ─────────────────────────────────────────────
  // A drawer that is "closed" by sliding it off the screen (position:fixed,
  // translated out of the viewport) keeps every control in it in the Tab
  // order: on molinahealthcare.com's blog, Tab from Search went into the
  // closed filter drawer — "Filter by:" and fourteen checkboxes nobody could
  // see — before reaching Filter (2026-10-08). And a control marked
  // aria-hidden="true" but still focusable is a stop a screen reader is told
  // does not exist.
  //   · a fixed/absolute container wholly outside the viewport → its controls
  //     leave the Tab order, the container is hidden from assistive tech;
  //   · a focusable element under aria-hidden="true" → out of the Tab order.
  // Recorded (data-u1p-ghost) and put back the moment the drawer comes on
  // screen or the aria-hidden goes. Programmatic focus still works
  // (tabindex -1), so a site that focuses into its drawer on open is not
  // broken. Elements this patch's own layers manage are left to them.
  var GHOST = 'data-u1p-ghost', GHOST_ROOT = 'data-u1p-ghost-root';
  var TABBABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]';
  var offScreen = function (el) {
    var cs; try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var vw = W.innerWidth || document.documentElement.clientWidth, vh = W.innerHeight || document.documentElement.clientHeight;
    if (cs.position === 'fixed') return r.right <= 0 || r.left >= vw || r.bottom <= 0 || r.top >= vh;
    return r.right <= 0 || r.left >= Math.max(vw, document.documentElement.scrollWidth);
  };
  var ghost = function (el) {
    // kept out by the label-checkbox rule below — always, whatever was recorded
    if (el.hasAttribute('data-u1p-cbx-in')) { el.removeAttribute(GHOST); if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1'); return; }
    // Already recorded: another layer (the accordion's header) may have put
    // tabindex="0" back since — take it out again, keep what was recorded.
    if (el.hasAttribute(GHOST)) { if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1'); return; }
    if (P.disclosureOwns && P.disclosureOwns(el)) return;
    var cur = el.getAttribute('tabindex');
    if (cur === '-1') return;
    if (!el.matches(TABBABLE)) return;
    el.setAttribute(GHOST, cur === null ? '' : cur);
    el.setAttribute('tabindex', '-1');
  };
  var unghost = function (el) {
    if (el.hasAttribute('data-u1p-cbx-in')) { el.removeAttribute(GHOST); el.setAttribute('tabindex', '-1'); return; }
    var was = el.getAttribute(GHOST);
    el.removeAttribute(GHOST);
    if (was === '' || was === null) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', was);
  };
  // Registered LAST (after every region's correctors, which are pushed while
  // this file is still running): a region that writes tabindex="0" on its
  // headers — the accordion's, on the drawer's "Filter by:" — ran after this
  // in the same pass and put the stop back every time.
  var ghostPass = function () {
    // Off-screen fixed drawers.
    qsa('body *').forEach(function (el) {
      if (el.hasAttribute(GHOST_ROOT)) {
        if (!offScreen(el)) {
          el.removeAttribute(GHOST_ROOT);
          if (el.getAttribute('data-u1p-ghost-aria') === '1') { el.removeAttribute('aria-hidden'); el.removeAttribute('data-u1p-ghost-aria'); }
          qsa('[' + GHOST + ']', el).forEach(unghost);
        } else {
          qsa(TABBABLE, el).forEach(ghost);   // still closed: new or re-enabled controls leave too
        }
        return;
      }
      var cs; try { cs = getComputedStyle(el); } catch (e) { return; }
      if (cs.position !== 'fixed') return;
      if (!el.querySelector(TABBABLE) || !offScreen(el)) return;
      el.setAttribute(GHOST_ROOT, '1');
      if (get(el, 'aria-hidden') !== 'true') { el.setAttribute('aria-hidden', 'true'); el.setAttribute('data-u1p-ghost-aria', '1'); }
      qsa(TABBABLE, el).forEach(ghost);
    });
    // Focusable under aria-hidden (outside the drawers handled above).
    qsa('[aria-hidden="true"]').forEach(function (h) {
      if (h.hasAttribute(GHOST_ROOT)) return;
      [h].concat(qsa(TABBABLE, h)).forEach(function (el) { if (el.matches && el.matches(TABBABLE)) ghost(el); });
    });
    // …and back, once the aria-hidden is gone.
    qsa('[' + GHOST + ']').forEach(function (el) {
      if (el.closest('[' + GHOST_ROOT + ']')) return;
      if (!el.closest('[aria-hidden="true"]')) unghost(el);
    });
  };
  P.ghostPass = ghostPass;
  P.offScreen = offScreen;
  // The drawers already found, re-checked at the moment Tab is pressed —
  // before the browser picks the next stop. While a drawer mapped as a
  // dialog was open the library wrote tabindex="0" on everything in it, and
  // after it slid shut those stops stayed until the next scheduled pass:
  // the first Shift+Tab from Filter went back into the closed drawer
  // (molinahealthcare.com blog, 2026-10-08). Known roots only, so it is cheap
  // enough to run on every Tab.
  var ghostKnown = function () {
    qsa('[' + GHOST_ROOT + ']').forEach(function (el) {
      if (offScreen(el)) qsa(TABBABLE, el).forEach(ghost);
    });
  };
  P.ghostKnown = ghostKnown;
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab') { try { ghostKnown(); } catch (x) {} } }, true);
  setTimeout(function () { P.correct(ghostPass); schedule(); }, 0);
  // A drawer opens on a click or a transition, neither of which the core
  // observer sees (class and transform are not in its filter).
  document.addEventListener('click', function () { setTimeout(schedule, 60); setTimeout(schedule, 450); }, true);
  document.addEventListener('transitionend', function () { schedule(); }, true);

  // ── A field named only by its placeholder ──────────────────────────────────
  // <input placeholder="Upcoming Events..."> with no <label>, aria-label,
  // aria-labelledby or title: a placeholder is a hint that disappears as soon
  // as someone types, and WAVE reports the field as "Missing form label"
  // (molinahealthcare.com/about/events/az, 2026-10-08). Its placeholder
  // becomes its name — the words the site itself chose for it — and only
  // where the field has no name of any other kind.
  P.correct(function () {
    qsa('input[placeholder]:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]),textarea[placeholder]').forEach(function (f) {
      if (f.hasAttribute('aria-label') || f.hasAttribute('aria-labelledby') || (f.getAttribute('title') || '').trim()) return;
      if (f.closest('label') || (f.id && document.querySelector('label[for="' + (W.CSS && CSS.escape ? CSS.escape(f.id) : f.id) + '"]'))) return;
      var name = (f.getAttribute('placeholder') || '').replace(/\s+/g, ' ').replace(/[\s.\u2026:]+$/, '').trim();
      if (name) f.setAttribute('aria-label', name);
    });
  });

  // ── A checkbox the site draws with its <label> ─────────────────────────────
  // <label>Mississippi (1)<input type="checkbox" style="opacity:0;width:0">
  // <span class="checkmark"></span></label> — the real control has no box,
  // the label is what is seen and clicked. VoiceOver then finds TWO things:
  // the hidden checkbox ("Mississippi (1), unchecked, checkbox") and the
  // label's text ("Mississippi (1), clickable"), and its cursor and the focus
  // ring sit on different boxes (molinahealthcare.com blog filter, Orel,
  // 2026-10-08). The label becomes the checkbox: role="checkbox" (whose
  // children are presentational, so the text is no stop of its own),
  // aria-checked/aria-disabled read from the input, one Tab stop, Space
  // toggles through the input itself — so the site's own change handling
  // runs as it always does. The input leaves the Tab order and the tree.
  // Only a lone checkbox in its label, only while the input has no box.
  var CBX = 'data-u1p-cbx', CBX_IN = 'data-u1p-cbx-in';
  var boxless = function (el) {
    var cs, r;
    try { cs = getComputedStyle(el); r = el.getBoundingClientRect(); } catch (e) { return false; }
    return r.width < 2 || r.height < 2 || parseFloat(cs.opacity) === 0 || cs.visibility === 'hidden';
  };
  var cbxSync = function (lab, inp) {
    var want = inp.indeterminate ? 'mixed' : inp.checked ? 'true' : 'false';
    if (lab.getAttribute('aria-checked') !== want) lab.setAttribute('aria-checked', want);
    if (inp.disabled) { if (lab.getAttribute('aria-disabled') !== 'true') lab.setAttribute('aria-disabled', 'true'); }
    else if (lab.hasAttribute('aria-disabled')) lab.removeAttribute('aria-disabled');
  };
  var cbxPass = function () {
    qsa('label input[type="checkbox"]').forEach(function (inp) {
      var lab = inp.closest('label');
      if (!lab) return;
      if (lab.hasAttribute(CBX)) { cbxSync(lab, inp); if (inp.getAttribute('tabindex') !== '-1') inp.setAttribute('tabindex', '-1'); return; }
      if (lab.hasAttribute('role') || lab.querySelectorAll('input,select,textarea,button,a[href]').length !== 1) return;
      if (!boxless(inp) || boxless(lab)) return;
      lab.setAttribute(CBX, '1');
      inp.setAttribute(CBX_IN, inp.getAttribute('tabindex') === null ? '' : inp.getAttribute('tabindex'));
      lab.setAttribute('role', 'checkbox');
      // a closed drawer's label is a stop nobody sees: born out of the Tab order there
      lab.setAttribute('tabindex', inp.disabled || inp.closest('[' + GHOST_ROOT + ']') ? '-1' : '0');
      if (inp.closest('[' + GHOST_ROOT + ']')) lab.setAttribute(GHOST, '0');
      inp.removeAttribute(GHOST);
      inp.setAttribute('tabindex', '-1');
      inp.setAttribute('aria-hidden', 'true');
      cbxSync(lab, inp);
    });
  };
  P.correct(cbxPass);
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.hasAttribute && t.hasAttribute(CBX_IN)) { var lab = t.closest('label'); if (lab) cbxSync(lab, t); }
  }, true);
  document.addEventListener('keydown', function (e) {
    var lab = e.target;
    if (!(lab && lab.hasAttribute && lab.hasAttribute(CBX))) return;
    if (e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
    var inp = lab.querySelector('input[' + CBX_IN + ']');
    if (inp && !inp.disabled) { inp.click(); cbxSync(lab, inp); }
  }, true);
  // focus that lands on the hidden input (a mouse press on the label) belongs on the label
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!(t && t.hasAttribute && t.hasAttribute(CBX_IN))) return;
    if (t.getAttribute('tabindex') !== '-1') t.setAttribute('tabindex', '-1');
    var lab = t.closest('label[' + CBX + ']');
    // never into a closed drawer: there the focus is a mistake, not a press
    if (lab && !t.closest('[' + GHOST_ROOT + ']')) { try { lab.focus(); } catch (x) {} }
  }, true);

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
  // opts.unless: a selector; a key pressed inside anything matching it is
  // left alone. A region that has taken a component over entirely (the
  // focus-hover submenus) declares itself this way so the generic handlers
  // do not move focus a second time.
  P.keys = function (containerSel, handler, opts) {
    var unless = opts && opts.unless;
    document.addEventListener('keydown', function (e) {
      // The caret's keys are the caret's. Every region below matches on a
      // CONTAINER, so a text field inside a tablist, a grid cell or a menu
      // reaches these handlers, and the ones that preventDefault then eat the
      // keystroke. No handler registered here consumes Space or Enter, so this
      // costs nothing and closes the whole class.
      if (caretOwns(e)) return;
      if (unless && closest(e.target, unless)) return;
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
    }, { unless: opts.unless });
  };

  /** NumpadEnter: the library compares event.code, which excludes it. */
  P.numpadEnter = function (selector) {
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'NumpadEnter') return;
      if (isTyping(e.target)) return;
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
  // radio was missing here, so a page with two radio groups had one of them
  // fixed — RadioFixer re-queries with querySelector and takes the first.
  var PER_MATCH = ['tabs', 'combobox', 'listbox', 'dialog', 'tooltip', 'pagination', 'radio'];
  var MARK = 'data-u1p-instance';
  var seq = 0;

  // A fixer's first argument is a CONTEXT, and some fixers resolve their other
  // selectors against it — so the element the context names is not always an
  // element the fixer can work from. A region registers a resolver here to widen
  // it to one that is. See the tabs region for the case that needs it.
  P.contextRoot = {};

  // A heading is a LINE. molinahealthcare.com's AI-built set carried
  // fix.heading('.theme-marketplace') — the wrapper around the whole page
  // body — so the content area became role="heading", every landmark and
  // control inside it lived "inside a heading" for a screen reader, and the
  // main-content skip link could not make it the main landmark ("has a role
  // already"). An element that holds controls, headings or blocks of text is
  // a region, not a heading, and the mapping is refused and recorded.
  var notHeadingWhy = function (el) {
    if (/^H[1-6]$/.test(el.tagName)) return null;
    try {
      if (el.querySelector('a[href],button,input,select,textarea,[role="button"],h1,h2,h3,h4,h5,h6,[role="heading"],nav,main,header,footer,form,table,ul,ol')) {
        return 'it holds controls, headings or structure — a region, not a line of text';
      }
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 240) return 'its text is ' + text.length + ' characters — a block, not a heading';
      if (el.querySelectorAll('*').length > 40) return 'it holds ' + el.querySelectorAll('*').length + ' elements — a region, not a heading';
    } catch (e) {}
    return null;
  };
  var headingsOnly = function (els, selector) {
    for (var i = 0; i < els.length; i++) {
      var why = notHeadingWhy(els[i]);
      if (why) {
        P.skipped.push({ type: 'heading', selector: selector, why: 'not a heading: ' + why });
        return false;
      }
    }
    return true;
  };

  // ── Fixers this build of U1 does not have ─────────────────────────────────
  //
  // U1 is delivered per client and not every build carries every fixer. Read
  // off the real engine at dev.tamam.user1st.com: it defines nineteen, and
  // `heading` is not among them — so a heading mapping, correct in every other
  // way, failed with "u1.fix.heading missing" and could never work there.
  //
  // Supplying it is what this file is for; grid-nav.js already ships whole
  // engines that need no U1 at all.
  //
  //   · ONLY what is missing. A build with the real fixer keeps it — the
  //     vendor's is authoritative and ours is a stand-in, not an improvement.
  //   · ONLY where the behaviour is exact. `heading` is role="heading" plus
  //     aria-level and nothing else. `menu` is not, and half-guessing one
  //     would be worse than the honest failure the panel reports.
  var FALLBACK = {
    // fix.heading(selector, { level, selectors: { heading } })
    heading: function (selector, props) {
      var lvl = props && props.level;
      var n = parseInt(lvl, 10);
      if (!(n >= 1 && n <= 6)) n = 2;
      var els = qsa(selector);
      if (!headingsOnly(els, selector)) return 0;
      els.forEach(function (el) {
        // A real heading at the wrong LEVEL — an <h4> that should be an <h3>
        // under its <h2> — keeps its tag and gets aria-level, which every
        // browser honours over the tag in the accessibility tree. No role:
        // <h4> already is one. (This used to skip native headings entirely,
        // so mapping "Get Active!" to H3 changed nothing and the scan kept
        // reporting the skip.) A non-heading gets both.
        var host = P.headingHost(el);              // never a control (see P.headingHost)
        if (!host) return;
        el = host;
        if (/^H[1-6]$/.test(el.tagName)) {
          if (+el.tagName.charAt(1) === n) { if (get(el, 'aria-level')) el.removeAttribute('aria-level'); return; }
          set(el, 'aria-level', String(n));
          return;
        }
        set(el, 'role', 'heading');
        set(el, 'aria-level', String(n));
      });
      return els.length;
    },
  };

  /**
   * Put the missing fixers on whatever window.u1 is RIGHT NOW.
   *
   * Idempotent, and deliberately callable at any moment rather than only from
   * wrap(). Installing once was not enough: settle() leaves window.u1 an
   * ordinary writable property (it has to — the site may legitimately reassign
   * it), and a library that re-initialises takes every fixer we added with it.
   * The panel calls this immediately before it applies, so what it checks for
   * is what is actually there.
   */
  P.filled = P.filled || [];
  P.ensureFixers = function () {
    var u1 = W.u1 !== undefined ? W.u1 : W.U1 !== undefined ? W.U1 : W.user1st;
    if (!u1 || !u1.fix) return [];
    Object.keys(FALLBACK).forEach(function (name) {
      // The real one wins. Our OWN stand-in from an earlier install of this
      // patch does not: a re-injected patch must bring its current fallback,
      // or a fix in the fallback never reaches a page until it is reloaded —
      // which is how "mapped to H3, still reads H4" survived three rebuilds.
      if (typeof u1.fix[name] === 'function' && !u1.fix[name].__u1PatchFilled) return;
      u1.fix[name] = FALLBACK[name];
      u1.fix[name].__u1PatchFilled = true;
      if (P.filled.indexOf(name) === -1) P.filled.push(name);
    });
    (P.fixerHooks || []).forEach(function (fn) { try { fn(u1); } catch (e) {} });
    return P.filled;
  };

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
        var perRootProps = null;
        if (resolve) {
          roots = [];
          perRootProps = [];
          els.forEach(function (el) {
            var r = resolve(el, props);
            // false means "this one cannot work" — a selector that matched more
            // than the caller meant it to. Calling the fixer there would only
            // throw, and one throw takes the other instances down with it.
            if (r === false) {
              widened = true;
              P.skipped.push({ type: name, selector: selector,
                               why: (resolve.lastWhy && resolve.lastWhy(el)) ||
                                    'no ancestor holds this component and its parts together' });
              return;
            }
            // A resolver may hand back BOTH a root and props to call it with.
            // Widening the context to reach one selector can pull in elements
            // another selector must not see; the resolver is the only place
            // that knows both, so it is allowed to narrow the props to match.
            if (r && typeof r === 'object' && r.root) {
              widened = true;
              roots.push(r.root);
              perRootProps.push(r.props || props);
              return;
            }
            if (r && r !== el) { widened = true; roots.push(r); }
            else roots.push(el);
            perRootProps.push(props);
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
          last = orig.call(this, '[' + MARK + '="' + token + '"]',
                           (perRootProps && perRootProps[i]) || props);
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
          // The library's schema is not uniform, and this is the whole bug that
          // was here: banner, contentinfo and main take a single OBJECT, while
          // complementary, form, navigation, search and application take an
          // ARRAY. Splitting a call and handing every role back as a bare
          // object failed LandmarksPropsSchema on five of the eight, and the
          // library's answer to that is to throw:
          //
          //     Error: [ … ]
          //     Uncaught Error: Invalid Landmarks props provided.
          //
          // …which killed the whole u1.fix.landmarks call, including the roles
          // that were shaped correctly. So the shape it arrived in is the shape
          // it goes back in.
          var wasArray = Array.isArray(props[role]);
          var rewrap = function (entry) { return wasArray ? [entry] : entry; };
          var entries = [].concat(props[role] || []);
          entries.forEach(function (entry) {
            var sel = entry && entry.selectors && entry.selectors.landmark;
            var els = sel ? qsa(sel) : [];
            if (els.length < 2) {
              var one = {}; one[role] = rewrap(entry);
              result = origLandmarks.call(self, one, context);
              return;
            }
            for (var i = 0; i < els.length; i++) {
              var token = 'u1p' + (seq++);
              els[i].setAttribute(MARK, token);
              var scoped = JSON.parse(JSON.stringify(entry));
              scoped.selectors.landmark = '[' + MARK + '="' + token + '"]';
              var single = {}; single[role] = rewrap(scoped);
              result = origLandmarks.call(self, single, context);
            }
          });
        });
        return result;
      };
    }

    // ── A per-mapping switch this patch reads and U1 never sees ───────────
    //
    // `focusOpensSubmenu: true` on a menu mapping turns the focus-hover
    // region on for THAT menu's triggers, and nothing else. Not every client
    // wants Tab to behave as hover, so it is opt-in per menu rather than on
    // everywhere. It rides inside the fix's own config so every path that
    // runs the fix carries it without further plumbing — Apply from the
    // panel, auto-apply on page load, the exported u1-fixes.js — and it
    // comes off here, before U1 validates the props it is handed.
    P.focusOpen = P.focusOpen || [];
    var origMenu = u1.fix.menu;
    if (typeof origMenu === 'function') {
      u1.fix.menu = function (selector, props) {
        if (props && typeof props === 'object' && 'focusOpensSubmenu' in props) {
          var on = props.focusOpensSubmenu === true || props.focusOpensSubmenu === 'true';
          var sel = props.selectors || {};
          var entry = { triggerSel: sel.triggers || '',
                        menuSel: sel.menu || (typeof selector === 'string' ? selector : '') };
          // The latest call for a menu is the truth about it. Re-applying with
          // the switch OFF must undo an earlier ON — so the menu's previous
          // entry comes out either way, and anything it is holding open right
          // now is closed, not left until focus happens to move.
          var stale = P.focusOpen.filter(function (s) {
            return s.menuSel === entry.menuSel || (s.triggerSel && s.triggerSel === entry.triggerSel);
          });
          P.focusOpen = P.focusOpen.filter(function (s) { return stale.indexOf(s) === -1; });
          stale.forEach(function (s) { if (P.focusOpenRelease) P.focusOpenRelease(s); });
          if (on) P.focusOpen.push(entry);
          var clean = {};
          Object.keys(props).forEach(function (k) { if (k !== 'focusOpensSubmenu') clean[k] = props[k]; });
          props = clean;
        }
        return origMenu.call(this, selector, props);
      };
    }

    // ── `enterSelects: true` on a listbox mapping ──────────────────────────
    //
    // Same shape as focusOpensSubmenu: a switch this patch reads and U1 never
    // sees. For THAT list, arrow keys only move the highlight (focus stays on
    // the list, aria-activedescendant names the option) and only Enter or
    // Space activates the option. Needed on sites where an option acts the
    // moment it receives focus — a language picker whose <a> options navigate
    // on focus — so arrowing through the list was changing the page. Read by
    // the listbox region below.
    P.enterSelects = P.enterSelects || [];
    var origListbox = u1.fix.listbox;
    if (typeof origListbox === 'function') {
      u1.fix.listbox = function (selector, props) {
        if (props && typeof props === 'object' && 'enterSelects' in props) {
          var esOn = props.enterSelects === true || props.enterSelects === 'true';
          var esSel = props.selectors || {};
          var esEntry = { listSel: esSel.listbox || (typeof selector === 'string' ? selector : ''),
                          optionsSel: esSel.options || '', triggerSel: esSel.trigger || '' };
          P.enterSelects = P.enterSelects.filter(function (x) { return x.listSel !== esEntry.listSel; });
          if (esOn && esEntry.listSel) P.enterSelects.push(esEntry);
          var esClean = {};
          Object.keys(props).forEach(function (k) { if (k !== 'enterSelects') esClean[k] = props[k]; });
          props = esClean;
        }
        return origListbox.call(this, selector, props);
      };
    }

    // ── heading: the level lands, whatever the engine's gate does ──────────
    //
    // HeadingFixer sits behind FixerAbstract's wait-for-visible gate; on some
    // pages that gate never resolves and the mapping has no effect — "I
    // mapped it to H3 and it still reads H4". The correction is two
    // attributes and idempotent, so it is written here as well, at once.
    var origHeading = u1.fix.heading;
    if (typeof origHeading === 'function' && !origHeading.__u1PatchHeadingWrap) {
      u1.fix.heading = function (selector, props) {
        try {
          var n = parseInt(props && props.level, 10);
          var sel = (props && props.selectors && props.selectors.heading) || selector;
          if (typeof sel === 'string' && !headingsOnly(qsa(sel), sel)) return 0;   // see notHeadingWhy
          if (n >= 1 && n <= 6 && typeof sel === 'string') {
            qsa(sel).forEach(function (el) {
              el = P.headingHost(el);              // never a control (see P.headingHost)
              if (!el) return;
              if (/^H[1-6]$/.test(el.tagName)) {
                if (+el.tagName.charAt(1) === n) { if (get(el, 'aria-level')) el.removeAttribute('aria-level'); }
                else set(el, 'aria-level', String(n));
              } else { set(el, 'role', 'heading'); set(el, 'aria-level', String(n)); }
            });
          }
        } catch (e) {}
        return origHeading.apply(this, arguments);
      };
      u1.fix.heading.__u1PatchHeadingWrap = true;
      if (origHeading.__u1PatchFilled) u1.fix.heading.__u1PatchFilled = true;
    }

    // ── Any CSS selector, handed to U1 as one it can read ──────────────────
    //
    // U1 resolves selectors through jQuery and refuses, silently, anything
    // past `> + ~`, tags, classes, ids, attributes and a few structural
    // pseudos — no descendant space, no :has, no :last-of-type. That made the
    // selector the hard part of every mapping: on tamam.co.il the only thing
    // separating three real section titles from the bold paragraphs around
    // them is a <br> right after the <strong>, which `strong:has(+br)` says
    // exactly and nothing U1 accepts can say at all.
    //
    // So the browser resolves the selector instead. Every match is stamped
    // with a token in `data-u1p-sel` (space-separated, one element can carry
    // several), and U1 is handed `[data-u1p-sel~="token"]` — an attribute
    // selector, which it has always accepted. The token is a hash of the
    // selector, so the same selector is the same token on every call and on
    // every page. Elements that appear later are stamped by the correction
    // pass. A selector U1 can already read passes through untouched, and one
    // that is not CSS at all does too, so U1 reports it the way it always has.
    //
    // Wrapped here, outside every correction above and inside the recorder
    // below: the corrections see a selector they can read, and the recorder
    // sees the one the site wrote.
    var SEL_MARK = 'data-u1p-sel';
    // What U1 can read is decided by ITS gate, not by what jQuery could in
    // principle resolve. The engine (Ku, in u1_vanilla-js-a11y.js) runs every
    // selector it is handed through
    //   ^([\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\])([>+~]?(…same…))*(,…)*$
    // before doing anything with it: no pseudo-class of any kind, and
    // "Invalid selector" for one. The previous version of this check let the
    // structural pseudos (:nth-child, :not, …) through on the belief that
    // jQuery resolves them — it does, but the selector never reaches jQuery.
    //
    // Worse than the refusal: that regex has an OPTIONAL combinator between
    // compounds, so a run of word characters can be split between its
    // alternatives in exponentially many ways, and when the match FAILS the
    // engine backtracks through all of them. Twenty-two characters before
    // the first `:` cost 36 ms; every further character doubles it. The
    // molinahealthcare.com mapping
    //   .EditorialCardHC_right_section__rDQ9O>div:nth-child(1)>…>h2:nth-child(1)
    // has thirty-six, and u1.fix.link() on it froze the tab for good, on
    // every page load, with or without a match on the page (2026-10-04).
    //
    // So this test answers NO for anything that gate would reject — the
    // selector is then stamped and the engine receives `[data-u1p-sel~=…]`,
    // which it has always accepted — and it is linear itself: each compound
    // is an optional tag followed by tokens that each begin with `.`, `#`
    // or `[`, so there is only one way to match.
    var U1_COMPOUND = /^[\w-]*(?:[.#][\w-]+|\[[^\]]+\])*$/;
    var u1Reads = function (s) {
      var n = String(s).trim().replace(/\s*([>+~,])\s*/g, '$1');
      return n.split(',').every(function (group) {
        return group !== '' && group.split(/[>+~]/).every(function (c) {
          return c !== '' && U1_COMPOUND.test(c);
        });
      });
    };
    P.freeSel = P.freeSel || {};
    var stampFree = function (css, token) {
      qsa(css).forEach(function (el) {
        var cur = get(el, SEL_MARK) || '';
        if ((' ' + cur + ' ').indexOf(' ' + token + ' ') === -1) el.setAttribute(SEL_MARK, cur ? cur + ' ' + token : token);
      });
    };
    P.readable = function (sel) {
      if (typeof sel !== 'string' || !sel.trim() || u1Reads(sel)) return sel;
      // Not CSS at all (a typo, a trailing `>`): there is nothing to stamp, and
      // U1 should refuse it the way it always has — but not by being handed
      // the string, because its gate backtracks exponentially on exactly this
      // kind of failure when a long class name comes first. A stand-in that
      // fails the gate on its first character gets the same "Invalid
      // selector" out of the engine in constant time. The recorder, wrapped
      // outside this, still sees what the site wrote.
      try { document.querySelector(sel); } catch (e) { return ':u1p-invalid'; }
      var h = 5381;
      for (var i = 0; i < sel.length; i++) h = ((h * 33) ^ sel.charCodeAt(i)) >>> 0;
      var token = 's' + h.toString(36);
      P.freeSel[token] = sel;
      stampFree(sel, token);
      return '[' + SEL_MARK + '~="' + token + '"]';
    };
    var readableIn = function (v, inSelectors) {
      if (typeof v === 'string') return inSelectors ? P.readable(v) : v;
      if (!v || typeof v !== 'object') return v;
      var out = Array.isArray(v) ? [] : {};
      Object.keys(v).forEach(function (k) { out[k] = readableIn(v[k], inSelectors || k === 'selectors'); });
      return out;
    };
    P.correct(function () {
      Object.keys(P.freeSel).forEach(function (t) { stampFree(P.freeSel[t], t); });
    });
    Object.keys(u1.fix).forEach(function (name) {
      if (name.charAt(0) === '_' || typeof u1.fix[name] !== 'function') return;
      var inner = u1.fix[name];
      var outer = function () {
        var args = Array.prototype.slice.call(arguments);
        try {
          // landmarks(props, context) carries its selectors inside props.
          args[0] = typeof args[0] === 'string' ? P.readable(args[0]) : readableIn(args[0], name === 'landmarks');
          if (args.length > 1) args[1] = readableIn(args[1], false);
        } catch (e) { args = arguments; }
        return inner.apply(this, args);
      };
      ['__u1PatchFilled', '__u1PatchHeadingWrap'].forEach(function (k) { if (inner[k]) outer[k] = inner[k]; });
      u1.fix[name] = outer;
    });

    // ── Record what the SITE itself asked for ─────────────────────────────
    //
    // Every fix the page runs, as it runs it: the type, the selector and the
    // props. That is exactly a mapping, so a site already carrying a U1
    // deployment can be read back into the panel instead of re-derived by
    // hand — which on a site like tamam.co.il means several menus somebody
    // else wired months ago.
    //
    // A SEPARATE pass over every fixer, not folded into the per-match wrapper
    // above: PER_MATCH is seven types and `menu` is not one of them, so
    // recording inside it would have silently missed the very component that
    // prompted this. Recording is orthogonal to correcting, and every fixer
    // is worth recording.
    //
    // Wrapped LAST, so it sits outside the corrections and sees the arguments
    // the site actually passed rather than anything this patch rewrote. It
    // only observes — the original is called with `arguments` untouched, and
    // a throw here must never take the site's own fix down, hence the catch.
    // The flags that say "this function is the patch's own" ride along onto
    // the recording wrapper — without that, ensureFixers could not tell its
    // own stand-in from a real engine fixer once it had been wrapped, and a
    // re-injected patch kept the old stand-in for the life of the page.
    var keepFlags = function (from, to) {
      ['__u1PatchFilled', '__u1PatchHeadingWrap'].forEach(function (k) { if (from && from[k]) to[k] = from[k]; });
      return to;
    };
    Object.keys(u1.fix).forEach(function (name) {
      if (name.charAt(0) === '_' || typeof u1.fix[name] !== 'function') return;
      var inner = u1.fix[name];
      u1.fix[name] = keepFlags(inner, function (selector, props) {
        try {
          if (typeof selector === 'string') {
            // Structured-cloned across the world boundary later, so it must
            // be plain data. A props object holding a function or a node
            // would make the whole list unreadable from the panel.
            var plain = JSON.parse(JSON.stringify(props === undefined ? {} : props));
            var page = typeof W.__u1CallPage === 'string' ? W.__u1CallPage : null;
            // Coming back to a page re-runs its calls (__u1OnPage): the same
            // call is recorded once, not once per visit.
            var key = name + '\u0001' + selector + '\u0001' + (page || '') + '\u0001' + JSON.stringify(plain);
            var dup = P._calls.some(function (c) { return c.key === key; });
            if (!dup) P._calls.push({ type: name, selector: selector, props: plain, page: page, key: key, at: Date.now() });
            // A new mapping changes what the correctors read (the
            // disclosure layer's pairs and rows come off P.calls). Nothing
            // else wakes them: on molinahealthcare.com the mega bar's items
            // sat at the site's own tabindex=-1 for as long as nothing
            // mutated, and Tab skipped the bar (2026-10-05).
            schedule();
          }
        } catch (e) {}
        return inner.apply(this, arguments);
      });
    });

    // ── Filling in a fixer the build does not have ────────────────────────
    //
    // U1 is delivered per client, and not every build carries every fixer. On
    // tamam.co.il window.u1.fix.heading simply does not exist, so a heading
    // mapping — correct selector, correct level, saved and exported — failed
    // with "u1.fix.heading missing" and could never work on that site however
    // it was written.
    //
    // Supplying it here is what this file is for, and the project already does
    // exactly this elsewhere: grid-nav.js ships whole engines (tabs, clickable,
    // breadcrumb, link-list) that need no U1 at all.
    //
    // Two rules, both deliberate:
    //
    //   · ONLY what is missing. A build that has the real fixer keeps it —
    //     the vendor's is authoritative and ours is a stand-in, never an
    //     improvement on it.
    //   · ONLY where the behaviour is unambiguous. `heading` is role="heading"
    //     plus aria-level and nothing else, so a stand-in is exact. `menu` is
    //     not, and half-guessing one would be worse than the honest failure
    //     the panel reports today.
    //
    // Anything filled in here is marked so the panel can say the fix came from
    // the patch rather than from the library.
    P.ensureFixers();

    // ── u1st-avoid-change-detection, on an element we were asked to fix ───
    //
    // The attribute tells U1 to skip an element entirely. It is usually not a
    // decision anybody made: U1 stamps it on what it has processed, and a site
    // whose framework re-renders that element leaves the stamp behind on
    // markup U1 never actually touched. On tamam.co.il #menu-1-a35013c carries
    // it in the served HTML, and the menu mapping therefore did nothing.
    //
    // The panel already lifts it so a fix can run while you are testing —
    // which meant the mapping worked in the panel and was dead in production,
    // the exact split this file exists to close. The exported bundle carries
    // this patch, so doing it here makes the two agree.
    //
    // ONLY on an element a fix is actually being called on. This does not
    // sweep the page clearing the attribute: everywhere else it is left alone,
    // because everywhere else nobody has said they want that element changed.
    var liftOptOut = function (selector) {
      var lifted = [];
      qsa(selector).forEach(function (el) {
        if (el.hasAttribute && el.hasAttribute('u1st-avoid-change-detection')) {
          el.removeAttribute('u1st-avoid-change-detection');
          lifted.push(el);
        }
      });
      return lifted;
    };
    P.lifted = P.lifted || [];
    Object.keys(u1.fix).forEach(function (name) {
      if (name.charAt(0) === '_' || typeof u1.fix[name] !== 'function') return;
      var inner = u1.fix[name];
      u1.fix[name] = keepFlags(inner, function (selector, props) {
        try {
          if (typeof selector === 'string') {
            var lifted = liftOptOut(selector);
            if (lifted.length) P.lifted.push({ type: name, selector: selector, n: lifted.length });
          }
        } catch (e) {}
        return inner.apply(this, arguments);
      });
    });

    u1.fix.__u1PatchWrapped = true;
    // The regions that wrap a fixer of their own (form, accordion, checkbox)
    // used to poll for the library every 250 ms — a mapping applied in the
    // window between the library appearing and the next tick met the bare
    // fixer. They register here instead and are called the moment the
    // library is wrapped (and again from ensureFixers, which the panel calls
    // before an apply).
    P.fixerHooks.forEach(function (fn) { try { fn(u1); } catch (e) {} });
    return true;
  };
  P.fixerHooks = P.fixerHooks || [];
  P.onFixers = function (fn) {
    P.fixerHooks.push(fn);
    var u1 = W.u1 !== undefined ? W.u1 : W.U1 !== undefined ? W.U1 : W.user1st;
    if (u1 && u1.fix) { try { fn(u1); } catch (e) {} }
  };

  // ── Winning the race for the library ──────────────────────────────────────
  //
  // This used to be a 250ms poll, and on a site that already deploys U1 it
  // lost almost every time: at document_start `window.u1` does not exist yet,
  // the library then loads and runs the site's own fix calls, and our next
  // tick arrives after they are already done. The wrapper then wrapped a
  // library whose work was finished — so the per-instance corrections never
  // saw those calls, and the recorder recorded nothing at all. Reported as an
  // adopt list that stayed empty on a site visibly full of U1.
  //
  // Catching the ASSIGNMENT removes the race instead of narrowing it: the
  // setter runs synchronously, inside the library's own `window.u1 = …`, so
  // there is no window in which a fix can be called unwrapped.
  //
  // The poll stays as a fallback — defineProperty can be refused, and a
  // library that was already assigned before this file ran needs the plain
  // path anyway.
  var watchAssign = function () {
    ['u1', 'U1', 'user1st'].forEach(function (name) {
      // ALREADY an object, but with no .fix on it yet. This is not the rare
      // case — it is the normal one, and we cause it ourselves: background.js
      // presets the config at document_start with
      // `window.u1 = window.u1 || {}; window.u1.config = cfg`, which creates
      // a bare object before the library has loaded. Skipping it here (it is
      // "already there") sent us straight back to the poll and lost the race
      // again, which is why the adopt list stayed empty on a site plainly
      // running U1. Watch .fix on the object that exists.
      if (W[name] !== undefined) {
        var cur = W[name];
        if (cur && typeof cur === 'object' && cur.fix === undefined) watchFix(cur, null);
        return;                                       // wrap() handles the rest
      }
      var held;
      try {
        Object.defineProperty(W, name, {
          configurable: true,
          enumerable: true,
          get: function () { return held; },
          set: function (v) {
            held = v;
            if (wrap()) { settle(name, v); return; }
            // The library sometimes lands as `window.u1 = {}` and grows `.fix`
            // a moment later. Watch that too, or we are back to guessing.
            if (v && typeof v === 'object' && v.fix === undefined) watchFix(v, name);
          },
        });
      } catch (e) {}
    });
  };
  // Once wrapped there is nothing left to intercept, so the accessor is put
  // back to an ordinary data property — a getter where the library expects a
  // value is a difference nobody should have to think about later.
  var settle = function (name, v) {
    try {
      Object.defineProperty(W, name, {
        configurable: true, enumerable: true, writable: true, value: v,
      });
    } catch (e) {}
  };
  var watchFix = function (obj, name) {
    var heldFix;
    try {
      Object.defineProperty(obj, 'fix', {
        configurable: true,
        enumerable: true,
        get: function () { return heldFix; },
        set: function (f) {
          heldFix = f;
          try {
            Object.defineProperty(obj, 'fix', {
              configurable: true, enumerable: true, writable: true, value: f,
            });
          } catch (e) {}
          wrap();
          if (name) settle(name, obj);
        },
      });
    } catch (e) {}
  };

  if (!wrap()) {
    watchAssign();
    // Still polled, but only as a safety net for the cases the setter cannot
    // see. Keep trying briefly, then stop.
    var tries = 0;
    var poll = setInterval(function () {
      if (wrap() || ++tries > 40) clearInterval(poll);
    }, 250);
  }

  // ── Two menus share one coordinate space ──────────────────────────────────
  // The engine's arrow navigation looks top-row items up by [u1st-x][u1st-y]
  // over the whole document, and counts the row the same way — so two
  // fix.menu calls interleave: on STEP, ArrowRight from the main nav's "Men"
  // landed on the util bar's "Track my order" (reproduced live against the
  // real engine, 2026-09-02). Bands (+1000 per menu) were tried first and
  // broke getItemAmount's bounds check, freezing the arrows instead.
  //
  // So: make the engine's own model TRUE. All top-row (y=0) items of every
  // recorded menu become ONE consecutive sequence in DOM order. Inside a
  // menu the arrows behave exactly as before; at a menu's edge they cross
  // into the neighbouring menu instead of teleporting mid-row. Submenu rows
  // (y >= 1) are left alone — the engine enters them through queries scoped
  // to the submenu element, and renumbering them would break that.
  // Idempotent: the expected sequence is recomputed every pass and written
  // only where it differs, so the engine re-initialising (raw numbers back)
  // just gets renumbered again.
  P.correct(function () {
    var menus = [], live = P.calls;
    for (var i = 0; i < live.length; i++) {
      var c = live[i];
      if (c.type === 'menu' && c.selector && menus.indexOf(c.selector) === -1) menus.push(c.selector);
    }
    if (menus.length < 2) return;
    var tops = [];
    menus.forEach(function (sel) {
      qsa(sel).forEach(function (root) {
        var items = root.querySelectorAll('[u1st-x][u1st-y="0"]');
        for (var k = 0; k < items.length; k++) {
          // A menu wrapped in an explicit role=menu/menubar/navigation is
          // SCOPED by the engine (getParentMenu) and never collides — leave
          // its numbering alone entirely.
          if (items[k].closest &&
              items[k].closest('[role="menubar"],[role="menu"],[role="navigation"]')) continue;
          if (tops.indexOf(items[k]) === -1) tops.push(items[k]);
        }
      });
    });
    if (tops.length < 2) return;
    tops.sort(function (a, b) {
      return (a.compareDocumentPosition(b) & 4) ? -1 : 1;   // 4 = FOLLOWING
    });
    for (var t = 0; t < tops.length; t++) {
      if (tops[t].getAttribute('u1st-x') !== String(t)) {
        tops[t].setAttribute('u1st-x', String(t));
      }
    }
  });

  // ── Enter opens a native <select> ─────────────────────────────────────────
  // On macOS Chrome a <select> opens on Space and Alt+Down but not on Enter,
  // and the owner's keyboard users press Enter (molina's state picker,
  // 2026-10-06). showPicker() is the browser's own popup, run from a user
  // gesture; where it does not exist nothing changes.
  document.addEventListener('keydown', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'SELECT' || e.key !== 'Enter' || el.multiple || el.disabled) return;
    // The guard every key handler carries. isTyping() counts a <select> as a
    // field so Space is never taken from it; Enter on a <select> types
    // nothing, and this handler is for a <select> only.
    if (isTyping(el) && el.tagName !== 'SELECT') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (typeof el.showPicker !== 'function') return;
    var open = false;
    try { open = el.matches(':open'); } catch (err) {}
    if (open) return;
    e.preventDefault();
    try { el.showPicker(); } catch (err) {}
  }, true);

  // ── Skip links ────────────────────────────────────────────────────────────
  // U1 gives the target an id and nothing else. Following `href="#id"` moves the
  // scroll position, but focus only moves if the target can hold it — so on most
  // browsers the next Tab returns to the top of the page and the skip link
  // achieves nothing for the people who need it.
  P.correct(function () {
    qsa('a.u1st-skip-link[href^="#"]').forEach(function (link) {
      var target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      // Only a target that cannot hold focus gets tabindex="-1". Written on a
      // control that already can — molina's Search BUTTON, the target of a
      // "Skip to search" row — it took the button OUT of the Tab order
      // (2026-10-06).
      var natively = false;
      try { natively = target.matches(FOCUSABLE); } catch (e) {}
      if (!natively && !target.hasAttribute('tabindex')) set(target, 'tabindex', '-1');
      // A skip link acts on this page — it moves focus — and the owner wants
      // it announced as a button, not a link (2026-10-06). role=button on
      // every one, the engine's included; Space presses it like Enter.
      set(link, 'role', 'button');
      if (link.__u1pSkip) return;
      link.__u1pSkip = true;
      link.addEventListener('keydown', function (ev) {
        if (ev.key === ' ' || ev.code === 'Space') { ev.preventDefault(); link.click(); }
      });
      // Browsers disagree about whether the target receives focus; doing it
      // explicitly is the only behaviour that is the same everywhere. And the
      // move is made here rather than by following the href: the browser's
      // own fragment navigation writes "#u1p-skip-w296fw" into the address
      // bar — a made-up id, on every skip, on the client's own site — and
      // pushes a history entry, so Back returns to the same page. Focus plus
      // scroll is the whole of what a skip link owes its user; the href
      // stays for what it says to assistive tech and for a page where this
      // script is not running.
      link.addEventListener('click', function (e) {
        var t = document.getElementById(link.getAttribute('href').slice(1));
        if (!t) return;
        if (e && e.preventDefault) e.preventDefault();
        try { t.scrollIntoView({ block: 'start' }); } catch (err) { try { t.scrollIntoView(); } catch (err2) {} }
        setTimeout(function () { try { t.focus({ preventScroll: true }); } catch (err) { t.focus(); } }, 0);
      });
    });
  });

  // ── The skip links the CONFIG asked for ───────────────────────────────────
  // Read off the engine: SkipLinkFixer renders from a hard-coded list of three
  // landmarks — nav, main, footer — and never reads config.skipLinks at all.
  // Studio's Config lets a person write five ("skip to sign in", "skip to
  // search"); the first three happened to coincide with the engine's own and
  // the rest never appeared, with nothing to say why. So anything in
  // config.skipLinks the page does not already have a link for is rendered
  // here, in the engine's own class (so u1.css styles it the same), right
  // after the engine's links so the order a keyboard user meets them is the
  // order the config lists them. The engine's own link for the same target
  // always wins: if it turns up later, ours for that target comes out.
  // Exposed as well as registered: Studio calls it straight after it writes
  // the config, so the links exist before anyone looks for them — the
  // corrector pass waits for the engine and for a mutation, and "Verify on
  // page" cannot wait for either.
  // ── Hidden until focused, whatever the site's CSS says ───────────────────
  // u1.css hides .u1st-skip-link with a plain, low-specificity rule
  // (position:absolute; left:-10000px) and shows it on :focus. Any theme rule
  // that names anchors more specifically — `header a { position: relative }`,
  // a reset on `a` inside `#page` — wins the cascade, and every skip link,
  // the engine's and ours, then sits in the page flow as a row of plain text
  // at the top (seen on an Elementor site: the Styles pane listed only the
  // theme's rules, u1.css's crossed out). The same idea, with !important, in
  // a stylesheet of our own: the site cannot outrank it, and the focused look
  // is u1.css's own so the link appears as the black pill people know from
  // other U1 sites.
  //
  // NOT left:-10000px, though — hidden by clip instead. On a page with
  // direction:rtl the area to the LEFT of the page is scrollable (the scroll
  // origin is the right edge), so an element parked 10000px to the left adds
  // 10000px of horizontal scroll, and the page opened scrolled into it: the
  // left half blank, the content cut off at the right (tamam.co.il, the
  // moment this stylesheet first applied there). Clipping to nothing keeps
  // the link exactly where it is, one pixel big and invisible, and no
  // direction has anything to scroll to. u1.css's own rule has the same
  // latent fault on RTL sites; this one is the one in force when both apply.
  var SKIP_CSS =
    'a.u1st-skip-link:not(:focus){position:absolute!important;left:0!important;right:auto!important;top:0!important;' +
      'width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;' +
      'overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important}' +
    'a.u1st-skip-link:focus{position:absolute!important;left:6px!important;top:6px!important;' +
      'width:auto!important;height:40px!important;margin:0!important;z-index:999999!important;display:inline-block!important;' +
      'clip:auto!important;clip-path:none!important;overflow:visible!important;' +
      'background-color:black!important;color:white!important;font-weight:600!important;font-size:16px!important;' +
      'padding:8px 24px!important;border-radius:100px!important;box-sizing:border-box!important;' +
      'text-decoration:none!important;line-height:24px!important;white-space:nowrap!important}' +
    'a.u1st-skip-link.rtl:focus{direction:rtl!important;right:6px!important;left:auto!important}';
  var ensureSkipCss = function () {
    if (document.getElementById('u1p-skip-css')) return;
    var st = document.createElement('style');
    st.id = 'u1p-skip-css';
    st.textContent = SKIP_CSS;
    (document.head || document.documentElement).appendChild(st);
  };

  // "Skip to" in the page's language — the engine's own SKIP_TO strings, so a
  // Hebrew page reads "דלג אל תוכן מרכזי" like the engine's links beside it,
  // not "Skip to תוכן מרכזי". Direction follows the document, as the engine's
  // isRtl does.
  var SKIP_TO = { he: 'דלג אל', ar: 'انتقل إلى', ru: 'Перейти к', fr: 'Aller à', es: 'Saltar a', de: 'Springe zu', en: 'Skip to' };
  var SAYS_SKIP = /^(skip|דלג|דלגו|انتقل|перейти|saltar|aller|springe)/i;
  var pageLang = function () {
    return ((document.documentElement.getAttribute('lang') || 'en').slice(0, 2)).toLowerCase();
  };
  var pageRtl = function () {
    var dir = (document.documentElement.getAttribute('dir') || '').toLowerCase();
    if (dir) return dir === 'rtl';
    try { return getComputedStyle(document.documentElement).direction === 'rtl'; } catch (e) { return false; }
  };

  // A skip link chosen as "Main content" (or header / nav / search / footer)
  // says what its target IS, so the target is made that landmark too. Found
  // on molinahealthcare.com: "skip to main content" pointed at the content
  // area and worked, yet the page had no main landmark at all — the scan said
  // so, and nothing in Studio could map one. The engine's own SkipLinkFixer
  // then adds its "Skip to main content" for the new role=main, and the
  // duplicate check above removes ours in its favour.
  //
  // Conservative on purpose: nothing happens when the target already is, or
  // sits inside, that landmark (a nav link list inside <nav>); a
  // one-per-page landmark (main, banner, contentinfo) that already exists
  // elsewhere is left alone; and only a generic container is given a role —
  // a list, a button or a link keeps its own semantics.
  var LANDMARK_OF = {
    header: ['banner', 'header,[role=banner]'],
    nav: ['navigation', 'nav,[role=navigation]'],
    main: ['main', 'main,[role=main]'],
    search: ['search', 'search,[role=search]'],
    footer: ['contentinfo', 'footer,[role=contentinfo]'],
  };
  var ONE_PER_PAGE = { header: 1, main: 1, footer: 1 };
  var makeLandmark = function (el, kind) {
    var lm = LANDMARK_OF[kind];
    if (!lm || !el || el.nodeType !== 1) return;
    if (closest(el, lm[1])) return;
    if (ONE_PER_PAGE[kind] && qsa(lm[1]).length) return;
    if (!/^(DIV|SECTION|ARTICLE|ASIDE|FORM|SPAN)$/.test(el.tagName)) return;
    if (el.getAttribute('role')) return;
    set(el, 'role', lm[0]);
  };
  P.makeLandmark = makeLandmark;

  // Landmarks the ENGINE gives a skip link of its own, unconditionally:
  // activateFixers() ends with skipLinkApi(), whose SkipLinkFixer subscribes
  // to nav/[role=navigation], main/[role=main] and footer/[role=contentinfo]
  // and adds "Skip to navigation / main content / footer" for each one it
  // sees (u1_vanilla-js-a11y.js, read). It never reads config.skipLinks, so
  // nothing in Studio turns these off — deleting every configured skip link
  // on molinahealthcare.com left exactly two: the engine's, for its one nav
  // and one footer. Header and search have no engine link.
  var ENGINE_KINDS = { nav: 1, main: 1, footer: 1 };

  P.renderSkipLinks = function () {
    ensureSkipCss();
    var u1 = W.u1 !== undefined ? W.u1 : W.U1 !== undefined ? W.U1 : W.user1st;
    var cfg = u1 && u1.config;
    // Studio (background.js, applyConfig) always leaves an ARRAY on
    // window.__u1SkipLinks — empty when the site has none — and that array
    // is the answer, empty included. The fallbacks are only for a page where
    // nothing set it: the engine's setConfiguration replaces u1.config and
    // the list was seen to vanish with it, so the last list seen is kept.
    //
    // An empty __u1SkipLinks used to fall through to that remembered list:
    // delete every skip link in Setup and the page re-created the old ones on
    // the next pass, for as long as it stayed open.
    var authoritative = Array.isArray(W.__u1SkipLinks);
    var list = authoritative ? W.__u1SkipLinks
             : (cfg && Array.isArray(cfg.skipLinks) && cfg.skipLinks.length) ? cfg.skipLinks
             : P.skipLinks;
    var report = { build: P.build, list: Array.isArray(list) ? list.length : 0, made: 0, kept: 0,
                   covered: 0, missing: [], errors: [] };
    if (!Array.isArray(list)) list = [];
    if (list.length) P.skipLinks = list; else if (authoritative) P.skipLinks = [];
    var engineLinks = qsa('a.u1st-skip-link:not(.u1p-skip-link)');
    // The owner can switch the engine's own links OFF (Setup: "Hide the
    // skip links U1 adds by itself"). The engine adds them unconditionally
    // and re-adds them on its own passes, so they are removed on every
    // pass here; the configured rows are then rendered in full, none of
    // them "covered" by an engine link that is gone.
    var hideEngine = W.__u1SkipLinksEngine === 'hide' || !!(cfg && cfg.skipLinksEngine === 'hide');
    if (hideEngine) {
      engineLinks.forEach(function (e) { try { e.remove(); } catch (err) {} });
      engineLinks = [];
      report.hiddenEngine = true;
    }
    var engineLinkFor = function (href) {
      for (var i = 0; i < engineLinks.length; i++) if (engineLinks[i].getAttribute('href') === href) return engineLinks[i];
      return null;
    };
    var engineHref = function (href) { return !!engineLinkFor(href); };
    var phrase = function (label) {
      label = String(label).trim();
      // "sign in" → "Skip to sign in"; a label already phrased as one is kept.
      if (!SAYS_SKIP.test(label)) label = (SKIP_TO[pageLang()] || SKIP_TO.en) + ' ' + label;
      return label.charAt(0).toUpperCase() + label.slice(1);
    };
    // The engine's own links carry the engine's words ("Skip to navigation",
    // once per <nav>, so twice on a page with a breadcrumb). A configured
    // row of the SAME kind renames the engine's link to the owner's wording
    // instead of adding a second link beside it; what is not renamed and
    // still collides is told apart by its landmark's own name.
    var renamed = {};
    var rename = function (link, label) {
      var want = phrase(label);
      if ((link.textContent || '').trim() !== want) link.textContent = want;
      link.setAttribute('data-u1p-renamed', '1');
      renamed[link.getAttribute('href')] = true;
    };
    var all = qsa('a.u1st-skip-link');
    var after = all.length ? all[all.length - 1] : null;
    // Every href this list stands for this pass; ours pointing anywhere else
    // (deleted in Setup, re-targeted, now covered by the engine) comes off.
    var wanted = {};
    list.forEach(function (sl) {
      try {
      if (!sl || !sl.label) return;
      var target = null;
      var href = typeof sl.target === 'string' && sl.target.charAt(0) === '#' ? sl.target : '';
      if (href) target = document.getElementById(href.slice(1));
      if (!target && sl.selector) { try { target = document.querySelector(sl.selector); } catch (e) {} }
      if (!target && typeof sl.target === 'string' && !href) { try { target = document.querySelector(sl.target); } catch (e) {} }
      if (!target) { report.missing.push(sl.selector || sl.target || sl.label); return; }
      if (sl.kind) makeLandmark(target, sl.kind);
      // The engine already links this landmark — ours would be the same
      // words ("Skip to navigation") to a spot inside it. On molina "skip to
      // nav" pointed at the menu <ul> inside the <nav>, the engine's at the
      // <nav>: two identical links, one tab stop apart.
      if (sl.kind && ENGINE_KINDS[sl.kind]) {
        var lm = closest(target, LANDMARK_OF[sl.kind][1]);
        var eng = lm && lm.id ? engineLinkFor('#' + lm.id) : null;
        if (eng) { rename(eng, sl.label); report.covered++; return; }
      }
      if (!target.id) target.id = sl.syntheticId || ('u1p-skip-' + Math.random().toString(36).slice(2, 8));
      href = '#' + target.id;
      var eng2 = engineLinkFor(href);
      if (eng2) { rename(eng2, sl.label); report.covered++; return; }
      wanted[href] = true;
      var have = false;
      try { have = !!document.querySelector('a.u1p-skip-link[href="' + href.replace(/"/g, '\\"') + '"]'); } catch (e) {}
      if (have) { report.kept++; return; }
      var a = document.createElement('a');
      a.className = 'u1st-skip-link u1p-skip-link' + (pageRtl() ? ' rtl' : '');
      a.href = href;
      a.textContent = phrase(sl.label);
      if (after && after.parentNode) after.insertAdjacentElement('afterend', a);
      else document.body.insertAdjacentElement('afterbegin', a);
      after = a;
      report.made++;
      } catch (e) { report.errors.push(String(e && e.message || e)); }
    });
    qsa('a.u1p-skip-link').forEach(function (mine) {
      if (!wanted[mine.getAttribute('href')]) mine.remove();
    });
    // Two engine links with the same words (a page with two <nav>s) are
    // told apart by the landmark's own name: "Skip to navigation
    // (breadcrumb)". Only where the landmark has a name, and never one the
    // owner renamed above.
    var byText = {};
    engineLinks.forEach(function (e) {
      if (renamed[e.getAttribute('href')]) return;
      var base = e.getAttribute('data-u1p-base') || (e.textContent || '').trim();
      (byText[base] = byText[base] || []).push(e);
    });
    Object.keys(byText).forEach(function (text) {
      var group = byText[text];
      if (group.length < 2) return;
      group.forEach(function (e) {
        var id = (e.getAttribute('href') || '').slice(1);
        var t = id ? document.getElementById(id) : null;
        if (!t) return;
        var name = get(t, 'aria-label') || '';
        if (!name && get(t, 'aria-labelledby')) {
          var lb = document.getElementById(get(t, 'aria-labelledby'));
          name = lb ? (lb.textContent || '').trim() : '';
        }
        if (!name) { var h = t.querySelector('h1,h2,h3'); name = h ? (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : ''; }
        if (!name) return;
        if (!e.getAttribute('data-u1p-base')) e.setAttribute('data-u1p-base', text);
        var want = text + ' (' + name + ')';
        if ((e.textContent || '').trim() !== want) e.textContent = want;
      });
    });
    // What is on the page now, whoever put it there — the panel lists the
    // engine's own beside the configured ones so a count never surprises.
    report.onPage = qsa('a.u1st-skip-link').map(function (a) {
      var id = (a.getAttribute('href') || '').slice(1);
      var t = id ? document.getElementById(id) : null;
      return { text: (a.textContent || '').trim(), href: a.getAttribute('href') || '',
               engine: !a.classList.contains('u1p-skip-link'),
               to: t ? t.tagName.toLowerCase() + (t.getAttribute('role') ? '[role=' + t.getAttribute('role') + ']' : '') : '' };
    });
    return report;
  };
  P.correct(P.renderSkipLinks);

// ── The keyboard contract a MAPPING promises, kept by the mapping ───────────
//
// Measured on molinahealthcare.com (2026-10-05) with the engine, this patch
// and the four mappings the survey produced, driven with real key presses:
// Enter opened every component, focus reached the first item in the menus
// but not in the language listbox, no arrow key moved anywhere, and Escape
// put focus back on the trigger while every panel STAYED OPEN. Every region
// below that handles these keys is keyed on what the library writes —
// role="menu" on a submenu, aria-haspopup="listbox" on a trigger,
// aria-expanded kept true while open — and on that site the library wrote
// almost none of it: the submenus got no role, the listbox fix met a list
// that is born on the press (React: {open && <ul/>}) and decorated nothing,
// and aria-expanded is written once and never again.
//
// So this layer reads the MAPPING instead — the calls P.calls recorded —
// and the page: a menu's triggers and the submenu inside each trigger's
// item, a listbox's trigger and its list (resolved at the moment of the key,
// since it may not exist until then), a form and the control that opened it
// (remembered when a mapped form appears after a press). From those it keeps
// the three promises itself, whether or not the library kept any:
//
//   1. OPENING puts focus on the first item — once the panel is showing,
//      and only while focus is still on the trigger.
//   2. ARROWS walk the panel's items (Up/Down, Home/End); ArrowDown on a
//      closed trigger opens it.
//   3. ESCAPE closes and puts focus back on the trigger. Closing is done
//      the page's own way first — the trigger's click, when that is what
//      opened it — then the panel's own Close control, and only as a last
//      resort by hiding the panel directly (undone on the trigger's next
//      press, so the page's state machine is not left lying).
//
// What it writes to the DOM is what the mapping asked the library for and
// the library left off: aria-haspopup on the trigger, aria-expanded kept
// TRUE to what is on screen, role="menu" / role="listbox" on the panel and
// role="option" on a listbox's options. Nothing is written where the
// library already did. Runs first (document capture, registered before the
// per-type regions) and stops the key it handled, so a region keyed on a
// role this layer stamped does not handle the same key a second time.
(function () {
  var SETTLE = [80, 260, 600];
  var FORCED = 'data-u1p-forced-shut';
  // Showing by GEOMETRY alone. The library writes aria-hidden="true" on a
  // closed submenu and never again, so on molinahealthcare.com every open
  // mega panel still said aria-hidden — and visible(), which trusts the
  // attribute, called it closed: Escape "saw nothing to close".
  var shown = function (el) {
    if (!el) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    } catch (e) {}
    return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
  };
  var sel1 = function (sel, root) {
    if (!sel) return null;
    try { return (root || document).querySelector(sel); } catch (e) { return null; }
  };

  // ── The pairs: trigger ↔ panel, read off the recorded calls each time ────
  // Cheap (a page records a handful of calls) and always current: a list
  // born after the mapping was applied is found at the moment of the key.
  var formOpeners = [];   // [{ form, opener }] — see activation below
  var submenuOf = function (t, subSel) {
    var item = t.parentElement;
    if (!item) return null;
    var p = subSel ? sel1(subSel, item) : null;
    if (!p && t.nextElementSibling && t.nextElementSibling !== t) {
      var n = t.nextElementSibling;
      if (n.matches && n.matches('ul,ol,div,section,nav,[role="menu"]')) p = n;
    }
    return p && !p.contains(t) && p !== t ? p : null;
  };
  // A `listbox` mapped one level too wide — the WRAPPER around the button
  // and the list (molina's Log In, built by hand: listbox '[class*=
  // "Login_dropdown__"]') — holds its own trigger, and is not the list. The
  // list inside it that does not hold the trigger is.
  var narrowList = function (l, t, optSel) {
    if (!l || !l.contains(t)) return l;
    var cands = qsa('[role="listbox"],[role="menu"],ul,ol,.dropdown-menu', l);
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.contains(t)) continue;
      if (optSel && !sel1(optSel, c)) continue;
      return c;
    }
    return null;
  };
  var listOf = function (t, lbSel, root, optSel) {
    var l = sel1(lbSel, root);
    if (l && !l.contains(t)) return l;
    if (l) { var n0 = narrowList(l, t, optSel); if (n0) return n0; }
    var node = t.parentElement, hops = 0;
    while (node && hops++ < 3) {
      l = sel1(lbSel, node);
      if (l && !l.contains(t)) return l;
      if (l) { var n1 = narrowList(l, t, optSel); if (n1) return n1; }
      node = node.parentElement;
    }
    // The wrapper IS the mapped list and stands above the trigger.
    for (node = t.parentElement, hops = 0; node && hops++ < 4; node = node.parentElement) {
      try { if (node.matches(lbSel)) return narrowList(node, t, optSel); } catch (e) { return null; }
    }
    return null;
  };
  var tooltipOf = function (t, tipSel) {
    var cands = qsa(tipSel);
    var tip = null;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c === t) continue;
      if (c.contains(t)) {
        // The wrapper: the text beside the trigger is the tooltip.
        var kids = c.children;
        for (var k = 0; k < kids.length; k++) {
          if (kids[k] !== t && !kids[k].contains(t) && (kids[k].textContent || '').trim()) { tip = kids[k]; break; }
        }
        if (tip) break;
        continue;
      }
      // Nearest: the candidate sharing the trigger's parent, else the first.
      if (!tip || (t.parentElement && t.parentElement.contains(c))) tip = c;
    }
    // A mapping that names the trigger itself as the tooltip (molina's
    // PageBanner icon, fixNo 28: both selectors the same <svg>) has its text
    // in the element beside the trigger.
    if (!tip && t.parentElement) {
      var sibs = t.parentElement.children;
      for (var si = 0; si < sibs.length; si++) {
        if (sibs[si] !== t && !sibs[si].contains(t) && (sibs[si].textContent || '').trim()) { tip = sibs[si]; break; }
      }
    }
    return tip;
  };
  // The text a control is NAMED by: its own, without the tooltip it may hold
  // and without anything hidden from assistive tech. A trigger that wraps its
  // tooltip (molina's Medicare hero: <span role=button><svg/><span
  // role=tooltip aria-hidden>Select your state</span></span>) reads as
  // "button" and nothing else — its only text is the hidden tooltip.
  var ownName = function (t, tip) {
    if (get(t, 'aria-label') || get(t, 'aria-labelledby')) return 'named';
    var out = '';
    var walk = function (n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { out += c.nodeValue; continue; }
        if (c.nodeType !== 1 || c === tip || get(c, 'aria-hidden') === 'true') continue;
        out += get(c, 'aria-label') || get(c, 'alt') || '';
        walk(c);
      }
    };
    walk(t);
    return out.replace(/\s+/g, ' ').trim();
  };
  var pairsNow = function () {
    var out = [];
    var seenT = [];
    var add = function (pair) {
      if (seenT.indexOf(pair.trigger) !== -1) return;
      seenT.push(pair.trigger);
      out.push(pair);
    };
    (P.calls || []).forEach(function (c) {
      var s = (c.props && c.props.selectors) || {};
      if (c.type === 'menu') {
        var trigs = s.triggers ? qsa(s.triggers) : [];
        trigs.forEach(function (t) {
          if (!(t.matches && t.matches(FOCUSABLE))) return;
          add({ kind: 'menu', trigger: t, panel: function () { return submenuOf(t, s.submenus); } });
        });
      } else if (c.type === 'listbox' && s.trigger && s.listbox) {
        var roots = qsa(c.selector);
        if (!roots.length) roots = [document];
        roots.forEach(function (r) {
          var t = sel1(s.trigger, r) || (r === document ? null : sel1(s.trigger));
          if (!t) return;
          // The library's own listbox keeps focus on the LIST and moves a
          // highlight (aria-activedescendant). The owner wants focus on the
          // options themselves (molina Log In, 2026-10-05) — that is the
          // default; only a mapping that asks for `enterSelects` (options
          // that act the moment they get focus) keeps the highlight pattern.
          add({ kind: 'listbox', trigger: t, options: s.options,
                     highlight: !!(c.props && (c.props.enterSelects === true || c.props.enterSelects === 'true')),
                     panel: function () { return listOf(t, s.listbox, r === document ? null : r, s.options); } });
        });
      }
    });
    // A TOOLTIP mapping: the trigger and the text it shows. The library only
    // WAITS for the tooltip to appear (its change detection) and then stamps
    // role/aria-describedby; it never shows it, and on focus it dispatches
    // a synthetic mouseover the site's CSS :hover cannot hear. On
    // molinahealthcare.com's "Select your state" info icon nothing ever
    // happened: no description, no tooltip on focus (2026-10-08). A mapping
    // that names the WRAPPER (icon and text together) as the tooltip is
    // narrowed to the text inside it.
    (P.calls || []).forEach(function (c) {
      if (c.type !== 'tooltip') return;
      var s = (c.props && c.props.selectors) || {};
      var trigSel = s.trigger || c.selector, tipSel = s.tooltip;
      if (!trigSel || !tipSel) return;
      qsa(trigSel).forEach(function (t) {
        add({ kind: 'tooltip', trigger: t, panel: function () { return tooltipOf(t, tipSel); } });
      });
    });
    formOpeners.forEach(function (fo) {
      if (!fo.form.isConnected || !fo.opener.isConnected) return;
      add({ kind: 'form', trigger: fo.opener, panel: function () { return fo.form; } });
    });
    return out;
  };
  // The mapped menu ITEM a key landed on (selectors.items — the top row).
  var menuItemOf = function (el) {
    var calls = P.calls || [];
    for (var i = 0; i < calls.length; i++) {
      var c = calls[i];
      if (c.type !== 'menu') continue;
      var s = (c.props && c.props.selectors) || {};
      if (!s.items) continue;
      var items = qsa(s.items);
      for (var j = 0; j < items.length; j++) {
        if (items[j] === el || items[j].contains(el)) {
          // Inside a SUBMENU (an item of a nested list) Left/Right are the
          // submenu's keys, handled below; only the top row is a row.
          var inSub = false;
          try { inSub = !!(pairOfPanel(items[j])); } catch (e2) {}
          return inSub ? null : items[j];
        }
      }
    }
    return null;
  };
  // Every item of a mapped top row stays in the TAB order. The engine's
  // roving tabindex parks all but one item at -1, so Tab skipped the bar
  // entirely and only the arrows could walk it; the owner wants both (the
  // top layer reachable by Tab, molinahealthcare.com, 2026-10-05).
  P.correct(function () {
    (P.calls || []).forEach(function (c) {
      if (c.type !== 'menu') return;
      var s = (c.props && c.props.selectors) || {};
      if (!s.items) return;
      qsa(s.items).forEach(function (it) {
        var ctl = it.matches && it.matches(FOCUSABLE) ? it : qsa(FOCUSABLE, it).filter(visible)[0];
        // Only what is on screen: a loose `items` selector can reach the
        // entries of a closed submenu, and a hidden control at tabindex 0
        // is a Tab stop nobody can see.
        if (ctl && visible(ctl) && ctl.tabIndex < 0 && !pairOfPanel(ctl)) ctl.tabIndex = 0;
      });
    });
  });
  var pairOfTrigger = function (el) {
    var ps = pairsNow();
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].trigger === el || ps[i].trigger.contains(el)) return ps[i];
    }
    return null;
  };
  // Items INSIDE a panel are owned; the panel container itself is not — a
  // listbox focused as a whole (the enterSelects pattern: focus on the
  // list, a highlight moving) is the listbox region's own.
  var pairOfPanel = function (el) {
    var ps = pairsNow();
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i].panel();
      if (p && p !== el && p.contains(el)) return { pair: ps[i], panel: p };
    }
    return null;
  };

  // ── What is walked, and what is written ──────────────────────────────────
  var itemsOf = function (pair, panel) {
    if (pair.kind === 'listbox') {
      var opts = (pair.options ? qsa(pair.options, panel) : qsa(':scope > *', panel)).filter(visible);
      // An option holding a control (li > button, li > a) is walked by that
      // control; a bare option is made focusable itself.
      return opts.map(function (o) {
        var inner = o.matches && o.matches(FOCUSABLE) ? o : qsa(FOCUSABLE, o).filter(visible)[0];
        if (inner) return inner;
        if (o.tabIndex < 0 && !o.hasAttribute('tabindex')) o.tabIndex = -1;
        return o;
      });
    }
    return qsa(FOCUSABLE, panel).filter(visible);
  };
  var TIP_FORCED = 'data-u1p-tip-shown';
  var showTip = function (pair) {
    var tip = pair.panel();
    if (!tip) return;
    pair.trigger.__u1pTipHide && clearTimeout(pair.trigger.__u1pTipHide);
    // The site may show it itself (CSS :hover, its own JS); only what is
    // still hidden a moment later is shown by hand, and marked so.
    setTimeout(function () {
      if (shown(tip)) return;
      tip.setAttribute(TIP_FORCED, '1');
      tip.style.display = 'block'; tip.style.visibility = 'visible'; tip.style.opacity = '1';
      dlog('tooltip:shown', pair);
    }, 120);
  };
  var hideTip = function (pair, now) {
    var tip = pair.panel();
    if (!tip) return;
    var run = function () {
      if (tip.hasAttribute(TIP_FORCED)) {
        tip.removeAttribute(TIP_FORCED);
        tip.style.display = ''; tip.style.visibility = ''; tip.style.opacity = '';
      }
    };
    if (now) { run(); return; }
    // 1.4.13 hoverable: a grace period to walk onto the tooltip.
    pair.trigger.__u1pTipHide = setTimeout(function () {
      if (tip.matches(':hover') || tip.contains(document.activeElement)) return;
      run();
    }, 300);
  };
  var stampTooltip = function (pair) {
    var t = pair.trigger, tip = pair.panel();
    var TIP_NAME = { en: 'More information', he: 'מידע נוסף', es: 'Más información', fr: 'Plus d\u2019informations', ar: 'مزيد من المعلومات', ru: 'Подробнее' };
    // Named whatever else happens — even with no tooltip found, a control
    // the library made role=button must not be "button" alone.
    if (!ownName(t, tip)) set(t, 'aria-label', TIP_NAME[pageLang()] || TIP_NAME.en);
    if (!tip) return;
    if (!tip.id) tip.id = 'u1p-tip-' + Math.random().toString(36).slice(2, 9);
    if (get(tip, 'role') !== 'tooltip') set(tip, 'role', 'tooltip');
    // The description is tied up front: aria-describedby reads a hidden
    // element too, so a screen reader hears the sentence on focus whether
    // or not the bubble is on screen.
    var have = (get(t, 'aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (have.indexOf(tip.id) === -1) { have.push(tip.id); set(t, 'aria-describedby', have.join(' ')); }
    if (!t.matches(FOCUSABLE)) { set(t, 'tabindex', '0'); if (!get(t, 'role') || get(t, 'role') === 'img') set(t, 'role', 'button'); }
    if (!t.__u1pTipWired) {
      t.__u1pTipWired = true;
      t.addEventListener('focus', function () { showTip(pair); });
      t.addEventListener('mouseenter', function () { showTip(pair); });
      t.addEventListener('blur', function () { hideTip(pair); });
      t.addEventListener('mouseleave', function () { hideTip(pair); });
      tip.addEventListener('mouseleave', function () { hideTip(pair); });
    }
  };
  var stamp = function (pair, panel) {
    var t = pair.trigger;
    if (pair.kind === 'tooltip') { stampTooltip(pair); return; }
    // A "menu" panel of links, headings and text — a site's mega menu — is a
    // DISCLOSURE, not an ARIA menu: role="menu" requires menuitems, and WAVE
    // reports every such panel as "Broken ARIA menu" (molinahealthcare.com:
    // five, 2026-10-08), while a screen reader in a role="menu" skips the
    // headings and text inside it. Only a panel that really holds menuitems
    // keeps role="menu" and aria-haspopup; the rest are a button with
    // aria-expanded and the panel it opens — the WAI disclosure navigation
    // pattern. Undone here whoever wrote it (the library writes it on every
    // submenu of a menubar:false mapping).
    var notAMenu = pair.kind === 'menu' && panel &&
      !panel.querySelector('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]');
    if (pair.kind !== 'form') {
      if (notAMenu) {
        var hp = get(t, 'aria-haspopup');
        if (hp === 'true' || hp === 'menu') t.removeAttribute('aria-haspopup');
      } else if (!get(t, 'aria-haspopup')) set(t, 'aria-haspopup', pair.kind === 'listbox' ? 'listbox' : 'true');
      set(t, 'aria-expanded', panel && shown(panel) ? 'true' : 'false');
    }
    if (!panel) return;
    // An OPEN panel is not aria-hidden, whatever was written on it closed.
    if (shown(panel) && get(panel, 'aria-hidden') === 'true') panel.removeAttribute('aria-hidden');
    if (notAMenu) { if (get(panel, 'role') === 'menu') panel.removeAttribute('role'); }
    else if (pair.kind === 'menu' && !get(panel, 'role')) set(panel, 'role', 'menu');
    // The library fights ITSELF over the links in a mapped submenu: its menu
    // fixer makes them tabbable (tabindex="0"), its visibility handler sees
    // the closed panel and parks them (tabindex="-1"), and the two take
    // turns on every change-detection tick — 196 vs 179 writes in three
    // seconds on molinahealthcare.com/medicaid, enough mutation records for
    // VoiceOver to lose its place on the search field (2026-10-06). The
    // visibility handler honours `u1st-avoid-auto-tabbable`; a closed panel
    // is display:none and its links are out of the Tab order anyway, so
    // nothing is lost by telling it to leave them alone.
    qsa(FOCUSABLE, panel).forEach(function (el) {
      if (get(el, 'u1st-avoid-auto-tabbable') !== 'true') set(el, 'u1st-avoid-auto-tabbable', 'true');
    });
    // Named by its own title: a screen reader entering the first item then
    // hears the panel's name and role first ("Medicare plans and benefits,
    // menu, Dual-Eligible…, link"), the way it would read the panel from its
    // top. Keyboard focus stays on the first item (the owner wants both,
    // 2026-10-06). Only where nothing names the panel already, and only
    // from text that comes BEFORE the first item.
    if (!get(panel, 'aria-label') && !get(panel, 'aria-labelledby')) {
      var firstItem = qsa(FOCUSABLE, panel).filter(visible)[0];
      var titles = qsa('h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="heading" i]', panel);
      for (var ti = 0; ti < titles.length; ti++) {
        var tt = titles[ti];
        var words = (tt.textContent || '').replace(/\s+/g, ' ').trim();
        if (!words || words.length > 80) continue;
        if (firstItem && (tt.contains(firstItem) || (tt.compareDocumentPosition(firstItem) & 2))) continue;   // 2 = PRECEDING: the item comes first
        if (!tt.id) tt.id = 'u1p-title-' + Math.random().toString(36).slice(2, 8);
        set(panel, 'aria-labelledby', tt.id);
        break;
      }
    }
    if (pair.kind === 'listbox') {
      if (!get(panel, 'role')) set(panel, 'role', 'listbox');
      (pair.options ? qsa(pair.options, panel) : qsa(':scope > *', panel)).forEach(function (o) {
        if (!get(o, 'role')) set(o, 'role', 'option');
      });
    }
  };
  P.correct(function () {
    pairsNow().forEach(function (pair) { stamp(pair, pair.panel()); });
  });
  // The per-type regions below ask this before handling a key: a trigger or
  // panel this layer owns is handled here, once.
  P.disclosureOwns = function (el) {
    try { return !!(pairOfTrigger(el) || pairOfPanel(el) || menuItemOf(el)); } catch (e) { return false; }
  };

  // ── Opening: the page opens, this layer follows focus in ─────────────────
  // HOW it was opened decides where focus lands (owner, 2026-10-06):
  //   ArrowDown / ArrowUp on the trigger → the first / last CLICKABLE item:
  //     the arrow is the keyboard user's "take me into the items".
  //   Enter, Space, a click, a screen reader's activate → the panel's FIRST
  //     ELEMENT, whatever it is (its title, its text), so whoever opened it
  //     starts at the top and misses nothing; Tab or ArrowDown then reaches
  //     the first item. Telling a screen reader apart from a keyboard was
  //     tried (a click with no key before it) and failed where the reader
  //     passes the key through (VoiceOver on the Medicaid panel: focus
  //     jumped to "Shop state" past the title and the text).
  //   mouse → the first clickable item; a pointer user does not read from
  //     the top.
  var lastInput = { kind: '', key: '', at: 0 };
  document.addEventListener('keydown', function (e) { lastInput = { kind: 'key', key: e.key, at: Date.now() }; }, true);
  document.addEventListener('pointerdown', function (e) { lastInput = { kind: 'pointer', at: Date.now() }; }, true);
  document.addEventListener('mousedown', function (e) { lastInput = { kind: 'pointer', at: Date.now() }; }, true);
  var pressedBy = function () {
    if ((Date.now() - lastInput.at) >= 800) return 'top';            // no key, no pointer: a screen reader
    if (lastInput.kind === 'pointer') return 'items';
    if (lastInput.key === 'ArrowDown') return 'items';
    if (lastInput.key === 'ArrowUp') return 'last';
    return 'top';                                                       // Enter, Space
  };
  // The first element of a panel: its first element child that is showing
  // (a title div, a paragraph, a list) — made focusable for the moment so a
  // screen reader's focus can rest on it; the panel itself when it has none.
  var firstElementOf = function (panel) {
    var kids = panel.children;
    for (var i = 0; i < kids.length; i++) if (shown(kids[i])) return kids[i];
    return panel;
  };
  P.disclosureLog = [];
  var dlog = function (what, pair, extra) {
    try {
      var t = pair && pair.trigger;
      P.disclosureLog.push(Object.assign({ at: Date.now(), what: what, kind: pair && pair.kind,
        trigger: t ? t.tagName + (t.getAttribute('aria-label') ? '[' + t.getAttribute('aria-label') + ']' : '') : '' }, extra || {}));
      if (P.disclosureLog.length > 60) P.disclosureLog.shift();
    } catch (e) {}
  };
  var activate = function (pair) {
    var by = pressedBy();
    dlog('activate', pair, { by: by });
    pair.trigger.removeAttribute(FORCED);
    var forced = pair.panel();
    if (forced && forced.hasAttribute(FORCED)) {
      forced.removeAttribute(FORCED);
      forced.style.display = '';
    }
    var wasOpen = forced ? shown(forced) : false;
    SETTLE.forEach(function (ms) {
      setTimeout(function () {
        var panel = pair.panel();
        stamp(pair, panel);
        if (!panel || !shown(panel)) { dlog('settle:closed', pair, { ms: ms }); return; }
        if (!wasOpen) pair.trigger.setAttribute('data-u1p-opened-by-press', '1');
        dlog('settle:open', pair, { ms: ms, focusOnTrigger: document.activeElement === pair.trigger });
        // The library's listbox fix parks focus on the LIST container
        // itself (tabindex=-1 on the <ul>), and from there its own arrows
        // did nothing on molinahealthcare.com while the site's Bootstrap
        // threw on every key (its dropdown handler expects a
        // data-bs-toggle). Focus on the container is as good as on the
        // trigger: the first item takes it.
        var onContainer = document.activeElement === panel && !pair.highlight;
        if (document.activeElement !== pair.trigger && !onContainer) return;
        var items0 = itemsOf(pair, panel);
        if (by === 'top') {
          var head = firstElementOf(panel);
          // A panel that is ONLY items (a plain drop-down list) has no top
          // to read; its first item is the top.
          if (items0.length && (head === items0[0] || head.contains(items0[0])) && !(head.textContent || '').replace(/\s+/g, ' ').trim().replace((items0[0].textContent || '').replace(/\s+/g, ' ').trim(), '').trim()) {
            try { items0[0].focus(); } catch (e) {}
            return;
          }
          if (!head.matches(FOCUSABLE) && !head.hasAttribute('tabindex')) { head.setAttribute('tabindex', '-1'); head.setAttribute('data-u1p-rest', '1'); }
          try { head.focus(); } catch (e) {}
          return;
        }
        var first = by === 'last' ? items0[items0.length - 1] : items0[0];
        if (first) { try { first.focus(); } catch (e) {} }
      }, ms);
    });
  };

  // A mapped FORM that appears after a press was opened by that press: the
  // control is remembered as its opener, so Escape can go back to it.
  var mappedForms = function () {
    var out = [];
    (P.calls || []).forEach(function (c) {
      if (c.type !== 'form') return;
      var s = (c.props && c.props.selectors) || {};
      qsa(s.form || c.selector).forEach(function (f) { if (out.indexOf(f) === -1) out.push(f); });
    });
    return out;
  };
  var watchForms = function (opener) {
    var hidden = mappedForms().filter(function (f) { return !shown(f); });
    var known = mappedForms();
    SETTLE.forEach(function (ms) {
      setTimeout(function () {
        mappedForms().forEach(function (f) {
          if (!shown(f)) return;
          if (known.indexOf(f) !== -1 && hidden.indexOf(f) === -1) return;   // was showing already
          if (formOpeners.some(function (fo) { return fo.form === f; })) return;
          if (f.contains(opener)) return;
          formOpeners.push({ form: f, opener: opener });
        });
      }, ms);
    });
  };

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(FOCUSABLE) : null;
    if (!t) return;
    var pair = pairOfTrigger(t);
    if (pair && pair.kind !== 'form') { activate(pair); return; }
    if (t.matches('button,[role="button"],a[href],[tabindex]')) watchForms(t);
  }, true);

  // ── Closing: the page's way first, then the panel's, then ours ───────────
  var closerIn = function (panel) {
    var CLOSE = /(^|[\s_-])(close|dismiss|cancel|סגור|ביטול)([\s_-]|$)|^[×✕✖╳x]$/i;
    var cands = qsa('button,[role="button"],a[href="#"],a:not([href])', panel);
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!visible(c)) continue;
      var face = (get(c, 'aria-label') || get(c, 'title') || c.textContent || '').replace(/\s+/g, ' ').trim();
      if (CLOSE.test(face) || /(^|[\s_-])(close|dismiss)([\s_-]|$)/i.test(String(c.className || ''))) return c;
    }
    return null;
  };
  var settled = function (el, cb) {
    var last = -1, waited = 0;
    var tick = function () {
      var now = el.offsetHeight + ':' + el.offsetWidth;
      if (now === last || waited >= 900) { cb(shown(el)); return; }
      last = now; waited += 80;
      setTimeout(tick, 80);
    };
    setTimeout(tick, 80);
  };
  // `landOn`: where focus ends up instead of the trigger — the neighbouring
  // top item when Left/Right left the submenu. Closing is partly async
  // (settled → the panel's Close → by force) and each step re-asserts the
  // landing, so a late step cannot pull focus back to the trigger.
  var close = function (pair, panel, landOn) {
    var t = pair.trigger;
    var land = function () { try { (landOn || t).focus(); } catch (e) {} };
    land();
    dlog('close', pair, { visible: !!(panel && shown(panel)), closing: !!(panel && panel.__u1pClosing),
                          byPress: t.hasAttribute('data-u1p-opened-by-press') });
    if (!panel || !shown(panel)) { stamp(pair, panel); return; }
    if (panel.__u1pClosing) return;
    panel.__u1pClosing = true;
    var done = function () { panel.__u1pClosing = false; stamp(pair, panel); schedule(); };
    var byForce = function () {
      dlog('close:force', pair);
      panel.setAttribute(FORCED, '1');
      panel.style.display = 'none';
      done();
    };
    var byCloser = function () {
      var c = closerIn(panel);
      dlog('close:closer', pair, { found: !!c });
      if (!c) { byForce(); return; }
      try { c.click(); } catch (e) {}
      land();
      settled(panel, function (still) { if (still) byForce(); else done(); });
    };
    // The trigger's click closes what the trigger's click opened. A trigger
    // whose click does something else (a hover-menu's link) is not pressed.
    if (t.hasAttribute('data-u1p-opened-by-press') && pair.kind !== 'form') {
      try { t.click(); } catch (e) {}
      land();
      settled(panel, function (still) { if (still) byCloser(); else done(); });
      return;
    }
    byCloser();
  };

  // ── Keys ─────────────────────────────────────────────────────────────────
  var take = function (e) { e.preventDefault(); e.stopImmediatePropagation(); };
  // Left/Right along the trigger's OWN row — its item's siblings, never
  // another menu's. The engine numbers every menu's top row into one
  // document-wide sequence (see "two menus share one coordinate space"), and
  // on molinahealthcare.com/medicare ArrowRight from the mega bar's "Plans &
  // benefits" landed on the top bar's "Medicare" (2026-10-05).
  var rowNext = function (t, dir) {
    var item = t.parentElement, row = item && item.parentElement;
    if (!row) return null;
    var controls = [];
    for (var i = 0; i < row.children.length; i++) {
      var ch = row.children[i];
      var c = ch.matches && ch.matches(FOCUSABLE) && visible(ch) ? ch : qsa(FOCUSABLE, ch).filter(visible)[0];
      if (c) controls.push(c);
    }
    var here = controls.indexOf(t);
    if (here === -1 || controls.length < 2) return null;
    var to;
    if (dir === 'Home') to = controls[0];
    else if (dir === 'End') to = controls[controls.length - 1];
    else {
      try { if (getComputedStyle(row).direction === 'rtl') dir = -dir; } catch (e) {}
      to = controls[(here + dir + controls.length) % controls.length];
    }
    return to || null;
  };
  var rowStep = function (t, dir) {
    var to = rowNext(t, dir);
    if (!to) return false;
    try { to.focus(); } catch (e) {}
    return true;
  };

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k !== 'Enter' && k !== ' ' && k !== 'Escape' && k !== 'ArrowDown' && k !== 'ArrowUp' &&
        k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    var target = e.target;
    if (!target || target.nodeType !== 1) return;
    // Escape from OUTSIDE every pair — the screen-reader case: its virtual
    // cursor is on an option while DOM focus sits on <body>, so the key never
    // reached a handler keyed on the panel and the list stayed open (molina's
    // language list, 2026-10-06). An open panel this layer owns closes, and
    // focus returns to its trigger, wherever the key was pressed.
    if (k === 'Escape' && !pairOfTrigger(target) && !pairOfPanel(target)) {
      var ps9 = pairsNow(), closedAny = false;
      for (var pi9 = 0; pi9 < ps9.length; pi9++) {
        var pp9 = ps9[pi9].panel();
        if (!pp9 || !shown(pp9) || pp9 === target || pp9.contains(target)) continue;
        if (ps9[pi9].kind === 'form' && !ps9[pi9].trigger.hasAttribute('data-u1p-opened-by-press')) continue;
        close(ps9[pi9], pp9);
        closedAny = true;
      }
      if (closedAny) { take(e); return; }
    }

    // Left/Right on ANY item of a mapped menu's top row — a plain item
    // (Medicare, Medicaid) as much as a trigger (More Sites).
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') {
      var rowItem = menuItemOf(target);
      if (rowItem) {
        var rowPair = pairOfTrigger(rowItem), rowPanel = rowPair && rowPair.panel();
        // Home/End on a trigger whose panel is OPEN belong to the panel.
        if ((k === 'Home' || k === 'End') && rowPanel && shown(rowPanel)) { /* fall through */ }
        else { if (rowStep(rowItem, k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k)) take(e); return; }
      }
    }

    // On a tooltip's trigger: Escape dismisses (1.4.13), nothing else is its.
    var tipPair = pairOfTrigger(target);
    if (tipPair && tipPair.kind === 'tooltip') {
      if (k === 'Escape') { var tp = tipPair.panel(); if (tp && shown(tp)) { take(e); hideTip(tipPair, true); } }
      return;
    }
    // On a trigger.
    var pair = pairOfTrigger(target);
    // A "trigger" with no panel of its own that sits INSIDE another pair's
    // panel is that panel's item, whatever a mapping called it. The owner's
    // AI set on molinahealthcare.com named every `…_menu_items__` button a
    // trigger — the submenu's Providers / Brokers / CHIP included — and
    // ArrowDown on "Providers" pressed it to "open" it: the page navigated
    // (2026-10-05).
    if (pair && pair.kind !== 'form' && !pair.panel() && pairOfPanel(target)) pair = null;
    if (pair && pair.kind !== 'form') {
      var panel = pair.panel();
      if (k === 'Escape') {
        if (!panel || !shown(panel)) return;
        take(e);
        close(pair, panel);
        return;
      }
      if (k === 'ArrowDown') {
        // Nothing is pressed to open what cannot be found: a trigger whose
        // panel is unknown is left to the page (pressing it could be a link).
        if (!panel) return;
        take(e);
        if (shown(panel)) {
          var first = itemsOf(pair, panel)[0];
          if (first) first.focus();
        } else {
          try { pair.trigger.click(); } catch (err) {}
          activate(pair);
        }
        return;
      }
      if (k === 'Enter' || k === ' ') {
        // A native button clicks itself on Enter/Space; anything else is
        // clicked here. Either way the page opens it and focus follows.
        if (!isNative(pair.trigger)) { take(e); try { pair.trigger.click(); } catch (err) {} }
        activate(pair);
        return;
      }
      return;
    }

    // ON the panel container itself (focus parked there — see activate):
    // Up/Down/Home/End enter the items, Escape closes. A container that
    // highlights with aria-activedescendant (enterSelects) is the listbox
    // region's own.
    if (!pairOfTrigger(target)) {
      var ps0 = pairsNow();
      for (var pi0 = 0; pi0 < ps0.length; pi0++) {
        if (ps0[pi0].highlight) continue;
        var pp0 = ps0[pi0].panel();
        // The panel itself — or a list INSIDE a panel that was mapped one
        // level too wide (listbox: the wrapper), when the library parked
        // focus on that list: the <ul> is not an item and holds the items.
        var isCont = pp0 === target;
        if (!isCont && pp0 && pp0.contains(target) && !(target.matches && target.matches(FOCUSABLE))) {
          var its0 = itemsOf(ps0[pi0], pp0);
          for (var ii0 = 0; ii0 < its0.length; ii0++) if (target.contains(its0[ii0]) && target !== its0[ii0]) { isCont = true; break; }
        }
        if (!isCont) continue;
        if (ps0[pi0].kind === 'form') break;
        if (k === 'Escape') { take(e); close(ps0[pi0], pp0); return; }
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') {
          var l0 = itemsOf(ps0[pi0], pp0);
          if (!l0.length) break;
          take(e);
          try { l0[(k === 'ArrowUp' || k === 'End') ? l0.length - 1 : 0].focus(); } catch (err) {}
          return;
        }
        break;
      }
    }

    // Inside a panel.
    var hit = pairOfPanel(target);
    if (!hit) return;
    if (k === 'Escape') {
      take(e);
      close(hit.pair, hit.panel);
      return;
    }
    if (hit.pair.kind === 'form') return;
    if (isTyping(target)) return;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      // Out of the submenu to the neighbouring top-level item, as a menubar.
      if (hit.pair.kind !== 'menu') return;
      var next = rowNext(hit.pair.trigger, k === 'ArrowRight' ? 1 : -1);
      if (next) { take(e); close(hit.pair, hit.panel, next); }
      return;
    }
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
    var list = itemsOf(hit.pair, hit.panel);
    if (!list.length) return;
    var here = list.indexOf(target);
    if (here === -1) here = list.indexOf(closest(target, FOCUSABLE));
    if (here === -1) here = k === 'ArrowUp' || k === 'End' ? 0 : -1;
    var to = k === 'Home' ? 0
           : k === 'End' ? list.length - 1
           : k === 'ArrowDown' ? (here + 1) % list.length
           : (here - 1 + list.length) % list.length;
    take(e);
    try { list[to].focus(); } catch (err) {}
  }, true);
})();

})();
//#endregion

//#region u1-patch:visibility
// ElementVisibility.isVisible walks every ancestor of a fix target up to
// <html>, and isHidden() on each one reads:
//   display=="none" || visibility=="hidden" ||
//   (height=="0px" && (overflow=="auto"||overflow=="hidden")) ||
//   width=="0px" || opacity=="0" || transform=="translateX(0%)"
// — verified against the real bundle (dev.oreltest.user1st.com,
// u1_vanilla-js-a11y.js). The height branch only counts a 0px height as
// hidden when it also CLIPS (overflow auto/hidden) — a deliberate,
// reasonable "collapsed accordion" signal. width=="0px" has no such
// condition: it counts as hidden even with overflow:visible, where the
// content is not clipped and is not hidden from anyone.
//
// Reproduced on molinahealthcare.com's header: a nameless 0×0,
// overflow:visible <div> sits between the mega-menu and the <header> — a
// pure positioning wrapper, content escapes it on purpose. Both header
// menus mapped on that page share it as an ancestor. ChangeDetection.handle
// (a setInterval poll) checks this BEFORE a fixer ever runs, every second,
// forever — so a correctly-built, correctly-configured u1.fix.menu call
// never fires. No error, no attribute, nothing: the mapping and the
// selectors are not the defect, this ancestor is.
//
// The engine defines its own way out — `!element.getAttribute("u1-visible")`
// skips the whole isHidden check for that ancestor — so this does not ask
// every client to hand-edit markup for a defect in a third-party library.
// It walks the ancestors of what THIS SITE actually asked u1.fix.* to
// process (P.calls, recorded above) rather than scanning the page: a
// handful of containers, not every element on it — the blanket scan that
// froze molinahealthcare.com once already (see the budget comment at the
// top of this file) is exactly the shape this avoids repeating.
//
// Deliberately narrower than U1's own rule: only width==0 with overflow
// NOT clipping qualifies. A 0px dimension that DOES clip (overflow
// hidden/auto) is left alone in every case — that is a real collapsed
// state (an accordion panel, a slide-out drawer mid-transition) and U1
// hiding it is correct; marking it visible would be the opposite bug.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;
  var clips = function (v) { return v === 'hidden' || v === 'auto' || v === 'scroll'; };

  var freeButZero = function (el) {
    if (!el || el.nodeType !== 1 || el.tagName === 'HTML') return false;
    // Cheapest check first, and it alone re-excludes an ancestor this ran on
    // before: once set(), it stays set (set() itself no-ops a repeat write),
    // so nothing past this line runs twice for the same element.
    if (el.getAttribute('u1-visible')) return false;
    // offsetWidth is a plain layout read; getComputedStyle (below) is not —
    // this keeps the ordinary ancestor (a real width) from ever paying for
    // it, on a walk that runs for every mapped container on every pass.
    if (el.offsetWidth !== 0) return false;
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    // Both the shorthand and the longhand: real engines resolve overflow-x
    // from `overflow`, but this is cheap enough to double-check rather than
    // trust that every environment expands it the same way.
    return cs.width === '0px' && !clips(cs.overflowX) && !clips(cs.overflow);
  };

  P.correct(function () {
    var containers = [], live = P.calls;
    for (var i = 0; i < live.length; i++) {
      var sel = live[i].selector;
      if (sel && containers.indexOf(sel) === -1) containers.push(sel);
    }
    for (var c = 0; c < containers.length; c++) {
      var roots = u.qsa(containers[c]);
      // A selector that matches many elements — a link mapping on every card
      // of a news list — matches siblings under ONE ancestor chain; walking
      // it once per card is the same walk repeated. Three is enough to catch
      // a wrapper any of them shares, and keeps a 300-card page from paying
      // for 300 walks on every pass (the page is mutating as its cards load,
      // so the passes come in bursts).
      if (roots.length > 3) roots = roots.slice(0, 3);
      for (var r = 0; r < roots.length; r++) {
        var node = roots[r].parentElement;
        // To <html> — the same distance U1's own check climbs. This only
        // runs per mapped container, so the depth costs nothing a page-wide
        // scan would.
        for (var hop = 0; node && node.tagName !== 'HTML' && hop < 40; hop++, node = node.parentElement) {
          if (freeButZero(node)) u.set(node, 'u1-visible', 'true');
        }
      }
    }
  });
})();
//#endregion

//#region u1-patch:accordion
// AccordionRoles.assignOnLoadAccordionAttr() has two real defects, verified by
// reading AccordionRoles/AccordionEvents/AccordionFixer in u1_vanilla-js-a11y.js:
//
//   1. It only calls assignOnLoadAriaControlsAttr() — which sets aria-controls —
//      when headerContentMatch is true, i.e. accordionHeaders.length exactly
//      equals accordionContent.length. Any accordion whose header/content counts
//      do not line up 1:1 (one extra decorative header, a selector that also
//      catches something outside the widget) gets NO aria-controls on ANY
//      header, not just the mismatched one.
//   2. The same branch hard-codes aria-expanded="false" on every header, even
//      one whose panel is already open on load — reporting an expanded section
//      as collapsed.
//
// Both only run once, at fix() time, and the whole fixer sits behind
// FixerAbstract's own wait-for-visible gate (a ChangeDetection poll keyed to
// props.selectors.headerSelector) — on some pages that gate never resolves at
// all, and NONE of assignOnLoadAccordionAttr() runs, ever, for any header.
//
// Rather than depend on that gate, this wraps u1.fix.accordion to capture the
// exact headerSelector/contentSelector/disabledElementsSelector a mapping was
// given — the same information AccordionFixer.fix() itself reads off
// this.props.selectors — and reimplements assignOnLoadAccordionAttr() correctly
// from outside, converging every pass through the normal P.correct loop instead
// of running once. A click/keydown listener forces an immediate extra pass,
// because a site's own toggle (a class flip, a jQuery slideToggle) is not one of
// the attributes core's MutationObserver watches, so nothing else would notice it.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;
  var configs = [];

  var already = function (header, content) {
    return configs.some(function (c) { return c.header === header && c.content === content; });
  };
  var wrapOne = function (u1) {
    if (!u1 || !u1.fix || typeof u1.fix.accordion !== 'function' || u1.fix.accordion.__u1pWrapped) return;
    var orig = u1.fix.accordion;
    var wrapped = function (selector, props) {
      var sel = props && props.selectors;
      // The SHAPE first. An accordion is a header and, apart from it, a
      // region it opens. molinahealthcare.com's AI-built mapping named the
      // header's own OPEN-STATE class as the content
      // (`.AccordionHC_open__…`, added to the button when expanded): the
      // library then made the BUTTON a role="region", labelled it by itself
      // and wrote aria-expanded="false" over the site's "true" — a screen
      // reader heard "button" and no change of state on every press
      // (2026-10-08). Content that is the header, inside it or around it is
      // refused and recorded; a header the site already wires (aria-expanded
      // and an aria-controls that resolves) needs nothing and is left alone.
      if (sel && typeof sel.headerSelector === 'string' && typeof sel.contentSelector === 'string') {
        var heads = u.qsa(sel.headerSelector), conts = u.qsa(sel.contentSelector);
        var why = null;
        if (heads.length && conts.length && conts.every(function (c) {
          return heads.some(function (h) { return c === h || h.contains(c) || c.contains(h); });
        })) {
          why = 'not an accordion panel: the content selector matches the header itself (or something inside or around it) — a panel is the region the header opens, outside the header. The site puts that class on the header when it is open.';
        } else if (heads.length && conts.length === 0 && /^\.[\w-]+$/.test(sel.contentSelector.trim()) &&
                   /(^|[_-])(open|active|expanded|show|is-open|isopen)([_-]|$)/i.test(sel.contentSelector)) {
          // Nothing is open at load, so the content selector — a STATE class
          // ("…_open__…", ".active", ".show") — matches nothing to compare.
          // A state class is never a panel's selector.
          why = 'not an accordion panel: "' + sel.contentSelector + '" is a state class (open/active/show), the class a header or panel wears while open — not the panel itself.';
        } else if (heads.length && heads.every(function (h) {
          // The panel may not exist until it opens (React: {open && <div/>}),
          // so aria-controls is not required to resolve.
          return u.get(h, 'aria-expanded') !== null && u.get(h, 'aria-controls');
        })) {
          why = 'already accessible: every header carries aria-expanded and an aria-controls that points at its panel — the site did this itself, and a second set of roles on top of it only muddles what a screen reader hears.';
        } else if (conts.length && conts.every(function (c) {
          // Judged from the PANEL's side: a panel the site's own button
          // already opens and announces needs no header from a mapping, and
          // whatever else the header selector caught is not its header.
          // molinahealthcare.com's blog drawer: `.filterTitle,.clearall,
          // .filterClose` over #StateFilter-panel — the site's "State Type"
          // button wires that panel, and the mapping turned the drawer's
          // title "Filter by:" and its Close button into accordion headers
          // (role=button, a Tab stop, focus landing on the title) (2026-10-08).
          if (!c.id) return false;
          var ctl = null;
          try { ctl = document.querySelector('[aria-controls~="' + c.id.replace(/"/g, '\\"') + '"][aria-expanded]'); } catch (e) { ctl = null; }
          if (!ctl) return false;
          // …the SITE's button: one an accordion mapping already captured here
          // got its aria-controls from this patch, and re-applying that
          // mapping must not read its own wiring as the site's.
          return !configs.some(function (k) { try { return ctl.matches(k.header); } catch (e) { return false; } });
        })) {
          why = 'already accessible: the site\u2019s own button opens this panel (aria-expanded + aria-controls) — the panel needs no header from a mapping, and the other elements the header selector matches are not its header.';
        }
        if (why) {
          P.skipped.push({ type: 'accordion', selector: sel.headerSelector, why: why });
          return 0;
        }
      }
      if (sel && typeof sel.headerSelector === 'string' && typeof sel.contentSelector === 'string'
          && !already(sel.headerSelector, sel.contentSelector)) {
        configs.push({
          header: sel.headerSelector,
          content: sel.contentSelector,
          disabled: typeof sel.disabledElementsSelector === 'string' ? sel.disabledElementsSelector : null,
          page: typeof window.__u1CallPage === 'string' ? window.__u1CallPage : null,   // see P.live
        });
        // A newly captured config has never been through P.correct — the core
        // loop only re-runs on a DOM mutation or the load-time pass that
        // already happened before this call existed. Without this, the first
        // application of a mapping waited for an unrelated mutation to arrive
        // before anything showed up, which reads exactly like "Apply did
        // nothing" even though it is only "Apply hasn't been picked up yet".
        P.schedule();
      }
      return orig.apply(this, arguments);
    };
    wrapped.__u1pWrapped = true;
    u1.fix.accordion = wrapped;
  };
  var currentU1 = function () {
    return window.u1 !== undefined ? window.u1 : window.U1 !== undefined ? window.U1 : window.user1st;
  };
  if (P.onFixers) P.onFixers(wrapOne);
  else if (currentU1() && currentU1().fix) wrapOne(currentU1());
  else {
    var tries = 0;
    var poll = setInterval(function () {
      var u1 = currentU1();
      if ((u1 && u1.fix && (wrapOne(u1), true)) || ++tries > 40) clearInterval(poll);
    }, 250);
  }

  var syncPair = function (header, content) {
    if (!/^button$/i.test(header.tagName)) {
      u.set(header, 'role', 'button');
      u.setTabIndex(header, 0);
    }
    var headerId = header.id || (header.id = 'u1p-acc-h-' + Math.random().toString(36).slice(2, 9));
    var contentId = content.id || (content.id = 'u1p-acc-c-' + Math.random().toString(36).slice(2, 9));
    u.set(content, 'role', 'region');
    u.set(content, 'aria-labelledby', headerId);
    u.set(header, 'aria-controls', contentId);              // defect 1: missing when counts mismatched
    u.set(header, 'aria-expanded', u.visible(content) ? 'true' : 'false'); // defect 2: re-derived every pass
  };

  P.correct(function () {
    configs.forEach(function (cfg) {
      if (!P.live(cfg)) return;
      var headers = u.qsa(cfg.header);
      var content = u.qsa(cfg.content);
      var n = Math.min(headers.length, content.length);
      for (var i = 0; i < n; i++) syncPair(headers[i], content[i]);
      for (var j = n; j < headers.length; j++) {
        if (!/^button$/i.test(headers[j].tagName)) {
          u.set(headers[j], 'role', 'button');
          u.setTabIndex(headers[j], 0);
        }
      }
      if (cfg.disabled) {
        for (var k = 0; k < n; k++) {
          try { if (headers[k].matches(cfg.disabled)) u.set(headers[k], 'aria-disabled', 'true'); } catch (e) {}
        }
      }
    });
  });

  var headerSelectorList = function () {
    return configs.map(function (c) { return c.header; }).filter(Boolean).join(',');
  };
  var kick = function () {
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(P.schedule); });
    } else setTimeout(P.schedule, 50);
    setTimeout(P.schedule, 350);              // catches slideToggle-style animated collapses
  };
  document.addEventListener('keydown', function (e) {
    if (!configs.length || (e.code !== 'Space' && e.code !== 'Enter')) return;
    if (u.isTyping(e.target)) return;
    var header = u.closest(e.target, headerSelectorList());
    if (!header || u.isNative(header)) return;
    e.preventDefault();
    header.click();
    kick();
  }, true);
  document.addEventListener('click', function (e) {
    if (!configs.length) return;
    if (u.closest(e.target, headerSelectorList())) kick();
  }, true);
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

  // ── A region that is not a dialog is refused before the library sees it ──
  // molinahealthcare.com, 2026-10-05 (the owner's AI-built set): fix.dialog
  // was mapped on the language selector's WRAPPER with the language button
  // as its trigger, and on the mega bar's row with the search button as its
  // trigger. The library made each a role=dialog with a focus trap, and the
  // header became a cage: Tab on "Language" stayed on "Language", Tab from
  // "Find care" went to "Search" and back forever, Shift+Tab could not leave.
  // A dialog is a LAYER: it does not hold the control that opens it, it is
  // not another mapping's submenu, and it is not a piece of the page's
  // header or navigation sitting in the flow while it is "closed". Any of
  // those is a region wearing the name, and the mapping is refused here and
  // recorded in P.skipped so the panel can say why.
  P.contextRoot.dialog = function (root, props) {
    var sels = (props && props.selectors) || {};
    var why = null;
    try {
      var trig = sels.trigger ? u.qsa(sels.trigger) : [];
      // The checks are about the DIALOG — selectors.dialog when the mapping
      // names one — not about the first argument: the panel passes the
      // TRIGGER first (u1.fix.dialog('<trigger>', { selectors: { dialog } })),
      // and a trigger always "holds" itself, so every such mapping was
      // refused as "holds its own trigger" (molinahealthcare.com blog filter
      // drawer, 2026-10-08). The first argument stands for the dialog only
      // when no dialog selector is given.
      var dlgs = [];
      if (sels.dialog) { try { dlgs = u.qsa(sels.dialog); } catch (e0) { dlgs = []; } }
      // A dialog the page draws only when it opens (react-datepicker's
      // popup, born on the click) matches nothing yet: there is nothing to
      // judge, and the trigger standing in for it was refused as "holding
      // its own trigger" (molinahealthcare.com/about/events/az, 2026-10-08).
      if (!dlgs.length && sels.dialog && sels.dialog !== (typeof root.id === 'string' && root.id ? '#' + root.id : null)) { var isTrig = false; try { isTrig = trig.indexOf(root) !== -1; } catch (e0) {} if (isTrig) return root; }
      if (!dlgs.length) dlgs = [root];
      for (var d = 0; d < dlgs.length && !why; d++) {
        var dlg = dlgs[d];
        for (var i = 0; i < trig.length && !why; i++) {
          if (dlg.contains(trig[i])) why = 'the element holds its own trigger — a dialog is a layer the trigger opens, not the region around the trigger';
        }
        if (!why) {
          var calls = P.calls || [];
          for (var c = 0; c < calls.length && !why; c++) {
            var cs = (calls[c].props && calls[c].props.selectors) || {};
            var other = calls[c].type === 'menu' ? cs.submenus : calls[c].type === 'listbox' ? cs.listbox : null;
            if (other && calls[c].selector !== undefined) {
              try { if (dlg.matches(other)) why = 'already mapped as a ' + calls[c].type + '\u2019s panel (' + other + ') — one component, one type'; } catch (e2) {}
            }
          }
        }
        if (!why && u.visible(dlg) && !dlg.matches('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]')) {
          var pos = '';
          try { pos = getComputedStyle(dlg).position; } catch (e3) {}
          var inFlow = pos !== 'fixed' && pos !== 'absolute';
          if (inFlow && u.closest(dlg, 'header,nav,[role="banner"],[role="navigation"]')) {
            why = 'on screen inside the page\u2019s header or navigation, sitting in the flow — not a layer that opens';
          }
        }
      }
    } catch (e) { why = null; }
    if (why) { refused.push({ el: root, why: why }); return false; }
    return root;
  };
  var refused = [];
  P.contextRoot.dialog.lastWhy = function (el) {
    for (var i = refused.length - 1; i >= 0; i--) if (refused[i].el === el) return 'not a dialog: ' + refused[i].why;
    return null;
  };

  // ── A drawer that closes by sliding away gives focus back ─────────────────
  // The library notices a dialog closing only when it stops being "visible",
  // and a drawer closed by sliding it off the screen (molinahealthcare.com's
  // blog filter: position:fixed, left -390px) never stops: after Escape or
  // Close the drawer was gone and focus stayed on its invisible Close button
  // (2026-10-08). Each mapped dialog is watched by geometry — on screen, then
  // off it or hidden — and focus that was inside goes back to the trigger
  // that opened it (the last one pressed; else the first one showing).
  var wasOpen = typeof WeakMap === 'function' ? new WeakMap() : null;
  var openedAt = typeof WeakMap === 'function' ? new WeakMap() : null;
  P._wasOpen = wasOpen;
  // The library's focusInBound() fires when ITS poll sees the dialog open —
  // on a sliding drawer that can be a second after the person is already
  // inside, and it puts focus back on the first stop: Tab to "California",
  // then focus jumped to Close (u1_vanilla-js-a11y.js, yo.focusInBound:
  // querySelectorAll(TABBABLE)[0].focus(), no "already inside?" check). In
  // the first seconds after a mapped dialog opened, a move inside it that no
  // key or press caused is undone: focus goes back where the person was.
  // The trap below says where IT sent focus (trapTo); the library's jump
  // comes a moment after, from a promise, so "a key was just pressed" is true
  // for both and cannot tell them apart.
  var lastPress = 0, trapTo = null, trapAt = 0, lastKey = 0;
  ['mousedown', 'pointerdown', 'touchstart'].forEach(function (t) {
    document.addEventListener(t, function () { lastPress = Date.now(); }, true);
  });
  document.addEventListener('keydown', function () { lastKey = Date.now(); }, true);
  P.dialogTrapMoved = function (el) { trapTo = el; trapAt = Date.now(); };
  document.addEventListener('focusin', function (e) {
    if (!openedAt) return;
    var from = e.relatedTarget, to = e.target;
    if (!from || from === to || Date.now() - lastPress < 300) return;
    if (to === trapTo && Date.now() - trapAt < 400) return;            // the trap's own move
    dialogCalls().some(function (c) {
      var dlg = null;
      try { u.qsa(c.props.selectors.dialog || c.selector).some(function (d) { if (d.contains(to)) { dlg = d; return true; } return false; }); } catch (x) {}
      if (!dlg || !dlg.contains(from)) return !!dlg;
      // Only the library's own signature: focusInBound() focuses the FIRST
      // tabbable element, always. A move anywhere else is the page's own —
      // react-datepicker's arrow keys move October → November, and undoing
      // every move near a Tab sent it straight back, focus bouncing between
      // the two (molinahealthcare.com/about/events/az, 2026-10-08).
      var firstStop = null;
      try { firstStop = u.qsa(u.FOCUSABLE, dlg).filter(u.visible)[0] || null; } catch (x) {}
      if (to !== firstStop) return true;
      var at = openedAt.get(dlg);
      var afterTrap = Date.now() - trapAt < 400 && trapTo && dlg.contains(trapTo);
      var fresh = at && Date.now() - at < 3000 && Date.now() - lastKey > 120;
      if (afterTrap || fresh) setTimeout(function () { try { from.focus(); } catch (x) {} }, 0);
      return true;
    });
  }, true);
  var lastTrigger = null, lastTriggerAt = 0;
  var dialogCalls = function () { return (P.calls || []).filter(function (c) { return c.type === 'dialog' && c.props && c.props.selectors; }); };
  document.addEventListener('click', function (e) {
    dialogCalls().forEach(function (c) {
      var t = c.props.selectors.trigger;
      if (!t) return;
      try { var hit = u.closest(e.target, t); if (hit) { lastTrigger = hit; lastTriggerAt = Date.now(); } } catch (x) {}
    });
  }, true);
  P.correct(function () {
    if (!wasOpen) return;
    dialogCalls().forEach(function (c) {
      var sels = c.props.selectors;
      var dlgs = []; try { dlgs = u.qsa(sels.dialog || c.selector); } catch (x) { return; }
      dlgs.forEach(function (dlg) {
        // The aria-hidden the core puts on a drawer while it is off-screen
        // (data-u1p-ghost-aria) is ours, and lifts a pass later: reading it
        // as "closed" made focus wait for that next pass — sometimes too long.
        var ours = dlg.getAttribute('data-u1p-ghost-aria') === '1';
        var open = (ours ? !dlg.hasAttribute('hidden') && !!(dlg.offsetWidth || dlg.offsetHeight || dlg.getClientRects().length) : u.visible(dlg)) &&
                   !(P.offScreen && P.offScreen(dlg));
        var before = wasOpen.get(dlg);
        wasOpen.set(dlg, open);
        // Opened (seen closed before): focus goes in. The library moves focus
        // into a dialog when it sees it open — and on a drawer that slides in
        // it looks while the drawer is still off-screen, so sometimes focus
        // stayed on Filter behind the open drawer (Orel, 2026-10-08: "focus
        // does not always move to the dialog"). Only from the trigger (or
        // nowhere): a dialog opening on its own does not steal focus.
        // A dialog the page draws only when it opens (react-datepicker) is
        // never seen closed: first seen already open, right after its
        // trigger was pressed, counts as just opened.
        if (open && before === undefined && lastTriggerAt && Date.now() - lastTriggerAt < 2500) before = false;
        if (before === false && open) {
          openedAt.set(dlg, Date.now());
          var f = document.activeElement;
          if (f && dlg.contains(f)) return;
          var fromTrigger = f === document.body || f === lastTrigger;
          if (!fromTrigger && sels.trigger) { try { fromTrigger = !!u.closest(f, sels.trigger); } catch (x) {} }
          if (!fromTrigger) return;
          var first = u.qsa('a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[data-u1p-ghost]', dlg)
            .filter(function (el) { return u.visible(el) || (P.focusRing && P.focusRing.proxyOf && el.matches('input')); })[0];
          if (!first) { if (!dlg.hasAttribute('tabindex')) dlg.setAttribute('tabindex', '-1'); first = dlg; }
          var go = function () { if (!dlg.contains(document.activeElement)) { try { first.focus(); } catch (x) {} } };
          go(); setTimeout(go, 350);
          return;
        }
        if (!before || open) return;
        var a = document.activeElement;
        if (!(a && (dlg.contains(a) || a === document.body))) return;
        var back = lastTrigger && lastTrigger.isConnected && u.visible(lastTrigger) ? lastTrigger : null;
        if (!back && sels.trigger) { try { back = u.qsa(sels.trigger).filter(u.visible)[0] || null; } catch (x) {} }
        if (back) { try { back.focus(); } catch (x) {} }
        if (P.ghostKnown) { try { P.ghostKnown(); } catch (x) {} }
      });
    });
  });

  // ── Escape closes a mapped dialog, whatever the site did about it ─────────
  // molinahealthcare.com/about/events/az: the month picker (role="dialog",
  // aria-modal) ignores Escape completely — it stays open, focus inside
  // (2026-10-08). A moment after Escape, a mapped dialog that is still open
  // is closed the way a person would: its Close button, else the trigger
  // that toggles it; focus goes back to the trigger.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var target = e.target;
    dialogCalls().some(function (c) {
      var sels = c.props.selectors, dlg = null;
      try { u.qsa(sels.dialog || c.selector).some(function (d) { if (d.contains(target)) { dlg = d; return true; } return false; }); } catch (x) {}
      if (!dlg) return false;
      var rectOf = function () { try { var r = dlg.getBoundingClientRect(); return r.left + ',' + r.top + ',' + r.width; } catch (x) { return ''; } };
      var r1 = '';
      setTimeout(function () { r1 = rectOf(); }, 350);
      setTimeout(function () {
        var stillOpen = dlg.isConnected && u.visible(dlg) && !(P.offScreen && P.offScreen(dlg));
        if (!stillOpen) return;
        // Still sliding shut (a drawer's transition): the site DID handle
        // Escape — an outside press now would hit its state mid-change.
        if (rectOf() !== r1) return;
        var trig = lastTrigger && lastTrigger.isConnected ? lastTrigger : null;
        if (!trig && sels.trigger) { try { trig = u.qsa(sels.trigger).filter(u.visible)[0] || null; } catch (x) {} }
        var close = null;
        if (sels.closeBtn) { try { close = u.qsa(sels.closeBtn, dlg).filter(u.visible)[0] || null; } catch (x) {} }
        try {
          if (close) close.click();
          else {
            // react-datepicker closes on a press OUTSIDE it and on nothing else
            // (the trigger does not toggle it): an outside press, the way a
            // mouse user closes it.
            ['mousedown', 'mouseup', 'click'].forEach(function (t) { document.body.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); });
          }
        } catch (x) {}
        setTimeout(function () { if (trig && (!document.activeElement || dlg.contains(document.activeElement) || document.activeElement === document.body)) { try { trig.focus(); } catch (x) {} } }, 60);
      }, 650);
      return true;
    });
  }, true);

  // Our own trap. U1's cannot be removed — it lives in a closure — so its Tab
  // handling is swallowed in the capture phase and replaced here. Ours is
  // symmetric: the library guards the forward direction with a modal check and
  // the backward direction with none, so a non-modal dialog traps Shift+Tab
  // while letting Tab out.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var dlg = u.closest(e.target, '[role="dialog"]');
    // A MAPPED dialog is ours from the moment it is open, before the library
    // gets round to writing role="dialog" — its trap is already live by then,
    // walking a list that skips stops (Tab from "Arizona" went to Close).
    var mapped = false;
    if (!dlg) {
      dialogCalls().some(function (c) {
        var hit = null;
        try { u.qsa(c.props.selectors.dialog || c.selector).some(function (d) { if (d.contains(e.target)) { hit = d; return true; } return false; }); } catch (x) {}
        if (hit && !(P.offScreen && P.offScreen(hit))) { dlg = hit; mapped = true; }
        return !!dlg;
      });
    }
    if (!dlg || (!mapped && !u.visible(dlg))) return;

    var items = u.qsa(u.FOCUSABLE, dlg).filter(function (el) { return el.tabIndex >= 0 && !el.disabled && u.get(el, 'aria-disabled') !== 'true' && u.visible(el); });
    if (!items.length) return;

    var modal = mapped || u.get(dlg, 'aria-modal') === 'true';
    var first = items[0], last = items[items.length - 1];
    var atEdge = e.shiftKey ? e.target === first : e.target === last;

    // A non-modal dialog must let focus leave in BOTH directions.
    if (!modal) {
      if (!atEdge) return;
      return;
    }
    // Modal: EVERY Tab is ours, not only the edges. The library walks its
    // own list of stops, taken when the dialog opened; a stop it does not
    // know — a label made the checkbox (core) — sent Tab from "Arizona" back
    // to Close, skipping every other state (molinahealthcare.com, 2026-10-08).
    e.preventDefault();
    e.stopImmediatePropagation();
    var i = items.indexOf(e.target);
    if (i === -1) {
      // focus is on something not in the list: the next stop after it in the document
      i = items.length;
      for (var k = 0; k < items.length; k++) {
        if (e.target.compareDocumentPosition(items[k]) & 4) { i = k; break; }
      }
      var to = e.shiftKey ? items[(i - 1 + items.length) % items.length] : items[i % items.length];
      P.dialogTrapMoved(to); to.focus();
      return;
    }
    var nx = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length];
    P.dialogTrapMoved(nx); nx.focus();
  }, true);
})();
//#endregion

//#region u1-patch:form
// FormFixer.fix() returns early when no errorMsg selector was configured — and
// the label-to-field linking sits after that return. A form mapped without an
// error selector therefore never gets its labels connected, which is a 1.3.1 and
// 3.3.2 failure caused by an unrelated field being left blank.
//
// role="form" and handleRequiredFields() (aria-required) sit BEFORE that
// return, so they are not this same bug — but fix() itself only ever runs once
// FixerAbstract's wait-for-visible gate resolves (a ChangeDetection poll keyed
// to props.selectors.form), and on some pages that gate never resolves at all,
// same as accordion's fixer (see that region's comment). Wrapping u1.fix.form
// captures the mapping's own form/requiredField selectors — exactly what
// FormFixer.fix() reads off this.props.selectors — so role="form" and
// aria-required apply independent of whether that gate ever fires.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;
  var configs = [];

  var already = function (form, required) {
    return configs.some(function (c) { return c.form === form && c.required === required; });
  };
  var wrapOne = function (u1) {
    if (!u1 || !u1.fix || typeof u1.fix.form !== 'function' || u1.fix.form.__u1pWrapped) return;
    var orig = u1.fix.form;
    var wrapped = function (selector, props) {
      var sel = props && props.selectors;
      // A native <select> is left to the browser. The engine's form fixer
      // writes tabindex="0" on every inputField, and on molinahealthcare.com's
      // state picker (/medicare/plans-benefits) that write landing on the
      // <select> as it was pressed kept its native list from opening — the
      // owner "could not open the select" (2026-10-06). A <select> is
      // focusable, labelled by its own <label>/aria-label and operated by the
      // browser; a mapping has nothing to add to it, so it is taken out of
      // inputField before the engine sees the selector.
      if (sel && typeof sel.inputField === 'string' && sel.inputField.trim() && P.readable) {
        var hasSelect = false;
        try { hasSelect = u.qsa(sel.inputField).some(function (el) { return el.tagName === 'SELECT'; }); } catch (e) {}
        if (hasSelect) {
          var noSelect = sel.inputField.split(',').map(function (g) { return g.trim() + ':not(select)'; }).join(',');
          sel = Object.assign({}, sel, { inputField: P.readable(noSelect) });
          props = Object.assign({}, props, { selectors: sel });
          arguments[1] = props;
        }
      }
      var formSel = (sel && typeof sel.form === 'string' && sel.form) || (typeof selector === 'string' ? selector : null);
      var reqSel = (sel && typeof sel.requiredField === 'string') ? sel.requiredField : null;
      if (formSel && !already(formSel, reqSel)) {
        configs.push({ form: formSel, required: reqSel, page: typeof window.__u1CallPage === 'string' ? window.__u1CallPage : null });
        P.schedule();          // see the matching comment in u1-patch:accordion
      }
      return orig.apply(this, arguments);
    };
    wrapped.__u1pWrapped = true;
    u1.fix.form = wrapped;
  };
  var currentU1 = function () {
    return window.u1 !== undefined ? window.u1 : window.U1 !== undefined ? window.U1 : window.user1st;
  };
  if (P.onFixers) P.onFixers(wrapOne);
  else if (currentU1() && currentU1().fix) wrapOne(currentU1());
  else {
    var tries = 0;
    var poll = setInterval(function () {
      var u1 = currentU1();
      if ((u1 && u1.fix && (wrapOne(u1), true)) || ++tries > 40) clearInterval(poll);
    }, 250);
  }

  P.correct(function () {
    configs.forEach(function (cfg) {
      if (!P.live(cfg)) return;
      u.qsa(cfg.form).forEach(function (form) {
        if (form.tagName !== 'FORM' && u.get(form, 'role') !== 'form') u.set(form, 'role', 'form');
        if (cfg.required) u.qsa(cfg.required, form).forEach(function (el) { u.set(el, 'aria-required', 'true'); });
      });
    });
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
//
// CheckboxFixer.fix() only runs once FixerAbstract's wait-for-visible gate
// resolves (a ChangeDetection poll keyed to props.selectors.element), and on
// some pages that gate never resolves at all — same as accordion/form (see
// those regions' comments). Wrapping u1.fix.checkbox captures the mapping's
// own element/checkedState/uncheckedState/exclude/disabled/label selectors —
// exactly what CheckboxFixer.fix() and ToggleStateService.fix() read off
// this.props.selectors — so role="checkbox", the checked/unchecked ARIA sync,
// disabled/excluded handling and the label naming all apply independent of
// whether that gate ever fires.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;
  var configs = [];

  var already = function (el) { return configs.some(function (c) { return c.element === el; }); };
  var wrapOne = function (u1) {
    if (!u1 || !u1.fix || typeof u1.fix.checkbox !== 'function' || u1.fix.checkbox.__u1pWrapped) return;
    var orig = u1.fix.checkbox;
    var wrapped = function (selector, props) {
      var sel = props && props.selectors;
      var elSel = (sel && typeof sel.element === 'string' && sel.element) || (typeof selector === 'string' ? selector : null);
      if (elSel && !already(elSel)) {
        configs.push({
          element: elSel,
          checkedState: (sel && typeof sel.checkedState === 'string') ? sel.checkedState : null,
          uncheckedState: (sel && typeof sel.uncheckedState === 'string') ? sel.uncheckedState : null,
          exclude: (sel && typeof sel.exclude === 'string') ? sel.exclude : null,
          disabled: (sel && typeof sel.disabled === 'string') ? sel.disabled : null,
          label: (sel && typeof sel.label === 'string') ? sel.label : null,
          page: typeof window.__u1CallPage === 'string' ? window.__u1CallPage : null,
        });
        P.schedule();
      }
      return orig.apply(this, arguments);
    };
    wrapped.__u1pWrapped = true;
    u1.fix.checkbox = wrapped;
  };
  var currentU1 = function () {
    return window.u1 !== undefined ? window.u1 : window.U1 !== undefined ? window.U1 : window.user1st;
  };
  if (P.onFixers) P.onFixers(wrapOne);
  else if (currentU1() && currentU1().fix) wrapOne(currentU1());
  else {
    var tries = 0;
    var poll = setInterval(function () {
      var u1 = currentU1();
      if ((u1 && u1.fix && (wrapOne(u1), true)) || ++tries > 40) clearInterval(poll);
    }, 250);
  }

  // Mirrors ToggleStateService.fix(): an element-level match on checkedState
  // wins when unambiguous; when both or neither selector matches, checkedState
  // is retried as a DESCENDANT lookup, since some mappings point it at an
  // inner icon/class rather than the checkbox itself.
  var deriveChecked = function (box, cfg) {
    var isTrue = false, isFalse = false;
    try { isTrue = cfg.checkedState ? box.matches(cfg.checkedState) : false; } catch (e) {}
    try { isFalse = cfg.uncheckedState ? box.matches(cfg.uncheckedState) : false; } catch (e) {}
    if (isTrue && !isFalse) return 'true';
    if (!isTrue && isFalse) return 'false';
    if (cfg.checkedState) {
      var desc = false;
      try { desc = !!box.querySelector(cfg.checkedState); } catch (e) {}
      return desc ? 'true' : 'false';
    }
    return null;
  };

  P.correct(function () {
    configs.forEach(function (cfg) {
      if (!P.live(cfg)) return;
      var boxes = u.qsa(cfg.element);
      var labelEl = cfg.label ? u.qsa(cfg.label)[0] : null;
      var labelText = labelEl && (labelEl.textContent || '').trim();
      boxes.forEach(function (box) {
        if (u.get(box, 'role') !== 'checkbox') u.set(box, 'role', 'checkbox');
        u.setTabIndex(box, 0);
        if (cfg.checkedState || cfg.uncheckedState) {
          var checked = deriveChecked(box, cfg);
          if (checked !== null) u.set(box, 'aria-checked', checked);
        }
        if (labelEl && labelText) {
          u.set(box, 'aria-label', labelText);
          if (!labelEl.querySelector(u.FOCUSABLE)) u.set(labelEl, 'aria-hidden', 'true');
        }
      });
      if (cfg.disabled) {
        u.qsa(cfg.disabled).forEach(function (el) {
          u.set(el, 'aria-disabled', 'true');
          u.setTabIndex(el, -1);
        });
      }
      if (cfg.exclude) {
        u.qsa(cfg.exclude).forEach(function (el) {
          if (!u.visible(el)) el.style.visibility = 'hidden';
        });
      }
    });
  });

  // Space activates a non-native checkbox (addKeyboardEvent's contract), and
  // either kind of activation must force an immediate re-sync: the checked
  // state is read from a CSS class/selector the site's own JS flips, which is
  // not one of the attributes core's MutationObserver watches.
  var checkboxSelectorList = function () {
    return configs.map(function (c) { return c.element; }).filter(Boolean).join(',');
  };
  var kick = function () {
    if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(P.schedule); });
    else setTimeout(P.schedule, 50);
  };
  document.addEventListener('keydown', function (e) {
    if (!configs.length || e.code !== 'Space') return;
    if (u.isTyping(e.target)) return;
    var box = u.closest(e.target, checkboxSelectorList());
    if (!box || u.isNative(box)) return;
    e.preventDefault();
    box.click();
    kick();
  }, true);
  document.addEventListener('click', function (e) {
    if (!configs.length) return;
    if (u.closest(e.target, checkboxSelectorList())) kick();
  }, true);

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
    // which fixer produced it — except a closed drawer the core hid itself
    // (data-u1p-ghost-root): its controls are already out of the Tab order,
    // and uncovering it put "Filter by:" and its checkboxes back under a
    // screen reader's arrow keys between Search and Filter (molina blog).
    u.qsa('[aria-hidden="true"]').forEach(function (el) {
      if (el.hasAttribute('data-u1p-ghost-root')) return;
      // A panel that is not rendered at all (display:none — a closed mega
      // menu) has nothing focusable in it; its aria-hidden is harmless, and
      // taking it off started a fight with the library, which puts it back:
      // 24 writes in 3 idle seconds on molinahealthcare.com (2026-10-08).
      if (!el.getClientRects().length) return;
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

  // Its own marker, distinct from the wrapper's MARK: the wrapper's names the
  // CONTEXT the fixer is handed, this one names the tab list inside it, and the
  // two are different elements the moment we widen.
  // Each tab that belongs to THIS list gets its own mark, and the scoped
  // selector is that mark alone. A descendant combinator would be the obvious
  // way to scope and it is not available: U1's selector validator splits on
  // [>+~] and rejects a compound containing a space, and the tabs are not
  // always direct children so `>` will not always reach them. A bare attribute
  // selector has no combinator to argue about.
  var TAB_MARK = 'data-u1p-tab';
  var seq2 = 0;

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

    // Reaching the panel means climbing, and climbing can pull in tabs that
    // belong to something else — a button class shared with the rest of the
    // page. That used to end the strip: return false, the wrapper takes it as
    // "cannot work", u1.fix.tabs is never called and nothing is decorated.
    //
    // But the tabs were never the problem. The caller named the right list and
    // the right panel; only the tab SELECTOR is wider than the list. So mark
    // the list, scope the selector to it, and climb freely: the widened root
    // reaches the panel while `tab` still means the six inside #dealTabs.
    var scoped = null;
    var scopeToRoot = function () {
      if (scoped) return scoped;
      var tok = 'u1pt' + (seq2++);
      var ours = root.querySelectorAll(sel.tab);
      for (var i = 0; i < ours.length; i++) ours[i].setAttribute(TAB_MARK, tok);
      var next = {};
      for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) next[k] = props[k];
      next.selectors = {};
      for (var j in sel) if (Object.prototype.hasOwnProperty.call(sel, j)) next.selectors[j] = sel[j];
      next.selectors.tab = '[' + TAB_MARK + '="' + tok + '"]';
      scoped = next;
      return scoped;
    };

    while ((node = node.parentElement)) {
      try {
        // An ancestor that sweeps in tabs which are not ours is still the wrong
        // root for the UNSCOPED props — so from here on, use the scoped ones.
        if (node.querySelectorAll(sel.tab).length !== mine) {
          var up = node;
          do {
            try {
              if (!up.querySelector(sel.tabPanel)) continue;
              // A panel is in reach — but is it OURS? An ancestor holding two
              // tab lists holds two strips, and the panel we just found may
              // belong to the other one. Pairing them is the mistake the plain
              // count check was there to prevent, and it stays prevented: this
              // widening is only for a strip whose own panel sits outside it,
              // not for borrowing a neighbour's.
              if (sel.tabList && up.querySelectorAll(sel.tabList).length !== 1) return false;
              return { root: up, props: scopeToRoot() };
            } catch (e2) { return null; }
          } while ((up = up.parentElement));
          return false;   // no ancestor holds a panel at all
        }
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

  // A submenu the focus-hover region opened is that region's, arrows and all.
  var NOT_FOCUS_PANEL = { unless: '[data-u1p-focus-panel]' };

  P.rove(SEL, '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
         { arrows: true, unless: NOT_FOCUS_PANEL.unless });

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
  }, NOT_FOCUS_PANEL);

  // ── Opening a submenu, and getting back out of it ────────────────────────
  //
  // Neither of these is in the library, and they are the two things a keyboard
  // user does with a menu. Reported on a live mapping: pressing the trigger did
  // not open the panel, and Escape from inside a submenu left focus stranded
  // in a panel that had closed behind it.
  //
  // Both are done by driving the PAGE's own behaviour — the trigger is clicked
  // rather than the panel being shown by hand — so a site that opens on click,
  // on class, or on its own state machine keeps working. Nothing here decides
  // what "open" means; it only makes the keyboard reach it.
  var triggerFor = function (panel) {
    if (!panel) return null;
    // Whoever says they control it.
    if (panel.id) {
      var by = u.qsa('[aria-controls="' + panel.id + '"], [data-controls="' + panel.id + '"]');
      if (by.length) return by[0];
    }
    // Otherwise the control just before it: a trigger and its panel are
    // siblings, or the panel is the trigger's own next element.
    var prev = panel.previousElementSibling;
    if (prev && prev.matches && prev.matches('button,[role="button"],a[href]')) return prev;
    var up = panel.parentElement;
    if (up) {
      var t = up.querySelector('button,[role="button"],a[href]');
      if (t && !t.contains(panel) && !panel.contains(t)) return t;
    }
    return null;
  };

  // Enter, Space or Down on a closed trigger opens it and steps inside.
  //
  // `u.closest(e.target, '[aria-expanded]')` assumes the trigger itself (or
  // an ancestor of it) carries aria-expanded. It never does for a plain
  // u1.fix.menu mapping: RolesAndAttributes.setSubmenuState (the real
  // u1_vanilla-js-a11y.js) writes aria-expanded on the SUBMENU, a SIBLING of
  // the trigger under the same <li> — never on the trigger and never on an
  // ancestor shared with it. closest() only climbs ancestors, so on the most
  // ordinary shape U1 itself produces this always returned null and did
  // nothing: pressing Enter opened the panel (the page's own click handler)
  // but never stepped focus inside it. Confirmed on
  // molinahealthcare.com's mega-menu, and true of any site built the same
  // way, not particular to that one.
  //
  // The trigger IS reliably markable: U1 sets aria-haspopup="true" on every
  // item matching `selectors.triggers`, unconditionally, the moment
  // fix.menu runs — before the submenu itself has been opened even once, so
  // it exists from the first keypress. Used only as a fallback, so a site
  // where aria-expanded genuinely does sit on the trigger (or an ancestor)
  // keeps taking the original, unchanged path.
  var panelFor = function (trigger) {
    if (!trigger) return null;
    var id = u.get(trigger, 'aria-controls') || u.get(trigger, 'data-controls');
    if (id) { var byId = document.getElementById(id); if (byId) return byId; }
    var next = trigger.nextElementSibling;
    // Not itself another pressable — a panel is content, not a second
    // control sitting beside the first.
    if (next && !next.matches('button,[role="button"],a[href],input,select,textarea')) return next;
    return null;
  };
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return;
    // The caret wins. This matches on an ANCESTOR with aria-expanded, so
    // without this line a field inside any collapsed region loses Space and
    // Enter entirely — see isTyping.
    if (u.isTyping(e.target)) return;
    // A trigger the core's disclosure layer owns lands focus by ITS rule
    // (Enter → the panel's top, arrows → the items). This handler's "first
    // focusable" ran a frame later and pulled a VoiceOver user from the
    // Medicaid panel's title to its first link (2026-10-06).
    if (P.disclosureOwns && P.disclosureOwns(e.target)) return;
    var t = u.closest(e.target, '[aria-expanded]');
    var panel = null;
    if (t) {
      if (u.get(t, 'aria-expanded') !== 'false') return;
    } else {
      t = u.closest(e.target, '[aria-haspopup="true"]');
      panel = t && panelFor(t);
      // Not '!== false': a panel U1 has never opened yet carries no
      // aria-expanded AT ALL (setSubmenuState only ever runs the first time
      // ChangeDetection sees the submenu become visible) — undefined means
      // "still closed", not "unknown". 'true' is the only value this
      // refuses, so a second Enter on an already-open trigger is a no-op
      // here rather than a redundant click.
      if (!panel || u.get(panel, 'aria-expanded') === 'true') return;
    }
    // A native button already opens on Enter and Space on its own — clicking
    // it again here would be a second, redundant open. But that only excuses
    // the CLICK; stepping focus into whatever just opened is this patch's
    // to do regardless of who opened it, and returning here unconditionally
    // (the previous shape of this check) skipped that half too — Enter
    // opened the panel and then left a keyboard user stranded on the
    // trigger, exactly the report this whole handler exists to fix. Only
    // Down, which nothing native listens for, still needs the click itself.
    var native = u.isNative(t);
    if (!(native && e.key !== 'ArrowDown')) {
      e.preventDefault();
      t.click();
    }
    if (!panel) {
      var panelId = u.get(t, 'aria-controls') || u.get(t, 'data-controls');
      panel = panelId ? document.getElementById(panelId) : t.nextElementSibling;
    }
    (window.requestAnimationFrame || setTimeout)(function () {
      if (!panel) return;
      var first = u.qsa(u.FOCUSABLE, panel).filter(u.visible)[0];
      if (first) first.focus();
    }, 0);
  }, true);

  // Escape closes the submenu and puts focus back where it came from. Without
  // it, focus is left inside a panel that is no longer on screen — the tab
  // order simply stops.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (P.disclosureOwns && P.disclosureOwns(e.target)) return;   // the core's, once
    var panel = u.closest(e.target, '[role="menu"], [role="menubar"]');
    // A menubar is the bar itself, not something to escape out of.
    if (!panel || u.get(panel, 'role') === 'menubar') return;
    var t = triggerFor(panel);
    if (!t) return;
    // A submenu the focus-hover region below is holding open is that
    // region's to close — clicking THIS trigger would not close anything, it
    // would fire the trigger's click job (on molinahealthcare.com: a dialog).
    if (t.hasAttribute('data-u1p-focus-open')) return;
    e.preventDefault();
    e.stopPropagation();
    if (u.get(t, 'aria-expanded') === 'true') t.click();   // let the page close it
    u.set(t, 'aria-expanded', 'false');
    t.focus();
  }, true);
})();
//#endregion

//#region u1-patch:menu-focus-hover
// Tabbing to a trigger does not open its submenu the way hovering it does —
// Tab and hover are unrelated input paths. U1's own `openByFocus` config
// option (read off the real u1_vanilla-js-a11y.js) is not a focus LISTENER:
// it only tells U1 what to nudge when U1 ITSELF decides, from its own
// keyboard handling, to open a submenu — nothing in U1 reacts to a plain Tab
// landing on a trigger.
//
// Dispatching synthetic mouseover/mouseenter on focus (mirroring the nudge
// U1's own engine sends internally for its OPEN_BY.MOUSE_OVER path) covers a
// site whose hover-open menu is wired in JS. It does NOT cover one whose
// submenu is revealed by CSS `:hover` alone (e.g. `.dropdown:hover
// .dropdown-menu{display:block}`) — `:hover` is a real pointer-position
// match; no dispatched event can set it, on molinahealthcare.com or anywhere
// else. Confirmed there: aria-expanded flips on real mouse hover with no
// hover JS wired to the trigger at all, so the panel's own inline style has
// to be forced open directly, independent of whichever CSS property the
// site happens to be hiding it with.
//
// Scoped to aria-haspopup="true" — which U1 already sets on every menu
// trigger it fixes, with or without openByFocus configured — so this needs
// no per-mapping config of its own, and does nothing where nothing listens.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  // What a submenu panel looks like when nothing names it outright. The
  // role is what U1 gives it; the classes are what Bootstrap, WordPress and
  // most nav builders give it; a bare list is the fallback for a hand-rolled
  // menu. Only ever matched INSIDE the trigger's own item, so a bare <ul>
  // cannot be another item's submenu.
  var PANEL_SEL = '[role="menu"], [role="menubar"], .dropdown-menu, .sub-menu, .submenu, ' +
                  '.mega-menu, .megamenu, ul, ol';
  var notSelf = function (trigger) {
    return function (p) { return p !== trigger && !p.contains(trigger); };
  };
  var cssEscape = function (s) {
    try { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'); }
    catch (e) { return s; }
  };
  var panelFor = function (trigger) {
    // Whoever the trigger says it controls.
    var id = u.get(trigger, 'aria-controls') || u.get(trigger, 'data-controls') ||
             u.get(trigger, 'data-target') || u.get(trigger, 'data-bs-target');
    if (id) {
      var byId = document.getElementById(id.replace(/^#/, ''));
      if (byId && notSelf(trigger)(byId)) return byId;
    }
    // Whoever says the trigger is its label — Bootstrap writes
    // aria-labelledby on the panel, and molinahealthcare.com writes it with a
    // "-nav" suffix on the trigger's id, so prefix and suffix forms count too.
    if (trigger.id) {
      var tid = cssEscape(trigger.id);
      var labelled = u.qsa('[aria-labelledby="' + tid + '"], [aria-labelledby^="' + tid + '-"], ' +
                           '[aria-labelledby$="-' + tid + '"]').filter(notSelf(trigger));
      if (labelled.length) return labelled[0];
    }
    // The next sibling that is a panel — skipping decorations such as the
    // <span class="arrow"> that sits between a trigger and its list.
    var sib = trigger.nextElementSibling;
    while (sib) {
      if (sib.matches && sib.matches(PANEL_SEL)) return sib;
      sib = sib.nextElementSibling;
    }
    // Anything panel-shaped inside the trigger's own item.
    var up = trigger.parentElement;
    if (up && up !== document.body) {
      var inItem = u.qsa(PANEL_SEL, up).filter(notSelf(trigger));
      if (inItem.length) return inItem[0];
    }
    return null;
  };

  // mouseover bubbles; mouseenter does NOT. A real pointer entering the <a>
  // fires a separate mouseenter on every ancestor it entered at the same
  // time — and a hover-menu's listener is usually on the <li class="dropdown">
  // around the trigger, not on the trigger itself. So mouseenter/mouseleave
  // go to the trigger and each ancestor up to the menu container, as the
  // browser would send them.
  var hover = function (el, enter) {
    if (!el) return;
    try {
      el.dispatchEvent(new MouseEvent(enter ? 'mouseover' : 'mouseout', { bubbles: true, cancelable: true }));
    } catch (e) {}
    var stop = u.closest(el, '[role="menubar"], [role="menu"], nav, ul') || el.parentElement;
    var node = el;
    while (node && node !== document.body) {
      try {
        node.dispatchEvent(new MouseEvent(enter ? 'mouseenter' : 'mouseleave', { bubbles: false, cancelable: false }));
      } catch (e) {}
      if (node === stop) break;
      node = node.parentElement;
    }
  };

  // ── Diagnostics ───────────────────────────────────────────────────────────
  // Reported "still does not open" with the build confirmed loaded — so this
  // records what each focusin actually found and did, and what the panel's
  // computed state was one frame later. Read it from the console after
  // tabbing onto a trigger: window.__u1Patch.focusHover
  var desc = function (el) {
    if (!el || !el.tagName) return null;
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    return s;
  };
  var snap = function (panel) {
    if (!panel) return null;
    var cs = null;
    try { cs = getComputedStyle(panel); } catch (e) {}
    var r = null;
    try { r = panel.getBoundingClientRect(); r = { x: r.x, y: r.y, w: r.width, h: r.height }; } catch (e) {}
    return {
      inline: panel.getAttribute('style'),
      className: panel.className,
      display: cs && cs.display, visibility: cs && cs.visibility, opacity: cs && cs.opacity,
      maxHeight: cs && cs.maxHeight, height: cs && cs.height, transform: cs && cs.transform,
      position: cs && cs.position, top: cs && cs.top, left: cs && cs.left,
      ariaExpanded: panel.getAttribute('aria-expanded'), ariaHidden: panel.getAttribute('aria-hidden'),
      parentOverflow: (function () { try { return getComputedStyle(panel.parentElement).overflow; } catch (e) { return null; } })(),
      rect: r, visible: u.visible(panel),
    };
  };
  var log = function (rec) {
    P.focusHover = P.focusHover || [];
    P.focusHover.push(rec);
    if (P.focusHover.length > 20) P.focusHover.shift();
  };

  // Whichever of these properties the site's own CSS is using to hide the
  // panel, an inline !important beats it — including its own `:hover` rule,
  // so nothing fights this while focus holds it open. Cleared (not just
  // zeroed) on close, so the site's stylesheet takes back over exactly as it
  // would the instant a real hover ends.
  var FORCE_OPEN = { display: 'block', visibility: 'visible', opacity: '1',
                     'pointer-events': 'auto', 'max-height': 'none' };
  var forceOpen = function (panel, open) {
    if (!panel) return;
    Object.keys(FORCE_OPEN).forEach(function (p) {
      if (open) panel.style.setProperty(p, FORCE_OPEN[p], 'important');
      else panel.style.removeProperty(p);
    });
  };

  // A third mechanism, alongside the two above: some sites open on hover by
  // toggling a STATE CLASS (their CSS reads `.dropdown.open .dropdown-menu`,
  // `.show`, `.is-open`, `.active` …) rather than by an inline style or a raw
  // `:hover` selector — jQuery's `.hover()` is commonly wired to add exactly
  // one of these, but the class itself, once added, may be what the CSS
  // keys off rather than the hover state that added it. Adding the common
  // names to both the trigger's own toggle target and its container costs
  // nothing where none of them mean anything, and covers the class-driven
  // case the two mechanisms above do not.
  var STATE_CLASSES = ['show', 'open', 'is-open', 'active', 'dropdown-menu-show'];
  var toggleStateClasses = function (trigger, panel, on) {
    var targets = [trigger, panel, trigger.parentElement, trigger.closest && trigger.closest('.dropdown')]
      .filter(Boolean);
    targets.forEach(function (el) {
      STATE_CLASSES.forEach(function (c) {
        if (on) el.classList.add(c); else el.classList.remove(c);
      });
    });
  };

  // The trigger this region is holding open is marked, so the key handlers
  // below act only on a submenu THIS region opened — never on a trigger some
  // other mechanism (the site's click handler, U1's own keyboard path, the
  // menu region above) is in charge of. The menu region's Escape handler
  // reads the same mark to stay out of the way.
  var MARK = P.FOCUS_OPEN_MARK = 'data-u1p-focus-open';
  // Set by Escape, read once by the next focusin: closing the panel puts
  // focus back on the trigger, and focusin would open it straight back up.
  var ESC = 'data-u1p-focus-esc';

  // The open panel is marked too: the menu region's generic arrow handling
  // (P.rove, the RTL mirror) reads it and stands aside, because the arrows
  // inside a panel this region opened are handled below, as a menubar's.
  var PANEL_MARK = 'data-u1p-focus-panel';

  var openNow = function (t, panel) {
    hover(t, true);
    forceOpen(panel, true);
    toggleStateClasses(t, panel, true);
    if (panel) {
      u.set(t, MARK, '1');
      u.set(panel, PANEL_MARK, '1');
      // A menu button announces "collapsed"/"expanded" from ITS OWN
      // aria-expanded. Here the site put it on the <ul> and left the trigger
      // without one — so a screen reader hears "has popup" and nothing about
      // whether it is open. While this region is in charge, the trigger says.
      u.set(t, 'aria-expanded', 'true');
    }
  };
  var closeNow = function (t, panel) {
    hover(t, false);
    forceOpen(panel, false);
    toggleStateClasses(t, panel, false);
    if (t.hasAttribute(MARK)) {
      t.removeAttribute(MARK);
      u.set(t, 'aria-expanded', 'false');
    }
    if (panel) panel.removeAttribute(PANEL_MARK);
  };

  // ── The row of top-level items the trigger sits in ────────────────────────
  // A menubar's Left/Right move between ITS items — the trigger's siblings —
  // never into a submenu. U1 walks the mapping's flat `items` list in DOM
  // order and skips what is hidden, so the moment a submenu is held open its
  // entries become "the next item" and Right walks into it. The row is read
  // off the DOM instead: the trigger's item is its parent, the row is that
  // item's parent, and each sibling item's own control is the stop.
  var itemOf = function (t) { return t.parentElement; };
  var controlOf = function (item) {
    if (!item) return null;
    if (item.matches && item.matches(u.FOCUSABLE) && u.visible(item)) return item;
    return u.qsa(':scope > ' + u.FOCUSABLE.split(',').join(', :scope > '), item)
            .filter(u.visible)[0] || null;
  };
  var rowSiblings = function (t) {
    var item = itemOf(t), row = item && item.parentElement;
    if (!row) return { items: [], here: -1, rtl: false };
    var controls = Array.prototype.map.call(row.children, controlOf).filter(Boolean);
    var rtl = false;
    try { rtl = getComputedStyle(row).direction === 'rtl'; } catch (e) {}
    return { items: controls, here: controls.indexOf(t), rtl: rtl };
  };
  var stepRow = function (t, dir) {
    var r = rowSiblings(t);
    if (r.here === -1 || r.items.length < 2) return false;
    if (r.rtl) dir = -dir;
    var to = r.items[(r.here + dir + r.items.length) % r.items.length];
    if (!to) return false;
    to.focus();          // its own focusin opens its submenu, as a menubar does
    return true;
  };
  var panelItems = function (panel) {
    return panel ? u.qsa(u.FOCUSABLE, panel).filter(u.visible) : [];
  };

  // Opt-in, per menu: only a trigger belonging to a menu mapping that set
  // `focusOpensSubmenu` (collected by the core's u1.fix.menu intercept) is
  // taken over. Matched by the mapping's own `triggers` selector, or, when
  // it has none, by sitting inside its `menu` container.
  var matchesEntry = function (t, s) {
    try {
      if (s.triggerSel && t.matches(s.triggerSel)) return true;
      if (!s.triggerSel && s.menuSel && u.closest(t, s.menuSel)) return true;
    } catch (e) {}
    return false;
  };
  var enabledFor = function (t) {
    var list = P.focusOpen || [];
    for (var i = 0; i < list.length; i++) if (matchesEntry(t, list[i])) return true;
    return false;
  };
  // Called by the core when a menu's switch is turned off (or re-applied):
  // whatever this region is holding open for that menu closes now.
  P.focusOpenRelease = function (s) {
    u.qsa('[' + MARK + ']').forEach(function (t) {
      if (matchesEntry(t, s)) closeNow(t, panelFor(t));
    });
  };

  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (u.get(t, 'aria-haspopup') !== 'true') return;
    if (!enabledFor(t)) return;
    // Escape just closed this on purpose. A time window rather than a
    // one-shot flag: focus arriving back on the trigger fires focusin two
    // or three times within a few ms (U1 re-focuses what it was handed), and
    // a flag consumed by the first would let the second reopen the panel.
    var esc = +u.get(t, ESC);
    if (esc && Date.now() - esc < 500) return;
    if (esc) t.removeAttribute(ESC);
    if (u.get(t, 'aria-expanded') === 'true') return;   // already open, nothing to nudge
    var panel = panelFor(t);
    var rec = { type: 'in', at: Date.now(), trigger: desc(t), panel: desc(panel), before: snap(panel),
                parent: desc(t.parentElement),
                parentChildren: t.parentElement
                  ? Array.prototype.map.call(t.parentElement.children, desc) : null };
    log(rec);
    openNow(t, panel);
    rec.applied = snap(panel);
    (window.requestAnimationFrame || setTimeout)(function () {
      rec.afterFrame = snap(panel);
      rec.activeAfterFrame = desc(document.activeElement);
    }, 0);
    // And a little later still — long enough for anything that closes it
    // back on a timer to have done so.
    setTimeout(function () {
      rec.after300ms = snap(panel);
      rec.activeAfter300ms = desc(document.activeElement);
    }, 300);
  }, true);

  document.addEventListener('focusout', function (e) {
    // Only a trigger THIS region opened — closing clears inline styles and
    // state classes off the panel, which must never happen to a menu some
    // other mechanism is running.
    var t = u.closest(e.target, '[' + MARK + ']') ||
            u.qsa('[' + MARK + ']').filter(function (m) {
              var p = panelFor(m); return p && p.contains(e.target);
            })[0];
    if (!t) return;
    var panel = panelFor(t);
    var rec = { type: 'out', at: Date.now(), trigger: desc(t), from: desc(e.target),
                relatedTarget: desc(e.relatedTarget) };
    log(rec);
    // One tick later: relatedTarget-style timing is reliable there, and it
    // lets focus that is simply moving from the trigger into its own
    // submenu skip the close instead of flickering it shut and open again.
    (window.requestAnimationFrame || setTimeout)(function () {
      var now = document.activeElement;
      rec.activeNow = desc(now);
      if (now === t || t.contains(now) || (panel && panel.contains(now))) { rec.kept = true; return; }
      rec.closed = true;
      closeNow(t, panel);
    }, 0);
  }, true);

  // ── Keys on a trigger this region holds open ──────────────────────────────
  //
  // The trigger has TWO jobs on this site and on most hover-menus: hovering
  // it shows the submenu, clicking it goes somewhere (here: opens a state
  // picker dialog). Focus now does the hover half. Enter and Space must do
  // the CLICK half — exactly what a mouse click does — and not be taken by
  // U1's menu keyboard path as "toggle the submenu", which is what made
  // Enter do nothing useful on a trigger whose submenu focus already opened.
  // A capture listener on the document runs before U1's element handler and
  // stopImmediatePropagation keeps that handler from running at all, the
  // same way P.rove takes the arrows.
  //
  // Only the trigger itself — items inside the panel keep their own keys.
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t || !t.hasAttribute || !t.hasAttribute(MARK)) return;
    if (e.defaultPrevented || u.isTyping(t)) return;
    var panel;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      // The page's own click — Bootstrap's modal handler, an href, whatever
      // the site wired. Nothing here decides what clicking means.
      t.click();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Down enters at the top, Up enters at the bottom — APG menubar.
      var list = panelItems(panelFor(t));
      if (!list.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      list[e.key === 'ArrowDown' ? 0 : list.length - 1].focus();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Along the row of top-level items — never into the submenu.
      if (!stepRow(t, e.key === 'ArrowRight' ? 1 : -1)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeNow(t, panelFor(t));
      u.set(t, ESC, String(Date.now()));   // focus stays here; a re-focus must not reopen
    }
  }, true);

  // ── Keys INSIDE a submenu this region opened ──────────────────────────────
  // Up/Down walk the panel; Left/Right leave it for the neighbouring
  // top-level item (which opens, as a menubar's does); Home/End jump; Escape
  // closes and returns to the trigger — without focusin reopening it, and
  // without the menu region's Escape clicking the trigger to "let the page
  // close it", which here would open the dialog.
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    var k = e.key;
    if (k !== 'Escape' && k !== 'ArrowUp' && k !== 'ArrowDown' &&
        k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    var panel = u.closest(e.target, '[' + PANEL_MARK + ']');
    if (!panel) return;
    var t = u.qsa('[' + MARK + ']').filter(function (m) { return panelFor(m) === panel; })[0];
    if (!t) return;
    if (u.isTyping(e.target)) return;

    if (k === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeNow(t, panel);
      u.set(t, ESC, String(Date.now()));
      t.focus();
      return;
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      if (!stepRow(t, k === 'ArrowRight' ? 1 : -1)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    var list = panelItems(panel);
    var here = list.indexOf(u.closest(e.target, u.FOCUSABLE));
    if (here === -1) here = list.indexOf(e.target);
    if (here === -1 || !list.length) return;
    var to = k === 'Home' ? 0
           : k === 'End' ? list.length - 1
           : k === 'ArrowDown' ? (here + 1) % list.length
           : (here - 1 + list.length) % list.length;
    e.preventDefault();
    e.stopImmediatePropagation();
    list[to].focus();
  }, true);
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

  // ── The mapping, kept by the mapping ───────────────────────────────────────
  // The library's RadioFixer writes role="radio", aria-checked and a roving
  // tabindex — when it runs. On molinahealthcare.com's glossary letter strip
  // it never ran: not with the patch, not with the engine alone, not with
  // <body> as the context (its wait-for-visible gate never opened; the same
  // gate the heading and accordion regions already step around). The letters
  // stayed plain buttons and a screen reader never heard which one was
  // chosen (2026-10-08). So the mapping's own selectors are read here:
  //   radioGroup  → role="radiogroup", named by the label before it
  //   radioButton → role="radio", aria-checked from checkedState, one tab stop
  //   keys        → arrows move AND select (APG radio), Home/End, Space.
  // Everything is written only where the library did not already write it.
  var groupsNow = function () {
    var out = [];
    (P.calls || []).forEach(function (c) {
      if (c.type !== 'radio') return;
      var sel = (c.props && c.props.selectors) || {};
      var gSel = sel.radioGroup || c.selector, bSel = sel.radioButton;
      if (!gSel || !bSel) return;
      u.qsa(gSel).forEach(function (g) {
        if (out.some(function (o) { return o.group === g; })) return;
        out.push({ group: g, bSel: bSel, checked: sel.checkedState || '', exclude: sel.exclude || '' });
      });
    });
    return out;
  };
  var radiosOf = function (o) {
    var all = u.qsa(o.bSel, o.group);
    if (!all.length) all = u.qsa(o.bSel).filter(function (r) { return o.group.contains(r); });
    return all.filter(function (r) {
      try { if (o.exclude && r.matches(o.exclude)) return false; } catch (e) {}
      return u.visible(r);
    });
  };
  var isChecked = function (o, r) {
    if (!o.checked) return u.get(r, 'aria-checked') === 'true';
    try { return r.matches(o.checked); } catch (e) {}
    // A bare class/attribute fragment (".active") — test it on the element.
    try { return r.matches(o.bSel + o.checked); } catch (e) { return false; }
  };
  var off = function (r) { return r.disabled || u.get(r, 'aria-disabled') === 'true'; };
  P.correct(function () {
    groupsNow().forEach(function (o) {
      var g = o.group;
      if (u.get(g, 'role') !== 'radiogroup') u.set(g, 'role', 'radiogroup');
      if (!u.get(g, 'aria-label') && !u.get(g, 'aria-labelledby')) {
        var lab = g.previousElementSibling;
        if (lab && /^(LABEL|SPAN|DIV|P|H[1-6]|LEGEND)$/.test(lab.tagName) && (lab.textContent || '').trim() && (lab.textContent || '').trim().length < 60) {
          if (!lab.id) lab.id = 'u1p-rg-' + Math.random().toString(36).slice(2, 8);
          u.set(g, 'aria-labelledby', lab.id);
        }
      }
      var rs = radiosOf(o);
      if (!rs.length) return;
      var entry = -1;
      rs.forEach(function (r, i) {
        if (u.get(r, 'role') !== 'radio') u.set(r, 'role', 'radio');
        var on = isChecked(o, r);
        u.set(r, 'aria-checked', on ? 'true' : 'false');
        if (r.disabled) u.set(r, 'aria-disabled', 'true');
        if (on && entry === -1) entry = i;
      });
      if (entry === -1) { for (var k = 0; k < rs.length; k++) if (!off(rs[k])) { entry = k; break; } }
      rs.forEach(function (r, i) { u.setTabIndex(r, i === entry ? 0 : -1); });
    });
  });
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End' && k !== ' ') return;
    if (u.isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    var gs = groupsNow();
    for (var gi = 0; gi < gs.length; gi++) {
      var o = gs[gi];
      if (!o.group.contains(e.target)) continue;
      var rs = radiosOf(o).filter(function (r) { return !off(r); });
      var here = rs.indexOf(e.target.closest ? (rs.filter(function (r) { return r === e.target || r.contains(e.target); })[0] || null) : null);
      if (here === -1) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (k === ' ') { rs[here].click(); setTimeout(P.schedule, 60); return; }
      var rtl = false; try { rtl = getComputedStyle(o.group).direction === 'rtl'; } catch (err) {}
      var step = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : -1;
      if (rtl && (k === 'ArrowRight' || k === 'ArrowLeft')) step = -step;
      var to = k === 'Home' ? 0 : k === 'End' ? rs.length - 1 : (here + step + rs.length) % rs.length;
      try { rs[to].focus(); } catch (err) {}
      rs[to].click();              // APG: moving IS choosing
      setTimeout(P.schedule, 60);  // the site re-renders the chosen class; follow it
      return;
    }
  }, true);
  // A click (mouse, Enter, a screen reader's activate) changes the chosen one
  // through the page's own state; the class swap is not a mutation the core
  // observer watches, so look again.
  document.addEventListener('click', function (e) {
    var gs = groupsNow();
    for (var i = 0; i < gs.length; i++) if (gs[i].group.contains(e.target)) { setTimeout(P.schedule, 60); setTimeout(P.schedule, 400); return; }
  }, true);
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
    if (u.isTyping(e.target)) return;
    if (P.disclosureOwns && P.disclosureOwns(e.target)) return;   // the core's, once
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

  /**
   * Answer "is this open?" only once it has stopped moving.
   *
   * A dropdown that slides shut is still visible for the whole animation —
   * mid-slide a jQuery slideUp reads height:5.08px, overflow:hidden — so any
   * fixed delay is a coin toss on a slow machine and a wrong answer on a fast
   * one. Poll until two consecutive measurements agree, then decide.
   */
  var whenSettled = function (el, cb) {
    var last = -1, waited = 0;
    var tick = function () {
      var now = el.offsetHeight + ':' + el.offsetWidth;
      if (now === last || waited >= 900) { cb(u.visible(el)); return; }
      last = now;
      waited += 80;
      setTimeout(tick, 80);
    };
    setTimeout(tick, 80);
  };

  // Escape: put focus back, and close it if nobody else is going to.
  //
  // This used to wait a flat 90ms and then click the trigger if the list still
  // looked visible. On a site that animates the dropdown, 90ms lands in the
  // middle of the slide: the list reads as open, the click REOPENS it, the
  // site closes it again, and the thing flickers three times before settling.
  // Reported exactly that way.
  //
  // So: the focus return happens at once — it is ours and it conflicts with
  // nothing — and the decision to close waits until the list has stopped
  // moving. On a site that closes on Escape by itself, that decision is
  // "already shut", and this touches nothing.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (P.disclosureOwns && P.disclosureOwns(e.target)) return;   // the core's, once
    var list = u.closest(e.target, '[role="listbox"]');
    if (!list) return;
    var trigger = triggerFor(list);
    if (!trigger) return;
    try { trigger.focus(); } catch (err) {}
    // A second Escape while the first is still settling would queue a second
    // click, which is its own way of reopening what was just closed.
    if (list.__u1pClosing) return;
    list.__u1pClosing = true;
    whenSettled(list, function (stillOpen) {
      list.__u1pClosing = false;
      if (stillOpen) trigger.click();
      P.schedule();
    });
  }, true);

  // The site opening or closing the list is not something the attribute
  // observer sees — it happens by class or by inline style, and neither is in
  // the filter. So the click that could have caused it schedules the pass.
  document.addEventListener('click', function (e) {
    var trigger = u.closest(e.target, TRIGGER);
    if (!trigger && !u.closest(e.target, '[role="listbox"]')) return;
    setTimeout(P.schedule, 0);
    // And again once the list has finished moving, because aria-expanded read
    // off a half-collapsed element is simply wrong.
    var list = trigger && listFor(trigger);
    if (list) whenSettled(list, function () { P.schedule(); });
    else setTimeout(P.schedule, 250);
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

  // ── enterSelects: arrows only move, Enter picks ────────────────────────────
  //
  // Opt-in per mapping (P.enterSelects, collected by the core's u1.fix.listbox
  // intercept). The list where it is on runs the aria-activedescendant model
  // and nothing else: keyboard focus sits on the LIST, never on an option, so
  // whatever the site does when an option receives focus — on one client the
  // options are links that navigate the moment they are focused — never
  // happens from the keyboard. The highlight moves by attribute (and an inline
  // outline, since the exported bundle ships no stylesheet); Enter or Space
  // clicks the highlighted option; Tab leaves without clicking anything,
  // which the library's own handler would otherwise do (its Tab case
  // dispatches a click on the active option). Registered at document capture
  // BEFORE the roving below, and it stops propagation, so neither the roving
  // nor the library's list handler runs for these keys on such a list.
  var esEntryFor = function (list) {
    var L = P.enterSelects || [];
    for (var i = 0; i < L.length; i++) {
      try { if (L[i].listSel && list.matches(L[i].listSel)) return L[i]; } catch (e) {}
    }
    return null;
  };
  var esOptions = function (list, entry) {
    var o = entry && entry.optionsSel ? u.qsa(entry.optionsSel, list) : u.qsa(OPT, list);
    if (!o.length) o = u.qsa(':scope > *', list);
    return o.filter(u.visible);
  };
  var esActive = function (list, opts) {
    var id = u.get(list, 'aria-activedescendant');
    var el = id && document.getElementById(id);
    if (el && opts.indexOf(el) !== -1) return el;
    return opts.filter(function (o) { return u.get(o, 'aria-selected') === 'true'; })[0] || null;
  };
  var esSetActive = function (list, opts, el) {
    opts.forEach(function (o) {
      if (o === el) return;
      if (u.get(o, 'aria-selected') === 'true') u.set(o, 'aria-selected', 'false');
      if (o.hasAttribute('data-u1p-es-outline')) { o.style.outline = o.getAttribute('data-u1p-es-outline'); o.removeAttribute('data-u1p-es-outline'); }
    });
    if (!el) return;
    if (!el.id) el.id = 'u1p-opt-' + Math.random().toString(36).slice(2, 9);
    u.set(list, 'aria-activedescendant', el.id);
    u.set(el, 'aria-selected', 'true');
    if (!el.hasAttribute('data-u1p-es-outline')) {
      el.setAttribute('data-u1p-es-outline', el.style.outline || '');
      el.style.outline = '2px solid Highlight';
      el.style.outlineOffset = '-2px';
    }
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  };
  // Focus belongs on the list. Every focusable inside an option comes out of
  // the tab order (setTabIndex keeps the original for revert), the list gets
  // a tab stop, and a highlight exists from the first moment.
  var esArm = function (list, entry) {
    var opts = esOptions(list, entry);
    if (!opts.length) return;
    u.qsa(u.FOCUSABLE, list).forEach(function (f) { u.setTabIndex(f, -1); });
    if (list.tabIndex < 0 || !list.hasAttribute('tabindex')) u.setTabIndex(list, 0);
    if (!esActive(list, opts)) esSetActive(list, opts, opts[0]);
    if (list.contains(document.activeElement) && document.activeElement !== list) {
      try { list.focus(); } catch (e) {}
    }
  };
  P.correct(function () {
    if (!(P.enterSelects || []).length) return;
    u.qsa('[role="listbox"]').forEach(function (list) {
      var entry = esEntryFor(list);
      if (entry && u.visible(list)) esArm(list, entry);
    });
  });
  // The opening path above (moveIn) puts focus ON AN OPTION; for these lists
  // it must land on the list itself.
  var plainMoveIn = moveIn;
  moveIn = function (trigger, list) {
    var entry = esEntryFor(list);
    if (!entry) return plainMoveIn(trigger, list);
    if (document.activeElement !== trigger) return;
    esArm(list, entry);
    try { list.focus(); } catch (e) {}
  };
  // A stray focus on an option (the site's own script, a mouse click) is
  // pulled back to the list, with that option highlighted.
  document.addEventListener('focusin', function (e) {
    if (!(P.enterSelects || []).length) return;
    var list = u.closest(e.target, '[role="listbox"]');
    if (!list || e.target === list) return;
    var entry = esEntryFor(list);
    if (!entry) return;
    var opts = esOptions(list, entry);
    var opt = opts.filter(function (o) { return o === e.target || o.contains(e.target); })[0];
    if (opt) esSetActive(list, opts, opt);
    try { list.focus(); } catch (err) {}
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!(P.enterSelects || []).length) return;
    if (u.isTyping(e.target)) return;
    var list = u.closest(e.target, '[role="listbox"]');
    if (!list) return;
    var entry = esEntryFor(list);
    if (!entry) return;
    var opts = esOptions(list, entry);
    if (!opts.length) return;
    var cur = esActive(list, opts), here = opts.indexOf(cur), n = opts.length, to = -1;
    if (e.key === 'ArrowDown') to = here === -1 ? 0 : (here + 1) % n;
    else if (e.key === 'ArrowUp') to = here === -1 ? n - 1 : (here - 1 + n) % n;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!cur) return;
      var hits = u.qsa('a[href],button', cur);
      (hits.length === 1 ? hits[0] : cur).click();
      return;
    } else if (e.key === 'Tab') {
      // Leave without choosing. The library's Tab case would click the
      // active option; that is exactly the behaviour this switch removes.
      e.stopImmediatePropagation();
      return;
    } else return;
    e.preventDefault(); e.stopImmediatePropagation();
    esSetActive(list, opts, opts[to]);
    if (document.activeElement !== list) { try { list.focus(); } catch (err) {} }
  }, true);

  // Vertical by default: that is the role's default orientation, and unlike a
  // tablist a listbox that says nothing means Up/Down.
  P.rove('[role="listbox"]', OPT, { arrows: true, vertical: 'auto', orientationDefault: 'vertical' });
  // No `activate` — arrowing through a list of links must not follow them.
})();
//#endregion

//#region u1-patch:carousel
// The library wires roles and the prev/next/picker clicks but has no pause
// mechanism at all — no reference to pause, stop or autoplay anywhere in the
// fixer — so a carousel that advances on its own leaves 2.2.2 unmet.
//
// This used to auto-inject a real <button> into the client's page to close
// that gap. Pulled: a visible, interactively-behaved control is a bigger
// intervention than the attribute-only fixes everywhere else in this file —
// wrong placement, wrong styling, or fighting the site's own pause button (if
// any) is a worse outcome on a real client site than leaving 2.2.2 flagged.
// This is now a static-scan recommendation only (panel.js SCAN_RULES
// 'carousel-nopause') — a human decides where and how a pause control belongs
// on THIS site, U1 does not decide it for them.
//#endregion

//#region u1-patch:loading
// ─────────────────────────────────────────────────────────────────────────────
//  Loading indicators.
//
//  role="meter" is wrong twice over. The spec requires aria-valuenow on it and
//  the library sets none, so the role is invalid as written. And meter
//  describes a static measurement within a known range — a progress indicator
//  is role="progressbar", which is also allowed to carry no value while it is
//  indeterminate.
//
//  Fixing the role alone left it announced as "progress bar" and nothing else:
//  correct role, correct value, NO NAME. Measured, not assumed. A person hears
//  that something is in progress and never learns what — which is most of the
//  information a spinner exists to carry, and is a plain 4.1.2 failure with
//  two of its three parts already in place.
//
//  And a spinner that APPEARS says nothing at all unless something announces
//  it. That is added only for the indeterminate kind: a progressbar with a
//  value re-announces on every change of that value, which turns a download
//  into a stream of interruptions and is worse than silence.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  // The site's own language, because a Hebrew page announcing "Loading" in
  // English is a worse answer than the one it replaces.
  var loadingWord = function () {
    var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (lang.indexOf('he') === 0) return 'טוען';
    if (lang.indexOf('ar') === 0) return 'جارٍ التحميل';
    return 'Loading';
  };

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

    u.qsa('[role="progressbar"]').forEach(function (el) {
      // ── A name ────────────────────────────────────────────────────────────
      // Whatever the page already offers first: its own words always beat ours.
      if (!u.named(el)) {
        var own = (el.textContent || '').replace(/\s+/g, ' ').trim() ||
                  (u.get(el, 'title') || '').trim();
        if (!own) {
          var img = el.querySelector('img[alt],svg title');
          own = img ? ((img.getAttribute && img.getAttribute('alt')) || img.textContent || '').trim() : '';
        }
        u.set(el, 'aria-label', own || loadingWord());
      }

      // ── Announced when it appears ─────────────────────────────────────────
      // Indeterminate only. With a value, every tick would be read out.
      var hasValue = u.get(el, 'aria-valuenow') !== null;
      if (!hasValue && u.get(el, 'aria-live') === null && !u.closest(el, '[aria-live]')) {
        u.set(el, 'aria-live', 'polite');
      }
      // A determinate bar that was given a live region by an earlier pass — or
      // by the page — is taken back out of it, for the same reason.
      if (hasValue && u.get(el, 'aria-live') === 'polite' && el.hasAttribute('aria-label')) {
        el.removeAttribute('aria-live');
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
// ─────────────────────────────────────────────────────────────────────────────
//  Tooltips, and WCAG 1.4.13 Content on Hover or Focus (AA).
//
//  Two defects were written down here and one and a half were left standing.
//  This closes both, and the note that described them is now a description of
//  what is corrected rather than of what is missing.
//
//  1. THE NAME NEVER ARRIVES. The library attaches aria-describedby inside its
//     own onTooltipShow, so the first time a trigger takes focus there is
//     nothing tying the two together and a screen reader announces the control
//     with no description at all. The whole point of a tooltip is the sentence
//     it adds; a tooltip nobody hears is decoration. Tied up front here.
//
//  2. IT IS NOT HOVERABLE. 1.4.13 asks for three things and the library gives
//     one and a half: dismissible with Escape — yes; persistent — mostly; and
//     HOVERABLE — no. The library dismisses on the trigger's mouseout, which
//     fires the moment the pointer leaves the trigger, including when it is
//     moving onto the tooltip to read it. For somebody magnifying the screen,
//     that is a tooltip that cannot be read at all: the text runs off the
//     viewport and reaching for it makes it vanish.
//
//     This took two attempts and the first one is worth recording, because it
//     looked right and did nothing. It recorded the pointer being over the
//     tooltip in a data attribute; that was replaced with a check of the same
//     thing at dismiss time — and the check always answers NO, because the
//     order of events is
//
//         pointer leaves trigger → mouseout → dismissed
//         pointer arrives at tooltip        → nothing there
//
//     The dismissal always precedes the arrival, and there is usually a gap of
//     a few pixels to cross as well. A fix conditioned on having already
//     arrived is inert in precisely the case it exists for.
//
//     What works is a GRACE PERIOD: hold the dismissal long enough to walk
//     there. Landing on the tooltip cancels it; leaving the tooltip sends it at
//     once; never arriving lets it through on its own.
//
//  Everything checks the current state first, so a library that ships its own
//  fix and a page that was already correct are both left alone.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;

  // Long enough to cross the gap between a control and the bubble beside it,
  // short enough that a tooltip left behind does not follow you around the
  // page. The same figure the common tooltip libraries settle on.
  var HOVER_GRACE_MS = 300;

  P.correct(function () {
    u.qsa('[role="tooltip"]').forEach(function (tip) {
      if (!tip.id) tip.id = 'u1p-tip-' + Math.random().toString(36).slice(2, 9);

      // ── 1. Tie it to its trigger, now, not on first show ──────────────────
      //
      // The trigger is whatever already points at this tooltip, or — the usual
      // case, since the page has not been told to point at anything yet — the
      // control it sits beside.
      var trigger = document.querySelector('[aria-describedby~="' + tip.id + '"]');
      if (!trigger) {
        var near = tip.previousElementSibling || (tip.parentElement &&
                   tip.parentElement.querySelector('button,a[href],input,[tabindex]'));
        if (near && near !== tip && !tip.contains(near)) trigger = near;
      }
      if (trigger) {
        var have = (u.get(trigger, 'aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (have.indexOf(tip.id) === -1) {
          have.push(tip.id);
          u.set(trigger, 'aria-describedby', have.join(' '));
        }
        // A tooltip on something a keyboard cannot reach is a tooltip only a
        // mouse ever sees. 1.4.13 is about focus as much as hover.
        if (!/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(trigger.tagName) &&
            trigger.getAttribute('tabindex') === null) {
          u.setTabIndex(trigger, 0);
        }
      }

      // ── 2. Hoverable: a GRACE PERIOD, not a check ─────────────────────────
      //
      // The first version of this swallowed the dismiss only while the pointer
      // was already ON the tooltip, and that is the one moment it cannot help:
      // measured, the real sequence is
      //
      //   pointer leaves trigger  → mouseout fires → tooltip dismissed
      //   pointer arrives at tooltip                → nothing there
      //
      // The dismissal happens BEFORE the arrival, always — and there is usually
      // a gap of a few pixels to cross as well. Asking "is the pointer on the
      // tooltip yet" at that instant always answers no, so the fix was inert in
      // exactly the case it was written for.
      //
      // What actually works is holding the dismissal for long enough to walk
      // there. The event is swallowed and re-sent after a pause; landing on the
      // tooltip inside that pause cancels it, and leaving the tooltip sends it
      // immediately. Nothing else about dismissal changes: Escape, focusout and
      // every other path reach the library untouched.
      if (!tip.__u1pHover) {
        tip.__u1pHover = true;
        var hovering = false, pending = null, passing = false;

        var dismissNow = function () {
          if (pending) { clearTimeout(pending); pending = null; }
          if (!trigger) return;
          try {
            passing = true;    // so the re-sent event is not swallowed again
            trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
          } catch (e) {} finally { passing = false; }
        };

        tip.addEventListener('mouseenter', function () {
          hovering = true;
          if (pending) { clearTimeout(pending); pending = null; }   // made it
        });
        tip.addEventListener('mouseleave', function () {
          hovering = false;
          // Leaving the tooltip itself dismisses it, which is what a person
          // expects and what "persistent until the trigger is left" means.
          dismissNow();
        });

        if (trigger && !trigger.__u1pHold) {
          trigger.__u1pHold = true;
          // Capture phase, so this runs before the library's own handler and
          // can stop the event reaching it.
          ['mouseout', 'mouseleave'].forEach(function (name) {
            trigger.addEventListener(name, function (e) {
              if (passing) return;                 // our own re-sent event
              if (pending) { e.stopImmediatePropagation(); return; }
              e.stopImmediatePropagation();
              pending = setTimeout(function () {
                pending = null;
                if (!hovering) dismissNow();       // never got there — let it go
              }, HOVER_GRACE_MS);
            }, true);
          });
        }
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

//#region u1-patch:focus
// The focus ring U1 draws, on the elements it cannot draw it on.
//
// u1.css paints the ring with `body *:focus { outline … !important }`, and it
// ships a hook for the one shape that ring is wrong on:
//   [data-u1-focus-fix]:focus { display: inline-block !important }
// Nothing in the engine ever sets that attribute (checked: zero references in
// u1_vanilla-js-a11y.js). So an inline <a> wrapping an <img> — every logo on
// every site — gets its outline drawn round the anchor's LINE BOX, which is a
// stripe through the middle of the picture. Photographed on molinahealthcare:
// `<a id="image" href="/"><img …></a>`, a red line across the logo.
//
// Two corrections, both only WHILE FOCUSED and both undone on blur, so the
// page's design is never changed for anyone who is not tabbing through it:
//
//   1. An inline element whose ring would be wrong — it holds an image or a
//      block, or it wraps onto more than one line — gets U1's own attribute,
//      which U1's own CSS turns into an inline-block ring round the whole box.
//
//   2. An element whose popup is OPEN (aria-expanded="true") has that popup
//      painted over one side of its ring — the Sign In button under its
//      dropdown, a menu item under its submenu — because the popup is
//      positioned and stacked above it. The ring is drawn just inside the
//      element's box instead (outline-offset −2px, as an inline !important,
//      which is the only thing that outranks the stylesheet's !important).
//      Re-evaluated after clicks, since the popup opens after focus lands.
//
//   3. An element that FILLS a box with overflow:hidden/clip has its ring
//      cut away by that box: U1 draws 3px solid at offset 2px — entirely
//      outside the element — and molinahealthcare.com's tile links sit
//      edge-to-edge inside `.ButtonTile_buttonTile` (overflow:hidden,
//      radius 8px), so a focused tile showed no ring at all (2026-10-08).
//      The ring is drawn inside instead, offset by its own width.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var FIX = 'data-u1-focus-fix';
  var isEl = function (n) { return n && n.nodeType === 1; };

  var ringIsWrong = function (el) {
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (cs.display !== 'inline') return false;
    try { if (el.getClientRects().length > 1) return true; } catch (e) {}
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i], tag = k.tagName;
      if (tag === 'IMG' || tag === 'SVG' || tag === 'PICTURE' || tag === 'VIDEO' || tag === 'CANVAS') return true;
      var d = '';
      try { d = getComputedStyle(k).display; } catch (e) {}
      if (d === 'block' || d === 'inline-block' || d === 'flex' || d === 'grid' || d === 'table') return true;
    }
    return false;
  };

  var inset = function (el) {
    try { el.style.setProperty('outline-offset', '-2px', 'important'); } catch (e) {}
  };
  var reset = function (el) {
    try {
      el.removeAttribute(FIX);
      if (el.style.getPropertyPriority('outline-offset') === 'important') el.style.removeProperty('outline-offset');
      if (el.hasAttribute('data-u1p-ring-in')) {
        el.removeAttribute('data-u1p-ring-in');
        el.style.removeProperty('box-shadow'); el.style.removeProperty('outline-width');
      }
    } catch (e) {}
  };
  // The ring drawn INSIDE, looking like the one outside. The engine's
  // regular ring is an outline; its DOUBLE ring (visualFocus.doubleBorder)
  // is a 2px outline in the primary colour at offset 0 plus a 4px box-shadow
  // in the secondary colour around it — both outside the box, both clipped.
  // Inside, the same two rings in the same order: secondary at the edge,
  // primary within it (Orel, 2026-10-08: "the same border as the site").
  var ringInside = function (el, w) {
    var bs = document.body && getComputedStyle(document.body);
    var outer = bs ? bs.getPropertyValue('--outer-border').trim() : '';
    if (outer && outer !== 'none') {
      var primary = bs.getPropertyValue('--outline-color').trim() || '#000';
      var secondary = bs.getPropertyValue('--secondary-outline-color').trim() || '#fff';
      el.setAttribute('data-u1p-ring-in', '1');
      el.style.setProperty('outline-width', '0px', 'important');
      el.style.setProperty('box-shadow', 'inset 0 0 0 4px ' + secondary + ', inset 0 0 0 6px ' + primary, 'important');
      return;
    }
    el.style.setProperty('outline-offset', '-' + Math.ceil(w + 1) + 'px', 'important');
  };

  // Would a box that clips its content cut this element's ring away? The ring
  // reaches (offset + width) beyond the element; any clipping ancestor whose
  // edge is closer than that on some side eats it there.
  var clippedRing = function (el) {
    var cs, r;
    try { cs = getComputedStyle(el); r = el.getBoundingClientRect(); } catch (e) { return 0; }
    var w = parseFloat(cs.outlineWidth) || 3, off = parseFloat(cs.outlineOffset) || 0;
    // The double ring's outer 4px box-shadow reaches further than the outline.
    var shadowReach = 0;
    try { var bsx = getComputedStyle(document.body).getPropertyValue('--outer-border').trim(); var m = /0 0 0 (\d+)px/.exec(bsx); if (m) shadowReach = +m[1]; } catch (e) {}
    var reach = Math.max(1, w + Math.max(0, off), shadowReach);
    for (var a = el.parentElement, i = 0; a && a !== document.body && i < 6; a = a.parentElement, i++) {
      var as;
      try { as = getComputedStyle(a); } catch (e) { continue; }
      if (!/hidden|clip|auto|scroll/.test(as.overflow + ' ' + as.overflowX + ' ' + as.overflowY)) continue;
      var ar = a.getBoundingClientRect();
      if (r.left - ar.left < reach || ar.right - r.right < reach || r.top - ar.top < reach || ar.bottom - r.bottom < reach) return w;
    }
    return 0;
  };
  //   4. A control the site draws with SOMETHING ELSE — a checkbox that is
  //      0×0 at opacity 0 behind a styled <span class="checkmark"> inside its
  //      <label> (molinahealthcare.com's blog filter, 2026-10-08) — gets its
  //      ring on what is seen: its label, else the nearest ancestor with a
  //      box. Same colours as the engine's ring; undone on blur.
  var PROXY = 'data-u1p-ring-proxy';
  var noBox = function (el) {
    var cs, r;
    try { cs = getComputedStyle(el); r = el.getBoundingClientRect(); } catch (e) { return false; }
    if (r.width < 2 || r.height < 2) return true;
    if (parseFloat(cs.opacity) === 0 || cs.visibility === 'hidden') return true;
    if (/rect\(0(px)?,? ?0(px)?,? ?0(px)?,? ?0(px)?\)/.test(cs.clip) || /inset\(50%\)/.test(cs.clipPath)) return true;
    return false;
  };
  var proxyOf = function (el) {
    var cands = [];
    if (el.labels && el.labels.length) cands.push(el.labels[0]);
    var lab = el.closest && el.closest('label'); if (lab) cands.push(lab);
    for (var a = el.parentElement, i = 0; a && a !== document.body && i < 3; a = a.parentElement, i++) cands.push(a);
    for (var k = 0; k < cands.length; k++) if (!noBox(cands[k])) return cands[k];
    return null;
  };
  var ringOn = function (px) {
    var bs = document.body && getComputedStyle(document.body);
    var primary = (bs && bs.getPropertyValue('--outline-color').trim()) || '#1a73e8';
    var outer = bs ? bs.getPropertyValue('--outer-border').trim() : '';
    px.setAttribute(PROXY, JSON.stringify({ o: px.style.getPropertyValue('outline'), oo: px.style.getPropertyValue('outline-offset'), bs: px.style.getPropertyValue('box-shadow') }));
    if (outer && outer !== 'none') {
      px.style.setProperty('outline', '2px solid ' + primary, 'important');
      px.style.setProperty('outline-offset', '0px', 'important');
      px.style.setProperty('box-shadow', outer, 'important');
    } else {
      px.style.setProperty('outline', '3px solid ' + primary, 'important');
      px.style.setProperty('outline-offset', '2px', 'important');
    }
  };
  var ringOff = function () {
    Array.prototype.forEach.call(document.querySelectorAll('[' + PROXY + ']'), function (px) {
      var was = {}; try { was = JSON.parse(px.getAttribute(PROXY)) || {}; } catch (e) {}
      px.removeAttribute(PROXY);
      ['outline', 'outline-offset', 'box-shadow'].forEach(function (p, i) {
        var v = [was.o, was.oo, was.bs][i];
        if (v) px.style.setProperty(p, v); else px.style.removeProperty(p);
      });
    });
  };
  var evaluate = function (el) {
    if (!isEl(el) || el === document.body || el === document.documentElement) return;
    ringOff();
    if (noBox(el)) { var px = proxyOf(el); if (px) { try { ringOn(px); } catch (e) {} } return; }
    if (ringIsWrong(el)) el.setAttribute(FIX, 'true');
    if (el.getAttribute('aria-expanded') === 'true') { inset(el); return; }
    var cw = clippedRing(el);
    if (cw) { try { ringInside(el, cw); } catch (e) {} return; }
    if (el.style.getPropertyPriority('outline-offset') === 'important') el.style.removeProperty('outline-offset');
  };

  document.addEventListener('focusin', function (e) { evaluate(e.target); }, true);
  document.addEventListener('focusout', function (e) { if (isEl(e.target)) reset(e.target); ringOff(); }, true);
  // The popup opens AFTER the click that focused the trigger, and after its
  // animation. Look again then.
  document.addEventListener('click', function () {
    setTimeout(function () { evaluate(document.activeElement); }, 50);
    setTimeout(function () { evaluate(document.activeElement); }, 600);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return;
    setTimeout(function () { evaluate(document.activeElement); }, 50);
    setTimeout(function () { evaluate(document.activeElement); }, 600);
  }, true);

  P.focusRing = { evaluate: evaluate, ringIsWrong: ringIsWrong, clippedRing: clippedRing, proxyOf: proxyOf };
})();
//#endregion

//#region u1-patch:statics
// Static corrections chosen from the scan report.
//
// These are not U1 components — nothing here calls u1.fix.*. They are the
// faults the report finds by the dozen, where the answer is the same for every
// one of them and the only reason it took forty decisions was that there was no
// way to say "all of these".
//
// Written as correctors so they inherit what correctors already give: they run
// on the MutationObserver schedule, so a page that builds itself after load is
// still covered; they check before they write, so running twice is running
// once; and they go quiet on their own the day the site is fixed properly.
//
// Each is switched on by an entry in window.__u1Statics, which the generated
// bundle sets before this runs. Nothing here fires unless it was asked for.
(function () {
  var P = window.__u1Patch; if (!P) return;
  var u = P.util;
  var on = function (rule) {
    var s = window.__u1Statics;
    return !!(s && s[rule]);
  };

  // ── Not reachable: not by Tab, not by a screen reader ────────────────────
  //
  // Both halves are required, so `inert` is the answer where it exists — one
  // attribute that takes the subtree out of the tab order, out of the
  // accessibility tree and out of pointer events, with no way for the three to
  // disagree.
  //
  // The fallback has to do all three by hand, and must not stop half way:
  // aria-hidden on something still focusable is a WCAG failure of its own — the
  // scan's own `aria-hidden-focusable` — so the tabindex sweep is not optional.
  var INERT_OK = 'inert' in document.createElement('div');
  P.correct(function () {
    if (!on('exclude')) return;
    var sel = (window.__u1Statics.exclude || {}).selector;
    if (!sel) return;
    u.qsa(sel).forEach(function (el) {
      if (INERT_OK) {
        if (!el.hasAttribute('inert')) el.setAttribute('inert', '');
        return;
      }
      u.set(el, 'aria-hidden', 'true');
      // Everything focusable inside it, and the element itself.
      var all = u.qsa(u.FOCUSABLE, el);
      if (el.matches && el.matches(u.FOCUSABLE)) all.push(el);
      all.forEach(function (f) {
        if (f.tabIndex !== -1) u.setTabIndex(f, -1);
      });
    });
  });

  // ── tabindex-positive ────────────────────────────────────────────────────
  // A positive tabindex takes an element out of document order and puts it in
  // front of everything, for everyone, for the rest of the page. 0 keeps it
  // focusable and puts it back where it visually is.
  P.correct(function () {
    if (!on('tabindex-positive')) return;
    u.qsa('[tabindex]').forEach(function (el) {
      var v = parseInt(u.get(el, 'tabindex'), 10);
      if (v > 0) u.setTabIndex(el, 0);
    });
  });

  // ── aria-ref-broken ──────────────────────────────────────────────────────
  // An aria-labelledby pointing at an id that is not on the page does not fall
  // back to the element's own text — it names it nothing. Dropping the dangling
  // reference is what restores the name it would otherwise have had.
  P.correct(function () {
    if (!on('aria-ref-broken')) return;
    ['aria-labelledby', 'aria-describedby'].forEach(function (attr) {
      u.qsa('[' + attr + ']').forEach(function (el) {
        var ids = (u.get(el, attr) || '').split(/\s+/).filter(Boolean);
        var live = ids.filter(function (id) { return !!document.getElementById(id); });
        if (live.length === ids.length) return;              // nothing to do
        if (live.length) u.set(el, attr, live.join(' '));
        else el.removeAttribute(attr);
      });
    });
  });

  // ── input-placeholder ────────────────────────────────────────────────────
  // A placeholder is not a label: it disappears the moment there is a value,
  // and several screen readers never announce it. But the text is already
  // written, so this needs nobody to author anything — it promotes what is
  // there. Only when the field has no name by any other route.
  P.correct(function () {
    if (!on('input-placeholder')) return;
    u.qsa('input[placeholder], textarea[placeholder]').forEach(function (f) {
      if (f.type === 'hidden' || f.disabled) return;
      if (u.get(f, 'aria-label') || u.get(f, 'aria-labelledby')) return;
      if (f.labels && f.labels.length) return;
      if (u.closest(f, 'label')) return;
      var ph = (f.getAttribute('placeholder') || '').trim();
      if (ph) u.set(f, 'aria-label', ph);
    });
  });

  // ── table-noheaders ──────────────────────────────────────────────────────
  // A data table whose first row is cells has no headers, so every cell is
  // announced without the column it belongs to. Only for a table that looks
  // like data — one with a single row or column is a layout table, and giving
  // it headers is a different kind of wrong.
  P.correct(function () {
    if (!on('table-noheaders')) return;
    u.qsa('table').forEach(function (t) {
      if (t.querySelector('th')) return;
      var rows = u.qsa('tr', t);
      if (rows.length < 2) return;
      var first = u.qsa('td', rows[0]);
      if (first.length < 2) return;
      first.forEach(function (td) {
        var th = document.createElement('th');
        th.setAttribute('scope', 'col');
        while (td.firstChild) th.appendChild(td.firstChild);
        for (var i = 0; i < td.attributes.length; i++) {
          th.setAttribute(td.attributes[i].name, td.attributes[i].value);
        }
        td.parentNode.replaceChild(th, td);
      });
    });
  });

  // ── button-symbol-name ───────────────────────────────────────────────────
  // molinahealthcare.com's text-size control (2026-10-05): two buttons named
  // "-" and "+", an "AA" glyph between them, the "-" disabled by a CLASS
  // only, and nothing said when the size changed. A screen reader hears
  // "dash, button" and "plus, button", and the disabled one as usable.
  // The symbols and their neighbours say what the controls are:
  //   +/- beside an A/AA glyph, or in a container whose class says font or
  //   text size → Increase / Decrease text size, grouped under "Text size",
  //   a class-only disabled state mirrored as aria-disabled, and the new
  //   size announced politely on each press.
  //   ‹ › < > « » → Previous / Next.
  // The visible glyph is untouched; only the name a screen reader hears.
  var SYM = {
    en: { inc: 'Increase text size', dec: 'Decrease text size', group: 'Text size', size: 'Text size now {n}', prev: 'Previous', next: 'Next' },
    he: { inc: 'הגדלת גודל הטקסט', dec: 'הקטנת גודל הטקסט', group: 'גודל טקסט', size: 'גודל הטקסט כעת {n}', prev: 'הקודם', next: 'הבא' },
    es: { inc: 'Aumentar el tamaño del texto', dec: 'Reducir el tamaño del texto', group: 'Tamaño del texto', size: 'Tamaño del texto ahora {n}', prev: 'Anterior', next: 'Siguiente' },
    fr: { inc: 'Augmenter la taille du texte', dec: 'Réduire la taille du texte', group: 'Taille du texte', size: 'Taille du texte : {n}', prev: 'Précédent', next: 'Suivant' },
    ar: { inc: 'تكبير حجم النص', dec: 'تصغير حجم النص', group: 'حجم النص', size: 'حجم النص الآن {n}', prev: 'السابق', next: 'التالي' },
    ru: { inc: 'Увеличить размер текста', dec: 'Уменьшить размер текста', group: 'Размер текста', size: 'Размер текста: {n}', prev: 'Назад', next: 'Далее' },
  };
  var symWords = function () {
    var lang = ((document.documentElement.getAttribute('lang') || 'en').slice(0, 2)).toLowerCase();
    return SYM[lang] || SYM.en;
  };
  var symFace = function (el) {
    return (u.get(el, 'aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  };
  var isTextSizeContext = function (el) {
    var box = el.parentElement;
    if (!box) return false;
    if (/font|text-?size|fontsize|textsize|zoom/i.test(String(box.className || '') + ' ' + (box.id || ''))) return true;
    var kids = box.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] !== el && /^[aA]{1,2}$/.test((kids[i].textContent || '').replace(/\s+/g, '').trim())) return true;
    }
    return false;
  };
  var symLive = null;
  var announceSize = function () {
    if (!symLive) {
      symLive = document.createElement('div');
      symLive.id = 'u1p-text-size-live';
      symLive.setAttribute('role', 'status');
      symLive.setAttribute('aria-live', 'polite');
      symLive.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
      document.body.appendChild(symLive);
    }
    setTimeout(function () {
      var n = '';
      try { n = getComputedStyle(document.body).fontSize; } catch (e) {}
      var msg = symWords().size.replace('{n}', n);
      symLive.textContent = '';
      setTimeout(function () { symLive.textContent = msg; }, 30);
    }, 120);
  };
  P.correct(function () {
    if (!on('button-symbol-name')) return;
    var w = symWords();
    u.qsa('button,[role="button"],a[href]').forEach(function (el) {
      var face = symFace(el);
      var orig = u.get(el, 'data-u1p-symbol') || face;
      if (!/^(\+|[-−–]|[<>«»‹›]{1,2})$/.test(orig)) return;
      if (!u.get(el, 'data-u1p-symbol')) el.setAttribute('data-u1p-symbol', orig);
      var name = null;
      if (/^\+$/.test(orig) && isTextSizeContext(el)) name = w.inc;
      else if (/^[-−–]$/.test(orig) && isTextSizeContext(el)) name = w.dec;
      else if (/^[<‹«]{1,2}$/.test(orig)) name = w.prev;
      else if (/^[>›»]{1,2}$/.test(orig)) name = w.next;
      if (!name) return;
      u.set(el, 'aria-label', name);
      if (name === w.inc || name === w.dec) {
        var box = el.parentElement;
        if (box && !u.get(box, 'role')) { u.set(box, 'role', 'group'); if (!u.get(box, 'aria-label')) u.set(box, 'aria-label', w.group); }
        // Disabled by a class alone: say so.
        var off = /(^|\s)[\w-]*disabled[\w-]*(\s|$)/i.test(String(el.className || '')) || el.disabled;
        u.set(el, 'aria-disabled', off ? 'true' : 'false');
        if (!el.__u1pSizeWired) {
          el.__u1pSizeWired = true;
          el.addEventListener('click', announceSize);
        }
      }
    });
  });

  // ── link-newwindow ───────────────────────────────────────────────────────
  // A link that opens a new tab says so in its name, in the page's language.
  // Only when the name does not already say it, and by extending the name the
  // link already has — never replacing it.
  var NEW_TAB = {
    he: 'נפתח בכרטיסייה חדשה', ar: 'يفتح في علامة تبويب جديدة', ru: 'открывается в новой вкладке',
    fr: 'ouvre dans un nouvel onglet', es: 'se abre en una pestaña nueva', de: 'öffnet in neuem Tab', en: 'opens in a new tab',
  };
  var SAYS_NEW_TAB = /new (tab|window)|opens? in|external|חלון חדש|לשונית חדשה|כרטיסייה חדשה|nouvel onglet|pestaña nueva|neuem tab|новой вкладке|علامة تبويب جديدة/i;
  P.correct(function () {
    if (!on('link-newwindow')) return;
    var lang = ((document.documentElement.getAttribute('lang') || 'en').slice(0, 2)).toLowerCase();
    var phrase = NEW_TAB[lang] || NEW_TAB.en;
    u.qsa('a[href][target="_blank"]').forEach(function (a) {
      // Judged by CONTENT on every pass, never by a "done" marker: an
      // aria-label mapping on the same link ("Learn More about Molina in the
      // Community") rewrites the name after this ran, and the marker then
      // kept the phrase off for good — seen on molinahealthcare.com. Whatever
      // wrote the name last, the phrase is put back if it is missing.
      var name = u.get(a, 'aria-label') || (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!name) {
        var img = a.querySelector('img[alt],[aria-label]');
        name = img ? (img.getAttribute('alt') || img.getAttribute('aria-label') || '').trim() : '';
      }
      if (!name) return;                              // a nameless link is a different fault
      if (SAYS_NEW_TAB.test(name + ' ' + (a.getAttribute('title') || ''))) return;
      a.setAttribute('data-u1p-newtab', '1');
      u.set(a, 'aria-label', name + ' (' + phrase + ')');
    });
  });

  // ── contrast ─────────────────────────────────────────────────────────────
  // Text too faint against its background. The scan groups the findings by
  // colour pair and the person approves one darker shade per pair; that lands
  // here as a rule list — { selectors: [...], color: '#0b6e70' } — and becomes
  // one <style> the bundle owns. A stylesheet, not inline styles: it survives
  // re-renders, and removing the mapping removes every trace at once.
  P.correct(function () {
    if (!on('contrast')) return;
    var rules = (window.__u1Statics.contrast || {}).rules;
    if (!Array.isArray(rules) || !rules.length) return;
    var css = rules.map(function (r) {
      var sels = (r.selectors || []).filter(function (x) { return typeof x === 'string' && x; });
      if (!sels.length || !r.color) return '';
      return sels.join(',\n') + ' { color: ' + r.color + ' !important; }';
    }).filter(Boolean).join('\n');
    var st = document.getElementById('u1p-contrast');
    if (!st) { st = document.createElement('style'); st.id = 'u1p-contrast'; (document.head || document.documentElement).appendChild(st); }
    if (st.textContent !== css) st.textContent = css;
  });

  // ── landmark-noname ──────────────────────────────────────────────────────
  // role="form" / role="region" with no name is not a landmark a screen
  // reader lists. The name is on the page already: a search container becomes
  // role="search" (named after its field); anything else takes the heading or
  // the first field's label inside it.
  var SEARCHY = /search|חיפוש|بحث|поиск|buscar|recherche|suche/i;
  P.correct(function () {
    if (!on('landmark-noname')) return;
    u.qsa('[role="form"],[role="region"]').forEach(function (el) {
      if (u.get(el, 'aria-label') || u.get(el, 'aria-labelledby')) return;
      var field = el.querySelector('input:not([type=hidden]),select,textarea');
      var fieldLabel = '';
      if (field) {
        var lab = field.id ? document.querySelector('label[for="' + field.id + '"]') : null;
        fieldLabel = (lab && lab.textContent.trim()) || field.getAttribute('aria-label') || field.getAttribute('placeholder') || '';
      }
      var searchy = field && (field.type === 'search' || SEARCHY.test(field.name || '') || SEARCHY.test(field.id || '') || SEARCHY.test(fieldLabel));
      // role=search only where the role is ours to change. A container the
      // engine manages (a `form` mapping wrote role="form" and stamps
      // u1st-avoid-change-detection) gets its role rewritten by the engine on
      // every tick; fighting that flickers. It keeps role=form and gets the
      // NAME — a named form around the search field is what the scan then
      // counts as the search landmark.
      if (searchy && u.get(el, 'role') === 'form' && !el.hasAttribute('u1st-avoid-change-detection')) u.set(el, 'role', 'search');
      var heading = el.querySelector('h1,h2,h3,h4,h5,h6,legend');
      if (heading && heading.textContent.trim()) {
        if (!heading.id) heading.id = 'u1p-lm-' + Math.random().toString(36).slice(2, 8);
        u.set(el, 'aria-labelledby', heading.id);
        return;
      }
      var name = fieldLabel.replace(/\s+/g, ' ').trim();
      if (name) u.set(el, 'aria-label', name);
    });
  });

  // ── list-stray-br ────────────────────────────────────────────────────────
  // A <br> (or an empty spacer) sitting directly inside a <ul>/<ol> makes a
  // screen reader miscount the items. The fix is not to rebuild the list: the
  // stray node is hidden from the accessibility tree and the list reads right.
  P.correct(function () {
    if (!on('list-stray-br')) return;
    u.qsa('ul, ol').forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (kid) {
        var tag = kid.tagName;
        if (tag === 'LI' || tag === 'SCRIPT' || tag === 'TEMPLATE') return;
        var empty = tag === 'BR' || tag === 'HR' || (!(kid.textContent || '').trim() && !kid.querySelector('img,svg,a,button,input,li'));
        if (empty && u.get(kid, 'aria-hidden') !== 'true') u.set(kid, 'aria-hidden', 'true');
      });
    });
  });

  // ── zoom-disabled ────────────────────────────────────────────────────────
  // user-scalable=no and a maximum-scale below 2 stop a person enlarging the
  // page. Not a corrector: the viewport meta is read once by the browser, so
  // re-running it every mutation is work with no effect.
  if (on('zoom-disabled')) {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      var content = (vp.getAttribute('content') || '')
        .split(',').map(function (x) { return x.trim(); })
        .filter(function (x) { return x && !/^(user-scalable|maximum-scale)\s*=/.test(x); });
      content.push('user-scalable=yes', 'maximum-scale=5');
      vp.setAttribute('content', content.join(', '));
    }
  }

  // ── autoplay-audio ───────────────────────────────────────────────────────
  // Sound that starts on its own has to be stoppable, and the surest way is for
  // it not to start. The control stays — this removes the autostart, not the
  // media.
  P.correct(function () {
    if (!on('autoplay-audio')) return;
    u.qsa('audio[autoplay], video[autoplay]').forEach(function (m) {
      m.removeAttribute('autoplay');
      m.autoplay = false;
      if (!m.paused && !m.__u1pPaused) { m.__u1pPaused = true; try { m.pause(); } catch (e) {} }
      if (!m.hasAttribute('controls')) m.setAttribute('controls', '');
    });
  });

  // ── filter-results ───────────────────────────────────────────────────────
  //
  // A field that filters a list already on the page. NOT a combobox: an ARIA
  // combobox has a popup that opens and closes, and this list is always there.
  // role="combobox" plus aria-expanded would describe a control that does not
  // exist and leave a screen reader waiting for a popup that never comes.
  //
  // What is actually missing is WCAG 4.1.3. You type a letter, fourteen
  // branches become two, and nothing says so — the change is only visible.
  // So: tie the field to the list it controls, and announce the count as it
  // changes.
  P.correct(function () {
    if (!on('filter-results')) return;
    var cfg = window.__u1Statics['filter-results'] || {};
    if (!cfg.field || !cfg.results) return;
    u.qsa(cfg.field).forEach(function (field) {
      var list = document.querySelector(cfg.results);
      if (!list) return;

      if (!list.id) list.id = 'u1p-results-' + Math.random().toString(36).slice(2, 9);
      u.set(field, 'aria-controls', list.id);

      // The status lives BESIDE the list, not on it. Making the list itself a
      // live region re-announces every result on every keystroke, which is
      // worse than silence — a count is the useful sentence.
      // Keyed on the LIST, not on the field. With one text box those are the
      // same thing; with a filter bar of five selects, keying it on the field
      // inserts five hidden status regions beside one list and every one of
      // them announces on every change — so a screen reader hears the count
      // five times. Found by extending this to selects, which is the first
      // time more than one field ever pointed at the same list.
      var say = list.__u1pSay;
      if (!say) {
        say = document.createElement('div');
        say.className = 'u1p-filter-status';
        say.setAttribute('role', 'status');
        say.setAttribute('aria-live', 'polite');
        say.style.cssText =
          'position:absolute;width:1px;height:1px;overflow:hidden;' +
          'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';
        list.parentNode.insertBefore(say, list);
        list.__u1pSay = say;
      }

      var visible = function () {
        return u.qsa(cfg.item, list).filter(u.visible).length;
      };
      var report = function () {
        var n = visible();
        if (say.__u1pLast === n) return;      // only when it has actually moved
        say.__u1pLast = n;
        var word = cfg.noun || 'result';
        // "2 branchs" is the kind of thing a screen reader reads aloud, so the
        // plural is worth getting right rather than adding an s and hoping.
        var many = /(s|x|z|ch|sh)$/i.test(word) ? word + 'es'
                 : /[^aeiou]y$/i.test(word) ? word.slice(0, -1) + 'ies'
                 : word + 's';
        say.textContent = n === 0
          ? ('No ' + many + ' match')
          : (n + ' ' + (n === 1 ? word : many));
      };

      if (!field.__u1pFilter) {
        field.__u1pFilter = true;
        // The page does its own filtering first; this runs after it, so the
        // count is of what is left rather than what was there.
        //
        // BOTH events. `input` is what a text box fires and was all this
        // listened for. A dropdown and a checkbox fire `change` and nothing
        // else, so a filter bar built out of selects — which is most of the
        // filter bars there are — announced nothing at all.
        var after = function () {
          (W.requestAnimationFrame || setTimeout)(function () { report(); }, 0);
        };
        field.addEventListener('input', after);
        field.addEventListener('change', after);
      }
      report();
    });
  });

  // ── lang-missing ─────────────────────────────────────────────────────────
  // Without it a screen reader reads the page in whatever voice it was last
  // set to — Hebrew content in an English voice is unintelligible rather than
  // merely wrong. One value, chosen once, so it is read from config.
  if (on('lang-missing')) {
    var code = (window.__u1Statics['lang-missing'] || {}).lang;
    if (code && !document.documentElement.getAttribute('lang')) {
      document.documentElement.setAttribute('lang', code);
    }
  }
})();
//#endregion

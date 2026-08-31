// ─────────────────────────────────────────────────────────────────────────────
//  probe.js — find out what a component IS by operating it.
//
//  Everything else in this tool reads the page: a tag, a role, a class name.
//  That works on a page that labels itself and returns nothing at all on one
//  that does not — measured, not guessed: the same page scores 100% with its
//  labels and 0% with them stripped, and no further list of class names can
//  close that, because there are no names left to list.
//
//  So this asks a different question. Not "what are you called" — which a page
//  can decline to answer — but "what do you do", which it cannot. Press a thing;
//  watch what appears. The element that opened is the panel, the element pressed
//  is the trigger, and neither fact needed a name.
//
//  That also produces, for free, the part that is most often wrong today: the
//  FIELD MAPPING. `triggers` and `submenus` are guessed from class names now,
//  and a wrong guess is what "applied, and nothing happened" actually is.
//
//  ── This clicks things on somebody's live site, so: ────────────────────────
//
//  Three layers, and the second one is the one that matters, because it does
//  not depend on the first being right:
//
//    1. A blocklist — never press a submit, a real link, or anything whose
//       words suggest it deletes, pays or sends.
//    2. A net under the whole run: while probing, a capture-phase listener
//       cancels navigation and form submission for EVERY element, and
//       window.open is stubbed. The page's own handlers still run, so the
//       widget still opens; only leaving the page is prevented. If layer 1
//       misjudges something, this still holds.
//    3. Put it back: press again, then Escape. If the page did not return to
//       the state it started in, that is recorded and probing of that
//       component stops. Nothing is ever reloaded behind your back.
// ─────────────────────────────────────────────────────────────────────────────
(function (root) {
  'use strict';
  if (root.__u1Probe) return;

  var doc = root.document;

  // ── Layer 1: what must never be pressed ────────────────────────────────────
  //
  // Words in the user's language, not the developer's — this is read off the
  // button's face, which is the only place a "Delete account" announces itself
  // when the class is called `c4b`.
  var DANGER = new RegExp([
    'delete', 'remove', 'discard', 'destroy', 'clear all',
    'pay', 'buy', 'checkout', 'order now', 'place order', 'purchase',
    'add to cart', 'add to bag', 'subscribe', 'sign up', 'register',
    'log ?out', 'sign ?out', 'confirm', 'send', 'submit', 'apply',
    'unsubscribe', 'cancel (order|subscription)', 'download',
    // Hebrew — the sites this runs on are as often in Hebrew as English.
    'מחק', 'הסר', 'שלם', 'תשלום', 'לתשלום', 'הזמן', 'קנה', 'רכישה',
    'הוסף לסל', 'לסל', 'הרשמה', 'הירשם', 'התנתק', 'יציאה', 'אשר',
    'שלח', 'שליחה', 'בטל', 'הורד',
  ].join('|'), 'i');

  function faceOf(el) {
    return ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) ||
            el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  /**
   * May this element be pressed? Returns a reason when not, so a component that
   * is skipped can say why rather than silently going missing.
   */
  function safeToClick(el, opts) {
    opts = opts || {};
    if (!el || el.nodeType !== 1) return { ok: false, why: 'not an element' };
    var tag = el.tagName.toLowerCase();

    // A TARGETED open trusts its caller. The sweep presses strangers, and for
    // strangers the label and the href are the only evidence there is. But a
    // caller opening ONE named component already holds better evidence: the
    // mapping calls it a disclosure widget — a listbox, a menu, a dialog
    // trigger — and the net is armed, which cancels navigation, submits and
    // the network. Under those two facts "Register" on a sign-in drop-down is
    // a misread, not a danger, and refusing it is how the same card comes
    // back unmappable run after run. The refusals that stay are the ones the
    // net cannot contain: a file picker's native dialog, a download, a
    // disabled control.
    var trusted = !!opts.trustDisclosure;

    if (tag === 'a') {
      var href = el.getAttribute('href') || '';
      // An in-page anchor or a JS hook is fine. A real destination is not: the
      // net below would cancel it, but a link is a link and there is nothing
      // to learn by pressing one — unless the caller says this link is a
      // drop-down trigger wearing an href, which is the ordinary way sites
      // build them.
      if (!trusted && href && !/^#/.test(href) && !/^javascript:/i.test(href)) {
        return { ok: false, why: 'a link to another page' };
      }
      if (el.hasAttribute('download')) {
        return { ok: false, why: 'opens or downloads elsewhere' };
      }
      if (!trusted && el.getAttribute('target') === '_blank') {
        return { ok: false, why: 'opens or downloads elsewhere' };
      }
    }

    var type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'submit' || type === 'reset' || type === 'file') {
      return { ok: false, why: 'a ' + type + ' control' };
    }
    // A <button> inside a form with no type IS a submit — the default nobody
    // remembers, and the single likeliest way to post a stranger's form. The
    // armed net cancels the submit event, so a trusted open may press it.
    if (!trusted && tag === 'button' && !type && el.closest && el.closest('form')) {
      return { ok: false, why: 'an untyped button in a form, which submits' };
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
      return { ok: false, why: 'disabled' };
    }
    if (!trusted && DANGER.test(faceOf(el))) {
      return { ok: false, why: 'its label reads as an action, not a disclosure' };
    }
    return { ok: true, why: '' };
  }

  // ── Layer 2: the net ───────────────────────────────────────────────────────
  //
  // Installed for the duration of a run, removed after. It does NOT stop the
  // page's own handlers — the widget must still open, or there is nothing to
  // observe. It stops the page LEAVING.
  var net = null;

  function armNet() {
    if (net) return net;
    var onClick = function (e) {
      // EVERY link, including an in-page one. A `href="#deals"` does not leave
      // the page, but it does move it — and a sweep that is walking the page a
      // screenful at a time works from the current scroll position, so one
      // anchor jump sends it wandering. It revisited the same screens and
      // reported forty-two of them on a page that has twenty.
      //
      // The page's own handler still runs; only the jump is cancelled.
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (a && a.getAttribute('href')) e.preventDefault();
    };
    var onSubmit = function (e) { e.preventDefault(); };
    var onLeave = function (e) { e.preventDefault(); e.returnValue = ''; return ''; };

    // Capture phase and LAST argument true: this runs before the page's own
    // listeners, and preventDefault survives whatever they do afterwards
    // because it is the default action being cancelled, not the dispatch.
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('submit', onSubmit, true);
    root.addEventListener('beforeunload', onLeave, true);

    var openWas = root.open;
    try { root.open = function () { return null; }; } catch (e) {}

    // Cancelling the click's default action stops a LINK from navigating. It
    // does nothing about a page whose own handler navigates in script —
    // `location.href = '/search'`, `location.assign(...)`, or an SPA router
    // calling history.pushState. Those run as the handler's own work, not as
    // the click's default, so preventDefault never sees them.
    //
    // Reported from elal.com: pressing things during the survey landed on
    // עמוד חיפוש, and the walk carried on measuring a page that was no longer
    // the one being surveyed.
    //
    // These are functions, so they can be replaced for the duration and put
    // back afterwards. `location.href = …` is a setter on a host object and
    // cannot be, which is why the panel ALSO watches the URL and recovers —
    // this layer narrows the hole rather than closing it.
    var loc = root.location, hist = root.history;
    var assignWas = loc && loc.assign, replaceWas = loc && loc.replace;
    var pushWas = hist && hist.pushState, replStateWas = hist && hist.replaceState;
    var blocked = [];
    var note = function (where, url) { blocked.push(where + ' ' + String(url || '')); };
    try { loc.assign = function (u) { note('location.assign', u); }; } catch (e) {}
    try { loc.replace = function (u) { note('location.replace', u); }; } catch (e) {}
    try { hist.pushState = function (s, t, u) { note('history.pushState', u); }; } catch (e) {}
    try { hist.replaceState = function (s, t, u) { note('history.replaceState', u); }; } catch (e) {}
    // Nothing leaves over the NETWORK either, and this is what makes pressing a
    // submit button defensible at all.
    //
    // Cancelling the submit event stops a form POSTing the old way. It does
    // nothing about a form that sends itself with fetch from a click handler,
    // which is how most of them are written now — and probing forms means
    // deliberately pressing the one control on the page whose whole purpose is
    // to send a stranger's data somewhere. An empty form usually fails its own
    // validation before it gets that far; "usually" is not a guarantee anybody
    // should be offering about somebody else's site.
    //
    // So: while the net is armed, requests do not go out. Each stub rejects or
    // no-ops the way a blocked request would, so the page's own error handling
    // runs rather than the page hanging on a promise that never settles.
    var fetchWas = root.fetch;
    var xhrWas = root.XMLHttpRequest && root.XMLHttpRequest.prototype.send;
    var beaconWas = root.navigator && root.navigator.sendBeacon;
    try {
      if (fetchWas) {
        root.fetch = function () {
          return Promise.reject(new Error('blocked while U1 Studio is inspecting this page'));
        };
      }
      if (xhrWas) {
        root.XMLHttpRequest.prototype.send = function () {
          var self = this;
          setTimeout(function () {
            try { self.dispatchEvent(new root.Event('error')); } catch (e) {}
          }, 0);
        };
      }
      if (beaconWas) root.navigator.sendBeacon = function () { return false; };
    } catch (e) {}

    net = {
      // What was stopped, so a survey can say "this page tried to navigate
      // seven times" rather than leaving it invisible.
      blocked: blocked,
      disarm: function () {
        doc.removeEventListener('click', onClick, true);
        doc.removeEventListener('submit', onSubmit, true);
        root.removeEventListener('beforeunload', onLeave, true);
        try { root.open = openWas; } catch (e) {}
        try { if (assignWas) loc.assign = assignWas; } catch (e) {}
        try { if (replaceWas) loc.replace = replaceWas; } catch (e) {}
        try { if (pushWas) hist.pushState = pushWas; } catch (e) {}
        try { if (replStateWas) hist.replaceState = replStateWas; } catch (e) {}
        try {
          if (fetchWas) root.fetch = fetchWas;
          if (xhrWas) root.XMLHttpRequest.prototype.send = xhrWas;
          if (beaconWas) root.navigator.sendBeacon = beaconWas;
        } catch (e) {}
        net = null;
        // What was stopped, handed back at last. The comment beside `blocked`
        // promised "this page tried to navigate seven times" and for a year
        // nothing ever read it — disarm returned undefined and the report
        // did not exist.
        return blocked;
      },
    };
    return net;
  }

  // ── Snapshots ──────────────────────────────────────────────────────────────
  //
  // Not the HTML — a fingerprint of the things that change when something
  // opens. Comparing markup would flag every re-rendered price and every
  // animation frame; this flags appearing and disappearing, which is what a
  // disclosure actually does.
  var STATE_ATTRS = ['hidden', 'aria-expanded', 'aria-selected', 'aria-hidden',
                     'aria-current', 'open', 'checked', 'inert'];

  var FIELD_SEL = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea';

  /**
   * The classes on a set of elements, read separately from `fingerprint`.
   *
   * A class toggle is how most sites actually say open/closed — `.is-open`,
   * `.active`, `.expanded` — and the state fingerprint above does not watch
   * `class` at all, so a panel that changes nothing but its class was invisible
   * to the whole behavioural layer.
   *
   * Kept OUT of the fingerprint on purpose rather than added to it. The
   * fingerprint is what the run-wide restore check compares, and pages add and
   * drop transition classes on their own — folding class into it would make
   * "the page is back where it started" fail on animation, which stops probing
   * and, worse, teaches us to distrust a check that exists for the client's
   * sake.
   */
  function classesOf(all) {
    var out = new Map();
    for (var i = 0; i < all.length; i++) {
      var c = all[i].className;
      out.set(all[i], typeof c === 'string' ? c : '');
    }
    return out;
  }

  /** Which classes appeared on an element, and which went away. */
  function classDelta(before, after, el) {
    var was = (before.get(el) || '').split(/\s+/).filter(Boolean);
    var now = (after.get(el) || '').split(/\s+/).filter(Boolean);
    var added = now.filter(function (c) { return was.indexOf(c) === -1; });
    var removed = was.filter(function (c) { return now.indexOf(c) === -1; });
    return (added.length || removed.length) ? { added: added, removed: removed } : null;
  }

  /**
   * Where things ARE, which is the half the visibility fingerprint cannot see.
   *
   * A rail that only scrolls hides nothing: every item keeps its box, and what
   * moves is the window onto them. So the whole behavioural layer found
   * NOTHING on a swipe gallery built the way swipe galleries are actually
   * built — measured, both ways round: the same gallery written with hidden
   * came back as a carousel and written as a scroller came back as an empty
   * page.
   *
   * Kept out of `fingerprint` for the same reason `class` is: the restore check
   * compares fingerprints, and a page that scrolls a pixel on its own would
   * start reporting itself as never restored.
   */
  function geometry(all) {
    var out = new Map();
    for (var i = 0; i < all.length; i++) {
      var el = all[i], r = null;
      try { r = el.getBoundingClientRect(); } catch (e) {}
      out.set(el, r ? (Math.round(r.left) + '|' + Math.round(r.top)) : '');
    }
    return out;
  }

  /**
   * What slid sideways.
   *
   * HORIZONTAL on purpose. Opening an accordion pushes everything below it
   * down, and counting that as movement would make every accordion on the page
   * a carousel — so a shift only counts when it is sideways and more sideways
   * than it is vertical.
   */
  function shifted(before, after) {
    var out = [];
    after.forEach(function (now, el) {
      var was = before.get(el);
      if (!was || !now || was === now) return;
      var a = was.split('|'), b = now.split('|');
      var dx = Math.abs(Number(b[0]) - Number(a[0])), dy = Math.abs(Number(b[1]) - Number(a[1]));
      // PURE sideways, not merely sideways-dominant. A flex-wrap container
      // that reflows sends items to another row — huge dx AND a row of dy —
      // and "dx > dy" let that register as a slide, which grew a phantom
      // body-rooted carousel that swallowed every hidden component's match.
      // A real slide translates on one axis: dy stays ~0.
      if (dx > 8 && dy <= 8) out.push(el);
    });
    return out;
  }

  /**
   * What each watched element is SHOWING, in a few characters.
   *
   * The third thing the visibility fingerprint cannot see, after class and
   * position: a region whose contents were REPLACED. Press page 3 of a product
   * list and the grid still has two cards in it and is still on screen — same
   * count, same visibility — so nothing anywhere registered that the whole page
   * of products had changed. Measured: a pagination strip came back as an empty
   * finding, and so does any strip that re-renders one region instead of
   * swapping between several.
   *
   * Out of `fingerprint` for the third time and for the third same reason: the
   * restore check compares fingerprints, and a page with a clock, a price
   * ticker or a countdown would start reporting itself as never restored.
   */
  function contentOf(all) {
    var out = new Map();
    for (var i = 0; i < all.length; i++) {
      var t = '';
      try { t = (all[i].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120); } catch (e) {}
      out.set(all[i], t);
    }
    return out;
  }

  /** Regions whose contents were swapped for different contents. */
  function replaced(before, after) {
    var out = [];
    after.forEach(function (now, el) {
      var was = before.get(el);
      // Something has to have been there and something else has to be there
      // now. An element that merely emptied has vanished, which is reported
      // already, and one that filled from nothing is a reveal.
      if (!was || !now || was === now) return;
      if (was.length < 8 || now.length < 8) return;
      out.push(el);
    });
    return outermost(out);
  }

  function shown(el) {
    if (el.hasAttribute('hidden')) return false;
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (r && (r.width > 0 || r.height > 0)) return true;
    // jsdom and display:contents both give a zero box to things that are
    // genuinely there, so absence of a box is not absence of the element.
    return !!(el.offsetParent || (el.getClientRects && el.getClientRects().length));
  }

  /**
   * Which elements to watch while something is pressed.
   *
   * The neighbourhood of the trigger, plus — anywhere in the document —
   * everything currently hidden. A cart drawer and a modal are children of
   * <body>, nowhere near the button that opens them, so a purely local watch
   * reported "pressed 8, nothing opened" while the drawer was visibly sliding
   * open on screen. Whatever appears must have been hidden a moment ago, which
   * makes that set exactly the right one to add and keeps it small.
   */
  function watched(scope, limit) {
    var els = Array.prototype.slice.call(scope.querySelectorAll('*'), 0, limit || 1200);
    try {
      var far = doc.querySelectorAll('[hidden],[aria-hidden="true"],dialog');
      for (var i = 0; i < far.length && i < 200; i++) {
        if (els.indexOf(far[i]) === -1) els.push(far[i]);
      }
    } catch (e) {}
    return els;
  }

  // Takes the LIST, not the scope. Rebuilding it after the click was the bug
  // that hid every drawer and modal: the watch list includes everything
  // currently [hidden], so the moment a panel opened it left the selector, was
  // missing from the second reading, and counted as VANISHED rather than
  // appeared. The comparison has to be of the same elements, both times.
  function fingerprint(all) {
    var out = new Map();
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var s = (shown(el) ? '1' : '0') + '|' + el.children.length;
      for (var a = 0; a < STATE_ATTRS.length; a++) {
        s += '|' + (el.getAttribute(STATE_ATTRS[a]) || '');
      }
      out.set(el, s);
    }
    return out;
  }

  /** What became visible, what vanished, and what merely changed state. */
  function diff(before, after) {
    var appeared = [], vanished = [], changed = [];
    after.forEach(function (now, el) {
      var was = before.get(el);
      if (was === undefined) { if (now.charAt(0) === '1') appeared.push(el); return; }
      if (was === now) return;
      if (was.charAt(0) === '0' && now.charAt(0) === '1') appeared.push(el);
      else if (was.charAt(0) === '1' && now.charAt(0) === '0') vanished.push(el);
      else changed.push(el);
    });
    before.forEach(function (was, el) {
      if (!after.has(el) && was.charAt(0) === '1') vanished.push(el);
    });
    return { appeared: appeared, vanished: vanished, changed: changed };
  }

  // An element that appeared only because its parent did is not a second
  // finding. The outermost one is the panel; the rest is its contents.
  function outermost(els) {
    return els.filter(function (el) {
      for (var i = 0; i < els.length; i++) {
        if (els[i] !== el && els[i].contains(el)) return false;
      }
      return true;
    });
  }

  var raf = function () {
    return new Promise(function (r) {
      var done = false;
      var fire = function () { if (!done) { done = true; r(); } };
      if (root.requestAnimationFrame) {
        root.requestAnimationFrame(function () { root.requestAnimationFrame(fire); });
      }
      // Not a fallback for old browsers — the only path that runs while the
      // tab is HIDDEN. Chrome freezes rAF in background tabs, so on a pinned
      // background tab every await on this promise hung forever, the finally
      // that disarms the net never ran, and the net went on cancelling every
      // link click on the page: reported as "the extension froze the site".
      setTimeout(fire, 64);
    });
  };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /**
   * The region a press could plausibly affect.
   *
   * Fingerprinting the whole page four times per press is what a first version
   * did, and on a four-thousand-element page that is a hundred and sixty full
   * scans per screenful — slow enough that the run never finished.
   *
   * A disclosure's panel is a sibling or a cousin of its trigger, never the far
   * side of the document, so climbing a few levels from the trigger both bounds
   * the work and keeps the answer. The climb stops when the subtree is big
   * enough to contain the panel, or when it would get expensive.
   */
  function localScope(el, outer, cap) {
    cap = cap || 600;
    var node = el, best = el;
    for (var i = 0; i < 8 && node && node !== outer; i++) {
      var p = node.parentElement;
      if (!p) break;
      var n = p.querySelectorAll('*').length;
      if (n > cap) break;
      best = p;
      node = p;
    }
    return best === el ? (el.parentElement || outer) : best;
  }

  /**
   * Press one element and report what it did.
   *
   * `scope` bounds both the fingerprint and the answer: a click that changes
   * something on the other side of the page is not this component's doing.
   */
  async function probeOne(el, opts) {
    opts = opts || {};
    var scope = opts.scope || doc.body;
    var settle = opts.settle == null ? 120 : opts.settle;

    var safe = safeToClick(el, { trustDisclosure: !!opts.trust });
    if (!safe.ok) return { skipped: true, why: safe.why };

    var els = watched(scope, opts.limit);
    var before = fingerprint(els);
    var classBefore = classesOf(els);
    var whereBefore = geometry(els);
    var textBefore = contentOf(els);
    var focusBefore = doc.activeElement;
    // Who was shut out. aria-hidden and inert on everything ELSE is the most
    // diagnostic modal signal there is — "it hid the rest of the page" — and
    // it used to be squashed into an anonymous `touched` count nobody read.
    var hiddenBefore = new Map();
    els.forEach(function (el) {
      hiddenBefore.set(el, (el.getAttribute('aria-hidden') || '') + '|' +
                           (el.hasAttribute('inert') ? '1' : '0'));
    });
    try { el.click(); } catch (e) { return { skipped: true, why: 'could not be pressed' }; }
    await raf();
    if (settle) await wait(settle);
    var after = fingerprint(els);
    var classAfter = classesOf(els);
    var d = diff(before, after);
    var slid = outermost(shifted(whereBefore, geometry(els)));
    var swapped = replaced(textBefore, contentOf(els));

    // Is what opened a LAYER OVER THE PAGE? Measured HERE, while it is open.
    //
    // This used to be asked in classify(), which runs after every press has
    // been undone — so it measured a CLOSED panel, and a panel closed with
    // `hidden` has no box at all. The test read `width >= 60% of the viewport`
    // against a width of zero and answered no, every time. A modal was
    // therefore reported as an accordion: "it revealed and hid a region", which
    // is true, and useless.
    //
    // It only ever appeared to work on drawers that stay laid out while closed
    // — translated off-screen rather than hidden — which is why it survived.
    var panel = panelOf(d);
    var isLayer = panel ? isOverlay(panel) : false;

    // Does it FLOAT, even when it is small? Same deadline as the overlay
    // measurement above: a panel closed with `hidden` has no box and no
    // computed position worth reading, so asking in classify() measured a
    // closed panel and answered no every time. Fixed-position with the
    // dimensions of a box someone is asked something in — a 3px progress
    // rule is also fixed, and is not asking anybody anything.
    var isFloating = false, headerDropdown = false;
    if (panel && !isLayer) {
      try {
        var pcs = root.getComputedStyle(panel);
        var fr = panel.getBoundingClientRect();
        var boxy = fr.height >= 40 && fr.width >= 80;
        if (pcs.position === 'fixed') {
          isFloating = boxy;
        } else if (pcs.position === 'absolute' && boxy) {
          // 4.9: absolute floats too, when it is anchored high (offsetParent
          // is the body, a header or a nav) and it opens right at its
          // trigger — a dropdown's geometry, not an accordion's flow.
          var op = panel.offsetParent;
          var opHigh = !op || op === doc.body ||
            !!(op.closest && op.closest('header,nav,[role="banner"],[role="navigation"]'));
          var tr = el.getBoundingClientRect();
          var near = Math.abs(fr.top - tr.bottom) <= Math.max(tr.height, 8) ||
                     Math.abs(tr.top - fr.bottom) <= Math.max(tr.height, 8);
          isFloating = opHigh && near;
        }
        // A panel spanning its header/nav ancestor's width is that bar's
        // DROPDOWN — menu territory, never "it revealed and hid a region".
        var bar = panel.closest && panel.closest('header,nav,[role="banner"],[role="navigation"]');
        if (bar && (pcs.position === 'absolute' || pcs.position === 'fixed')) {
          var brRect = bar.getBoundingClientRect();
          headerDropdown = brRect.width > 0 && fr.width >= brRect.width * 0.9;
        }
      } catch (e) {}
    }

    // Did focus follow what opened?
    //
    // Recorded as a FINDING, never as a condition for recognising anything. A
    // panel that covers the page is a dialog whether or not the site moved
    // focus into it — and most sites do not, which is the entire reason the
    // accessibility layer exists. Requiring correct focus behaviour before
    // agreeing something is a dialog would mean the broken ones, the only ones
    // worth mapping, are the ones we decline to find.
    //
    // So this answers "does this one already need the fix", which is the
    // specialist's next question anyway.
    var focusEntered = null;
    if (panel) {
      var landed = doc.activeElement;
      focusEntered = !!(landed && landed !== focusBefore && panel.contains(landed));
    }
    var activeInside = !!(panel && doc.activeElement && panel.contains(doc.activeElement));

    // The rest of the open-state measurements, same deadline as the two
    // above: a closed page has none of this to read.
    //
    // hidOthers — which elements OUTSIDE the panel were aria-hidden'd or
    // inert'ed by this press. The list itself, not a count.
    var hidOthers = [];
    if (panel) {
      els.forEach(function (el) {
        var now = (el.getAttribute('aria-hidden') || '') + '|' +
                  (el.hasAttribute('inert') ? '1' : '0');
        if (hiddenBefore.get(el) === now) return;
        var offNow = el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert');
        if (!offNow) return;
        if (el === panel || panel.contains(el) || el.contains(panel)) return;
        hidOthers.push(el);
      });
    }
    // scrollLocked — the page behind cannot scroll while this is open.
    var scrollLocked = false;
    try {
      var bodyStyle = root.getComputedStyle(doc.body);
      var htmlStyle = root.getComputedStyle(doc.documentElement);
      scrollLocked = bodyStyle.overflow === 'hidden' || htmlStyle.overflow === 'hidden' ||
                     bodyStyle.position === 'fixed';
    } catch (e) {}
    // backdrop — a fixed, page-covering, see-through layer beside or around
    // the panel. Measured as a NEIGHBOUR of the panel: a veil is a sibling or
    // the wrapper, never a stranger.
    var backdrop = null;
    if (panel) {
      try {
        var vwB = root.innerWidth || 1024, vhB = root.innerHeight || 768;
        var nearby = [panel.previousElementSibling, panel.nextElementSibling, panel.parentElement];
        for (var bi = 0; bi < nearby.length; bi++) {
          var cand = nearby[bi];
          if (!cand || cand === doc.body || cand === doc.documentElement) continue;
          var cs = root.getComputedStyle(cand);
          if (cs.position !== 'fixed') continue;
          var br = cand.getBoundingClientRect();
          if (br.width < vwB * 0.95 || br.height < vhB * 0.95) continue;
          var alpha = 1;
          var m = /rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(cs.backgroundColor || '');
          if (m) alpha = parseFloat(m[1]);
          if (alpha < 1 || parseFloat(cs.opacity) < 1) { backdrop = cand; break; }
        }
      } catch (e) {}
    }


    // Anything a caller needs read off the OPEN state beyond what is measured
    // above — selectors for a mapping, a shape, markup — has the same deadline
    // as the two measurements that got moved up here: it can only be read now.
    // `whileOpen` runs with the widget still open and its answer rides back on
    // the report, so the caller never holds the page open itself and the
    // restore below stays unconditional.
    var held = null;
    if (typeof opts.whileOpen === 'function') {
      try { held = await opts.whileOpen(panel, d); }
      catch (e) { held = { error: String((e && e.message) || e) }; }
    }

    // Put it back before reporting, so a caller that stops reading here still
    // leaves the page as it found it.
    //
    // EVERYTHING about the OPEN state has to be measured above this line. Both
    // things that ask "what was it like while it was open" — is it a layer over
    // the page, did focus go into it — were written below it first, and both
    // answered no every single time, because by then it was shut.
    var restored = false;
    try {
      el.click();
      await raf();
      if (settle) await wait(settle);
      restored = same(before, fingerprint(els));
      if (!restored) {
        doc.dispatchEvent(new root.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await raf();
        restored = same(before, fingerprint(els));
      }
    } catch (e) { restored = false; }
    // What an incomplete restore LEFT BEHIND — recorded, not fixed (that is
    // stage 4's). "Press residue shifts layout" stops being a guess when
    // every restored:false names its leftovers.
    var residue = null;
    if (!restored) {
      try {
        var leftover = diff(before, fingerprint(els));
        residue = {
          appeared: leftover.appeared.length,
          vanished: leftover.vanished.length,
          changed: leftover.changed.slice(0, 3),
          classes: classDelta(classBefore, classesOf(els), el) || null,
        };
      } catch (e) { residue = null; }
    }

    // The state class, which is the answer to "how does this page SAY open".
    // Read off the trigger and off whatever it opened, because sites put it on
    // either one and about as often on both.
    var stateClass = null;
    var onTrigger = classDelta(classBefore, classAfter, el);
    var marked = panel || d.changed[0] || null;
    var onPanel = marked ? classDelta(classBefore, classAfter, marked) : null;
    if (onTrigger || onPanel) {
      stateClass = { trigger: onTrigger, panel: onPanel };
    }

    return {
      skipped: false,
      opened: outermost(d.appeared),
      closed: outermost(d.vanished),
      moved: slid,
      rerendered: swapped,
      touched: d.changed.length,
      focusEntered: focusEntered,
      overlay: isLayer,
      floating: isFloating,
      headerDropdown: headerDropdown,
      hidOthers: hidOthers,
      scrollLocked: scrollLocked,
      backdrop: backdrop,
      activeInside: activeInside,
      stateClass: stateClass,
      restored: restored,
      residue: residue,
      held: held,
    };
  }

  /** The thing a press revealed, if it revealed one. */
  function panelOf(d) {
    var opened = outermost(d.appeared);
    return opened.length ? opened[0] : null;
  }

  function same(a, b) {
    if (a.size !== b.size) return false;
    var eq = true;
    a.forEach(function (v, k) { if (b.get(k) !== v) eq = false; });
    return eq;
  }

  // ── Which elements are worth pressing ──────────────────────────────────────
  //
  // On a page that labels itself this is easy. On one that does not, the only
  // honest signal is that something registered a click handler — which is
  // precisely what the event recorder knows and nothing else does.
  // Pressed already, this session. The sticky header travels with the viewport,
  // so a sweep met the same Search and Cart buttons on all twenty-eight
  // screenfuls and pressed them twenty-eight times — which is why the cart kept
  // opening. A component only has to be operated once.
  var everPressed = new WeakSet();

  // The run's ledger. A strip pressed half in one section and half in the
  // next produced two fragments, and each section's classify saw singleton
  // groups — the strip that classifies perfectly when pressed together
  // reported as nothing in the walk. Every probeAll press is recorded here,
  // and classifyRun() reads the WHOLE ledger once, with the sibling climb,
  // when the walk is done. Its answer REPLACES the fragments.
  var runResults = [], runPressed = [], runExtras = [];
  // F-lite: one snapshot instead of live rects. Whether a strip's tabs were
  // in the viewport at the instant pressable() read their rects turned out
  // to be a coin flip — the hero advances on its own clock and press residue
  // shifts layout — so the same walk pressed them in one run and never saw
  // them in the next. planRun() measures every press candidate ONCE, at
  // document-Y (rect.top + scrollY), and each candidate belongs to the
  // section that Y falls in, whatever its live rect says later. The walk,
  // the sections and the budget do not change — only "who belongs where" is
  // decided once.
  var runPlan = null;   // [{ el, docY, rank, seeded }]
  function resetRun() {
    runResults = []; runPressed = []; runExtras = []; runPlan = null;
    everPressed = new WeakSet();
  }
  function classifyRun() {
    var comps = classify(runResults, runPressed, { climb: true });
    // The observations nobody pressed for — the idle-watch's carousels and
    // the overlays that opened themselves — are not in the press ledger, and
    // the first run-level pass silently dropped every one of them. They ride
    // along, deduped by type + root containment.
    runExtras.forEach(function (c) {
      var dup = comps.some(function (o) {
        return o.type === c.type && !!o.root && !!c.root &&
          (o.root === c.root || o.root.contains(c.root) || c.root.contains(o.root));
      });
      if (!dup) comps.push(c);
    });
    return comps;
  }

  var PRESS_POOL = 'button,[role="button"],[role="tab"],[aria-expanded],[aria-haspopup],[aria-controls],summary,[tabindex]';

  // A skip-link TARGET is not a control. tabindex="-1" exists to receive
  // programmatic focus — #main-content, a heading a router focuses — and it
  // was eating press-budget slots at every section it rode into. A real
  // control keeps its seat whatever its tabindex says.
  function skipTabstop(el) {
    try {
      return el.getAttribute('tabindex') === '-1' &&
             !el.matches('button,a[href],[role="button"]');
    } catch (e) { return false; }
  }

  function declaresOpen(el) {
    try {
      if (el.hasAttribute('aria-expanded') || el.hasAttribute('aria-haspopup')) return true;
      var id = el.getAttribute('aria-controls');
      if (id) {
        var t = doc.getElementById(id);
        if (t && !shown(t)) return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * F-lite's snapshot: every press candidate on the page, measured ONCE at
   * document-Y, ranked like pressable(). `opts.seeds` (decision D) force-adds
   * the members of strips the HINT layer already identified — rank 1,
   * because a strip the markup announces deserves its presses more than a
   * plain button does. Returns how many candidates were planned.
   */
  var runPlanKnown = new WeakSet();
  function planRun(scope, opts) {
    opts = opts || {};
    scope = scope || doc.body;
    var plan = [];
    var known = new WeakSet();
    var sy = root.scrollY || root.pageYOffset || 0;
    var push = function (el, rank, seeded) {
      if (!el || el.nodeType !== 1 || known.has(el)) return;
      if (!shown(el) || skipTabstop(el)) return;
      if (!safeToClick(el).ok) return;
      var y;
      try { y = el.getBoundingClientRect().top + sy; } catch (e) { return; }
      known.add(el);
      plan.push({ el: el, docY: y, rank: rank, seeded: !!seeded });
    };
    (opts.seeds || []).forEach(function (el) { push(el, 1, true); });
    var rec = root.__u1EventMap;
    if (rec && typeof rec.all === 'function') {
      try { rec.all().forEach(function (el) { push(el, 0); }); } catch (e) {}
    }
    try {
      scope.querySelectorAll(PRESS_POOL).forEach(function (el) {
        push(el, declaresOpen(el) ? 1 : 2);
      });
    } catch (e) {}
    try {
      var all = scope.querySelectorAll('div,span,li,td');
      for (var i = 0; i < all.length && plan.length < 400; i++) {
        var el = all[i];
        if (known.has(el)) continue;
        var p = el.parentElement;
        if (root.getComputedStyle(el).cursor !== 'pointer') continue;
        if (p && root.getComputedStyle(p).cursor === 'pointer') continue;
        push(el, 3);
      }
    } catch (e) {}
    plan.sort(function (a, b) { return a.rank - b.rank || a.docY - b.docY; });
    runPlan = plan;
    runPlanKnown = known;
    return plan.length;
  }

  function pressable(scope, opts) {
    opts = opts || {};
    var seen = new Set();
    // A sweep probes one screenful at a time, so the question is not "is it on
    // the page" but "is it on THIS screen". Without this the same menu is
    // pressed again at every scroll position.
    var vh = root.innerHeight || 768, vw = root.innerWidth || 1024;
    var onScreen = function (el) {
      if (!opts.inViewport) return true;
      try {
        var r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      } catch (e) { return false; }
    };
    // RANKED, then cut — not collected in source order and cut blind. The
    // budget is 12 presses per section, and blind document order spent them
    // on whatever buttons came first: the finder's five selects and Go
    // buttons ate the budget and its tab strip — which classifies perfectly
    // when pressed — was never pressed at all. Rank by how loudly a control
    // says "I open something":
    //   0  the event recorder saw a real handler — an observation, not a hint
    //   1  aria-expanded / aria-haspopup, or aria-controls naming a HIDDEN
    //      element — the page declaring a disclosure outright
    //   2  button / role=button / role=tab / summary / [tabindex] — pressable
    //      by vocation, silent about what pressing does
    //   3  cursor:pointer on a bare div — the one signal a page cannot help
    //      giving, and the weakest
    // Document order within each rank, so a strip's siblings stay together.
    var buckets = [[], [], [], []];
    var add = function (el, rank) {
      if (!el || seen.has(el) || !scope.contains(el)) return;
      if (!opts.repeat && everPressed.has(el)) return;
      if (!shown(el) || !onScreen(el)) return;
      if (skipTabstop(el)) return;
      if (!safeToClick(el).ok) return;
      seen.add(el); buckets[rank].push(el);
    };

    var rec = root.__u1EventMap;
    if (rec && typeof rec.all === 'function') {
      try { rec.all().forEach(function (el) { add(el, 0); }); } catch (e) {}
    }
    // The ones that announce themselves, split by how much they announce.
    try {
      scope.querySelectorAll(PRESS_POOL)
        .forEach(function (el) { add(el, declaresOpen(el) ? 1 : 2); });
    } catch (e) {}

    // And, when neither of those found anything, the one signal a page cannot
    // help giving: `cursor: pointer`.
    //
    // A page of bare <div>s carries no tag, no role and no useful class — but
    // whoever built it still had to make the thing LOOK clickable, and there is
    // one way to do that. It is not proof, which is why it is a last resort and
    // why the probe then presses it and watches rather than believing it.
    //
    // Without this the probe needed the event recorder, which is opt-in and
    // needs a page reload — so on exactly the pages it was written for it had
    // nothing to press and reported nothing at all.
    // Always, not only when nothing else was found. Three stray [tabindex]
    // elements on a page were enough to make `out` non-empty, and the sweep
    // that finds the ACTUAL controls never ran — the probe reported nothing on
    // the one kind of page it was written for.
    var haveSoFar = buckets[0].length + buckets[1].length + buckets[2].length;
    if (haveSoFar < (opts.max || 40)) {
      try {
        var all = scope.querySelectorAll('div,span,li,td');
        var room = (opts.max || 40) * 3;
        for (var i = 0; i < all.length && buckets[3].length < room; i++) {
          var el = all[i];
          if (seen.has(el) || !onScreen(el)) continue;
          // A pointer cursor INHERITED from a clickable ancestor is that
          // ancestor's, not this element's — otherwise every word inside a
          // button becomes a candidate.
          var p = el.parentElement;
          var mine = root.getComputedStyle(el).cursor === 'pointer';
          if (!mine) continue;
          if (p && root.getComputedStyle(p).cursor === 'pointer') continue;
          add(el, 3);
        }
      } catch (e) {}
    }
    var out = buckets[0].concat(buckets[1], buckets[2], buckets[3]);
    return out.slice(0, opts.max || 40);
  }

  // Grouping by parent needs a key, and the parent element itself cannot be one
  // in a plain object. A WeakMap-backed counter keeps it identity-based rather
  // than depending on a selector that may not exist.
  var keySeq = 0, keyed = new WeakMap();
  var robustKey = function (el) {
    if (!keyed.has(el)) keyed.set(el, 'p' + (++keySeq));
    return keyed.get(el);
  };

  var commonAncestor = function (els) {
    if (!els.length) return null;
    var a = els[0];
    for (var i = 1; i < els.length; i++) {
      var b = els[i];
      while (a && !a.contains(b)) a = a.parentElement;
    }
    return a;
  };

  /**
   * Is this panel nothing but links?
   *
   * The rule was "two or more links makes it a menu", and that is too crude:
   * an FAQ answer with a "read more" link in it, or a product panel with a
   * link at the bottom, was called a menu on the strength of the links while
   * being mostly prose.
   *
   * What separates them is what is there BESIDES the links. A menu panel is
   * links and whitespace. An accordion panel is text that happens to contain
   * some. So the links' own text is subtracted and what is left is weighed.
   */
  var mostlyLinks = function (el) {
    try {
      // 4.6: only links that GO somewhere count. href="#" and javascript:
      // are buttons wearing <a>, and counting them called value-pickers menus.
      var links = [];
      var all0 = el.querySelectorAll('a[href]');
      for (var j = 0; j < all0.length; j++) {
        var href = all0[j].getAttribute('href') || '';
        if (href && !/^#/.test(href) && !/^javascript:/i.test(href)) links.push(all0[j]);
      }
      if (links.length < 2) return false;
      var all = (el.textContent || '').replace(/\s+/g, ' ').trim();
      var inLinks = 0;
      for (var i = 0; i < links.length; i++) {
        inLinks += (links[i].textContent || '').replace(/\s+/g, ' ').trim().length;
      }
      // 4.8: a RATIO, not the old flat forty characters. A mega-panel of 22
      // links with a 120-character category blurb is a menu — the absolute
      // threshold called it an accordion. Around each link, up to ~15
      // characters of furniture is normal (a heading, a "see all"); and as a
      // second door, free text under 40% of everything is still mostly links.
      var free = all.length - inLinks;
      return free <= links.length * 15 || (all.length > 0 && free / all.length <= 0.4);
    } catch (e) { return true; }
  };

  /**
   * The run of siblings a set of revealed elements belongs to.
   *
   * A carousel and a tab strip are the same observation up to here — press a
   * control, something is shown and something else is hidden — and they were
   * not being told apart at all: a hero carousel with prev/next arrows came
   * back as a strip of two controls "each revealing the same region", which is
   * a menu. Measured, not supposed.
   *
   * What separates them is COUNTING. A tab strip has as many panels as it has
   * tabs, because each tab owns one. A carousel has two arrows and five slides:
   * the controls cycle a set that is bigger than they are. So: find the run of
   * siblings the revealed elements sit in, and compare its size to the number
   * of controls.
   */
  var siblingRun = function (els, controls, touched) {
    if (!els.length) return null;
    var parent = els[0].parentElement;
    if (!parent) return null;
    for (var i = 1; i < els.length; i++) if (els[i].parentElement !== parent) return null;
    var kids = Array.prototype.slice.call(parent.children);
    // Only the ones that look like peers of what was revealed — a track with
    // five slides and a stray caption should count five, not six.
    var tag = els[0].tagName;
    var peers = kids.filter(function (k) { return k.tagName === tag; });
    var items = peers.length >= els.length ? peers : kids;

    // Anything holding a CONTROL is not a slide.
    //
    // Slides are inert: a track holds pictures and text, and the arrows live
    // outside it. So a peer that is, or contains, something this run pressed is
    // another component's container and must not be counted.
    //
    // Excluding only the strip's own controls was not enough, and the case that
    // proved it is worth keeping: on a page written flat — tab panels as direct
    // children of the page, beside the nav and the accordion — the run came
    // back as five, the strip had three controls, and an ordinary tab strip was
    // reported as a carousel. It then stopped being pressed back afterwards,
    // because only a strip gets pressed back, so the page was left on the wrong
    // panel. A misread that also breaks the promise to put the page back is the
    // expensive kind.
    if (controls && controls.length) {
      items = items.filter(function (k) {
        for (var c = 0; c < controls.length; c++) {
          if (k === controls[c] || k.contains(controls[c])) return false;
        }
        return true;
      });
    }
    // Slides take TURNS. Whatever is showing and was never shown or hidden by
    // anything this run did is not one of them — it is the caption beside the
    // track, or the paragraph below it.
    //
    // The case that needed this: a two-control strip whose panels sat flat
    // beside a paragraph of prose. The prose counted as a third item, three
    // beat two controls, and the strip was called a carousel. A slide that has
    // never once been hidden is not a slide.
    //
    // Slides not yet reached are kept — they are hidden, not showing, which is
    // exactly what an untouched slide looks like. That is what lets two arrows
    // over five slides still read as five.
    if (touched && touched.length) {
      items = items.filter(function (k) {
        return !shown(k) || touched.indexOf(k) !== -1;
      });
    }
    return items.length ? { parent: parent, items: items } : null;
  };

  /** Prev / next, when the control says so on its face. */
  var arrowRole = function (el) {
    var face = faceOf(el).toLowerCase() + ' ' +
               ((el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
    if (/prev|back|◄|‹|«|←|הקודם|אחורה/.test(face)) return 'prevButton';
    if (/next|forward|►|›|»|→|הבא|קדימה/.test(face)) return 'nextButton';
    return null;
  };

  /**
   * A layer over the page — which is what makes something a dialog.
   *
   * TWO shapes, because "covers most of the screen" was only one of them and
   * the other is extremely common:
   *
   *   · a MODAL: a box over the middle of the page, most of the screen wide
   *     and half of it tall.
   *   · a BANNER: a cookie bar, a coupon strip, a consent notice. Pinned to the
   *     top or bottom edge, nearly the full width, and DELIBERATELY short — it
   *     covers a sliver, and the height test alone threw every one of them out.
   *     Decided that these are dialogs like any other, which they are: they
   *     appear over the page, they demand an answer, and the ones that trap you
   *     without a reachable close button are a genuine trap.
   *
   * `fixed` is required for the banner and not for the modal. A short strip
   * that merely happens to be absolutely positioned inside some section is
   * ordinary page furniture; one pinned to the viewport edge is a layer.
   */
  var isOverlay = function (el) {
    try {
      var pos = root.getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'absolute') return false;
      var r = el.getBoundingClientRect();
      var vw = root.innerWidth || 1024, vh = root.innerHeight || 768;
      if (r.width >= vw * 0.6 && r.height >= vh * 0.5) return true;

      if (pos !== 'fixed') return false;
      var wide = r.width >= vw * 0.8;
      var atEdge = r.top <= 4 || Math.abs(r.bottom - vh) <= 4;
      // Not a hairline: a progress bar and a coloured rule are also wide, fixed
      // and against an edge, and neither is asking anybody anything.
      var tall = r.height >= 40;
      return wide && atEdge && tall;
    } catch (e) { return false; }
  };

  /**
   * Turn "pressing A revealed B" into a component.
   *
   * This is the whole point of the exercise: every one of these decisions is a
   * description of something that was observed, not a reading of a name. The
   * same code answers correctly on a page built with role="tablist" and on the
   * same page with every attribute stripped, because it never looked at either.
   */
  /**
   * The element whose SIBLINGS a strip's triggers really are.
   *
   * ul>li>button is the commonest strip markup on the web, and grouping by
   * parentElement put every trigger in its own <li> — seven singleton groups,
   * no strip, and the mega-nav filed as seven accordions. Climb through <li>
   * and through wrappers holding exactly one child, then group by what is
   * left. Used only by the RUN-level pass; the per-section classify keeps its
   * literal parents, because this climb is part of the stage-3 decision and
   * the section pass is a live preview.
   */
  function stripAnchor(el) {
    var node = el;
    for (var i = 0; i < 4 && node.parentElement; i++) {
      var p = node.parentElement;
      if (p === doc.body || p === doc.documentElement) break;
      if (p.tagName === 'LI' || p.children.length === 1) { node = p; continue; }
      break;
    }
    return node;
  }

  function classify(results, pressed, opts) {
    opts = opts || {};
    pressed = pressed || [];
    var comps = [];
    var used = new Set();
    // 4.7: the climb IS the grouping, per-section too. ul>li>button is the
    // commonest strip markup on the web, and literal-parent grouping put
    // every trigger in its own <li> — seven singleton groups, no strip.
    var anchorOf = function (el) { return stripAnchor(el).parentElement; };

    // Siblings that each reveal a DIFFERENT panel are a tab strip. One panel
    // shared between them is the same thing — a strip over one re-rendered
    // region — and both are far commoner than a page that says so.
    // Grouped by PRESSED siblings, not by siblings that revealed something.
    // The tab that is already selected reveals nothing when pressed, so a
    // two-tab strip produces exactly one observation — and requiring two
    // observations classified it as an accordion. A row of sibling controls
    // where pressing one swaps what is visible is a strip, and the already-open
    // one is a member of it.
    var byParent = new Map();
    pressed.forEach(function (el) {
      var p = anchorOf(el);
      if (!p) return;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(el);
    });

    byParent.forEach(function (siblings, groupKey) {
      if (siblings.length < 2) return;
      var group = results.filter(function (r) {
        return siblings.indexOf(r.trigger) !== -1 && r.opened.length;
      });
      if (!group.length) return;
      // Siblings that each reveal something are not automatically a tab strip.
      // A header toolbar is exactly that shape — Search, Wishlist and Cart each
      // open their own overlay — and it was being reported as tabs.
      //
      // What makes a strip a strip is that its panels are MUTUALLY EXCLUSIVE:
      // showing one hides another. A toolbar's overlays are independent, and
      // pressing one closes nothing.
      var exclusive = group.some(function (r) { return r.closed && r.closed.length; });
      if (!exclusive) return;
      var panels = [];
      group.forEach(function (r) { r.opened.forEach(function (el) { if (panels.indexOf(el) === -1) panels.push(el); }); });
      if (!panels.length) return;
      // A CAROUSEL, if the controls are cycling a set bigger than themselves.
      var revealed = [];
      group.forEach(function (r) { r.opened.forEach(function (el) {
        if (revealed.indexOf(el) === -1) revealed.push(el); }); });
      var swapped = [];
      group.forEach(function (r) {
        r.opened.forEach(function (el) { if (swapped.indexOf(el) === -1) swapped.push(el); });
        (r.closed || []).forEach(function (el) { if (swapped.indexOf(el) === -1) swapped.push(el); });
      });
      var run = siblingRun(revealed, pressed.concat(siblings), swapped);
      if (run && run.items.length > siblings.length) {
        group.forEach(function (r) { used.add(r.trigger); });
        siblings.forEach(function (el) { used.add(el); });
        var parts = { slide: run.items };
        siblings.forEach(function (el) {
          var role = arrowRole(el);
          if (role && !parts[role]) parts[role] = [el];
        });
        comps.push({
          type: 'carousel',
          root: commonAncestor(siblings.concat(run.items)),
          parts: parts,
          why: siblings.length + ' controls cycling ' + run.items.length +
               ' items — more items than controls, so they are not tabs',
        });
        return;
      }

      group.forEach(function (r) { used.add(r.trigger); });
      // The tab that was ALREADY selected reveals nothing when pressed, so it
      // never appears in `results` — and a three-tab strip was reported as two
      // tabs with the current one missing. Its siblings that were pressed and
      // did nothing belong to the same strip.
      var tabs = group.map(function (r) { return r.trigger; });
      siblings.forEach(function (el) {
        if (tabs.indexOf(el) === -1) { tabs.push(el); used.add(el); }
      });
      // Back into document order, so `tab` reads left to right as it looks.
      tabs.sort(function (a, b) {
        return (a.compareDocumentPosition(b) & 4) ? -1 : 1;   // 4 = FOLLOWING
      });
      // A MENU, not a tab strip. The two are one shape — several sibling
      // controls, pressing one swaps what is shown — and detection stopped
      // trying to tell them apart by which word the developer happened to use.
      //
      // `shape: 'strip'` is kept because the RESTORE below needs it, and that
      // is a mechanical fact rather than a name: a control that cannot undo
      // itself by being pressed again has to be pressed back deliberately.
      // Keying the restore on the type name would have broken it the moment
      // the name changed — silently, on somebody's live site.
      //
      // Rooted on the DIRECT PARENT of the controls, per the menu rules, not on
      // the common ancestor of the controls AND their panels: that reaches up
      // past the strip and u1.fix.menu walks the root's own children looking
      // for items.
      comps.push({
        type: 'menu',
        shape: 'strip',
        // The group key IS the strip — the <ul> whose children are the <li>
        // rows. The literal parent would be one trigger's own <li>.
        root: groupKey || commonAncestor(tabs.concat(panels)),
        parts: { items: tabs, submenus: panels },
        why: tabs.length + ' sibling controls, each revealing ' +
             (panels.length === 1 ? 'the same region' : 'a different panel'),
      });
    });

    // A PAGE STRIP, told by counting rather than by naming — the same trick the
    // calendar uses, and reliable for the same reason. Sibling controls whose
    // faces are running numbers are page numbers; nothing else on a page is a
    // row of controls that says 1, 2, 3.
    //
    // It has to come before the strip rule below, which would otherwise call it
    // a menu: pressing one of these swaps what is shown, which is exactly the
    // shape a menu has. And the difference matters — a menu leads to different
    // places, page numbers lead to the same content cut into pieces.
    var numbered = {};
    pressed.forEach(function (el) {
      var p = el.parentElement;
      if (!p) return;
      var key = robustKey(p);
      if (!numbered[key]) numbered[key] = { parent: p, nums: [], all: [] };
      numbered[key].all.push(el);
      var face = faceOf(el);
      if (/^\d{1,3}$/.test(face)) numbered[key].nums.push(el);
    });
    Object.keys(numbered).forEach(function (key) {
      var g = numbered[key];
      // Three numbers is the smallest strip worth the name; two is a pair of
      // buttons that happen to say 1 and 2.
      if (g.nums.length < 3) return;
      if (g.nums.some(function (el) { return used.has(el); })) return;
      var values = g.nums.map(function (el) { return Number(faceOf(el)); });
      var rising = 0;
      for (var i = 1; i < values.length; i++) if (values[i] === values[i - 1] + 1) rising++;
      if (rising < values.length - 2) return;

      g.all.forEach(function (el) { used.add(el); });
      var parts = { pageButtons: g.nums };
      g.all.forEach(function (el) {
        var role = arrowRole(el);
        if (role === 'prevButton' && !parts.prevButton) parts.prevButton = [el];
        if (role === 'nextButton' && !parts.nextButton) parts.nextButton = [el];
      });
      comps.push({
        type: 'pagination',
        root: g.parent,
        parts: parts,
        why: g.nums.length + ' controls numbered in sequence',
      });
    });

    // A rail that SLIDES. No counting needed and no hiding involved: if
    // pressing a control moved a run of siblings sideways, that is a carousel,
    // however many controls it has. A shelf of twenty products with two arrows
    // is one; so is a swipe gallery with no arrows at all, found below by
    // watching it move on its own.
    results.forEach(function (r) {
      if (used.has(r.trigger) || !r.moved || !r.moved.length) return;
      var run = siblingRun(r.moved, pressed, r.moved);
      if (!run || run.items.length < 2) return;
      used.add(r.trigger);
      var parts = { slide: run.items };
      var role = arrowRole(r.trigger);
      if (role) parts[role] = [r.trigger];
      // The other arrow, when there is one: its sibling that was also pressed.
      pressed.forEach(function (el) {
        if (el === r.trigger || el.parentElement !== r.trigger.parentElement) return;
        var other = arrowRole(el);
        if (other && !parts[other]) { parts[other] = [el]; used.add(el); }
      });
      comps.push({
        type: 'carousel',
        root: commonAncestor([r.trigger].concat(run.items)),
        parts: parts,
        why: 'pressing it slid a rail of ' + run.items.length + ' items sideways',
      });
    });

    results.forEach(function (r) {
      if (used.has(r.trigger) || !r.opened.length) return;
      var panel = r.opened[0];
      // `r.overlay` was measured while the panel was open. See probeOne.
      //
      // But a dialog does not have to be BIG. The overlay test asks "does it
      // cover the page", and a 420-pixel confirm box answers no — so a button
      // that plainly opens a dialog was reported as an accordion, "it
      // revealed and hid a region", true and useless. A small layer still
      // gives itself away twice over: the page SAYS the word (role=dialog,
      // aria-modal, <dialog>, a modal/lightbox class), or it FLOATS —
      // position:fixed is not how an accordion's content sits in the flow
      // under its header. Links win over floating, though: a nav drop-down
      // under a fixed header is itself fixed, and it is a menu.
      // The name survives closing — role and class are attributes, not
      // layout — so it may be read here. The FLOAT was measured while the
      // panel was open (see probeOne), for the same reason the overlay was.
      var saysDialog = false;
      try {
        saysDialog = !!(panel.closest &&
          panel.closest('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]')) ||
          /(^|[\s_-])(modal|lightbox|dialog)([\s_-]|$)/i.test(String(panel.className || ''));
      } catch (e) {}
      var type = r.overlay ? 'dialog'
        : saysDialog ? 'dialog'
        : mostlyLinks(panel) ? 'menu'
        : r.headerDropdown ? 'menu'
        : r.floating ? 'dialog'
        : 'accordion';
      var why = type === 'dialog'
        ? (r.overlay ? 'it opened a layer over the page'
           : saysDialog ? 'it opened a panel the page itself calls a dialog'
           : 'it opened a panel that floats over the page')
        : type === 'menu'
        ? (r.headerDropdown ? 'it dropped a panel across its own header bar'
           : 'it revealed a panel of links and nothing else')
        : 'it revealed and hid a region';
      // How the page SAYS open, when it says it with a class. Worth reporting
      // even for a dialog: it is the same answer to the same question, and a
      // mapping that has it does not need a person to go and find it.
      if (r.stateClass) {
        var added = (r.stateClass.panel && r.stateClass.panel.added) ||
                    (r.stateClass.trigger && r.stateClass.trigger.added) || [];
        if (added.length) why += ', and marks it open with .' + added[0];
      }
      // The work this one needs, said plainly. Not a reason to doubt the
      // type — the reason to map it. A menu or an accordion that drops focus
      // needed the note as much as a dialog and never got it.
      if (r.focusEntered === false &&
          (type === 'dialog' || type === 'menu' || type === 'accordion')) {
        why += '. Focus stayed outside it when it opened';
      }
      comps.push({
        type: type,
        root: type === 'dialog' ? panel : commonAncestor([r.trigger, panel]),
        parts: { trigger: [r.trigger], panel: [panel] },
        stateClass: r.stateClass || null,
        focusEntered: r.focusEntered,
        why: why,
      });
    });

    return comps;
  }

  /**
   * What the page does when nobody touches it.
   *
   * Everything else here presses something and watches. This watches while
   * pressing NOTHING, and it answers two questions at once:
   *
   *   · a carousel that advances on its own is a carousel even when it has no
   *     arrows to press — a swipe-only gallery announces itself no other way.
   *   · a thing that moves by itself and cannot be stopped is a WCAG 2.2.2
   *     failure in its own right, and it is the kind nobody reports because
   *     nothing on the page looks broken.
   *
   * It costs real time — a slide sits for seconds — so the window is a
   * parameter and the whole thing is skipped when it is zero.
   */
  async function watchIdle(scope, ms, limit) {
    if (!ms) return null;
    var els = watched(scope, limit);
    var before = fingerprint(els);
    var whereBefore = geometry(els);
    // SAMPLED, not just start-and-end. A carousel of three slides on a cycle
    // that divides the window lands back where it started and a two-point
    // comparison sees nothing at all — found by a test whose timing happened
    // to do exactly that, and reported as "no carousel here" with complete
    // confidence. Any sample differing from the start is movement.
    var step = Math.max(250, Math.round(ms / 4));
    for (var waited = 0; waited < ms; waited += step) {
      await wait(Math.min(step, ms - waited));
      var d = diff(before, fingerprint(els));
      var moved = outermost(d.appeared);
      if (moved.length) return { moved: moved, gone: outermost(d.vanished), ms: waited + step };
      // A ticker that scrolls itself hides nothing at all, so the visibility
      // comparison above will never see it however long it watches.
      var slid = outermost(shifted(whereBefore, geometry(els)));
      if (slid.length) return { moved: slid, gone: [], slid: true, ms: waited + step };
    }
    return null;
  }

  /**
   * Ask a form to validate itself, and read the answer off the page.
   *
   * A form mapping needs three things a person otherwise finds by hand: which
   * fields are required, the class the page puts on a field it has rejected,
   * and where the message goes. All three are written on the page the moment an
   * EMPTY form is submitted — so the form is asked, rather than the specialist.
   *
   * Nothing is sent. The submit event is cancelled in the capture phase and
   * fetch/XHR/sendBeacon are stubbed for the duration, so the page's own
   * validation runs and its request does not. That is the whole reason this is
   * defensible: pressing submit is otherwise the single most dangerous thing
   * that could be done to somebody's site, and the blocklist refuses to do it.
   *
   * Nothing is filled in either. An empty submit is the one that produces the
   * most errors and touches the least.
   *
   * WHAT IT LEAVES BEHIND: the form showing its validation errors. That is not
   * undone — the classes belong to the page's own state and stripping them
   * would leave its JavaScript believing something the DOM no longer says. It
   * is reported instead, so a caller can say so rather than a person finding a
   * red form they did not ask for.
   */
  async function probeForm(form, opts) {
    opts = opts || {};
    var settle = opts.settle == null ? 200 : opts.settle;
    var fields = [];
    try { fields = Array.prototype.slice.call(form.querySelectorAll(FIELD_SEL)); } catch (e) {}
    if (!fields.length) return null;

    var submit = null;
    try {
      var cands = form.querySelectorAll('button,input[type="submit"],[role="button"]');
      for (var i = 0; i < cands.length; i++) {
        var t = (cands[i].getAttribute('type') || '').toLowerCase();
        // A reset button empties what somebody typed. Never that one.
        if (t === 'reset' || t === 'button') continue;
        if (/reset|clear|cancel|נקה|בטל/i.test(faceOf(cands[i]))) continue;
        submit = cands[i];
        break;
      }
    } catch (e) {}
    if (!submit) return null;

    // Anything already filled in is somebody's work in progress. Submitting a
    // half-typed form is not a thing to do to a person, and a form that passes
    // validation would tell us nothing anyway.
    for (var f = 0; f < fields.length; f++) {
      var v = fields[f].value;
      if (typeof v === 'string' && v.trim()) return { skipped: true, why: 'somebody has typed in it' };
      if (fields[f].checked) return { skipped: true, why: 'somebody has ticked something in it' };
    }

    var watchList = watched(form, opts.limit);
    var before = fingerprint(watchList);
    var classBefore = classesOf(watchList);
    var invalidBefore = fields.map(function (el) { return el.getAttribute('aria-invalid'); });

    try { submit.click(); } catch (e) { return null; }
    await raf();
    if (settle) await wait(settle);

    var classAfter = classesOf(watchList);
    var d = diff(before, fingerprint(watchList));

    // Which fields the form rejected, and how it said so.
    var rejected = [], marks = {};
    fields.forEach(function (el, i) {
      var said = false;
      if (el.getAttribute('aria-invalid') === 'true' && invalidBefore[i] !== 'true') said = true;
      var delta = classDelta(classBefore, classAfter, el);
      if (delta && delta.added.length) {
        said = true;
        delta.added.forEach(function (c) { marks[c] = (marks[c] || 0) + 1; });
      }
      // A native control the browser itself refused.
      try { if (el.willValidate && el.validity && !el.validity.valid) said = true; } catch (e) {}
      if (said) rejected.push(el);
    });

    // The class the page uses for "this one is wrong".
    //
    // Counting alone is not enough and picked the wrong one first time: a field
    // going from `class=""` to `class="field field--error"` has added BOTH, on
    // exactly the same number of fields, and the tie broke on iteration order —
    // so the answer was `field`, which is every field on the form including the
    // valid ones. A mapping built on that marks the whole form as wrong.
    //
    // So a name that SAYS error wins, in either language, before any counting.
    // When nothing says it, the candidates are all reported rather than one
    // being picked by luck — a field left for a person to choose is honest, a
    // wrong one filled in confidently is not.
    var SAYS_ERROR = /error|invalid|danger|warn|fail|required|שגיא|שגוי|חוב/i;
    var candidates = Object.keys(marks).sort(function (a, b) { return marks[b] - marks[a]; });
    var named = candidates.filter(function (c) { return SAYS_ERROR.test(c); });
    var invalidClass = named.length ? named[0] : (candidates.length === 1 ? candidates[0] : null);

    return {
      submit: submit,
      fields: fields,
      required: rejected,
      invalidClass: invalidClass,
      invalidCandidates: candidates,
      messages: outermost(d.appeared),
      leftShowingErrors: rejected.length > 0 || d.appeared.length > 0,
    };
  }

  /**
   * Type one letter into a field and watch what the list does.
   *
   * This settles an argument that cannot be settled by looking. A garage finder
   * and an autocomplete are the same markup — a text field with a list of
   * results beside it — and the two need OPPOSITE fixes:
   *
   *   · the list was already there and typing NARROWS it → a filter. What it
   *     needs is a status message saying how many are left. Giving it combobox
   *     roles describes a popup that does not exist and leaves a screen reader
   *     waiting for one that never opens.
   *   · the list was not there and typing REVEALED it → a combobox. It does not
   *     have to float: a results container that goes from empty to populated is
   *     a popup in every sense ARIA cares about.
   *
   * Nothing in the code told these apart. `comboboxShape` and `filterListShape`
   * both match the same markup and whichever is asked first wins, while the
   * real distinction lived only as prose in the rules file.
   *
   * Safer than pressing a submit — it is one character into a text box — and
   * bounded the same way: never a password, never a field somebody has already
   * typed in, and the value is put back with the events the page needs to see
   * to undo its own work.
   */
  async function probeTyping(input, opts) {
    opts = opts || {};
    var settle = opts.settle == null ? 200 : opts.settle;
    if (!input || input.nodeType !== 1) return null;

    var type = (input.getAttribute('type') || '').toLowerCase();
    if (type === 'password') return { skipped: true, why: 'a password field' };
    if (input.disabled || input.readOnly) return { skipped: true, why: 'not editable' };
    if (typeof input.value === 'string' && input.value.trim()) {
      return { skipped: true, why: 'somebody has typed in it' };
    }

    var scope = opts.scope || input.closest('form,section,div') || doc.body;
    var els = watched(scope, opts.limit);
    var before = fingerprint(els);
    var countBefore = listCounts(scope);

    var fire = function (el) {
      ['input', 'keyup', 'change'].forEach(function (name) {
        try { el.dispatchEvent(new root.Event(name, { bubbles: true })); } catch (e) {}
      });
    };

    // FIRST: touch it without typing.
    //
    // A popup does not have to open empty. Most of them open showing every
    // option, and typing then narrows what is already in front of you — which
    // from the typing alone is indistinguishable from a page filter, and was
    // being called one. The difference is a step earlier: the page filter's
    // list is part of the page and was on screen before anybody touched
    // anything, and the popup's list was not there until the field was.
    try { input.focus(); input.click(); } catch (e) {}
    await raf();
    if (settle) await wait(settle);
    var onTouch = diff(before, fingerprint(els));
    var countTouched = listCounts(scope);
    var openedOnTouch = outermost(onTouch.appeared);
    countBefore.forEach(function (was, el) {
      var now = countTouched.get(el);
      if (was === 0 && now > 0 && openedOnTouch.indexOf(el) === -1) openedOnTouch.push(el);
    });

    // The baseline for the typing step is the page as it stands NOW, with the
    // popup open — otherwise the opening itself reads as the typing's doing.
    var beforeTyping = fingerprint(els);
    var countBeforeTyping = countTouched;

    try {
      input.value = opts.text || 'a';
      fire(input);
    } catch (e) { return null; }
    await raf();
    if (settle) await wait(settle);

    var d = diff(beforeTyping, fingerprint(els));
    var countAfter = listCounts(scope);

    // Put the letter back before anything else. A field left with a stray
    // character in it is the most visible thing this whole file could do.
    try {
      input.value = '';
      fire(input);
      // …and shut whatever the touch opened, the way a person would.
      if (openedOnTouch.length) {
        input.blur();
        doc.dispatchEvent(new root.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
    } catch (e) {}
    await raf();
    if (settle) await wait(settle);

    var revealed = outermost(d.appeared);
    var narrowed = [], filled = [];
    countBeforeTyping.forEach(function (was, el) {
      var now = countAfter.get(el);
      if (now == null) return;
      // The container was ALREADY THERE and EMPTY, and typing put results in
      // it. That is the commonest autocomplete on the web and the first version
      // of this missed all of them: the <ul> never appeared — it was visible
      // the whole time — so "did anything appear" answered no while the page
      // was visibly filling with matches.
      if (was === 0 && now > 0) filled.push({ list: el, now: now });
      else if (was > 0 && now < was) narrowed.push({ list: el, was: was, now: now });
    });

    return {
      skipped: false,
      openedOnTouch: openedOnTouch,
      revealed: revealed,
      filled: filled,
      narrowed: narrowed,
      // The whole point, in one word.
      //
      // Revealing beats narrowing when both happen: a page that hides its old
      // results and builds new ones is doing the autocomplete thing, and the
      // narrowing is a side effect of the same keystroke.
      // Opening on touch settles it before the typing is even read: a list that
      // was not on the page until the field was touched is a popup, however
      // full it opens and whatever typing then does to it.
      kind: openedOnTouch.length ? 'combobox'
          : (revealed.length || filled.length) ? 'combobox'
          : (narrowed.length ? 'filter' : null),
    };
  }

  /**
   * Pick a day, and read the mapping off what changes.
   *
   * The same idea as submitting an empty form: the answers a datepicker mapping
   * needs are written on the page the moment a day is chosen, and nowhere
   * before it. `days.selected` is a class the page toggles and there is no way
   * to know which one without watching it happen — the alternative is a person
   * opening devtools and comparing two screenshots.
   *
   * What it learns:
   *   · the class that marks the CHOSEN day
   *   · the class on days that cannot be chosen, which are the ones that did
   *     not respond
   *   · whether choosing writes into a field, and which field
   *
   * A day is a safe thing to press — it chooses a date, it does not buy
   * anything — and the net is armed around it, so a page that fetches prices on
   * a date change gets a rejected promise rather than a request.
   *
   * WHAT IT LEAVES BEHIND: a date chosen, when nothing was chosen before. The
   * previously selected day is put back when there WAS one, which is the common
   * case on a booking form; when there was none, that is reported rather than
   * faked, because clearing it would mean guessing at the page's own idea of
   * empty.
   */
  async function probeCalendar(grid, opts) {
    opts = opts || {};
    var settle = opts.settle == null ? 200 : opts.settle;
    var days = [];
    try {
      days = Array.prototype.slice.call(grid.querySelectorAll('td,li,button,a,div,span'))
        .filter(function (el) {
          return /^([1-9]|[12][0-9]|3[01])$/.test((el.textContent || '').trim()) &&
                 !el.querySelector('*');
        });
    } catch (e) {}
    if (days.length < 20) return null;

    var wasSelected = days.filter(function (el) {
      return /select|active|chosen|current|today/i.test(el.className || '') ||
             el.getAttribute('aria-selected') === 'true';
    });

    // Somewhere in the middle: the first of the month is often greyed out as
    // part of the previous one, and the last few belong to the next.
    var pick = null;
    for (var i = Math.floor(days.length / 2); i < days.length; i++) {
      if (wasSelected.indexOf(days[i]) !== -1) continue;
      if (days[i].disabled || days[i].getAttribute('aria-disabled') === 'true') continue;
      pick = days[i];
      break;
    }
    if (!pick) return null;

    var scope = opts.scope || grid;
    var els = watched(scope, opts.limit);
    var classBefore = classesOf(els);
    var fieldsBefore = fieldValues(scope);

    try { pick.click(); } catch (e) { return null; }
    await raf();
    if (settle) await wait(settle);

    var classAfter = classesOf(els);
    var delta = classDelta(classBefore, classAfter, pick);
    var selectedClass = delta && delta.added.length ? delta.added[0] : null;

    // Which field the date landed in, if any.
    var wroteInto = null, wroteValue = null;
    fieldValues(scope).forEach(function (now, el) {
      if (wroteInto) return;
      if (fieldsBefore.get(el) !== now && now) { wroteInto = el; wroteValue = now; }
    });

    // The days that could not be chosen, named the way the page names them.
    var disabled = days.filter(function (el) {
      return el.disabled || el.getAttribute('aria-disabled') === 'true' ||
             /disabled|muted|other-month|outside/i.test(el.className || '');
    });

    // Put the previous choice back when there was one.
    var restored = false;
    if (wasSelected.length) {
      try { wasSelected[0].click(); } catch (e) {}
      await raf();
      if (settle) await wait(settle);
      restored = true;
    }

    return {
      day: pick,
      selectedClass: selectedClass,
      selectedWas: wasSelected.length ? wasSelected[0] : null,
      disabled: disabled,
      wroteInto: wroteInto,
      wroteValue: wroteValue,
      restored: restored,
      leftADateChosen: !restored,
    };
  }

  /**
   * Tick it, read BOTH states, untick it.
   *
   * A checkbox mapping requires `checkedState` AND `uncheckedState` — two
   * selectors, and U1 will not maintain the announced state without both. They
   * are classes the page swaps, and one press hands over both at once: what was
   * ADDED is the state it went to, what was REMOVED is the state it came from.
   *
   * Without this a person opens devtools, ticks the box, and compares two class
   * attributes by eye. Getting it backwards is silent and specific: the control
   * then announces the opposite of what it is, every time.
   *
   * A radio cannot untick itself, so the one that WAS chosen is pressed back,
   * the same way the calendar puts a date back.
   */
  async function probeToggle(el, opts) {
    opts = opts || {};
    var settle = opts.settle == null ? 120 : opts.settle;
    if (!el || el.nodeType !== 1) return null;

    var safe = safeToClick(el);
    if (!safe.ok) return { skipped: true, why: safe.why };

    var wasOn = isOn(el);
    var scope = opts.scope || el.parentElement || doc.body;

    // A radio's group, so the previous choice can be put back.
    var groupWas = null;
    try {
      var group = Array.prototype.slice.call(scope.querySelectorAll('[role="radio"],input[type="radio"]'));
      if (group.indexOf(el) !== -1) {
        for (var i = 0; i < group.length; i++) if (group[i] !== el && isOn(group[i])) groupWas = group[i];
      }
    } catch (e) {}

    var els = [el];
    var classBefore = classesOf(els);

    try { el.click(); } catch (e) { return null; }
    await raf();
    if (settle) await wait(settle);

    var nowOn = isOn(el);
    var delta = classDelta(classBefore, classesOf(els), el);
    var added = (delta && delta.added) || [];
    var removed = (delta && delta.removed) || [];

    // Which way it went decides which list is which. Read from the state rather
    // than assumed from the press: a page that was already ticked gives the
    // lists the other way round, and assuming "added means checked" is exactly
    // the mistake that makes a control announce backwards.
    var checkedClasses = nowOn ? added : removed;
    var uncheckedClasses = nowOn ? removed : added;

    // Put it back.
    var restored = false;
    try {
      if (groupWas) { groupWas.click(); restored = true; }
      else if (nowOn !== wasOn) { el.click(); restored = isOn(el) === wasOn; }
      else restored = true;
    } catch (e) {}
    await raf();
    if (settle) await wait(settle);

    // The real control hiding inside a styled one — `exclude` exists so it does
    // not take focus of its own beside the thing standing in for it.
    var hidden = null;
    try {
      var inner = el.querySelector('input[type="checkbox"],input[type="radio"]');
      if (inner && !shown(inner)) hidden = inner;
    } catch (e) {}

    // A page can say "off" by having a class, or by NOT having one. The second
    // is very common — `class="opt"` becomes `class="opt opt--on"` — and it
    // matters more than it looks: U1 wants a selector for each state, and there
    // is no U1-valid selector for the absence of a class. `:not()` is a
    // pseudo-class and the engine rejects it.
    //
    // So this is reported as its own fact rather than as an empty field. An
    // empty field reads as "nobody filled this in"; this is "there is nothing
    // to fill it in WITH", which is a different conversation and one somebody
    // has to have with the site's developers.
    var byAbsence = !!checkedClasses.length && !uncheckedClasses.length;

    return {
      skipped: false,
      wasOn: wasOn,
      toggled: nowOn !== wasOn,
      checkedClass: checkedClasses[0] || null,
      uncheckedClass: uncheckedClasses[0] || null,
      saysOffByAbsence: byAbsence,
      hiddenInput: hidden,
      restored: restored,
    };
  }

  /** Is this control currently on, however the page says so? */
  function isOn(el) {
    try {
      if (typeof el.checked === 'boolean') return el.checked;
      var a = el.getAttribute('aria-checked');
      if (a != null) return a === 'true';
      return /(^|[^a-z])(checked|selected|active|on)([^a-z]|$)/i.test(el.className || '');
    } catch (e) { return false; }
  }

  /** What every field in a scope currently holds. */
  function fieldValues(scope) {
    var out = new Map();
    var fields;
    try { fields = scope.querySelectorAll('input,select,textarea'); } catch (e) { return out; }
    for (var i = 0; i < fields.length && i < 60; i++) {
      out.set(fields[i], fields[i].value == null ? '' : String(fields[i].value));
    }
    return out;
  }

  /**
   * Hover over it, and see what appears.
   *
   * The whole behavioural layer PRESSES, so anything that opens on hover was
   * invisible to it: tooltips, and the very common nav whose drop-downs open on
   * mouseover and do nothing at all when clicked. Such a menu came back as a
   * flat row of links with no submenus, and the three fields that exist to
   * describe exactly this — openByMouseover, openByMouseenter, openByFocus —
   * sat empty, because nothing has ever measured which event it is. The tool's
   * own note beside them says it: "whether that is HOVER or a click cannot be
   * told from the markup".
   *
   * Safer than everything else in this file by a wide margin. Hovering
   * activates nothing, sends nothing and changes no state — there is no
   * blocklist case, because there is no button a pointer can ruin by passing
   * over it.
   *
   * Each event is tried SEPARATELY, because the answer is which one to write in
   * the mapping. Firing all three and reporting "it opens on hover" would leave
   * the same guess the field already has.
   */
  async function probeHover(el, opts) {
    opts = opts || {};
    var settle = opts.settle == null ? 120 : opts.settle;
    if (!el || el.nodeType !== 1) return null;

    var scope = opts.scope || el.closest('li,div,nav,section') || doc.body;
    var els = watched(scope, opts.limit);

    var send = function (name, Ctor) {
      try { el.dispatchEvent(new root[Ctor](name, { bubbles: true })); } catch (e) {
        try { el.dispatchEvent(new root.Event(name, { bubbles: true })); } catch (e2) {}
      }
    };
    var away = function () {
      send('mouseleave', 'MouseEvent');
      send('mouseout', 'MouseEvent');
      try { el.blur(); } catch (e) {}
    };

    var attempts = [
      { field: 'openByMouseover', fire: function () { send('mouseover', 'MouseEvent'); } },
      { field: 'openByMouseenter', fire: function () { send('mouseenter', 'MouseEvent'); } },
      { field: 'openByFocus', fire: function () { try { el.focus(); } catch (e) {} send('focus', 'FocusEvent'); } },
    ];

    for (var i = 0; i < attempts.length; i++) {
      var before = fingerprint(els);
      attempts[i].fire();
      await raf();
      if (settle) await wait(settle);
      var appeared = outermost(diff(before, fingerprint(els)).appeared);

      away();
      await raf();
      if (settle) await wait(settle);

      if (appeared.length) {
        return {
          opensOn: attempts[i].field,
          revealed: appeared,
          restored: same(before, fingerprint(els)),
        };
      }
    }
    return { opensOn: null, revealed: [], restored: true };
  }

  /** How many children each list-shaped element is showing right now. */
  function listCounts(scope) {
    var out = new Map();
    var lists;
    try {
      lists = scope.querySelectorAll('ul,ol,tbody,[role="listbox"],[class*="result" i],[class*="list" i]');
    } catch (e) { return out; }
    for (var i = 0; i < lists.length && i < 60; i++) {
      var kids = Array.prototype.slice.call(lists[i].children).filter(function (c) {
        return c.nodeType === 1 && shown(c);
      });
      out.set(lists[i], kids.length);
    }
    return out;
  }

  /**
   * Press everything worth pressing inside `scope`, and say what is there.
   *
   * The net is armed for the whole run and disarmed in `finally`, so an
   * exception halfway through cannot leave a page that refuses to navigate.
   */
  async function probeAll(scope, opts) {
    opts = opts || {};
    scope = scope || doc.body;
    var net = armNet();
    var results = [], pressed = [], skipped = 0, comps = [];
    // The state to come back to, taken once for the whole run. Restoring after
    // each individual press is not possible for a tab strip — pressing a tab a
    // second time re-selects it, it does not undo it — and treating that as a
    // failure aborted the run at the first tab and left the strip undiscovered.
    var wholeScope = watched(scope, opts.limit);
    var start = fingerprint(wholeScope);
    try {
      var list, planMissing = 0, usedPlan = false;
      if (opts.sectionY && runPlan) {
        // F-lite: this section's candidates are the ones whose SNAPSHOT Y
        // fell in its band, whatever their live rects say now. Gates that
        // are about the moment of pressing — still here, still safe — are
        // re-checked; membership is not re-litigated.
        usedPlan = true;
        list = [];
        for (var pi = 0; pi < runPlan.length; pi++) {
          var pe = runPlan[pi];
          if (pe.docY < opts.sectionY.from || pe.docY >= opts.sectionY.to) continue;
          if (!pe.el.isConnected) { planMissing++; continue; }
          if (!opts.repeat && everPressed.has(pe.el)) continue;
          if (!shown(pe.el) || !safeToClick(pe.el).ok) continue;
          if (list.length >= (opts.max || 40)) break;
          list.push(pe.el);
        }
        // Arrivals since the snapshot — a panel a press just built — are
        // measured and assigned at run time, as before.
        var fresh = pressable(scope, opts);
        for (var fi2 = 0; fi2 < fresh.length && list.length < (opts.max || 40); fi2++) {
          if (runPlanKnown.has(fresh[fi2]) || list.indexOf(fresh[fi2]) !== -1) continue;
          list.push(fresh[fi2]);
        }
      } else {
        list = pressable(scope, opts);
      }
      // Decision A: pressing ONE member of a family of pressable siblings
      // (family through the stage-4.7 climb — ul>li>button IS siblings)
      // pulls the rest into this section's list, past the budget if need
      // be, capped at +8. Without this the finder's strip got the last two
      // slots at its only viewport window, the first was the selected
      // no-op, and no run-level pass can merge presses that never happened.
      var PRESS_VOCAB = 'button,[role="button"],[role="tab"],[aria-expanded],[aria-haspopup],summary,[tabindex]';
      var inList = new Set(list);
      var familyDone = new Set();
      var familyOverflow = 0;
      var familyOf = function (el) {
        var anchor = stripAnchor(el);
        var par = anchor.parentElement;
        if (!par || par === doc.body || par === doc.documentElement) return null;
        var members = [];
        for (var ci = 0; ci < par.children.length; ci++) {
          var sib = par.children[ci];
          var m = null;
          try {
            m = sib.matches(PRESS_VOCAB) ? sib : sib.querySelector(PRESS_VOCAB);
          } catch (e) { m = null; }
          if (m) members.push(m);
        }
        return members.length >= 2 ? { parent: par, members: members } : null;
      };
      var finishFamily = function (justPressed) {
        var fam = familyOf(justPressed);
        if (!fam || familyDone.has(fam.parent)) return;
        familyDone.add(fam.parent);
        for (var fi = 0; fi < fam.members.length; fi++) {
          var mem = fam.members[fi];
          if (mem === justPressed || inList.has(mem)) continue;
          // Out of the viewport is fine — the whole point is reaching the
          // siblings the window has moved past. Hidden or unsafe is not.
          if (everPressed.has(mem) || !shown(mem) || !safeToClick(mem).ok) continue;
          var beyond = list.length >= (opts.max || 40);
          if (beyond && familyOverflow >= 8) break;
          if (beyond) familyOverflow++;
          list.push(mem); inList.add(mem);
        }
      };
      for (var i = 0; i < list.length; i++) {
        // Each press is measured in its own neighbourhood, not across the whole
        // page — see localScope. The run-wide restore check below still uses
        // the full scope, because that is a guarantee about the page.
        var near = localScope(list[i], scope, opts.near);
        // A planned candidate whose live rect has left the viewport is still
        // this section's to press — that is the whole point of the snapshot.
        // Centre it first so the press happens against a settled layout.
        if (usedPlan) {
          try {
            var lr = list[i].getBoundingClientRect();
            var vhP = root.innerHeight || 768;
            if (lr.bottom <= 0 || lr.top >= vhP) {
              list[i].scrollIntoView({ block: 'center' });
              await raf();
              if (opts.settle) await wait(opts.settle);
            }
          } catch (e) {}
        }
        // Which press tried to LEAVE. The net counts what it stops; growth
        // across one press pins the attempt on that press, and a press that
        // navigated is not a press that revealed something.
        var navBefore = net.blocked.length;
        var r = await probeOne(list[i], { scope: near, settle: opts.settle, limit: opts.limit });
        r.navigated = net.blocked.length > navBefore;
        if (r.skipped) { skipped++; continue; }
        everPressed.add(list[i]);
        pressed.push(list[i]);
        runPressed.push(list[i]);
        finishFamily(list[i]);
        if (r.opened.length || r.moved.length || r.rerendered.length) {
          var entry = { trigger: list[i], opened: r.opened, closed: r.closed,
                        moved: r.moved, rerendered: r.rerendered,
                        stateClass: r.stateClass,
                        focusEntered: r.focusEntered, overlay: r.overlay,
                        floating: r.floating, navigated: r.navigated,
                        headerDropdown: r.headerDropdown,
                        hidOthers: r.hidOthers, scrollLocked: r.scrollLocked,
                        backdrop: r.backdrop, activeInside: r.activeInside };
          results.push(entry);
          runResults.push(entry);
        }
      }

      // Put the whole scope back.
      //
      // Only a STRIP needs this. A toggle was already closed by probeOne —
      // pressing it a second time is what closed it — so pressing the first
      // trigger of every group re-OPENED every menu and accordion on the page,
      // which is the exact opposite of restoring. Classify first, then press
      // back only the thing that cannot undo itself.
      // CONCAT, not assign. Twice now something pushed onto `comps` before this
      // line was silently thrown away by it — the idle watch's carousel, then
      // the self-opening dialog — each time looking exactly like "the detection
      // does not work", each time costing a debugging session. Appending
      // removes the trap rather than remembering to avoid it.
      comps = comps.concat(classify(results, pressed));

      // Something that put ITSELF over the page: a coupon, a cookie notice, a
      // newsletter box that waits five seconds. Nobody pressed anything, so
      // pressing can never find it. Decided that these are dialogs like any
      // other, and they are the ones a person is most likely to be trapped by.
      //
      // Compared against the state at the START OF THE RUN, not against the
      // start of the idle window. A watch that only sees what appears after it
      // begins misses anything that arrived while the pressing was going on —
      // which on a page whose coupon fires at three seconds is most of the
      // time. Found by a test where the coupon appeared 60ms in and the watch,
      // starting later, reported an empty page with complete confidence.
      var opened = [];
      results.forEach(function (r) { opened = opened.concat(r.opened); });
      var uninvited = outermost(diff(start, fingerprint(wholeScope)).appeared)
        .filter(function (el) { return opened.indexOf(el) === -1 && isOverlay(el); });
      uninvited.forEach(function (el) {
        var selfComp = {
          type: 'dialog',
          root: el,
          parts: { panel: [el] },
          openedItself: true,
          why: 'it put itself over the page with nobody touching anything',
        };
        comps.push(selfComp);
        // Not a press, so not in the ledger — carried to the run pass apart.
        runExtras.push(selfComp);
      });



      // What moves on its own. Done AFTER pressing, so a panel this run opened
      // is closed again and cannot be mistaken for something that moved by
      // itself — and so the cost is only paid on a section worth reading.
      var idle = await watchIdle(scope, opts.idle == null ? 2000 : opts.idle, opts.limit);
      if (idle) {
        var run = siblingRun(idle.moved, pressed, idle.moved.concat(idle.gone || []));
        if (run) {
          var already = comps.some(function (c) {
            return c.parts && c.parts.slide && c.parts.slide.indexOf(run.items[0]) !== -1;
          });
          if (already) {
            // A carousel already found by its arrows. Say that it also moves on
            // its own, which is the part with a WCAG requirement attached.
            comps.forEach(function (c) {
              if (c.type !== 'carousel') return;
              c.autoAdvances = true;
              c.why += ', and it advances on its own';
            });
          } else {
            var idleComp = {
              type: 'carousel',
              root: run.parent.parentElement || run.parent,
              parts: { slide: run.items },
              autoAdvances: true,
              why: 'it changed which of ' + run.items.length +
                   ' items is showing with nobody touching it',
            };
            comps.push(idleComp);
            // Not a press, so not in the ledger — carried to the run pass apart.
            runExtras.push(idleComp);
          }
        }
      }

      if (!same(start, fingerprint(wholeScope))) {
        for (var g = 0; g < comps.length; g++) {
          if (comps[g].shape !== 'strip') continue;
          try { comps[g].parts.items[0].click(); } catch (e) {}
        }
        await raf();
        if (!same(start, fingerprint(wholeScope))) {
          try {
            doc.dispatchEvent(new root.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          } catch (e) {}
          await raf();
        }
      }
    } finally {
      net.disarm();
    }
    var restored = same(start, fingerprint(wholeScope));
    return { components: comps, pressed: pressed.length, skipped: skipped,
             restored: restored, blocked: net.blocked.slice(),
             planMissing: planMissing };
  }

  root.__u1Probe = {
    safeToClick: safeToClick,
    fingerprint: fingerprint,
    diff: diff,
    outermost: outermost,
    probeOne: probeOne,
    probeAll: probeAll,
    pressable: pressable,
    classify: classify,
    classifyRun: classifyRun,
    resetRun: resetRun,
    planRun: planRun,
    planSnapshot: function () {
      return (runPlan || []).map(function (p) {
        return { docY: Math.round(p.docY), rank: p.rank, seeded: p.seeded,
                 id: p.el.id || '',
                 cls: String(p.el.className || '').split(' ')[0] || p.el.tagName };
      });
    },
    probeForm: probeForm,
    probeTyping: probeTyping,
    probeCalendar: probeCalendar,
    probeToggle: probeToggle,
    probeHover: probeHover,
    armNet: armNet,
    DANGER: DANGER,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
